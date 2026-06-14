# faqmd

Convert GameFAQs walkthroughs into hyperlinked markdown — via Node.js script or
[opencode](https://opencode.ai) agent skill.

**[faqmd.dev](https://faqmd.dev)** hosts walkthroughs generated with this tool.
Content is managed in a [private repo](https://github.com/danielcurran/faqmd-content);
only the initial example walked through lives here.

**Want your generated walkthrough on the site?** [Open a submission
issue](https://github.com/danielcurran/faqmd/issues/new?title=Submission%3A+%5Bgame+name%5D&body=Link+to+the+converted+markdown%3A%0A%0AOriginal+GameFAQs+URL%3A%0A%0AAuthor+credit%3A)
with a link to your converted markdown. Inclusion is at the admin's discretion.

No walkthroughs are committed to this repo — content is deployed from a private
repo via GitHub Actions.

---

## Core tool

The converter is standalone and works for any GameFAQs walkthrough. No API
keys or accounts needed.

### Script

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

### opencode skill

```bash
mkdir -p ~/.config/opencode/skills/faqmd
cp skills/SKILL.md ~/.config/opencode/skills/faqmd/SKILL.md
# Restart opencode, then ask:
# "convert this gamefaqs walkthrough https://gamefaqs.gamespot.com/..."
```

### Convert any walkthrough

1. Find a walkthrough on [gamefaqs.gamespot.com](https://gamefaqs.gamespot.com)
2. Click the guide, add `?print=1` to the URL
3. Run `node convert.js "<url>"`

## RetroAchievements annotations

Add achievement data to a walkthrough using the **retroachievements** opencode
agent skill. Unlike the old script (removed), the skill uses LLM reasoning to
accurately match achievements to walkthrough sections.

### Install the skill

```bash
mkdir -p ~/.config/opencode/skills/retroachievements
cp skills/retroachievements-skill.md ~/.config/opencode/skills/retroachievements/SKILL.md
```

### Set up credentials

```bash
export RA_USER=your_username
export RA_KEY=your_api_key
# Get a key at https://retroachievements.org/controlpanel.php
```

### Use in opencode

```
"Match RetroAchievements for game 50 to guide/ walkthrough sections"
"Cross-reference achievements for game 5633 with walkthrough.md"
```

The agent fetches achievements from the API, reads the walkthrough, reasons
about which section each achievement belongs to, and injects them directly.

### Full pipeline

```bash
# 1. Convert
node scripts/convert.js "https://gamefaqs.gamespot.com/.../faqs/12345?print=1"

# 2. Annotate (via opencode agent skill)
# "Match RetroAchievements for game <id> to walkthrough.md"

# 3. Split
node scripts/split-guide.js walkthrough.md guide/

# 4. Publish (push to private content repo — auto-deploys to faqmd.dev)
cp -r guide/ /path/to/faqmd-content/
cd /path/to/faqmd-content && git add -A && git commit -m "add walkthrough" && git push
```

## Output features

- **Table of Contents** with clickable anchor links to every section
- **Proper heading levels** (`#`, `##`, `###`) matching the guide's structure
- **ASCII art** (menu diagrams, dungeon maps, boss boxes) in code blocks
- **Equipment tables** and stat boxes preserved in code blocks
- **Party info** preserved in code blocks
- **RetroAchievements** callouts with medal emojis at matched sections
- Content-aware formatting — strips decorative lines, preserves structure

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
| `.github/workflows/deploy.yml` | Deploys content from private repo to faqmd.dev |
