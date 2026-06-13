# faqdown

Convert GameFAQs plain-text walkthroughs into hyperlinked markdown files.

## Quick start

```bash
# Clone and run
git clone https://github.com/danielcurran/faqdown
cd faqdown
node convert.js
```

This fetches the Phantasy Star IV walkthrough from GameFAQs and outputs a markdown file.

## Convert any walkthrough

Pass a GameFAQs **print URL** (`?print=1`) as an argument:

```bash
node convert.js "https://gamefaqs.gamespot.com/snes/588771-chrono-trigger/faqs/24488?print=1"
```

1. Find a walkthrough on [gamefaqs.gamespot.com](https://gamefaqs.gamespot.com)
2. Click the guide, then add `?print=1` to the URL
3. Pass that URL to `node convert.js`

## Output

- **Table of Contents** with clickable anchor links to every section
- **Proper heading levels** (`#`, `##`, `###`) matching the guide's structure
- **ASCII art** preserved in code blocks
- **Clean paragraphs** — fixed-width formatting collapsed to readable text
- Output file is named `guide-<id>.md` based on the FAQ ID

## How it works

GameFAQs print pages (`?print=1`) serve walkthroughs as HTML with the full text inside `<pre>` tags. These walkthroughs follow a consistent format:

1. **ASCII art header** — title art and dividers
2. **Table of Contents** — maps section numbers/titles to 4-letter search codes
3. **Section body** — each section starts with `***\nTitle\n***` and includes its search code (prefixed with `C`, e.g. `CLVTW`)

`faqdown` does the following:

1. **Fetches** the `?print=1` page
2. **Extracts** the text from `<pre>` tags
3. **Parses** the TOC into a tree of sections (chapter → section → subsection)
4. **Splits** the body at section code markers
5. **Converts** each section to markdown with proper heading levels
6. **Generates** a table of contents with `[anchor links](#section-id)`

The result is a single self-contained `.md` file you can view in any markdown reader, open in a browser, or sync to your phone for offline reference.
