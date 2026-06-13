# faqdown

Convert GameFAQs plain-text walkthroughs into hyperlinked markdown files.

## Quick start

```bash
node convert.js
```

This fetches the Phantasy Star IV walkthrough and outputs `phantasy-star-iv.md`.

## Convert your own

1. Find a walkthrough on GameFAQs
2. Append `?print=1` to the URL
3. Replace the `URL` in `convert.js`
4. Run `node convert.js`

## Output

- **Table of Contents** with clickable anchor links to every section
- **Proper heading levels** (`#`, `##`, `###`) matching the guide's structure
- **ASCII art** preserved in code blocks
- **Clean paragraphs** — fixed-width formatting collapsed to readable text

## How it works

GameFAQs print pages wrap walkthroughs in `<pre>` tags with consistent section marker patterns. `faqdown` extracts the text, parses the table of contents, splits content at section boundaries, and converts to markdown with internal anchor links.
