# Phase 2 — Safety net (Plan B + C)

## Goal

Guarantee that **every** complex layout degrades to clean, readable markdown
instead of broken tables or malformed ASCII. Adds semantic extractors for
common block types and confidence-based routing: high-confidence blocks get
tables, low-confidence blocks get bullet lists.

This phase builds on Phase 1 and can replace or wrap its equipment/shop
handlers with more structured extractors.

## Problem inventory

All problems from Phase 1 remain targets, plus:

### P6. Character sheet tables (8.1.1, 9.0)

**Current output:**
```markdown
| Joins Party: At start | Starting Level:  1 | Initial Stats |  |
| --- | --- | --- | --- |
| -------------------+----------------+------------------- |  |  |  |
| Initial Equipment | Initial Techniques: RES | HP    -    25 |  |
```

**Root cause:** The original layout uses `+` instead of `|`, mixed with code
block syntax. The current detector only looks for `|` pipes.

**Fix:** Add a character-sheet extractor that recognises the `+` grid syntax.

### P7. ASCII art portraits mislabelled as MODERNIZE:unknown (8.1.1)

The ASCII art portrait of Chaz is tagged `<!-- MODERNIZE:unknown -->` and
rendered as a code block. The `art-modernize` skill cannot interpret it.

**Fix:** Phase 2 does not attempt to render portraits. It adds a confidence
check: if the block is clearly art and not any other type, keep the code block
but tag it correctly.

### P8. Town summary tables as prose (16.5)

**Current output:**
```
Tool Store #1 Tool Store #2 Tool Store #3 ---------------- ---------------- ---------------- MONOMATE 20 TELEPIPE 130 ANTIDOTE 10
```

**Root cause:** No pipes, no colour delimiters. The converter sees prose and
joins lines with spaces, destroying the columnar layout.

**Fix:** Add a town-summary extractor that detects fixed-width column layouts
by their header pattern (`------ -------` or repeated columns of `Name Price`).

## Architecture changes

### `lib/extract/` — new directory

Each extractor is a module that exports a `tryParse(lines)` function.

- Returns `null` if it cannot parse the block.
- Returns an object `{ schema, type, data }` on success.
- The `schema` field identifies the block type for rendering.

```
lib/extract/
├── index.js          # runAll(block) — tries each extractor, returns first match
├── equipment.js      # isEquipmentBlock logic → structured data
├── shop.js           # isShopBlock logic → { location, groups, stores }
├── boss.js           # boss card parser → { name, hp, exp, mst, levels, weaknesses }
├── character.js      # character sheet parser → { name, stats, equipment, skills }
└── town.js           # town summary parser → { location, stores }
```

### `lib/render/` — new directory

Each renderer takes a parsed object and returns markdown.

```
lib/render/
├── index.js          # render(schema, data) — dispatches to the right renderer
├── equipment.js      # equipConfig → table or list
├── shop.js           # shopConfig → grouped tables
├── boss.js           # bossData → blockquote with formatted stats
└── character.js      # characterData → definition list
```

### Confidence scoring

Add `scoreTableQuality(lines)` to `detect.js`:

| Criterion | Points |
|---|---|
| All non-decorative rows have the same pipe count | +30 |
| ≥70% of cells contain word content | +20 |
| No row is purely decorative symbols | +20 |
| Header row is detectable | +15 |
| No stray frame chars (`\`, `/`, `¯`) inside cells | +15 |

Routing logic:

| Score | Action |
|---|---|
| ≥80 | `formatTable()` — clean table |
| ≥50 | `formatTableAggressive()` — table with aggressive frame stripping |
| <50 | Semantic extractor → list formatter (or code block if no extractor matches) |

## Files to change

### New files

1. `lib/extract/index.js` — `tryExtractors(lines)`:
   ```js
   function tryExtractors(lines) {
     const extractors = [extractBoss, extractEquipment, extractShop, extractCharacter, extractTown];
     for (const fn of extractors) {
       const result = fn(lines);
       if (result) return result;
     }
     return null;
   }
   ```

2. `lib/extract/equipment.js` — extract equipment data.

3. `lib/extract/shop.js` — extract shop data.
   - Group by store heading.
   - Parse price and bonus from each cell using regex.

4. `lib/extract/boss.js` — extract boss data.
   - Recognise `BOSS #N`, name, HP, EXP, MST, recommended levels.
   - Handle both inline `HP: 300` and multi-line `HP: 300` layouts.

5. `lib/extract/character.js` — extract character sheet data.
   - Recognise `+` grid borders.
   - Parse initial stats, equipment, techniques, skills.
   - This is the most complex extractor; target the most common layout.

6. `lib/extract/town.js` — extract town summary data.
   - Detect fixed-width column patterns (groups of `Name Price` repeated).
   - Parse store listings even in the absence of pipes.

7. `lib/render/index.js` — `render(data) → string`:
   ```js
   function render(data) {
     if (data.type === 'equipment') return renderEquipment(data);
     if (data.type === 'shop') return renderShop(data);
     // ...
   }
   ```

8. `lib/render/equipment.js`, `lib/render/shop.js`, `lib/render/boss.js`,
   `lib/render/character.js` — each returns markdown.

### Changes to existing files

9. `lib/reformat/detect.js`:
   - Add `scoreTableQuality(lines)`.
   - Keep existing `isEquipmentBlock`, `isShopBlock` as quick pre-checks.

10. `lib/reformat/format.js`:
    - Add `formatTableAggressive(lines)` — table with frame stripping.
    - Add `formatListFromExtract(data)` — generic bullet list renderer
      for extracted data (fallback when a dedicated renderer is missing).

11. `lib/reformat/classify.js`:
    - In `formatMixed()`, after Phase 1's equipment/shop checks, add:
      ```js
      const extracted = tryExtractors(group.lines);
      if (extracted) return render(extracted);
      ```
    - Then fall through to confidence scoring / existing logic.

12. `lib/reformat/index.js`:
    - In `reformatBlock()`, replace the `isAsciiArtBlock` → `hasStat` check
      with the new extractor routing.
    - Confidence scoring integrated into the phase 2/3/4 decision flow.

## New test fixtures

| Test | Input | Expected | Source |
|---|---|---|---|
| `extractBoss: Igglanova` | Boss card raw lines | Parsed `{name, hp, exp, mst, levels}` | 6.1.2 |
| `extractBoss: Dark Force` | Multi-line boss card | Parsed `{name, hp, exp, mst, levels, weakness}` | 6.4.8 |
| `extractEquipment: 3 chars` | 6.1.1 Alys+Chaz+Hahn equip | Parsed `{slots, chars}` | 6.1.1 |
| `extractShop: Mile` | Mile shop raw lines | Parsed stores with items | 6.1.3 |
| `extractShop: Aiedo market` | Aiedo complex market | Parsed stores with items | 6.2.1 |
| `extractCharacter: Chaz` | 8.1.1 Chaz sheet | Parsed stats/equip/skills | 8.1.1 |
| `extractCharacter: Alys` | 9.0 Alys level table | Parsed level table rows | 9.0 |
| `extractTown: Aiedo summary` | 16.5 Aiedo block | Parsed stores | 16.5 |
| `confidence: cleanTable` | Consistent pipe table | Score ≥80 | generated |
| `confidence: messyTable` | Broken pipe block | Score <50 | 6.1.1 broken |
| `renderBoss: Igglanova` | Parsed boss data | Valid markdown | 6.1.2 |
| `renderEquipment: as list` | Parsed equip data | Bullet list | 6.1.1 |

## Acceptance criteria

1. `npm test` passes.
2. Regenerated PSIV walkthrough:
   - Boss cards (6.1.2, 6.4.8) are rendered as clean blockquotes or tables,
     not ASCII code blocks.
   - Equipment blocks are either valid tables or clean lists.
   - Shop blocks (6.1.3, 6.2.1) are rendered as tables or grouped lists.
   - Character sheet (8.1.1) is a valid table or definition list.
   - Level/EXP tables (9.0) are parsed into markdown tables.
   - Town summaries (16.5) have readable columnar layout.
3. Every `<!-- MIXED -->` block in the output is either a valid markdown table,
   a list, or a code block with correct `MODERNIZE:TYPE` tag.
4. No `<!-- MODERNIZE:unknown -->` blocks remain (they are either parsed by an
   extractor or rendered as-is but tagged correctly).

## Out of scope for Phase 2

- LLM integration (Phase 4).
- Pipeline orchestration (Phase 5).
- Unicode art portraits (8.1.1 portrait will remain a code block).

## How to verify

```bash
npm test

# Regenerate
node scripts/convert.js scripts/raw.txt walkthrough.md

# Check no unknown blocks remain
grep -c "MODERNIZE:unknown" walkthrough.md          # should be 0

# Check boss cards are no longer code blocks
grep -c "<!-- MODERNIZE:boss" walkthrough.md         # should be 0

# Spot-check key sections
node -e "console.log(require('fs').readFileSync('walkthrough.md','utf8').match(/### 6\.1\.2\. Cleaning the Cellar[\s\S]*?(?=###)/)[0])"
```
