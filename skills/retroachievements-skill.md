---
name: retroachievements
description: "Cross-reference RetroAchievements with walkthrough sections using AI-powered matching. Trigger keywords: retroachievements, achievements, cross-reference, RA, walkthrough achievements, achievement matching."
---

# retroachievements — AI-Powered Achievement-to-Walkthrough Matching

Match RetroAchievements to walkthrough sections using LLM reasoning instead of
keyword matching. No scripts required — the agent does everything.

## Setup

Requires RetroAchievements credentials to fetch achievement data:

```bash
export RA_USER=your_username
export RA_KEY=your_api_key
```

Get your key at https://retroachievements.org/controlpanel.php

## Usage

In opencode:

```
"Match RetroAchievements for game 50 to guide/ walkthrough sections"
"Cross-reference achievements for game 5633 with walkthrough.md"
"Add achievement annotations from game ID 50 to my walkthrough"
```

## Instructions for the agent

### Step 1: Fetch achievements

Use curl to fetch achievement data from the RetroAchievements API:

```bash
curl -s "https://retroachievements.org/API/API_GetGameInfoAndUserProgress.php?z=$RA_USER&y=$RA_KEY&g=<game-id>&u=$RA_USER"
```

The response contains an `Achievements` object keyed by achievement ID. Each
achievement has: `ID`, `Title`, `Description`, `Points`, `DisplayOrder`.

Save the response to `achievements.json` for reference:

```bash
curl -s "..." -o guide/achievements.json
```

### Step 2: Understand the walkthrough

Read `guide/index.md` or the main markdown file's table of contents to
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

Read 2-3 sections around each candidate to verify context before matching.

### Step 4: Inject into markdown

For each matched achievement, add a callout in the section's `.md` file right
after the heading:

```markdown
> 🏅 **Achievement Title** — Achievement description _(RetroAchievements · 25 pts)_
```

Use medal emojis: 🏅 (25+ pts), 🥈 (10-24 pts), 🥉 (1-9 pts).

Append unmatched achievements at the end of the walkthrough under a
`## RetroAchievements` section.

### Step 5: Rebuild and deploy

After injecting achievements, run the splitter and push:

```bash
node scripts/split-guide.js walkthrough.md guide/
git add -f guide/ && git commit -m "feat: add RetroAchievements annotations" && git push
```
