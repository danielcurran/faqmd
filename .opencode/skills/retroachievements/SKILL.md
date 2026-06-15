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
"Match RetroAchievements for game <game-id> to guide/ walkthrough sections"
"Cross-reference achievements for game <game-id> with walkthrough.md"
```

---

## Instructions for the agent

Follow these steps in order. Do NOT skip the verification pass.

### Step 1: Pre-fetch achievement data

Run the fetch script to pull all achievements from the RA API:

```bash
node scripts/fetch-achievements.js --game=<game-id> --output=guide/achievements-raw.json --comments
```

With `--comments`, this also fetches player tips from the RA Comments API for
every achievement and stores them in `communityTips[]`. Without `--comments`,
achievement data is fetched but `communityTips` is left empty (the agent can
fetch comments on-demand for ambiguous achievements later).

The output JSON already has `id`, `title`, `description`, `points`, `badgeUrl`,
`displayOrder`, `type`, and `missable` pre-filled. The agent only needs to fill:
`section`, `confidence`, `notes`, `missableCutoffSection`.

Print the achievement list so the user can review before matching begins:

```
Achievement list for game <id> (N achievements):

1001  🥉  First Achievement            Description text here.                                1 pts
1002  🥉  Second Achievement           Description text here.                                5 pts
...
```

Ask the user to confirm the game and count before proceeding.

**Manual API reference (if the pre-fetch script cannot be used):**

```bash
# Fetch all achievements for a game
curl -s "https://retroachievements.org/API/API_GetGameInfoAndUserProgress.php?z=$RA_USER&y=$RA_KEY&g=<game-id>&u=$RA_USER"

# Fetch comments for a specific achievement
curl -s "https://retroachievements.org/API/API_GetComments.php?z=$RA_USER&y=$RA_KEY&i=<achievement-id>&t=2&c=50"

# Fetch achievement details (includes cutoff info)
curl -s "https://retroachievements.org/API/API_GetAchievementUnlocks.php?z=$RA_USER&y=$RA_KEY&a=<achievement-id>&c=1"
```

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
  → Match to the FIRST STORY SECTION where the mechanic becomes usable
     (based on when the required party members join or the mechanic is unlocked)
  → Do NOT place in appendix/reference sections (Combinations, Abilities, etc.)
  → Add this note: "This achievement can be earned over the course of the
     playthrough — it is not necessary or beneficial to grind for it at this point."
  → In Phantasy Star IV, for example: "Execute Combo TriBlaster" requires
     Chaz+Alys+Hahn → section 6.1.1 (first section all three are in the party),
     NOT section 12.1 (Combinations appendix).

If the achievement is a "LIMIT" or challenge variant of a boss:
  → Match to the SAME section as the non-limit version
  → These stack — the limit version goes right after the normal one
```

**Verify.** For each candidate section, read its actual content (use the Read
tool on the `.md` file). You're looking for evidence that the achievement's
trigger condition (location, character, item, boss name) appears IN THAT
SECTION.

**If the match is ambiguous or uncertain**, do NOT guess a section. Instead,
fetch the achievement's comments to get the exact location from players:

```bash
curl -s "https://retroachievements.org/API/API_GetComments.php?z=$RA_USER&y=$RA_KEY&i=<achievement-id>&t=2&c=50"
```

Filter out `"User": "Server"` auto-generated messages. Player comments often
contain the EXACT location, trigger, or strategy — far more precise than the
achievement description alone. Use these comments to:

1. **Extract location hints** — town names (Krup, Termi, Aiedo), dungeon floors
   ("7th floor of The Edge"), boss areas, or trigger conditions
2. **Search the walkthrough** for those location hints (use grep/search tools)
3. **Read the matching section** to find the exact anchor point
4. **Match to the section number** where the trigger location appears

Save the useful comment(s) in the `communityTips` field so the information
persists in achievements.json.

**Additional research sources** (when comments return no useful player input):

- **RA API for achievement details**:
  ```bash
  curl -s "https://retroachievements.org/API/API_GetAchievementUnlocks.php?z=$RA_USER&y=$RA_KEY&a=<achievement-id>&c=1"
  ```
  Returns the full achievement object including the description with missable
  cutoff info. Useful for confirming cutoff points.

- **Web search**: Search `"<achievement name>" retroachievements <game name>`
  to find player discussions, Reddit threads, and guide articles with
  strategies and tips.

- **RA Game page**: `https://retroachievements.org/game/<game-id>` — lists all
  achievements for the game with descriptions. Note: the RA website blocks
  automated access (403) — prefer the API or web search.

**Confidence levels:**

| Level | Criteria |
|---|---|
| High | The achievement's trigger (boss name, item, event) appears verbatim in the section content **OR** a player comment explicitly names the location/town/floor |
| Medium | The section's place in game progression strongly implies it, but the trigger isn't explicitly mentioned and no comments are available |
| Low | Best guess based on general game knowledge — mark these as "uncertain" |

If confidence is Low for any section, list it separately so the user can verify.

### Step 4: Common pitfalls (read before matching)

1. **Boss introduction vs. boss fight**: If a boss is mentioned in chapter
   introduction (section X.1) but fought later (section X.5), the achievement
   goes in X.5, not X.1. In Phantasy Star IV, for example, Zio is introduced
   in section 6.1.5 but fought in 6.2.11 — the achievement goes in 6.2.11.

2. **Progression-gated achievements**: "Reach the town of X" should map to the
   section where the player FIRST arrives at X, not every subsequent section
   where X is mentioned.

3. **Chapter/story arc start vs. completion**: "Complete the X quest" maps to
   the section where the quest RESOLVES, not where it begins.

4. **Collection achievements**: "Collect all X" typically spans the entire game.
   These are best placed in a dedicated appendix section (e.g., the items or
   enemies section at the end of the walkthrough), NOT in a story section.

5. **Mechanic achievements in appendix sections**: "Execute Combo X" or "Use
   Macro Y" achievements should go in the FIRST STORY SECTION where the mechanic
   becomes usable, NOT in appendix/reference sections (Combinations appendix,
   Abilities section, etc.). Determine when the required party members or
   abilities first become available, and place the achievement there. Add a note
   that it can be earned over the playthrough. In Phantasy Star IV, for example,
   TriBlaster (Chaz+Alys+Hahn) goes in section 6.1.1, not in the Combinations
   appendix (12.1).

6. **Missable achievements**: These are the most error-prone. The achievement
   description typically includes "(Missable)" or "(Missed upon...)" but may not
   clarify WHEN it becomes unobtainable. Do NOT just match to the first section
   that mentions the related content. Follow this process for EACH missable:

   **a) Fetch player comments to determine if it's actually missable and where:**
   ```bash
   curl -s "https://retroachievements.org/API/API_GetComments.php?z=$RA_USER&y=$RA_KEY&i=<achievement-id>&t=2&c=50"
   ```
   Player comments often reveal crucial info: whether an achievement is truly
   missable or available elsewhere, the exact cutoff point, and the trigger
   location. Filter out `"User": "Server"` entries. Use location hints from
   comments to search the walkthrough and pin down the exact section.

   **b) Query the RA API for the exact cutoff:**
   ```bash
   # Get achievement details including the missable description
   curl -s "https://retroachievements.org/API/API_GetAchievementUnlocks.php?z=$RA_USER&y=$RA_KEY&a=<achievement-id>&c=1"
   ```
   The `Achievement.Description` field typically includes the cutoff point,
   e.g. "(Missed upon finding Elsydeon.)" or "(Missed upon leaving Motavia.)"
   (real examples from Phantasy Star IV).

   **c) Map the cutoff to a walkthrough section:**
   Translate the cutoff event to the specific section number where it occurs.
   In Phantasy Star IV, for example: "Missed upon finding Elsydeon" → section
   6.5.7 (Sword of the Espers). "Missed upon leaving Motavia" → section 6.2.12
   (Upward Mobility — launching to Zelan leaves Motavia).

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
   (The above is a real example from the Phantasy Star IV walkthrough.)
   If research doesn't clarify the cutoff, flag it as "cutoff unknown — verify manually."

7. **Post-game / secret achievements**: Sound test, optional dungeons, secret
   items — match to their dedicated sections (not to story sections).

8. **Stacking achievements at the same section**: Many boss/limit achievements
   map to the same section. That's correct — a single section can have 3-8
   achievements. Don't try to spread them out artificially.

9. **Achievements that happen DURING a section, not at the end**: If a section
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

### Step 6: Validate achievements.json

Run the validation script to catch schema errors and section mismatches:

```bash
node scripts/validate-achievements.js guide/achievements.json
```

This checks:
- All required fields are present and valid
- Type and confidence enums are correct
- Every `section` value exists in `toc.json`
- Missable achievements have cutoff information
- No empty/unmatched sections
- Point totals match

### Step 7: Generate achievements.md

Run `node scripts/split-guide.js walkthrough.md guide/` which will:
- Generate `achievements.md` from `achievements.json`
- Insert a `0.1 Achievement Checklist` entry at the top of `toc.json`

### Step 8: Review with the user

Before finalizing, show a summary:

```
Matched: 87/93 achievements
Unmatched: 6 achievements (list them)
Low confidence: 3 matches (list them with candidate sections)

Proceed with injection? y/n
```

This lets the user spot-check and correct any mistakes before changes are
written.

### Step 9: Rebuild and deploy

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
  Player comments often state the exact floor, town, or trigger condition.
  Then search the walkthrough for that location to find the correct section.
  Example from the Phantasy Star IV walkthrough: "Welcome To The Phantasy
  Zone" described as "Opa! Opa!" was originally placed in section 18 (Sound
  Test), but a player comment revealed "you must see the dancers dance in
  Aiedo" — searching the walkthrough for "dance" found it in section 6.2.1
  (Hunters Guild theatre).
- **Save the best comment as `communityTips`** so it persists in
  achievements.json for future reference without re-fetching the API.

## Worked Example

The PSIV walkthrough at `guide/` in the gamemds repo is a fully worked example.
The skill's examples (TriBlaster placement, Elsydeon cutoff, Welcome To The
Phantasy Zone comment resolution) all reference real matches made against that
walkthrough. When uncertain about a rule, the agent can read `guide/toc.json`
and `guide/achievements.json` from the gamemds repo to see how the pattern was
applied in practice.
