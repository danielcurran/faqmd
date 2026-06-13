# faqdown

Convert GameFAQs walkthroughs into hyperlinked markdown — via Node.js script or
[opencode](https://opencode.ai) agent skill.

## Quick start

### Script

```bash
git clone https://github.com/danielcurran/faqdown
cd faqdown
node convert.js
```

Fetches the Phantasy Star IV walkthrough and outputs `guide-31907.md`.

### opencode skill

```bash
mkdir -p ~/.config/opencode/skills/faqdown
cp SKILL.md ~/.config/opencode/skills/faqdown/SKILL.md
# Restart opencode, then ask:
# "convert this gamefaqs walkthrough https://gamefaqs.gamespot.com/..."
```

## Convert any walkthrough

```bash
node convert.js "https://gamefaqs.gamespot.com/snes/588771-chrono-trigger/faqs/24488?print=1"
```

1. Find a walkthrough on [gamefaqs.gamespot.com](https://gamefaqs.gamespot.com)
2. Click the guide, add `?print=1` to the URL
3. Run `node convert.js "<url>"` — output is `guide-<id>.md`

## Output features

- **Table of Contents** with clickable anchor links to every section
- **Proper heading levels** (`#`, `##`, `###`) matching the guide's structure
- **Aggressive prose editing** — expert readability improvements:
  - Definition lists formatted as `- **Term** — definition`
  - RPG abbreviations auto-bolded (**HP**, **TP**, **EXP**, **ATK**, **DFS**)
  - Long paragraphs broken into 2-3 sentence chunks
  - Step detection for walkthrough directions
- **ASCII art** (menu diagrams, dungeon maps, boss boxes) in code blocks
- **Equipment tables** and stat boxes in code blocks
- **Party events** formatted as `> **bold callouts**`
- **Section header leaks removed** — no bleed-through between sections

## How it works

GameFAQs print pages (`?print=1`) are highly consistent:

1. **ASCII art header** — title art and dividers
2. **Table of Contents** — section numbers → 4-letter search codes
3. **Section body** — each section starts with `***\nTitle\n***` and includes
   its code prefixed with `C` (e.g. `CLVTW`)

The converter:

1. **Fetches** the `?print=1` page
2. **Extracts** text from `<pre>` tags
3. **Parses** the TOC into a section tree
4. **Splits** content at body section markers (not the TOC)
5. **Converts** each section with proper heading levels
6. **Generates** a TOC with anchor links
7. **Formats** line-by-line: ASCII art → code blocks, party events → callouts
8. **Edits prose** aggressively: bullet definitions, bold terms, paragraph splitting

The result is a self-contained `.md` file you can view in any markdown reader,
open in a browser, or push to GitHub Pages.

## Files

| File | Purpose |
|---|---|
| `convert.js` | Node.js scraper/converter script |
| `SKILL.md` | opencode agent skill definition |
| `guide-31907.md` | Example output (Phantasy Star IV) |
