# faqmd

Convert GameFAQs walkthroughs into hyperlinked markdown — via Node.js script or
[opencode](https://opencode.ai) agent skill.

## Repository Roles

| Repo | Purpose |
|---|---|
| **faqmd** (this repo) | Converter tool + opencode agent skills |
| **[faqmd-walkthroughs](https://github.com/danielcurran/faqmd-walkthroughs)** | Walkthrough content hosted at [faqmd.dev](https://faqmd.dev) |

The tool converts walkthroughs. The site hosts the converted results.
No walkthrough content is committed to this repo.

**Want your generated walkthrough on the site?** [Open a submission
issue](https://github.com/danielcurran/faqmd/issues/new?title=Submission%3A+%5Bgame+name%5D&body=Link+to+the+converted+markdown%3A%0A%0AOriginal+GameFAQs+URL%3A%0A%0AAuthor+credit%3A)
with a link to your converted markdown. Inclusion is at the admin's discretion.

---

## Quick Start

The converter is standalone and works for any GameFAQs walkthrough. No API
keys or accounts needed.

```bash
git clone https://github.com/danielcurran/faqmd
cd faqmd
node scripts/convert.js "https://gamefaqs.gamespot.com/genesis/563334-phantasy-star-iv/faqs/31907?print=1"
```

Output is saved as `walkthrough.md`. For large guides, split into mobile-friendly
sections:

```bash
node scripts/split-guide.js walkthrough.md guide/
```

This creates a `guide/` directory with `index.md` + one file per section.

### Convert any walkthrough

1. Find a walkthrough on [gamefaqs.gamespot.com](https://gamefaqs.gamespot.com)
2. Click the guide, add `?print=1` to the URL
3. Run `node scripts/convert.js "<url>"`

---

## opencode Agent Skills

Two agent skills are included for use with [opencode](https://opencode.ai).

### faqmd — Convert walkthroughs

Install the skill:

```bash
mkdir -p ~/.config/opencode/skills/faqmd
cp skills/SKILL.md ~/.config/opencode/skills/faqmd/SKILL.md
```

Then in opencode, paste a GameFAQs print URL and ask:

```
"convert this gamefaqs walkthrough https://gamefaqs.gamespot.com/..."
```

### retroachievements — Match achievements to sections

Add achievement data to a walkthrough using the **retroachievements** opencode
agent skill. Due to its complexity (LLM-powered matching with manual review),
this is handled by the skill rather than a standalone script.

Install the skill:

```bash
mkdir -p ~/.config/opencode/skills/retroachievements
cp skills/retroachievements-skill.md ~/.config/opencode/skills/retroachievements/SKILL.md
```

Set up credentials:

```bash
export RA_USER=your_username
export RA_KEY=your_api_key
# Get a key at https://retroachievements.org/controlpanel.php
```

Usage in opencode:

```
"Match RetroAchievements for game 50 to guide/ walkthrough sections"
"Cross-reference achievements for game 5633 with walkthrough.md"
```

The agent fetches achievements from the API, reads the walkthrough, reasons
about which section each achievement belongs to, and injects them directly.

---

## Full Pipeline

```bash
# 1. Convert
node scripts/convert.js "https://gamefaqs.gamespot.com/.../faqs/12345?print=1"

# 2. Annotate (via opencode agent skill)
# "Match RetroAchievements for game <id> to walkthrough.md"

# 3. Split
node scripts/split-guide.js walkthrough.md guide/

# 4. Publish — copy to faqmd-walkthroughs repo (auto-deploys to faqmd.dev)
cp -r guide/ /path/to/faqmd-walkthroughs/
cd /path/to/faqmd-walkthroughs
git add -A && git commit -m "add walkthrough" && git push
```

---

## Output Features

- **Table of Contents** with clickable anchor links to every section
- **Proper heading levels** (`#`, `##`, `###`) matching the guide's structure
- **ASCII art** (menu diagrams, dungeon maps, boss boxes) in code blocks
- **Equipment tables** and stat boxes preserved in code blocks
- **Party info** preserved in code blocks
- **RetroAchievements** callouts with medal emojis at matched sections
- Content-aware formatting — strips decorative lines, preserves structure

## How It Works

GameFAQs print pages (`?print=1`) are highly consistent:

1. **ASCII art header** — title art and dividers
2. **Table of Contents** — section numbers → 4-letter search codes
3. **Section body** — each section starts with `***\nTitle\n***` and includes
   its code prefixed with `C` (e.g. `CLVTW`)

The converter:

1. **Fetches** the `?print=1` page
2. **Extracts** text from `<pre>` tags
3. **Parses** the TOC into a section tree
4. **Splits** content at body section markers
5. **Converts** each section with proper heading levels
6. **Generates** a TOC with anchor links
7. **Formats** line-by-line, strips decorative noise, wraps in code blocks

## Files

| File | Purpose |
|---|---|
| `scripts/convert.js` | Core converter script |
| `scripts/split-guide.js` | Split large output into mobile-friendly section files |
| `skills/SKILL.md` | opencode agent skill — convert walkthroughs |
| `skills/retroachievements-skill.md` | opencode agent skill — AI-powered achievement matching |

## License

MIT
