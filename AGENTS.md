# faqmd — GameFAQs Walkthrough to Markdown Converter

## Purpose
Converts GameFAQs plain-text walkthroughs into clean, readable markdown files with a table of contents, internal anchor links, and properly formatted sections.

## Repository Separation
This repo contains the **converter tool** and **opencode agent skills** only. Walkthrough content and the [gamemds.org](https://gamemds.org) site are in a separate repo:
- **[gamemds](https://github.com/danielcurran/gamemds)** — hosted walkthrough content (HTML, reader app, guide files, deploy workflow) at [gamemds.org](https://gamemds.org)

## Tech Stack
- Node.js

## Key Files
- `scripts/convert.js` — Main converter: fetch GameFAQs walkthrough, parse, format to markdown
- `scripts/split-guide.js` — Split a large walkthrough markdown into per-section files for mobile-friendly browsing
- `skills/SKILL.md` — opencode agent skill for converting walkthroughs
- `skills/retroachievements-skill.md` — opencode agent skill for AI-powered achievement matching
- `.gitignore` — Ignores node_modules/, generated walkthrough files, and guide/ (local artifact only)

## Conventions
- Output saved as `walkthrough.md` or `guide-<faq-id>.md`
- Large guides (>500KB) should be split with `split-guide.js` for mobile readability
- Split output goes in `guide/`: `index.md` + one file per section named `<section-num>-<slug>.md`
- Anchor IDs: replace dots with hyphens, prefix with `s` (e.g., `s6-4-8`)
- ASCII art wrapped in code blocks
- Equipment tables stay in code blocks, not treated as markdown tables
- TOC appears twice in source (intro + body) — only parse the intro TOC

## Usage
Convert: node scripts/convert.js <gamefaqs-print-url>
Split: node scripts/split-guide.js <input.md> [output-dir]
Achievements: use the retroachievements agent skill in opencode
