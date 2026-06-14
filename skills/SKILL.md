---
name: faqmd
description: "Use when the user asks to convert a GameFAQs walkthrough to markdown, scrape a GameFAQs FAQ/guide, or create hyperlinked walkthrough files. Trigger keywords: gamefaqs, walkthrough, faqdown, faq, guide, scrape, convert, markdown, FAQ, print=1."
---

# faqmd — Convert GameFAQs Walkthroughs to Hyperlinked Markdown

Convert GameFAQs plain-text walkthroughs into clean, readable markdown files
with a table of contents, internal anchor links, and properly formatted sections.

> **Note:** To annotate a walkthrough with RetroAchievements, use the
> `retroachievements` agent skill instead. It uses LLM reasoning to accurately
> match achievements to walkthrough sections.

## Step 1: Fetch the walkthrough

GameFAQs walkthrough pages have a `?print=1` parameter that returns the full
text wrapped in `<pre>` tags. Always use this URL:

```
https://gamefaqs.gamespot.com/{platform}/{id}-{game}/faqs/{faq-id}?print=1
```

Fetch it with `curl -sL` and pipe to a file:

```bash
curl -sL "URL?print=1" -o raw.txt
```

## Step 2: Extract text from `<pre>` tags

The print page wraps the entire walkthrough in `<pre id="faqspan-1">` tags.
Extract with:

```bash
grep -oP '(?<=<pre[^>]*>).*?(?=</pre>)' raw.txt | sed 's/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g; s/&quot;/"/g' > text.txt
```

Or use Python/Node to do the extraction programmatically — strip HTML, decode
entities, join `<pre>` contents.

## Step 3: Parse the Table of Contents

GameFAQs walkthroughs have a consistent TOC format. Each section has a 4-letter
code used for searching. The TOC looks like:

```
 1. Introduction                             INRO
    1.1. Foreword                            FRWR
 6. Walkthrough                              WKTH
    6.1. An Ancient Civilization             ANCV
      6.1.1. The Town of Learning            TWLR
```

Parse with regex:
```
^\s*(\d+(?:\.\d+)*)\.?\s+(.+?)\s{2,}([A-Z]{4})\s*$
```

Group 1 = section number (e.g. "6.4.8"), Group 2 = title, Group 3 = 4-letter code.

The **heading level** is determined by counting dots in the number:
- `6` → `#` (h1)
- `6.1` → `##` (h2)
- `6.1.1` → `###` (h3)
- `6.4.8` → `###` (h3)

## Step 4: Split the body at section codes

In the body, section headers use the code prefixed with `C`:

```
***************************************************************************
6.4.8. A Living Tower                                                 CLVTW
***************************************************************************
```

Search for `C` + the 4-letter code from the TOC. The section content starts
after the header block (after the `***`, party info, and separator lines).

## Step 5: Convert to markdown

### Table of Contents
Generate a TOC at the top with anchor links:
```markdown
- [6.1. An Ancient Civilization](#s6-1)
  - [6.1.1. The Town of Learning](#s6-1-1)
  - [6.4.8. A Living Tower](#s6-4-8)
```

Anchor IDs: replace dots with hyphens, prefix with `s`: `s6-4-8`

### Section headings
```markdown
<a id="s6-4-8"></a>

### 6.4.8. A Living Tower
```

### Content formatting (line-by-line)

Walkthroughs mix ASCII art and prose on consecutive lines. Process line by line:

**ASCII art detection** — wrap in code blocks:
- Lines with 3+ pipe characters (`|`)
- Lines of repeated decorative chars (`____`, `****`, `====`, `----`)
- Lines where special chars outnumber letters
- Box-drawing patterns (`/`, `\`, `|` in combination)

**Equipment/party tables** — detect and wrap in code blocks:
- Lines with `Recommended`, `Starting`, `Equipment` followed by `|` chars

**Party events** — format as bold callouts:
```markdown
> **Alys joins the party (Level 7)**
```

### Prose editing (aggressive readability)

For plain text sections, act as an expert editor:

1. **Definition lists** — lines matching `Term      definition` (capital word
   followed by 2+ spaces) become bullet points:
   ```markdown
   - **Level** — Each playable character has a Level, ranging from 1 to 99.
   - **EXP** — Abbreviation for Experience Points, awarded after defeating enemies.
   ```

2. **Bold RPG terms** — auto-bold these abbreviations: HP, TP, EXP, ATK, DFS,
   MST, SP, MTL PWR. Also bold element names (Fire, Water, Energy, etc.) when
   used in a mechanical context.

3. **Paragraph splitting** — break long paragraphs into 2-3 sentence chunks
   for scannability.

4. **Step lists** — detect walkthrough directions (lines starting with action
   verbs: Go, Head, Walk, Take, Enter, Leave, Return, etc.) and format as
   clean paragraphs or bullet steps.

5. **Strip section header leaks** — remove lines matching
   `\d+\.\d+\. Title    CCODE` that bleed into adjacent section content.

## Step 6: Output

Save as `guide-<faq-id>.md`. The file should be a self-contained markdown file
with:
- Title: `# Game Name — Guide Name`
- Attribution: `> By Author — Converted from GameFAQs`
- TOC with `- [Section](anchor)` links
- Proper heading hierarchy
- ASCII art in code blocks
- Prose aggressively edited for readability

## Edge cases

- Some sections have no body code — skip them gracefully
- Blank lines within ASCII art should be preserved (don't break code blocks)
- Very long sections (boss strategies) may need sub-parsing
- Equipment tables with `|` chars should stay in code blocks, not be treated
  as markdown tables
- The TOC appears twice in the source (once in the intro, once in the body) —
  only parse the intro TOC

## Quick reference

```bash
# Fetch and convert in one pipeline:
curl -sL "https://gamefaqs.gamespot.com/GEN/563334-phantasy-star-iv/faqs/31907?print=1" \
  | grep -oP '(?<=<pre[^>]*>).*?(?=</pre>)' \
  | sed 's/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g' \
  > guide.md
```

Then process `guide.md` with the parsing and formatting rules above.
