# faqmd

Convert GameFAQs walkthroughs into hyperlinked markdown — via Node.js script or
[opencode](https://opencode.ai) agent skill.

**[faqmd.dev](https://faqmd.dev)** hosts walkthroughs generated with this tool.
The initial example is Phantasy Star IV.

**Want your generated walkthrough on the site?** [Open a submission
issue](https://github.com/danielcurran/faqmd/issues/new?title=Submission%3A+%5Bgame+name%5D&body=Link+to+the+converted+markdown%3A%0A%0AOriginal+GameFAQs+URL%3A%0A%0AAuthor+credit%3A)
with a link to your converted markdown. Inclusion is at the admin's discretion.

No walkthroughs are committed to this repo beyond the initial example.

---

## Core tool (everyone)

The converter and skill are standalone and work for any GameFAQs walkthrough.
No API keys or accounts needed.

### Script

```bash
git clone https://github.com/danielcurran/faqmd
cd faqmd
node convert.js "https://gamefaqs.gamespot.com/genesis/563334-phantasy-star-iv/faqs/31907?print=1"
```

Output is saved as `walkthrough.md`. For large guides, split into mobile-friendly
sections:

```bash
node split-guide.js walkthrough.md guide/
```

This creates a `guide/` directory with `index.md` + one file per section.

### opencode skill

Copy the skill definition into your opencode config:

```bash
mkdir -p ~/.config/opencode/skills/faqmd
cp SKILL.md ~/.config/opencode/skills/faqmd/SKILL.md
# Restart opencode, then ask:
# "convert this gamefaqs walkthrough https://gamefaqs.gamespot.com/..."
```

### Convert any walkthrough

1. Find a walkthrough on [gamefaqs.gamespot.com](https://gamefaqs.gamespot.com)
2. Click the guide, add `?print=1` to the URL
3. Run `node convert.js "<url>"`

## Achievements cross-reference (optional)

`crossref-achievements.js` annotates a converted walkthrough with
[RetroAchievements](https://retroachievements.org) data, matching each
achievement to its relevant walkthrough section. You can use it alongside the
core converter, or skip it entirely — the core tool works independently.

To use it:

```bash
# Set up your RetroAchievements credentials (get an API key at
# https://retroachievements.org/controlpanel.php)
export RA_USER=your_username
export RA_KEY=your_api_key

# Run after converting a walkthrough
node crossref-achievements.js walkthrough.md 5633
# Or search by game name
node crossref-achievements.js walkthrough.md "Phantasy Star IV"
```

Output: `walkthrough-achievements.md` with achievements injected into relevant
sections.

## Output features (core converter)

- **Table of Contents** with clickable anchor links to every section
- **Proper heading levels** (`#`, `##`, `###`) matching the guide's structure
- **ASCII art** (menu diagrams, dungeon maps, boss boxes) in code blocks
- **Equipment tables** and stat boxes in code blocks
- **Party events** formatted as `> **bold callouts**` (joins/leaves the party)
- **Bullet points** for terminology and step lists
- Original line breaks preserved in prose paragraphs
- **Content-aware formatting** — detects ASCII art vs prose, wraps only art in
  code blocks

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
7. **Formats** line-by-line: ASCII art → code blocks, party events → callouts,
   lists → bullets, prose preserves original line breaks

The result is a self-contained `.md` file you can view in any markdown reader,
open in a browser, or push to GitHub Pages.

## Files

| File | Purpose |
|---|---|
| `convert.js` | Core converter script — works standalone |
| `split-guide.js` | Split large output into mobile-friendly section files |
| `SKILL.md` | opencode agent skill definition — works standalone |
| `crossref-achievements.js` | Optional: annotate walkthroughs with RetroAchievements data |
