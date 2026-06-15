# Phase 4 — LLM polish (Plan E)

## Goal

Use an LLM to handle the layouts that heuristics cannot reliably parse:
- ASCII art portraits (8.1.1).
- Town summaries with non-standard formatting (16.5).
- Any `<!-- MODERNIZE:unknown -->` blocks that survive Phase 2–3.
- Low-confidence blocks (score <30) that fall through all extractors.

## Design

### Script: `scripts/llm-reformat.js`

A new optional CLI step that can be inserted between conversion and splitting:

```bash
node scripts/convert.js "url" walkthrough.md
node scripts/llm-reformat.js walkthrough.md walkthrough.polished.md   # optional
node scripts/split-guide.js walkthrough.polished.md guide/
```

It:
1. Reads a markdown file.
2. Scans for tagged blocks: `<!-- MIXED -->`, `<!-- MODERNIZE:unknown -->`,
   and any block that the Phase 3 IR marked with `confidence < 30`.
3. For each block, sends the raw text to the LLM with a type-specific prompt.
4. Validates the LLM response:
   - Must be valid markdown (no broken pipe tables, etc.).
   - Must not exceed the original block size by more than 5× (prevents
     hallucinated content).
   - Must preserve section anchor IDs and heading structure.
5. Replaces the block in the file.
6. Logs cost, tokens used, and blocks handled.

### Prompt templates

Stored in `lib/llm-prompts/`:

```
lib/llm-prompts/
├── boss.txt             # Convert this ASCII boss card to a markdown blockquote or table
├── character.txt        # Convert this character sheet to a markdown table or definition list
├── equipment.txt        # Convert this equipment table to markdown (table or list)
├── shop.txt             # Convert this shop listing to markdown (table or grouped list)
└── unknown.txt          # Determine what this block represents and format appropriately
```

Each prompt instructs the LLM to:
- Choose between table, list, or blockquote based on the content.
- Preserve all numeric data, names, and prices exactly.
- Return **only the markdown** (no explanations, no commentary).
- Prefix response with `<!-- LLM-GENERATED -->` for traceability.

### Provider integration

Reuse the model configured in `.opencode/opencode.json`:

```json
{
  "agent": {
    "llm-reformat": {
      "model": "deepseek/deepseek-v4-pro",
      "temperature": 0.1
    }
  }
}
```

If no API key is available, the script exits gracefully with:
```
No LLM provider configured. Skipping LLM polish.
```

## Files to change

### New files

1. `scripts/llm-reformat.js` — main CLI script.
2. `lib/llm.js` — provider abstraction:
   ```js
   function complete(prompt, options) // returns generated text
   ```
   - Reads provider from environment or `.opencode/opencode.json`.
   - Supports `deepseek` (default) or `anthropic` (fallback).
   - Handles API errors and rate limits.
3. `lib/validate-llm-output.js` — validates LLM responses:
   - Must be valid markdown (no raw JSON, no explanations).
   - Must not introduce unknown section IDs.
   - Must not drop more than 10% of words from the original.
4. `lib/llm-prompts/*.txt` — one prompt template per block type.

### Changes to existing files

5. `lib/reformat/index.js` — no changes (LLM is a separate post-processing step).
6. `skills/SKILL.md` — add an "LLM polish" subsection:
   ```markdown
   ### LLM polish (optional)
   After conversion, run `node scripts/llm-reformat.js walkthrough.md`
   to clean up blocks that the rule-based formatter could not handle.
   ```
7. `package.json` — add script (optional):
   ```json
   "polish": "node scripts/llm-reformat.js"
   ```
8. `.opencode/opencode.json` — add `llm-reformat` agent profile.

## New test fixtures

| Test | Input | Expected |
|---|---|---|
| `llmValidate: valid response` | Valid markdown output | `passes: true` |
| `llmValidate: contains explanation` | Output with "This is a table" | `passes: false` |
| `llmValidate: too much content` | 10× original size | `passes: false` |
| `llmValidate: valid but different style` | List instead of table | `passes: true` (style is allowed) |
| `llm: no provider configured` | No API key | Graceful skip |

## Acceptance criteria

1. Running `node scripts/llm-reformat.js walkthrough.md` does not fail.
2. If no API key is available, it exits gracefully with a message.
3. If an API key is available:
   - `<!-- MODERNIZE:unknown -->` blocks are either removed or replaced with
     structured markdown.
   - Low-confidence tables are cleaned up.
4. The script validates LLM output and never writes malformed markdown.
5. Cost is logged per run (`Used N tokens for M blocks, cost $0.XX`).

## How to verify

```bash
# With API key
node scripts/llm-reformat.js walkthrough.md walkthrough.polished.md
diff walkthrough.md walkthrough.polished.md

# Without API key
OPENCODE_API_KEY="" node scripts/llm-reformat.js walkthrough.md
# → "No LLM provider configured. Skipping LLM polish."

npm test
```
