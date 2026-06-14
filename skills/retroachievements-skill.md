---
name: retroachievements
description: "Cross-reference RetroAchievements with walkthrough sections using AI-powered matching. Trigger keywords: retroachievements, achievements, cross-reference, RA, walkthrough achievements, achievement matching."
---

# retroachievements — AI-Powered Achievement-to-Walkthrough Matching

Match RetroAchievements to walkthrough sections using LLM reasoning. The agent
reads the actual walkthrough content to verify each match, producing far more
accurate results than keyword-matching scripts.

## Setup

```bash
export RA_USER=your_username
export RA_KEY=your_api_key
# Get a key at https://retroachievements.org/controlpanel.php
```

## Usage

```
"Match RetroAchievements for game 50 to guide/ walkthrough sections"
"Cross-reference achievements for game 5633 with walkthrough.md"
```

---

## Instructions for the agent

Follow these steps in order. Do NOT skip the verification pass.

### Step 1: Fetch achievements

```bash
curl -s "https://retroachievements.org/API/API_GetGameInfoAndUserProgress.php?z=$RA_USER&y=$RA_KEY&g=<game-id>&u=$RA_USER" -o /tmp/ra.json
```

Each achievement has: `ID`, `Title`, `Description`, `Points`, `DisplayOrder`.

Print the full list so the user can review before matching begins:

```
Achievement list for game <id> (N achievements):

3807  🥉  Hahn                       Recruit Hahn.                                          1 pts
3819  🥉  Academy Infestation        Solve the monster situation in the academy basement.   5 pts
...
```

Ask the user to confirm the game and count before proceeding.

### Step 2: Understand the walkthrough structure

Read `guide/index.md` or the main markdown's Table of Contents. Build a mental
map of the game's progression through the section numbers. Identify:

- Where each major story beat happens
- Where bosses are fought
- Where side quests and optional content live
- Where items, characters, and locations are introduced

### Step 3: Match — one achievement at a time

For EACH achievement, do NOT guess. Follow this decision tree:

**Start with the description.** What specific action triggers this achievement?

```
If the description mentions a LOCATION (cave, tower, town, temple):
  → Read the section(s) where the player visits that location
  → Match to the section where the player REACHES or CLEARS the location

If the description mentions a CHARACTER (join, recruit, interact):
  → Match to the section where that character FIRST becomes available

If the description mentions a BOSS (defeat, encounter):
  → Match to the section where the boss BATTLE takes place
  → NOT the section where the boss is introduced or foreshadowed

If the description mentions an ITEM (acquire, equip, use):
  → Match to the section where the item is FIRST obtainable
  → Or the section describing it (character/item lists)

If the description mentions a MECHANIC (combo, macro, technique):
  → Match to the section that EXPLAINS that mechanic
  → Or the section where it first becomes usable

If the achievement is a "LIMIT" or challenge variant of a boss:
  → Match to the SAME section as the non-limit version
  → These stack — the limit version goes right after the normal one
```

**Verify.** For each candidate section, read its actual content (use the Read
tool on the `.md` file). You're looking for evidence that the achievement's
trigger condition (location, character, item, boss name) appears IN THAT
SECTION.

**Confidence levels:**

| Level | Criteria |
|---|---|
| High | The achievement's trigger (boss name, item, event) appears verbatim in the section content |
| Medium | The section's place in game progression strongly implies it, but the trigger isn't explicitly mentioned |
| Low | Best guess based on general game knowledge — mark these as "uncertain" |

If confidence is Low for any section, list it separately so the user can verify.

### Step 4: Common pitfalls (read before matching)

1. **Boss introduction vs. boss fight**: If a boss is mentioned in section
   6.1.5 but fought in 6.4.8, the achievement goes in 6.4.8, not 6.1.5.

2. **Progression-gated achievements**: "Reach the town of X" should map to the
   section where the player FIRST arrives at X, not every subsequent section
   where X is mentioned.

3. **Chapter/story arc start vs. completion**: "Complete the X quest" maps to
   the section where the quest RESOLVES, not where it begins.

4. **Collection achievements**: "Collect all X" typically spans the entire game.
   These are best placed in a dedicated appendix section (e.g., the items or
   enemies section at the end of the walkthrough), NOT in a story section.

5. **Missable achievements**: Flag these explicitly. The achievement
   description usually includes "(Missable)". Note this in the callout.

6. **Post-game / secret achievements**: Sound test, optional dungeons, secret
   items — match to their dedicated sections (not to story sections).

7. **Stacking achievements at the same section**: Many boss/limit achievements
   map to the same section. That's correct — a single section can have 3-8
   achievements. Don't try to spread them out artificially.

8. **Achievements that happen DURING a section, not at the end**: If a section
   covers multiple rooms/areas and the achievement triggers partway through,
   it's fine to place it at the top of that section.

### Step 5: Inject achievements

After matching, inject each achievement as a blockquote directly into the
section's `.md` file. Place it right after the first heading in the file (after
the `<a id="">` tag and the `##`/`###` heading).

**Format:**

```markdown
> 🏅 **Achievement Title** — Achievement description _(RetroAchievements · 25 pts)_
```

Use medal emojis: 🏅 (25+ pts), 🥈 (10-24 pts), 🥉 (1-9 pts).

**Ordering within a section**: sort by points (highest first), then by title.

**If a section already has achievements from a previous run**: remove them first
before injecting new ones. Don't duplicate.

**Unmatched achievements**: append at the end of the walkthrough under a
`## RetroAchievements` section with a note that they couldn't be confidently
matched.

### Step 6: Review with the user

Before finalizing, show a summary:

```
Matched: 87/93 achievements
Unmatched: 6 achievements (list them)
Low confidence: 3 matches (list them with candidate sections)

Proceed with injection? y/n
```

This lets the user spot-check and correct any mistakes before changes are
written.

### Step 7: Rebuild and deploy

After injection:

```bash
node scripts/split-guide.js walkthrough.md guide/
git add -f guide/ && git commit -m "feat: add RetroAchievements annotations" && git push
```

## Tips for accuracy

- Read section content, not just titles. A section titled "The Dark Tower" might
  not actually contain the boss fight — it could be the lead-up. Read it.
- Cross-reference achievement descriptions with the walkthrough text. If the
  achievement says "defeat the Dark Wizard in the Frozen Cave" but the
  walkthrough section for the Frozen Cave doesn't mention the Dark Wizard,
  you're looking at the wrong section.
- When in doubt, read the previous and next section too. Boss fights often span
  two sections (preparation + battle).
- Keep a running list of where each character joins, each boss is fought, and
  each major location is visited. This reference list speeds up matching.
- If the walkthrough has a separate "Boss Strategies" section, check it to
  verify which bosses appear where in the story.
