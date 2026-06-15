# Phase 5 — Production pipeline (Plan F)

## Goal

Wrap all previous phases into a single, repeatable command that produces
validated, deployment-ready output. Intermediate artifacts are kept for
debugging. Validation failures stop the pipeline loud and early.

## Pipeline

### Script: `scripts/pipeline.js`

Single entry point:

```bash
node scripts/pipeline.js [--no-llm] [--keep-artifacts] [url-or-file]
```

Steps:

| Step | Script | Input | Output | Always? |
|---|---|---|---|---|
| 1. Fetch & extract | `scripts/convert.js` | URL or file | `walkthrough.01-raw.md` | Yes |
| 2. Reformat | `lib/reformat/index.js` (via pipeline) | `walkthrough.01-raw.md` | `walkthrough.02-reformatted.md` | Yes |
| 3. Validate structure | `scripts/validate.js` | `walkthrough.02-reformatted.md` | pass/fail + report | Yes |
| 4. LLM polish | `scripts/llm-reformat.js` | `walkthrough.02-reformatted.md` | `walkthrough.03-polished.md` | Unless `--no-llm` |
| 5. Validate polished | `scripts/validate.js` | `walkthrough.03-polished.md` | pass/fail + report | If step 4 ran |
| 6. Finalize | — | step 2 or 4 output | `walkthrough.md` (symlink or copy) | Yes |
| 7. Split | `scripts/split-guide.js` | `walkthrough.md` | `guide/` directory | Yes |
| 8. Validate split | `scripts/validate.js` | `guide/` | pass/fail + report | Yes |

### Script: `scripts/validate.js`

A standalone validation tool that checks the output at any stage:

```bash
node scripts/validate.js walkthrough.md
node scripts/validate.js guide/
```

Checks performed:

| Check | Scope | Fails if |
|---|---|---|
| Markdown table consistency | Each `\|---\|---\|` separator | Column counts mismatch between header and data rows |
| Section anchors | All `<a id="s...">` | Anchor is duplicated or missing for a heading |
| Section TOC match | TOC links vs section headings | A TOC entry has no matching section heading |
| Heading depth | Heading levels | A jump of 2+ levels (e.g., `##` → `####` without `###`) |
| Empty sections | Section content | A section has no content after the heading |
| File existence | `guide/` | `index.md`, `toc.json`, or `meta.json` missing |
| meta.json | `guide/meta.json` | Missing required fields (`title`, `author`, etc.) |
| guides.json | `gamemds/guides.json` | Orphan sections (files in `guide/` not in TOC) |

Returns exit code 0 on pass, 1 on failure, and prints a summary report.

### Intermediate artifacts

```
walkthrough.01-raw.md          # Raw converter output (text extracted, TOC parsed)
walkthrough.02-reformatted.md  # After Phase 1–3 formatting
walkthrough.03-polished.md     # After Phase 4 LLM polish (only with --llm)
walkthrough.md                 # Final output (symlink to 02 or 03)
```

Kept only if `--keep-artifacts` is passed (default: deleted after finalize).

## Files to change

### New files

1. `scripts/pipeline.js` — orchestrator.
2. `scripts/validate.js` — validation checks (see above).

### Changes to existing files

3. `package.json` — add scripts:
   ```json
   "scripts": {
     "test": "node scripts/test.js",
     "convert": "node scripts/convert.js",
     "build": "node scripts/pipeline.js",
     "validate": "node scripts/validate.js",
     "polish": "node scripts/llm-reformat.js",
     "sync-skills": "node scripts/sync-skills.js"
   }
   ```
   The `npm run build` command is now the recommended way to convert a guide.

4. `faqmd/AGENTS.md` — update:
   - Add "Pipeline" section describing `npm run build`.
   - Mark `node scripts/convert.js` as the "low-level" entry point.
   - Mark `npm run build` as the recommended entry point.

5. `gamemds/AGENTS.md` — update Cross-Repo Workflow:
   ```
   1. In the faqmd repo: `npm run build <url>` (or `npm run build -- --no-llm`)
   2. Copy guide/ to gamemds/guides/<slug>/
   3. Add entry to guides.json
   4. Commit and push
   ```

6. `.github/workflows/test.yml` — update CI:
   - Run `npm run build -- --no-llm` in addition to `npm test`.
   - Validate that `walkthrough.md` is structurally sound.

## Acceptance criteria

1. `npm run build scripts/raw.txt` produces a validated `walkthrough.md` with no
   structural errors.
2. `npm run build -- --no-llm scripts/raw.txt` produces the same output but skips
   LLM polish.
3. `npm run validate walkthrough.md` reports 0 errors for a clean file.
4. `npm run validate guide/` reports 0 errors for a valid guide/ directory.
5. Pipeline fails with exit code 1 and a clear error message if any validation
   check fails.
6. Intermediate artifacts are cleaned up by default.

## How to verify

```bash
# Full pipeline with LLM polish
npm run build scripts/raw.txt

# Full pipeline without LLM
npm run build -- --no-llm scripts/raw.txt

# Validate a file
npm run validate walkthrough.md

# Validate the split guide
npm run validate guide/

# CI equivalent
npm test && npm run build -- --no-llm scripts/raw.txt && npm run validate walkthrough.md && npm run validate guide/
```
