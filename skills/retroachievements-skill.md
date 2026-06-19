---
name: retroachievements
description: "Cross-reference RetroAchievements with walkthrough sections using AI-powered matching. Trigger keywords: retroachievements, achievements, cross-reference, RA, walkthrough achievements, achievement matching."
---

# retroachievements — Achievement-to-Walkthrough Matching

Match RetroAchievements to walkthrough sections. The fetch script handles all API
interaction and pre-fills most fields. The agent reads walkthrough content to
assign each achievement to the correct section, verifies matches, and fills in
the remaining fields.

> **Model note:** This skill involves reading long walkthroughs and
> cross-referencing 50-100+ achievements against section content. It works
> best on `deepseek-v4-pro`. If you're running on `deepseek-v4-flash`,
> tell the user and recommend they switch to Pro before proceeding.

> **Related skills:**
> - `faqmd` — convert the walkthrough first
> - `reformat-review` — polish formatting before matching
> - `live-review` — final QA after splitting

## What the script handles

`fetch-achievements.js` pre-fills these fields automatically:
`id`, `title`, `description`, `points`, `badgeUrl`, `displayOrder`, `type`,
`missable`, `missableCutoff`, `communityTips`

The agent only fills: `section`, `confidence`, `notes`, `missableCutoffSection`,
`ongoing`

`validate-achievements.js` checks schema, section cross-references, point
totals, and required fields.

## Workflow

### Step 1: Fetch achievement data

Ask the user for the RetroAchievements game ID. Do NOT attempt to find it
via web search, the RA API, or any other lookup method — the user knows
the game and will provide the ID.

```bash
node scripts/fetch-achievements.js --game=<game-id> --output=guide/achievements-raw.json --comments
```

With `--comments`, player tips are fetched from the RA Comments API and stored
in `communityTips[]`. Without it, `communityTips` is empty (fetch on-demand
later for ambiguous achievements).

Print the achievement list so the user can confirm before matching:

```
Achievement list for game <id> (N achievements):

1001  🥉  First Achievement            Description text here.     1 pts
1002  🥉  Second Achievement           Description text here.     5 pts
...
```

Ask the user to confirm the game and count before proceeding.

**Manual API fallback** (if the script can't be used):

```bash
# All achievements for a game
curl -s "https://retroachievements.org/API/API_GetGameInfoAndUserProgress.php?z=$RA_USER&y=$RA_KEY&g=<game-id>&u=$RA_USER"

# Comments for a specific achievement
curl -s "https://retroachievements.org/API/API_GetComments.php?z=$RA_USER&y=$RA_KEY&i=<achievement-id>&t=2&c=50"

# Achievement details (includes missable cutoff info)
curl -s "https://retroachievements.org/API/API_GetAchievementUnlocks.php?z=$RA_USER&y=$RA_KEY&a=<achievement-id>&c=1"
```

### Step 2: Map the walkthrough structure

Read `guide/index.md` or the main markdown's Table of Contents. Build a mental
map of game progression: where bosses are fought, characters join, locations
are visited, side quests open and close.

### Step 3: Match each achievement

For each achievement, follow this decision tree:

**Location** (cave, tower, town, temple) → match to the section where the player
**reaches or clears** that location.

**Character** (join, recruit, interact) → match to the section where that
character **first becomes available**.

**Boss** (defeat, encounter) → match to the section where the **battle** takes
place, not where the boss is introduced.

**Item** (acquire, equip, use) → match to the section where the item is **first
obtainable**.

**Mechanic** (combo, macro, technique) → match to the **first story section**
where the mechanic becomes usable (based on when required party members join or
the mechanic unlocks). Do NOT place in appendix/reference sections. Add a note:
"Completes naturally over the playthrough — no grinding needed."

**Limit/challenge boss** → same section as the normal version. They stack.

**Verify each match** by reading the actual section content. The achievement's
trigger (boss name, item, location) must appear in that section's text.

**If ambiguous**, fetch player comments:

```bash
curl -s "https://retroachievements.org/API/API_GetComments.php?z=$RA_USER&y=$RA_KEY&i=<achievement-id>&t=2&c=50"
```

Filter out `"User": "Server"` entries. Use location hints from comments to
search the walkthrough and pin down the exact section. Save useful comments in
`communityTips`.

**Confidence levels:**

| Level | Criteria |
|---|---|
| High | Trigger appears verbatim in section content, or player comment names the location |
| Medium | Section's place in progression strongly implies it, but trigger isn't explicit |
| Low | Best guess from general knowledge — flag for user verification |

### Step 4: Common pitfalls

1. **Boss introduction vs. fight** — achievement goes in the fight section, not
   the intro section.
2. **Progression-gated** — "Reach town X" → first arrival, not every mention.
3. **Quest completion** — match to where the quest **resolves**, not begins.
4. **Collection achievements** — place in the dedicated appendix section (items,
   enemies), not a story section.
5. **Mechanic achievements** — first story section where usable, not appendix.
6. **Missable achievements** — most error-prone. Fetch comments, check the RA
   API for cutoff descriptions (`(Missed upon...)`), map the cutoff event to a
   section number. Write a concise tip with the cutoff and strategic advice.
7. **Post-game / secret** — match to their dedicated sections.
8. **Stacking at same section** — correct. One section can have 3-8 achievements.

### Step 5: Write achievements.json

Write a single `achievements.json` to the guide directory. Do NOT inject
blockquotes into section `.md` files.

The schema is defined in `AGENTS.md` — reference it for the full field list.
The agent fills: `section`, `confidence`, `notes`, `missableCutoffSection`,
`ongoing`. All other fields are pre-filled by the fetch script.

**Type classification:**

| Type | Criteria |
|---|---|
| `story` | Unavoidable story progression |
| `missable` | Flagged missable by RA or the skill |
| `collectible` | "Collect all X" spanning the whole game |
| `challenge` | Limit bosses, speedruns, difficulty modes |
| `secret` | Post-game, sound test, optional dungeons |
| `progress` | Milestones that aren't story |

**Ongoing achievements:** Set `ongoing: true` for cumulative actions ("defeat X
enemies", "cast Y spells Z times"). Place at the earliest available section
with a note about natural completion.

**Unmatched achievements:** Set `confidence: "low"` with a note. Never omit.

### Step 6: Validate

```bash
node scripts/validate-achievements.js guide/achievements.json
```

This checks all required fields, type/confidence enums, section cross-references
against `toc.json`, missable cutoffs, and point totals.

### Step 7: Generate achievements.md

```bash
node scripts/split-guide.js walkthrough.md guide/
```

This reads `achievements.json` and generates `achievements.md` with a checklist
and missable table, and inserts a `0.1 Achievement Checklist` entry into
`toc.json`.

### Step 8: Review with the user

Show a summary before finalizing:

```
Matched: 87/93 achievements
Unmatched: 6 achievements (list them)
Low confidence: 3 matches (list them with candidate sections)

Proceed? y/n
```