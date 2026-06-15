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

**Research online for ambiguous achievements.** When the walkthrough content
alone doesn't give a clear answer, use these sources (in order of reliability):

- **RA Comments API for player tips** (MOST RELIABLE for ambiguous achievements):
  ```bash
  curl -s "https://retroachievements.org/API/API_GetComments.php?z=$RA_USER&y=$RA_KEY&i=<achievement-id>&t=2&c=50"
  ```
  Returns comments from the achievement's wall page. Filter out `"User": "Server"`
  auto-generated messages and focus on player comments which often contain exact
  strategies, locations, and tips. Save the most useful comment(s) in the
  `communityTips` field so they're available for future reference without
  re-fetching. This is the single best source for resolving ambiguous section
  placements — player comments often state the exact location or trigger.

- **RA API for achievement details**:
  ```bash
  curl -s "https://retroachievements.org/API/API_GetAchievementUnlocks.php?z=$RA_USER&y=$RA_KEY&a=<achievement-id>&c=1"
  ```
  Returns the full achievement object including the description with missable
  cutoff info. Useful for confirming cutoff points.

- **Web search**: Search `"<achievement name>" retroachievements phantasy star iv`
  to find player discussions, Reddit threads, and guide articles with
  strategies and tips. Use when the Comments API returns no useful player
  comments.

- **RA Game page**: `https://retroachievements.org/game/<game-id>` — lists all
  achievements for the game with descriptions. Note: the RA website blocks
  automated access (403) — prefer the API or web search.

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

5. **Missable achievements**: These are the most error-prone. The achievement
   description typically includes "(Missable)" or "(Missed upon...)" but may not
   clarify WHEN it becomes unobtainable. Do NOT just match to the first section
   that mentions the related content. Follow this process for EACH missable:

   **a) Check the RA Comments API for player tips FIRST:**
   ```bash
   curl -s "https://retroachievements.org/API/API_GetComments.php?z=$RA_USER&y=$RA_KEY&i=<achievement-id>&t=2&c=50"
   ```
   Player comments often reveal crucial info: whether an achievement is truly
   missable (vs. just hard to find), the exact cutoff point, or alternative
   locations where it can still be earned. Filter out `"User": "Server"` entries.

   **b) Query the RA API for the exact cutoff:**
   ```bash
   # Get achievement details including the missable description
   curl -s "https://retroachievements.org/API/API_GetAchievementUnlocks.php?z=$RA_USER&y=$RA_KEY&a=<achievement-id>&c=1"
   ```
   The `Achievement.Description` field typically includes the cutoff point,
   e.g. "(Missed upon finding Elsydeon.)" or "(Missed upon leaving Motavia.)"

   **c) Map the cutoff to a walkthrough section:**
   Translate the cutoff event to the specific section number where it occurs.
   For example, "Missed upon finding Elsydeon" → section 6.5.7 (Sword of the
   Espers). "Missed upon leaving Motavia" → section 6.2.12 (Upward Mobility
   — launching to Zelan leaves Motavia).

   **d) Search the web for additional player tips:**
   Search for the achievement name + "retroachievements" to find forum posts
   and guides with player strategies. Use when the Comments API provides
   insufficient information.

   **e) Write a concise tip** with the cutoff point and any strategic advice:
   ```markdown
   > 🥈 **Achievement Title** — Description _(RetroAchievements · 10 pts)_
   > ⚠ **Missable** — must be completed before [specific event] ([section X.Y]). [1-2 sentences of strategic advice].
   ```
   Example:
   ```markdown
   > 🥈 **Tectonic Tech** — Solve Plate System's earthquake malfunction. _(RetroAchievements · 10 pts)_
   > ⚠ **Missable** — must be completed before leaving Motavia (6.2.12). Shut down the Plate System controls in section 6.2.7 before launching to Zelan.
   ```
   If research doesn't clarify the cutoff, flag it as "cutoff unknown — verify manually."

6. **Post-game / secret achievements**: Sound test, optional dungeons, secret
   items — match to their dedicated sections (not to story sections).

7. **Stacking achievements at the same section**: Many boss/limit achievements
   map to the same section. That's correct — a single section can have 3-8
   achievements. Don't try to spread them out artificially.

8. **Achievements that happen DURING a section, not at the end**: If a section
   covers multiple rooms/areas and the achievement triggers partway through,
   it's fine to place it at the top of that section.

### Step 5: Produce achievements.json

After matching, write a single `achievements.json` file to the guide directory
in the gamemds repo. Do NOT inject blockquotes into section `.md` files.

**Schema:**

```json
{
  "schemaVersion": 1,
  "gameId": <game-id>,
  "gameTitle": "<game title>",
  "source": "https://retroachievements.org/game/<game-id>",
  "totalAchievements": <count>,
  "totalPoints": <sum of all points>,
  "achievements": [
    {
      "id": <RA achievement ID>,
      "title": "<achievement name>",
      "description": "<RA description text>",
      "points": <point value>,
      "badgeUrl": "https://retroachievements.org/Badge/<id>.png",
      "displayOrder": <RA display order>,
      "type": "<story|missable|collectible|challenge|secret|progress>",
      "missable": <true|false>,
      "missableCutoff": "<human-readable cutoff description, only if missable>",
      "missableCutoffSection": "<section number where it becomes unavailable, only if missable>",
      "section": "<walkthrough section number>",
      "confidence": "<high|medium|low>",
      "notes": "<strategic advice or clarification>",
      "communityTips": [
        {
          "user": "<RA username>",
          "text": "<useful player comment about this achievement>"
        }
      ]
    }
  ]
}
```

**Type classification:**

| Type | Criteria |
|---|---|
| `story` | Unavoidable story progression achievements |
| `missable` | Any achievement flagged as missable by RA or the skill |
| `collectible` | "Collect all X" or "find all Y" achievements spanning the whole game |
| `challenge` | Limit bosses, speedruns, difficulty modes |
| `secret` | Post-game, sound test, optional dungeons |
| `progress` | Milestone achievements (reach level X, complete chapter Y) that aren't story |

**Unmatched achievements**: set `confidence` to `"low"` and add a note explaining
why the match is uncertain. Do NOT omit achievements from the JSON.

### Step 6: Generate achievements.md

Run `node scripts/split-guide.js walkthrough.md guide/` which will:
- Generate `achievements.md` from `achievements.json`
- Insert a `0.1 Achievement Checklist` entry at the top of `toc.json`

### Step 7: Review with the user

Before finalizing, show a summary:

```
Matched: 87/93 achievements
Unmatched: 6 achievements (list them)
Low confidence: 3 matches (list them with candidate sections)

Proceed with injection? y/n
```

This lets the user spot-check and correct any mistakes before changes are
written.

### Step 8: Rebuild and deploy

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
- **Use the RA Comments API for any achievement with medium/low confidence.**
  Player comments are often definitive — they state the exact floor, town, or
  trigger condition. Save the best comment as `communityTips` so it persists
  in achievements.json.
- **communityTips is optional.** Only include it when a player comment
  provides useful information beyond what's in the achievement description.
  Server/auto-generated comments should never be included.
