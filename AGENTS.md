# faqdown — GameFAQs Walkthrough to Markdown Converter

## Purpose
Converts GameFAQs plain-text walkthroughs into clean, readable markdown files with a table of contents, internal anchor links, and properly formatted sections.

## Tech Stack
- Node.js
- `@retroachievements/api` (for achievement cross-referencing)

## Key Files
- `SKILL.md` — OpenCode skill definition that describes the conversion process
- `crossref-achievements.js` — Cross-references walkthrough markdown with RetroAchievements (requires RA_USER and RA_KEY env vars)

## Conventions
- Output saved as `guide-<faq-id>.md`
- Anchor IDs: replace dots with hyphens, prefix with `s` (e.g., `s6-4-8`)
- ASCII art wrapped in code blocks
- Equipment tables stay in code blocks, not treated as markdown tables
- TOC appears twice in source (intro + body) — only parse the intro TOC

## Usage
Usage: node crossref-achievements.js <markdown-file> <RA-game-id-or-name>
Requires: RA_USER and RA_KEY env vars
