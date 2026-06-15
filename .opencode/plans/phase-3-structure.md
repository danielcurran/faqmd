# Phase 3 — Structured IR (Plan D)

## Goal

Refactor Phase 2's ad-hoc extraction into a canonical JSON intermediate
representation. Decouple "understanding the content" from "rendering markdown"
so that:
- Adding a new block type requires only a new extractor + renderer + schema.
- Changing the output style (e.g., tables → lists globally) is a renderer change,
  not a pipeline change.
- The IR can be validated, inspected, or transformed by other tools.

## Architecture

```
Raw lines → Extractor → JSON (schema-validated) → Renderer → Markdown
```

## Schema (`lib/schema.js`)

Define a type system for all recognised blocks:

```js
// Block types
const BLOCK_TYPES = {
  EQUIPMENT:  'equipment',
  SHOP:       'shop',
  BOSS:       'boss',
  CHARACTER:  'character',  // character sheet + level table
  MAP:        'map',         // town service map (e.g., Piata)
  STATBLOCK:  'statblock',   // pure key-value pairs
  TABLE:      'table',       // generic pipe table (confidence ≥80)
  ART:        'art',         // ASCII art (no extractor matched)
  PROSE:      'prose',       // continuous text
};
```

Each parsed block has the shape:

```js
{
  type: 'equipment',
  confidence: 85,          // 0–100
  source: 'extractor',     // 'extractor' | 'confidence-table' | 'fallback'
  data: { /* type-specific fields */ },
  meta: {
    rawLineCount: 8,
    hasFrame: false,
    // …
  }
}
```

Renderers take `block.data` and return a string. The `index.js` dispatcher
chooses the renderer based on `block.type` and `block.confidence`.

## Files to change

### New files

1. `lib/schema.js` — type constants, JSON schema validators, and a
   `validateBlock(block)` function that returns errors on malformed data.

2. `lib/render/index.js` — becomes a simple dispatcher:
   ```js
   function renderBlock(block) {
     switch (block.type) {
       case 'equipment': return renderEquipment(block.data);
       case 'shop':      return renderShop(block.data);
       case 'boss':      return renderBoss(block.data);
       case 'character': return renderCharacter(block.data);
       case 'statblock': return renderStatBlock(block.data);
       case 'table':     return renderTable(block.data);
       case 'art':       return renderArt(block.data);
       case 'prose':     return renderProse(block.data);
     }
   }
   ```

### Changes to existing files

3. `lib/extract/*.js` — each extractor now returns the schema object
   instead of ad-hoc JSON. Update to include `type`, `confidence`, `source`.

4. `lib/render/equipment.js`, `lib/render/shop.js`, `lib/render/boss.js`,
   `lib/render/character.js` — accept `block.data` and return markdown.
   No longer need to interpret type.

5. `lib/reformat/format.js` — existing formatters (formatProse, formatTable,
   formatStatBlock, etc.) are wrapped as renderers for blocks with
   `source: 'confidence-table'` or `source: 'fallback'`.

6. `lib/reformat/index.js` — `reformatBlock(lines)` becomes a thin function:
   ```js
   function reformatBlock(lines) {
     const extracted = tryExtractors(lines);
     if (extracted) {
       const validated = validateBlock(extracted);
       if (validated.errors.length > 0) {
         return fallbackRender(lines); // warn and fall through to old code
       }
       return renderBlock(validated);
     }
     return fallbackRender(lines); // Phase 1/2 fallback
   }
   ```

7. `lib/reformat/detect.js` — no change (kept as fallback).

## Non-goals

- This phase does **not** change the visual output of Phase 2. Its purpose is
  architectural. Visual improvements should be made in Phase 2 and refined in Phase 4.

## New test fixtures

| Test | Description |
|---|---|
| `schema: validates equipment block` | Valid IR passes; missing fields fail |
| `schema: rejects unknown type` | `type: 'foo'` fails |
| `extractors return schema` | All extractors return valid matched blocks |
| `renderer: renderProse` | Prose block → expected markdown |None|
| `renderer: renderArt` | Art block → code block with `MODERNIZE` tag None|

## Acceptance criteria

1. `npm test` passes.
2. Visual output of `node scripts/convert.js scripts/raw.txt walkthrough.md` is
   **identical** to Phase 2 output (use `diff` to verify).
3. `validateBlock()` catches at least 3 types of malformed data.
4. Adding a new block type requires changes to only 3 files:
   - `lib/extract/new.js` (extractor)
   - `lib/render/new.js` (renderer)
   - `lib/schema.js` (type constant and validator)

## How to verify

```bash
# Visual regression: compare against Phase 2 output
git stash && node scripts/convert.js scripts/raw.txt phase2.md && git stash pop
node scripts/convert.js scripts/raw.txt phase3.md
diff phase2.md phase3.md   # should be identical

# Schema validation
node -e "
  const { validateBlock, BLOCK_TYPES } = require('./lib/schema');
  console.log(validateBlock({type: 'equipment', data: {}}));
  console.log(validateBlock({type: 'foo', data: {}}));
"

npm test
```
