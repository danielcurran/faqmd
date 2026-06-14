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

Four agent skills are included for use with [opencode](https://opencode.ai).

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

### reformat-review — Polish the reformatter output

Reviews and fixes edge cases in the reformatted walkthrough:

- Code blocks that should be markdown tables
- Pipe tables that should be ASCII art code blocks
- Stat blocks still embedded in prose
- Broken or misaligned tables
- Walkthrough steps that should be bullet lists

Install:

```bash
mkdir -p ~/.config/opencode/skills/reformat-review
cp skills/reformat-review-skill.md ~/.config/opencode/skills/reformat-review/SKILL.md
```

Usage: `"Run reformat-review on walkthrough.md"`

### art-modernize — Upgrade ASCII art to HTML

Replaces tagged ASCII art blocks with modern HTML components:

- Town maps → `.game-map` grid layouts
- Boss boxes → `.boss-card` encounter cards
- Character stat cards → `.stat-card` grids
- Equipment tables → styled `.equipment-table`
- Menu UIs → `.game-menu` buttons
- Decorative labels → `.section-marker` headers

Install:

```bash
mkdir -p ~/.config/opencode/skills/art-modernize
cp skills/art-modernize-skill.md ~/.config/opencode/skills/art-modernize/SKILL.md
```

Usage: `"Run art-modernize on walkthrough.md"`

---

## Full Pipeline

```bash
# 1. Convert
node scripts/convert.js "https://gamefaqs.gamespot.com/.../faqs/12345?print=1"

# 2. Annotate (via opencode agent skill)
# "Match RetroAchievements for game <id> to walkthrough.md"

# 3. Review and polish (optional, via opencode agent skills)
# "Run reformat-review on walkthrough.md"   — fix tables, stat blocks, bullet lists
# "Run art-modernize on walkthrough.md"    — upgrade ASCII art to HTML components

# 4. Split
node scripts/split-guide.js walkthrough.md guide/

# 5. Publish — copy to faqmd-walkthroughs repo (auto-deploys to faqmd.dev)
cp -r guide/ /path/to/faqmd-walkthroughs/
cd /path/to/faqmd-walkthroughs
git add -A && git commit -m "add walkthrough" && git push
```

---

## Output Features

- **Table of Contents** with clickable anchor links to every section
- **Proper heading levels** (`#`, `##`, `###`) matching the guide's structure
- **Prose unwrapped from code blocks** — readable at normal font size on mobile
- **Equipment tables** converted to markdown pipe tables
- **Stat blocks** (party info, enemy data) formatted as bold `**Key:** Value`
- **ASCII art** (maps, boss boxes, dungeon layouts) preserved in code blocks with `<!-- MODERNIZE:TYPE -->` tags for the art-modernize agent skill
- **Paragraph breaks** at walkthrough instruction steps (Go, Turn, Take, Enter)
- **Decorative headers** (`// DUNGEON #2`) stripped to clean bold text
- **RetroAchievements** callouts with medal emojis at matched sections
- Content-aware formatting — classifies each block and reformats accordingly

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
5. **Classifies** each content block — prose, table, ASCII art, stat block, decorative
6. **Reformats** each type — prose to paragraphs, tables to markdown, art to code blocks, stats to bold labels
7. **Strips** simple decorations (`// DUNGEON`, `\ Boss:`) to clean bold text
8. **Tags** complex art blocks with `<!-- MODERNIZE:TYPE -->` for downstream agent skills
9. **Generates** a TOC with anchor links

## Files

| File | Purpose |
|---|---|
| `scripts/convert.js` | Core converter — fetch, parse, reformat, output markdown |
| `scripts/reformat.js` | Content reformatter — prose unwrapping, table detection, art classification, decoration stripping |
| `scripts/split-guide.js` | Split large output into mobile-friendly section files |
| `scripts/raw.txt` | Cached GameFAQs walkthrough for offline testing |
| `skills/SKILL.md` | opencode agent skill — convert walkthroughs |
| `skills/retroachievements-skill.md` | opencode agent skill — AI-powered achievement matching |
| `skills/reformat-review-skill.md` | opencode agent skill — review and fix reformatter edge cases |
| `skills/art-modernize-skill.md` | opencode agent skill — upgrade ASCII art to HTML components |

## License

MIT
