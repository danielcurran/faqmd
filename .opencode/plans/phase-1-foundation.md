# Phase 1 — Foundation (Plan A)

## Goal

Fix the most visible PSIV formatting errors without changing the converter's
architecture. The existing block-detection pipeline stays the same; only the
heuristics and output formatting improve.

## Problem inventory (from PSIV review)

### P1. Equipment tables rendered as broken pipe fragments (6.1.1, 6.1.3, 6.4.8)

**Current output:**
```markdown
Starting          |   Chaz   |

**Equipment**

|Head |LTHR-HELM |
```

**Root cause:** `isTableBlock()` requires ≥50% of lines to contain `|`. Equipment
blocks have a label line (`**Equipment**`) and blank lines that lower the ratio.
The pipe-bearing lines are handled individually, producing fragments.

**Fix:** Detect equipment blocks before generic table detection, then emit either
a valid table or a bulleted list.

### P2. Shop tables with inconsistent columns (6.1.3 Mile, 6.2.1 Aiedo)

**Current output:**
```markdown
| Mile | Inn | Per person     10 MST \ |
| --- | --- | --- |
| Tool Store | MONOMATE       20 MST / |  |
```

**Root cause:** Decorative frame characters (`\`, `/`, `¯`) survive into cells.
Column counts vary because the original ASCII uses merged cells. Rows like
`__________|____________|_______________` are treated as data.

**Fix:** Strip frame chars from cells. Skip rows that are purely decorative
separators. Detect shop blocks semantically and render as grouped tables or lists.

### P3. One-line map fragments tagged as MODERNIZE:map (6.1.2, 6.1.4, 6.4.8)

**Current output:**
```
<!-- MODERNIZE:map -->

```
|/  Academy Basement       \_________________________________
```
```

**Root cause:** A single decorative line with a pipe is classified as `pipe`
group with one line, falls through to `formatAscii()`, and gets tagged as a map.

**Fix:** One-line pipe blocks that contain no data (no words, only decorative
chars) should be treated as decorative and stripped, not wrapped as ASCII art.

### P4. Excessive vertical whitespace (entire walkthrough)

**Current output:**
Between every paragraph there are 2–3 blank lines. Labels float disconnected
from their content.

**Root cause:** `formatProse()` adds `\n\n`. `reformat()` joins blocks with
`\n\n`. `splitSections()` normalizes `\n{3,}` to `\n\n`. Effect: 2–4 blank
lines between every paragraph.

**Fix:** Normalize whitespace as a post-processing pass after all other
formatting: collapse 3+ consecutive blank lines to exactly 1, and normalise
spacing around bold labels (`**DUNGEON #N**`, `**Boss: X**`).

### P5. Boss stat blocks as one-line prose (15.1.1, 15.2.2)

**Current output:**
```markdown
**Met:** Academy Basement           Recommended Level before fighting: · **HP:** 300
```

**Root cause:** These sections in the boss appendix use a different ASCII layout
than the walkthrough body. The stat formatter does not handle multi-column
alignment or stat labels mixed with prose.

**Fix:** TBD — best addressed in Phase 2 with semantic extractors.

## Files to change

### `lib/reformat/detect.js`

1. Add `isEquipmentBlock(lines)`:
   - True if any line matches equipment keywords (`Starting`, `Equipment`,
     `Recommended`, or slot labels `Head`, `Right`, `Left`, `Body`)
     followed by an uppercase word.
   - Also true if ≥2 consecutive lines match `^\s*(Head|Right|Left|Body)\s*\|`.

2. Add `isShopBlock(lines)`:
   - True if lines contain shop keywords (`Inn`, `Store`, `Shop`, `Guild`)
     and price patterns (`\d+\s*MST`).
   - True if ≥2 lines contain `\|.*\d{2,}\s*MST.*[\/\\]`.

3. Lower the `pipeLines / nonEmptyLines` threshold from 0.5 to 0.35 when
   equipment or shop keywords are present.

### `lib/reformat/format.js`

4. Rewrite `formatTable()`:
   - **Skip decorative rows:** rows where all content between pipes is
     `[+\-=¯\_\*]` are skipped entirely.
   - **Strip frame chars:** each cell is cleaned with
     `/^[\/\\¯\_\|\s]+|[\/\\¯\_\|\s]+$/g` before trimming.
   - **Detect header heuristically:** the first non-separator row with
     word content becomes the header; it gets a separator below it.
   - **Normalize column count:** pad short rows with empty strings; trim
     trailing empty columns from all rows.

5. Add `formatEquipmentTable(lines)`:
   - Parse slot rows.
   - If the block has multiple characters (pipes separated by `|`), render
     as a table with columns: `Slot`, `Char1`, `Char2`, …
   - If the block has only one character, render as a list:
     ```markdown
     **Equipment**
     - Head: LTHR-HELM
     - Right: HUNT-KNIFE
     ```
   - Fall back to list rendering if pipe counts are inconsistent.

6. Add `formatShopTable(lines)`:
   - Group rows by shop name (text before the first `|`).
   - Render each group as a separate table or list:
     ```markdown
     **Weapon Store**
     | Item | Price | Bonus |
     |---|---|---|
     | DAGGER | 40 MST | +2 ATK |
     ```
   - Or as a list if there are too many columns:
     ```markdown
     - **Weapon Store**
       - DAGGER — 40 MST (+2 ATK)
       - STEL-SWORD — 280 MST (+14 ATK, +2 DFS)
     ```

7. In `classifyArtBlock()`:
   - If the block is a single line with fewer than 2 word characters and
     mostly decorative symbols, return `false` instead of a type tag.

### `lib/reformat/classify.js`

8. In `formatMixed()`, add these checks **before** generic pipe-group routing:
   - If the group is `pipe` type:
     - Check `isEquipmentBlock` → route to `formatEquipmentTable`.
     - Check `isShopBlock` → route to `formatShopTable`.
   - Then fall through to existing `hasConsistentPipes` / `isAsciiArtBlock`.

### `lib/reformat/index.js`

9. Add a `postProcess(md)` function:
   - Collapse 3+ consecutive blank lines to exactly 1.
   - Ensure `**DUNGEON #N**` / `**Boss: X**` labels have exactly one blank
     line above and below (remove excessive spacing).
   - Strip trailing whitespace from every line.
   - Insert this call at the end of `reformat()`.

## New test fixtures

Add to `scripts/test.js`:

| Test | Input | Expected | Source |
|---|---|---|---|
| `equipmentTable: single character` | Lines from 6.1.1 Chaz starter equipment | Valid markdown table or list | 6.1.1 |
| `equipmentTable: multiple characters` | Lines from 6.1.1 Alys + Chaz equipment | Valid markdown table or list | 6.1.1 |
| `shopTable: Mile` | Mile shop lines | Valid grouped table or list | 6.1.3 |
| `shopTable: Aiedo` | Aiedo market lines | Valid grouped table or list | 6.2.1 |
| `whitespace: excessive blanks` | Multiple paragraphs with triple blank lines | Single blank line between paragraphs | any section |
| `singleLineAscii: decorative` | `\|/  Academy Basement  \\\___` | Empty string (stripped) | 6.1.2 |
| `decorativeRow: skipped in table` | Row `----------+----------+--------` | Row is excluded from output | 13.2.1 |
| `postProcess: dungeon labels` | Text with blank lines before `**DUNGEON #1**` | Single blank line above label | 6.1.2 |

## Acceptance criteria

1. `npm test` passes (all existing + new tests).
2. Regenerated PSIV walkthrough has:
   - **6.1.1:** Equipment tables are valid markdown tables or clean lists.
     No broken pipe fragments.
   - **6.1.2:** No one-line map fragment. Dungeon label has correct spacing.
   - **6.1.3:** Mile shop is readable — either a table or grouped list.
   - **6.2.1:** Aiedo shops are readable.
   - **13.2.1:** Weapon list has no decorative separator rows in output.
   - **Entire guide:** 3+ blank lines do not appear anywhere.
3. `reformat-review` skill can be reduced to a spot-check (it should find no
   broken tables or spacing issues).

## Out of scope for Phase 1

- Character portrait blocks (8.1.1).
- Level/EXP tables (9.0).
- Town summary tables (16.5).
- LLM integration.
- Pipeline orchestration.

These are better addressed in Phase 2+ when semantic extractors exist.

## How to verify

```bash
# 1. Run existing tests
npm test

# 2. Regenerate the PSIV walkthrough
node scripts/convert.js scripts/raw.txt walkthrough.md

# 3. Inspect the problem sections
grep -n "MODERNIZE:map" walkthrough.md       # should have zero single-line maps
grep -n "^\*\*DUNGEON" walkthrough.md        # check spacing around labels
grep -n "Starting          |" walkthrough.md  # should not exist (fixed table)
less walkthrough.md -N                        # visual sanity check around 6.1.1-6.2.1

# 4. Diff the old guide/ against the new one (if available)
diff -r /tmp/old-guide guide/                 # verify improvements, no regressions
```
