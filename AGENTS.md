# faqmd — GameFAQs Walkthrough to Markdown Converter

## Purpose
Converts GameFAQs plain-text walkthroughs into clean, readable markdown files with a table of contents, internal anchor links, and properly formatted sections.

## Repository Separation
This repo contains the **converter tool** and **opencode agent skills** only. Walkthrough content and the [gamemds.org](https://gamemds.org) site are in a separate repo:
- **[gamemds](https://github.com/danielcurran/gamemds)** — hosted walkthrough content (HTML, reader app, guide files, deploy workflow) at [gamemds.org](https://gamemds.org)

## Tech Stack
- Node.js (>=18)
- Zero npm dependencies — all scripts use Node.js built-ins only

## Key Files
- `scripts/convert.js` — CLI entry point: fetch a GameFAQs walkthrough, parse, and write markdown
- `scripts/split-guide.js` — Split a large walkthrough markdown into per-section files for mobile-friendly browsing
- `lib/convert-core.js` — Core conversion logic used by `scripts/convert.js`
- `lib/cli.js` — Shared zero-dependency CLI argument parsing helpers
- `lib/reformat/index.js` — Public reformatting API
- `lib/reformat/detect.js` — Block-type detection (prose, table, ASCII art, stat block, decorative)
- `lib/reformat/format.js` — Per-block formatting and `<!-- MODERNIZE:TYPE -->` tagging
- `lib/reformat/classify.js` — Content classification helpers
- `scripts/reformat.js` — Backward-compatible wrapper around `lib/reformat`
- `scripts/test.js` — Standalone test runner (also available as `npm test`)
- `scripts/fetch-achievements.js` — Fetches RA achievement data for any game ID, optionally with Comments API data
- `scripts/validate-achievements.js` — Validates achievements.json schema and cross-references sections against toc.json
- `scripts/sync-skills.js` — Copies repo skill files to `~/.config/opencode/skills/` (run via `npm run sync-skills`)
- `package.json` — Defines `npm test`, `npm run convert`, `npm run sync-skills`, and Node engine requirement
- `.github/workflows/test.yml` — CI: runs `npm test` on push/PR
- `skills/SKILL.md` — opencode agent skill for converting walkthroughs
- `skills/retroachievements-skill.md` — opencode agent skill for AI-powered achievement matching
- `skills/reformat-review-skill.md` — opencode agent skill for reviewing reformatter edge cases
- `skills/art-modernize-skill.md` — opencode agent skill for upgrading ASCII art to HTML components
- `.gitignore` — Ignores node_modules/, generated walkthrough files, and guide/ (local artifact only)

## Conventions
- Converter output is saved as `walkthrough.md` by default
- Large guides (>500KB) should be split with `split-guide.js` for mobile readability
- Split output goes in `guide/`: `index.md` + `toc.json` + `meta.json` + one file per section named `<section-num>-<slug>.md`
- `meta.json` contains `title`, `subtitle`, `author`, `source`, and `attributionHtml` for the gamemds reader app
- Anchor IDs: replace dots with hyphens, prefix with `s` (e.g., `s6-4-8`)
- ASCII art wrapped in code blocks; complex art blocks are tagged with `<!-- MODERNIZE:TYPE -->` for the art-modernize agent skill
- Equipment tables stay in code blocks, not treated as markdown tables
- TOC appears twice in source (intro + body) — only parse the intro TOC
- Run `npm test` before committing any change to converter logic, reformatting rules, or skills
- Do not commit generated `walkthrough.md`, `guide/`, or `node_modules/`

## RetroAchievements Integration

`split-guide.js` optionally reads `achievements.json` from the output directory and generates:
- `achievements.md` — a standalone checklist with missable table + by-section checkboxes
- Updates `toc.json` to insert a `0.1 Achievement Checklist` entry at the top

The `achievements.json` schema:

```json
{
  "schemaVersion": 1,
  "gameId": <game-id>,
  "gameTitle": "<game title>",
  "source": "https://retroachievements.org/game/<game-id>",
  "totalAchievements": <count>,
  "totalPoints": <sum>,
  "achievements": [
    {
      "id": <achievement-id>,
      "title": "<name>",
      "description": "<description>",
      "points": <value>,
      "badgeUrl": "https://retroachievements.org/Badge/<badge-name>.png",
      "displayOrder": <order>,
      "type": "<story|missable|collectible|challenge|secret|progress>",
      "missable": <boolean>,
      "missableCutoff": "<cutoff description, if missable>",
      "missableCutoffSection": "<section num, if missable>",
      "section": "<walkthrough section number>",
      "confidence": "<high|medium|low>",
      "notes": "<clarification or strategic advice>",
      "communityTips": [
        { "user": "<username>", "text": "<player comment>" }
      ]
    }
  ]
}
```

Fields: `id`, `title`, `description`, `points`, `badgeUrl`, `displayOrder`, `type` (story|missable|collectible|challenge|secret|progress), `missable`, `missableCutoff`, `missableCutoffSection`, `section`, `confidence` (high|medium|low), `notes`, `communityTips` (optional array of `{user, text}`).

The RA Comments API provides player tips for ambiguous achievements:
```bash
curl -s "https://retroachievements.org/API/API_GetComments.php?z=$RA_USER&y=$RA_KEY&i=<achievement-id>&t=2&c=50"
```
Filter out `"User": "Server"` auto-generated messages. Useful player comments should be saved in the optional `communityTips` field.

The `section` field joins to `toc.json` on the `num` field. The gamemds reader app loads `achievements.json` at runtime to render inline badges, missable warnings, and progress tracking.

## Usage
Convert: node scripts/convert.js [--title=NAME] [--author=NAME] <gamefaqs-print-url>
Split: node scripts/split-guide.js <input.md> [output-dir]
Fetch Achievements: node scripts/fetch-achievements.js --game=<id> [--output=FILE] [--comments]
Validate Achievements: node scripts/validate-achievements.js guide/achievements.json
Test: npm test

## Agent Skills

This repo is the source of truth for all faqmd-related opencode skills. The
skill files live in `skills/` and are mirrored in `.opencode/skills/<name>/SKILL.md`
for per-repo discovery.

Globally installed copies also live under `~/.config/opencode/skills/` so the
skills are available outside this repo. When editing a skill, update the file
in `skills/` first, then run `npm run sync-skills` to copy the changed files to
`~/.config/opencode/skills/`.

| Skill | File | Purpose |
|---|---|---|
| `faqmd` | `skills/SKILL.md` | Convert GameFAQs walkthroughs to markdown |
| `retroachievements` | `skills/retroachievements-skill.md` | Match RetroAchievements to walkthrough sections |
| `reformat-review` | `skills/reformat-review-skill.md` | Review and fix reformatter edge cases |
| `art-modernize` | `skills/art-modernize-skill.md` | Upgrade ASCII art to HTML components |

## Per-Repo Opencode Config

`.opencode/opencode.json` declares the `build` agent profile. The
`.opencode/skills/` directory mirrors the four skills above for per-repo
discovery. When adding or renaming a skill, update both `skills/` and
`.opencode/skills/` and run `npm run sync-skills` to update the global copies.
