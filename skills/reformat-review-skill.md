---
name: reformat-review
description: "Use when the user asks to review and fix a reformatted walkthrough for mobile readability. Trigger keywords: reformat, review, fix formatting, check tables, cleanup, polish."
---

# reformat-review — Review and Fix Walkthrough Markdown

Reviews a reformatted walkthrough markdown file and fixes edge cases the
automated `scripts/reformat.js` script missed. Runs as a sanity check pass
per-walkthrough, not per-script-run.

## When to use

After running the converter and reformatter:

```bash
node scripts/convert.js "<gamefaqs-url>" walkthrough.md
node scripts/split-guide.js walkthrough.md guide/
```

Then in opencode:

```
"Run reformat-review on walkthrough.md"
"Run reformat-review on guide/"
"Check tables only in walkthrough.md"
```

---

## Instructions for the agent

Read the specified file or directory. Then run these four scans in order.
Do NOT modify the file until you have completed all scans. After fixing,
print a summary report.

### Scan 1: Code blocks that should be tables

The reformatter sometimes misclassifies equipment tables as ASCII art,
wrapping them in ``` code blocks.

Find every ``` code block. For each block:

1. Do at least 2 lines contain `|` characters?
2. Are pipe positions consistent across those lines (same number of `|`)?
3. Do the cells between pipes contain mostly words (at least 50% of
   non-empty cells have 2+ consecutive letters)?

If **all three** are true: the block is a table. Extract it, rebuild as a
markdown pipe table, and replace the code block.

A cell has "word content" if `/[a-zA-Z]{2,}/` matches. Cells containing
only symbols (`¯`, `_`, `-`, `/`, `\`, spaces) do NOT count as words.

### Scan 2: Pipe tables that should be code blocks

The converse — some ASCII layouts (maps, menu representations) happen to
have consistent pipe counts but are visually decorative, not tabular data.

Find every markdown pipe table (a line starting with `|` followed by
a separator line `|---|---|`). For each table:

1. Count "word cells" (cells with 2+ consecutive letters) and "symbol
   cells" (cells containing only symbols and numbers without letters).
2. If at least 50% of non-empty cells are symbol-only: the table is
   actually ASCII art. Rewrap as a ``` code block.

A cell is "symbol-only" if it has zero letters. Numbers, dots, and
special chars without letters count as symbol-only.

### Scan 3: Stat blocks still in prose

`reformat.js` requires 40% of lines to match `Key: Value` to trigger
the stat-block formatter. Some mixed blocks narrowly miss the threshold,
leaving stat lines as plain text in paragraphs.

Scan the entire document for lines matching the pattern:
`/^\w[\w\s]+\s*:\s*\w+/` (a key followed by a colon followed by a value).

For each match that is NOT already formatted as `**Key:** Value`:

- Is the key short (1-5 words before the colon)?
- Is it NOT part of a full sentence (no following clause with verbs)?
- Is the line embedded in a prose paragraph rather than in a code block?

If all three: extract the line from the paragraph, split on the first
colon, format as `**Key:** Value`, and place as a standalone line before
the paragraph.

Skip lines that are clearly prose sentences (e.g., "The elder explains:").

### Scan 4: Broken tables

`formatTable` can produce misaligned tables when the original content has
varying pipe counts or merged cells. The agent can identify these.

For each markdown pipe table, verify structural consistency:

1. Count columns in the separator row (number of `---` segments).
2. For each data row, count columns. If any row has a different count
   from the separator, the table is broken.
3. If the original code block is nearby (identified in Scan 1), use it
   to rebuild the table correctly. If unavailable, flag it for manual fix.

### Scan 5: Bullet lists in prose

Walkthrough sections often contain discrete step-by-step instructions
that read better as bullet lists than as dense paragraphs.

Find sequences of 3+ consecutive sentences where each starts with a
walkthrough action verb (Go, Head, Walk, Take, Enter, Leave, Use,
Follow, Continue, Turn, Collect, Pick up, Open, Search, Return, etc.).

For each sequence:
- Format as a markdown unordered list (`- sentence`) or numbered list
  (`1. sentence`) if the original text uses sequential numbering.
- Keep descriptive paragraphs (non-action sentences) as-is — do NOT
  force them into lists.
- Leave at least one blank line between the list and surrounding
  paragraphs.
- A sequence must have at least 3 action-verb sentences to qualify.
  Fewer than 3 is not a list — it's just instruction prose.

### After all scans

Print a summary report:

```
reformat-review complete
  Scan 1 (code blocks → tables):  N fixed
  Scan 2 (tables → code blocks):  N fixed
  Scan 3 (stat blocks in prose):  N fixed
  Scan 4 (broken tables):         N fixed (M flagged for manual)
  Scan 5 (bullet lists):          N sequences formatted
  ────────────────────────────
  Total: N issues handled
```

If no issues in a scan, print `0 fixed`.

---

## Edge cases

- **File not found**: print `File not found: <path>` and exit.
- **No markdown content**: print `No markdown content detected` and exit.
- **Broken table can't be fixed**: leave as-is, flag in the summary.
- **Directory input**: process all `.md` files in the directory.
- **Section filter**: if the user specifies a section range (e.g.,
  "check sections 6.1-6.4"), only process matching files or content.
- **Overlapping fixes**: if Scans 1 and 2 disagree about a block (both
  claim it), trust the agent's judgment — tables with mostly-word cells
  stay as tables. Art with mostly-symbol cells goes to code blocks.
