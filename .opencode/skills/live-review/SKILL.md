---
name: live-review
description: "Use when the user asks to review a walkthrough as it renders on gamemds.org for final polish and quality. Trigger keywords: live-review, site-qa, gamemds review, final check, polish live, verify guide."
---

# live-review — Final QA Pass on Rendered Walkthrough

Reviews a split walkthrough guide directory for structural integrity, cross-reference
consistency, and rendering quality — the checks that only matter after `split-guide.js`
has produced `toc.json`, `meta.json`, section files, and optionally `achievements.json`.
Runs as the final gate before committing to the gamemds repo.

## When to use

After converting, splitting, and reformatting:

```bash
node scripts/convert.js "<gamefaqs-url>" walkthrough.md
node scripts/reformat.js walkthrough.md
node scripts/split-guide.js walkthrough.md guide/
```

Then in opencode:

```
"Run live-review on guide/"
"Run live-review on guide/ — check links only"
"Final QA on guide/"
```

---

## Instructions for the agent

Read the guide directory. Then run these six scans in order. Do NOT modify any
file until you have completed all scans. After fixing, print a summary report.

### Scan 1: Structural integrity

Verify the guide directory contains all expected files and that they reference
each other correctly.

1. Read `guide/toc.json`. For every entry with a `file` field, verify that file
   exists in the guide directory.
2. Read every `guide/*.md` file that is NOT in `toc.json` — these are orphans.
   Flag them.
3. Verify `guide/meta.json` has all required fields: `title`, `subtitle`,
   `author`, `source`, `attributionHtml`.
4. Verify `guide/search-index.json` exists and is valid JSON with at least 100
   terms (for a full walkthrough).

### Scan 2: Anchor and link consistency

Verify all internal navigation resolves correctly.

1. For every entry in `toc.json`, verify its `num` field matches the anchor ID
   in its section file. The anchor ID format is `s` + num with dots replaced by
   hyphens (e.g., `6.4.8` → `s6-4-8`). The section file should contain
   `<a id="s6-4-8"></a>`.
2. For every internal link in every section file matching `[text](#s...)`,
   verify the target anchor exists in the referenced section file.
3. For every internal link matching `[text](filename.md)`, verify that file
   exists in the guide directory.
4. For every internal link matching `[text](filename.md#s...)`, verify both
   the file and the anchor within it exist.
5. Check `achievements.md` (if present) — every `[section](#s...)` link must
   resolve to an anchor that exists in a section file.

### Scan 3: Achievement cross-references

Verify `achievements.json` joins cleanly to the walkthrough structure.

1. Every `section` field in `achievements.json` must match a `num` value in
   `toc.json`.
2. Every `missableCutoffSection` field must match a `num` value in `toc.json`.
3. Every `badgeUrl` must be a valid RetroAchievements badge URL
   (`https://retroachievements.org/Badge/<name>.png`). Optionally fetch a
   sample to verify they return 200.
4. Verify `totalAchievements` equals the length of the `achievements` array.
5. Verify `totalPoints` equals the sum of all `points` fields.
6. No achievement should have `confidence: "low"` without a `notes` field
   explaining the uncertainty.

### Scan 4: Content quality

Check for rendering problems that degrade readability on mobile.

1. **Empty sections**: Any section file with fewer than 100 characters of
   actual content (excluding anchor tags, headings, and blank lines) is
   effectively empty. Flag it.
2. **Duplicate headings**: No two section files should have the same heading
   text at the same level.
3. **Heading hierarchy**: Within each section file, headings should not skip
   levels (e.g., `##` followed by `####` with no `###` in between).
4. **Raw HTML leaks**: Any HTML tags other than `<a id="..."></a>` should be
   flagged. The reader app renders markdown, not arbitrary HTML.
5. **Broken markdown tables**: Every pipe table must have a separator row
   (`|---|---|`) and consistent column counts across all rows.
6. **Oversized code blocks**: Any code block exceeding 40 lines should be
   flagged — these are hard to scroll on mobile.
7. **Broken images/links**: Any `![]()` or `[]()` referencing external URLs
   should be flagged for manual verification (the agent cannot fetch them
   reliably).

### Scan 5: Mobile rendering simulation

Estimate how content will render on a 375px-wide mobile viewport.

1. **Wide tables**: Any markdown table row exceeding 60 characters of cell
   content will likely overflow on mobile. Flag it.
2. **Long unbroken lines**: Any line exceeding 80 characters without a space
   or hyphen will not wrap on mobile. Flag it.
3. **Code block width**: Any code block line exceeding 40 characters may
   require horizontal scrolling. Flag blocks where more than half the lines
   exceed this threshold.
4. **Dense paragraphs**: Any paragraph exceeding 5 lines without a break
   should be flagged for potential splitting.

### Scan 6: TOC and navigation

Verify the table of contents is complete and well-structured.

1. Every section file must appear in `toc.json` exactly once.
2. Section numbering in `toc.json` must be sequential — no gaps in the
   numbering (e.g., jumping from 6.3 to 6.5 without 6.4).
3. The `depth` field in `toc.json` must match the heading level implied by
   the section number (0 dots = depth 0, 1 dot = depth 1, etc.).
4. If `achievements.md` exists, `toc.json` must contain the `0.1 Achievement
   Checklist` entry at the top.

### After all scans

Print a summary report:

```
live-review complete
  Scan 1 (structural integrity):    N errors, M warnings
  Scan 2 (anchors and links):       N broken links fixed, M flagged
  Scan 3 (achievement cross-refs):  N errors, M warnings
  Scan 4 (content quality):         N issues found
  Scan 5 (mobile rendering):        N issues found
  Scan 6 (TOC and navigation):      N errors, M warnings
  ────────────────────────────
  Total: N issues (E errors, W warnings, I nits)
```

Severity levels:
- **Error** (must fix): broken links, missing files, invalid JSON, incorrect
  cross-references
- **Warning** (should fix): empty sections, oversized code blocks, wide
  tables, heading hierarchy skips
- **Nit** (nice to fix): dense paragraphs, long unbroken lines, minor style
  inconsistencies

For each issue, report the **local file path and line number** so the user
can fix it directly. Do not attempt to fix issues in the gamemds repo —
all fixes happen in the local `guide/` files, then `split-guide.js` is
re-run to regenerate the output.

---

## Fix workflow

When the user asks to fix issues found by live-review:

1. Edit the **source** `walkthrough.md` or section `.md` files in `guide/`
   as appropriate.
2. Re-run `node scripts/split-guide.js walkthrough.md guide/` to regenerate
   `toc.json`, `meta.json`, `search-index.json`, and section files.
3. Re-run live-review to verify fixes.

Do NOT edit `toc.json`, `meta.json`, or `search-index.json` directly — they
are generated by `split-guide.js` and will be overwritten.

---

## Edge cases

- **Directory not found**: print `Directory not found: <path>` and exit.
- **No toc.json**: print `No toc.json found — run split-guide.js first` and exit.
- **No achievements.json**: skip Scan 3 entirely, print `No achievements.json — skipping achievement cross-references`.
- **Section filter**: if the user specifies a section range (e.g., "check sections 6.1-6.4"), only process matching section files. Always run structural and TOC scans on the full directory.
- **Live site check**: if the user provides a gamemds.org URL, optionally fetch the rendered page and compare the live HTML structure against the local files. This catches CSS/rendering issues that local checks cannot. Use `webfetch` to retrieve the page. This is optional — local checks are the default.

## Relationship to other skills

- **faqmd**: Converts raw GameFAQs text to markdown. Runs first.
- **reformat-review**: Fixes formatting edge cases in the markdown. Runs second.
- **retroachievements**: Matches achievements to sections. Runs third.
- **live-review**: Final structural and rendering QA. Runs last, after all
  content changes are complete.