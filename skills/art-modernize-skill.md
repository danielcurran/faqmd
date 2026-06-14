---
name: art-modernize
description: "Use when the user asks to modernize ASCII art in a walkthrough. Trigger keywords: modernize, art, ascii, maps, tables, upgrade, beautify."
---

# art-modernize — Modernize ASCII Art as HTML

Replaces tagged ASCII art blocks (maps, boss cards, stat blocks, menus,
equipment tables) with modern HTML components styled for mobile reading.

Uses the `<!-- MODERNIZE:TYPE -->` tags inserted by `scripts/reformat.js`
to find what needs attention.

## When to use

After converting a walkthrough:

```bash
node scripts/convert.js "<gamefaqs-url>" walkthrough.md
```

Then in opencode:

```
"Run art-modernize on walkthrough.md"
"Modernize maps and bosses only in walkthrough.md"
```

---

## Instructions for the agent

Follow these three steps in order. Do NOT modify the file until you have
processed all tagged blocks. After replacing, print a summary report.

### Step 1: Find tagged blocks

Scan the file for `<!-- MODERNIZE:TYPE -->` followed by a ``` code block.
Collect all matches with their type, file position, and code block text.

### Step 2: Generate HTML per type

For each tagged block, parse the ASCII content and generate HTML.

#### type=map

```html
<div class="game-map">
  <div class="map-row">
    <span class="map-location">Piata</span>
    <div class="map-services">
      <span class="map-service">Inn</span>
      <span class="map-price">5 MST</span>
    </div>
  </div>
</div>
```

Extract the location name (typically the first word on a pipe-delimited
row), then for each row extract service name and price. Strip decorative
border characters (¯, _, |, /, \). Remove repeated header rows.

#### type=boss

```html
<div class="boss-card">
  <div class="boss-header">BOSS #1</div>
  <div class="boss-name">Igglanova</div>
  <div class="boss-stats">
    <div class="boss-stat"><span class="stat-label">HP</span><span class="stat-value">300</span></div>
    <div class="boss-stat"><span class="stat-label">Recommended Level</span><span class="stat-value">12+</span></div>
  </div>
</div>
```

Extract boss number from "BOSS #N" markers. Extract boss name from the
line below. Extract HP, Recommended Level, Enemies, and Treasure entries.
Ignore decorative frame characters.

#### type=statblock

```html
<div class="stat-card">
  <div class="stat-header">Chaz Ashley</div>
  <div class="stat-grid">
    <div class="stat-item"><span class="stat-label">LV</span><span class="stat-value">99</span></div>
    <div class="stat-item"><span class="stat-label">HP</span><span class="stat-value">999/999</span></div>
    <div class="stat-item"><span class="stat-label">TP</span><span class="stat-value">999/999</span></div>
  </div>
</div>
```

Extract character name (usually in a "Name" cell of the ASCII layout).
Extract each stat label and value pair (LV, HP, TP, ATK, DFS, STRNGTH,
AGILITY, etc.). Ignore decorative art characters.

#### type=menu

```html
<div class="game-menu">
  <div class="menu-option">o ITEM</div>
  <div class="menu-option">o TECH</div>
  <div class="menu-option">o SKILL</div>
  <div class="menu-option">o EQUIP</div>
</div>
```

Extract menu option names from `|o OPTION` markers. Keep them in order.

#### type=equipment

```html
<table class="equipment-table">
  <tr><th class="eq-slot">Slot</th><th class="eq-item">Item</th></tr>
  <tr><td class="eq-slot">Head</td><td class="eq-item">LTHR-HELM</td></tr>
  <tr><td class="eq-slot">Right</td><td class="eq-item">HUNT-KNIFE</td></tr>
</table>
```

Extract equipment slots (Head, Right, Left, Body) and item names from
pipe-delimited rows. Skip decorative separator rows. If there are
multiple characters, create a separate table for each character or
add extra columns.

#### type=unknown

Read the block. Determine if it represents something clear (a diagram,
a decorative header, a spell list, etc.). If so, generate appropriate
HTML using one of the existing CSS classes or a simple layout. If
unclear, leave the block as-is. Do NOT remove unknown blocks.

For blocks you can improve, create a summary card or table. Add an
`<!-- MODERNIZE:unknown-to-something -->` comment to self-document.

### Step 3: Replace in file

For each processed block, replace the `<!-- MODERNIZE:TYPE -->` comment
AND the following ``` code block with the generated HTML. Keep the
`<!-- MODERNIZE:TYPE -->` comment above the HTML replacement so the
file remains self-documenting.

Leave two blank lines between replacements and surrounding content
so the markdown parser handles them correctly.

### Step 4: Polish decorative labels

The `formatDecorativeText()` function in `scripts/reformat.js` strips
simple decorative elements like `// DUNGEON #2 ¯¯\` and `\ Boss: Igglanova`
to `**DUNGEON #2**` and `**Boss:** Igglanova`. Scan for these bold labels
and make them visually clean:

**Dungeon/area headers** (all-caps or short bold labels like
`**DUNGEON #2**`, `**BIRTH VALLEY**`): wrap in a `<div class="section-marker">`
to give them visual weight as section dividers:
```html
<div class="section-marker">**DUNGEON #2**</div>
```

**Boss/sub-labels** (`**Boss:** Igglanova`, `**Enemies:** Xanafalgue`):
ensure there is a blank line before and after them for spacing. If
multiple labels are consecutive, group them.
No special HTML wrap needed — bold markdown alone is sufficient.

**Treasure/stat labels** already formatted as `**Key:** Value`:
these are already clean. Just ensure blank line spacing around them.

### Summary report

```
art-modernize complete
  map:        N modernized
  boss:       N modernized
  statblock:  N modernized
  menu:       N modernized
  equipment:  N modernized
  unknown:    N improved, N kept as-is
  decorative: N labels polished
  ───────────────────
  Total: N blocks processed + N labels polished
```

---

## Edge cases

- **Can't parse reliably**: leave the block as a code block. Mark it as
  kept as-is in the summary.
- **Consecutive HTML blocks**: leave exactly one blank line between them
  for consistent markdown parsing.
- **Block is empty**: skip it (remove the tag + empty block).
- **HTML includes `|` or `->` characters**: these are safe inside HTML
  (marked passes raw HTML through without processing).
- **File has no tags**: report "No tagged blocks found" and exit.
- **Partial mode**: if the user says "maps only" or "bosses only", skip
  other types.
