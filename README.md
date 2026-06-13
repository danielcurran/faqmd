# faqdown

Convert GameFAQs plain-text walkthroughs into hyperlinked markdown files.

## Quick start

```bash
git clone https://github.com/danielcurran/faqdown
cd faqdown
node convert.js
```

Fetches the Phantasy Star IV walkthrough and outputs `guide-31907.md`.

## Convert any walkthrough

Pass a GameFAQs **print URL** (`?print=1`) as an argument:

```bash
node convert.js "https://gamefaqs.gamespot.com/snes/588771-chrono-trigger/faqs/24488?print=1"
```

1. Find a walkthrough on [gamefaqs.gamespot.com](https://gamefaqs.gamespot.com)
2. Click the guide, then add `?print=1` to the URL
3. Pass that URL to `node convert.js`
4. Output is saved as `guide-<id>.md`

## Output features

- **Table of Contents** with clickable anchor links to every section
- **Proper heading levels** (`#`, `##`, `###`) matching the guide's structure
- **ASCII art** (menu diagrams, dungeon maps) preserved in code blocks
- **Equipment tables** and stat boxes detected and wrapped in code blocks
- **Party events** (`joins the party` / `leaves the party`) formatted as bold callouts
- **Preserved line breaks** — paragraphs read naturally instead of being collapsed into one blob
- **Section header leaks removed** — section titles don't bleed into content

## How it works

GameFAQs print pages (`?print=1`) serve walkthroughs as HTML wrapped in `<pre>` tags. The format is highly consistent:

1. **ASCII art header** — title art and dividers
2. **Table of Contents** — maps section numbers/titles to 4-letter search codes
3. **Section body** — each section starts with `***\nTitle\n***` and includes its code (prefixed with `C`, e.g. `CLVTW`)

The converter:

1. **Fetches** the `?print=1` page
2. **Extracts** text from `<pre>` tags
3. **Parses** the TOC into a section tree
4. **Splits** content at section code markers in the body (not the TOC)
5. **Converts** each section with proper heading levels
6. **Generates** a TOC with `[anchor links](#section-id)`
7. **Formats** with line-by-line art/prose detection, equipment table recognition, and party event callouts

The result is a self-contained `.md` file you can view in any markdown reader, open in a browser, or push to GitHub Pages.
