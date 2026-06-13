#!/usr/bin/env node
// Cross-reference walkthrough markdown with RetroAchievements
// Usage: node crossref-achievements.js <markdown-file> <RA-game-id>
// Requires: RA_USER and RA_KEY env vars (from https://retroachievements.org/controlpanel.php)

const fs = require('fs');
const { buildAuthorization, getGameInfoAndUserProgress, getGameList } = require('@retroachievements/api');

const USERNAME = process.env.RA_USER;
const API_KEY = process.env.RA_KEY;

if (!USERNAME || !API_KEY) {
  console.error('Set RA_USER and RA_KEY environment variables');
  console.error('Get your key at: https://retroachievements.org/controlpanel.php');
  process.exit(1);
}

const auth = buildAuthorization({ username: USERNAME, webApiKey: API_KEY });

const inputFile = process.argv[2] || 'walkthrough.md';
const gameArg = process.argv[3];

if (!gameArg) {
  console.error('Usage: node crossref-achievements.js <markdown-file> <RA-game-id-or-name>');
  console.error('  node crossref-achievements.js walkthrough.md 5633');
  console.error('  node crossref-achievements.js walkthrough.md "Phantasy Star IV"');
  process.exit(1);
}

// Step 0: Resolve game ID (numeric or search by name)
async function resolveGameId(arg) {
  const num = parseInt(arg);
  if (!isNaN(num)) return num;

  // Search by name
  console.log('Searching for: "' + arg + '"...');
  const results = await getGameList(auth, { consoleId: 1 }); // 1 = Mega Drive/Genesis
  // Also search other consoles
  const allResults = results;
  for (const g of allResults) {
    if (g.Title && g.Title.toLowerCase().includes(arg.toLowerCase())) {
      console.log('Found: ' + g.Title + ' (ID: ' + g.ID + ', Achievements: ' + g.NumAchievements + ')');
      return g.ID;
    }
  }

  // Try broader search
  for (const g of allResults) {
    const words = arg.toLowerCase().split(/\s+/);
    const title = (g.Title || '').toLowerCase();
    if (words.every(w => title.includes(w))) {
      console.log('Partial match: ' + g.Title + ' (ID: ' + g.ID + ')');
      return g.ID;
    }
  }

  console.error('Game not found: ' + arg);
  process.exit(1);
}

// Step 1: Parse the walkthrough markdown to build an index of sections
function parseSections(md) {
  const sections = [];
  const lines = md.split('\n');
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match anchor IDs like: <a id="s6-4-8"></a>
    const anchorMatch = line.match(/<a id="(s\d+(?:-\d+)*)"><\/a>/);
    if (anchorMatch) {
      if (current) sections.push(current);
      current = { anchor: anchorMatch[1], title: '', line: i, keywords: [] };
      continue;
    }
    // Match section heading after anchor
    if (current && line.startsWith('#')) {
      current.title = line.replace(/^#+\s+/, '').trim();
      // Extract keywords from the title
      current.keywords = current.title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    }
  }
  if (current) sections.push(current);
  return sections;
}

// Step 2: Find relevant sections for a given achievement
function findSections(achievement, sections) {
  const titleWords = (achievement.Title || '').toLowerCase().split(/\s+/);
  const descWords = (achievement.Description || '').toLowerCase().split(/\s+/);
  const searchWords = [...new Set([...titleWords, ...descWords])].filter(w => w.length > 3);

  const scored = sections.map(s => {
    let score = 0;
    const sectionText = (s.title + ' ' + s.keywords.join(' ')).toLowerCase();
    for (const w of searchWords) {
      if (sectionText.includes(w)) score += w.length;
      // Bonus for boss/location keywords
      if (/^(tower|castle|cave|valley|temple|dungeon|fort|ruins|town|village|fortress)$/i.test(w)) score += 5;
      if (/^(defeat|defeated|boss|obtain|acquire|find|collect|reach)$/i.test(w)) score += 3;
    }
    return { ...s, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  return scored.slice(0, 2); // Top 2 matches
}

// Step 3: Inject achievements into the markdown
function injectAchievements(md, achievements, sections) {
  const lines = md.split('\n');
  const injections = {}; // line number → array of strings to insert

  for (const ach of achievements) {
    const matches = findSections(ach, sections);
    if (matches.length === 0) continue;

    const best = matches[0];
    // Insert after the section heading line (which is after the anchor)
    const injectLine = best.line + 1;

    if (!injections[injectLine]) injections[injectLine] = [];
    const medal = ach.Points >= 25 ? '🏅' : ach.Points >= 10 ? '🥈' : '🥉';
    injections[injectLine].push(
      '> ' + medal + ' **' + ach.Title + '** — ' + ach.Description + ' _(RetroAchievements · ' + ach.Points + ' pts)_',
    );
  }

  // Build output with injections in reverse line order
  for (const lnum of Object.keys(injections).sort((a, b) => b - a)) {
    const inserts = injections[lnum];
    lines.splice(lnum, 0, '', ...inserts, '');
  }

  // Add summary at the top
  const totalPts = achievements.reduce((s, a) => s + a.Points, 0);
  const matched = Object.keys(injections).length;
  const summary = [
    '',
    '---',
    '',
    '> 🏆 **RetroAchievements** — ' + matched + ' of ' + achievements.length + ' achievements matched (' + totalPts + ' total pts)',
    '',
  ];
  // Insert after the TOC section (find the last ---)
  const tocEnd = lines.findIndex((l, i) => i > 5 && l.startsWith('---') && lines[i + 1]?.startsWith('#'));
  if (tocEnd > 0) {
    lines.splice(tocEnd + 1, 0, ...summary);
  }

  return lines.join('\n');
}

// Main
(async function () {
  const gameId = await resolveGameId(gameArg);
  console.log('Fetching achievements for game ID ' + gameId + '...');
  const data = await getGameInfoAndUserProgress(auth, { gameId, username: USERNAME });

  const achievements = (data.achievements || []).sort((a, b) => (a.DisplayOrder || 0) - (b.DisplayOrder || 0));
  console.log('Found ' + achievements.length + ' achievements');

  console.log('Parsing markdown sections...');
  const md = fs.readFileSync(inputFile, 'utf8');
  const sections = parseSections(md);
  console.log('Found ' + sections.length + ' sections');

  console.log('Matching achievements to sections...');
  const output = injectAchievements(md, achievements, sections);

  const outFile = inputFile.replace(/\.md$/, '-achievements.md');
  fs.writeFileSync(outFile, output);
  console.log('Saved to ' + outFile);
})();
