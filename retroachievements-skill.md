---
name: retroachievements
description: "Cross-reference RetroAchievements with walkthrough sections using AI-powered matching. Trigger keywords: retroachievements, achievements, cross-reference, RA, walkthrough achievements, achievement matching."
---

# retroachievements — AI-Powered Achievement-to-Walkthrough Matching

Match RetroAchievements to walkthrough sections using LLM reasoning instead of
simple keyword matching.

## Setup

Requires RetroAchievements credentials (only used to fetch achievement data):

```bash
export RA_USER=your_username
export RA_KEY=your_api_key
```

Get your key at https://retroachievements.org/controlpanel.php

## How it works

1. Fetch achievements from RetroAchievements API for a given game ID
2. Parse the walkthrough markdown into sections (title, section number, content)
3. Present each achievement to the LLM along with the relevant section candidates
4. The LLM reasons about which section(s) the achievement is achievable in
5. Inject matched achievements as callouts into the walkthrough

## Usage

```
"Match RetroAchievements for game 50 to guide/ walkthrough sections"
"Cross-reference achievements for game 5633 with walkthrough.md"
"Add achievement annotations from game ID 50 to my walkthrough"
```

## Instructions for the agent

When asked to match achievements to a walkthrough:

### Step 1: Fetch achievements

Use `crossref-achievements.js` with `--dump` to fetch and save achievements:

```bash
RA_USER=... RA_KEY=... node crossref-achievements.js <walkthrough.md> <game-id> --dump
```

Or fetch them directly via curl:

```bash
curl -s "https://retroachievements.org/API/API_GetGameInfoAndUserProgress.php?z=$RA_USER&y=$RA_KEY&g=<game-id>&u=$RA_USER"
```

### Step 2: Understand the walkthrough structure

Read the TOC (`guide/index.md` or the markdown file's table of contents) to
understand the walkthrough structure. Each section has:
- A section number (e.g., 6.4.8)
- A title (e.g., "A Living Tower")
- Content (the walkthrough text for that section)

### Step 3: Match each achievement

For each achievement, read its title and description. Then reason about:
- What event or milestone does this achievement describe?
- At what point in the game does this naturally occur?
- Which walkthrough section(s) cover this part of the game?
- Could a player realistically earn this achievement while following that section?

Consider:
- **Boss achievements**: Match to the section where you fight that boss
- **Story events**: Match to the section where the event happens
- **Collection/completion**: Match to sections where those items/enemies appear
- **Missable achievements**: Note which sections have missable content
- **End-game**: Match to the final/pre-final sections

If unsure between multiple sections, list all candidates with confidence levels.

### Step 4: Inject into markdown

For each matched achievement, add a callout in the matched section's markdown
file, right after the heading:

```markdown
> 🏅 **Achievement Title** — Achievement description _(RetroAchievements · 25 pts)_
```

Use medal emojis: 🏅 (25+ pts), 🥈 (10-24 pts), 🥉 (1-9 pts).

Append unmatched achievements at the end of the walkthrough in a separate
"RetroAchievements" section.

### Step 5: Update the site

After injecting achievements, update the guide files and push.

## Tips

- Read 2-3 sections around a candidate match to verify context
- If an achievement refers to something that happens across multiple sections
  (e.g., "collect all X"), match it to the LAST section where completion is possible
- Story-based achievements usually match the exact section where the cutscene/event plays
- Boss achievements sometimes span two sections (encounter + defeat) — prefer the
  section where the boss is actually fought
- If genuinely uncertain, mark as unmatched rather than guessing wrong
