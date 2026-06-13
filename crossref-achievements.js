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

const auth = buildAuthorization({ userName: USERNAME, webApiKey: API_KEY });

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
    if (g.title && g.title.toLowerCase().includes(arg.toLowerCase())) {
      console.log('Found: ' + g.title + ' (ID: ' + g.id + ', Achievements: ' + g.numAchievements + ')');
      return g.id;
    }
  }

  // Try broader search
  for (const g of allResults) {
    const words = arg.toLowerCase().split(/\s+/);
    const title = (g.title || '').toLowerCase();
    if (words.every(w => title.includes(w))) {
      console.log('Partial match: ' + g.title + ' (ID: ' + g.id + ')');
      return g.id;
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
    const anchorMatch = line.match(/<a id="(s\d+(?:-\d+)*)"><\/a>/);
    if (anchorMatch) {
      if (current) {
        current.body = current.bodyLines.join('\n').toLowerCase();
        delete current.bodyLines;
        sections.push(current);
      }
      current = { anchor: anchorMatch[1], title: '', line: i, keywords: [], bodyLines: [], body: '' };
      continue;
    }
    if (current) {
      if (!current.title && line.startsWith('#')) {
        current.title = line.replace(/^#+\s+/, '').trim();
        current.keywords = current.title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      } else if (current.title) {
        // Collect body text until next anchor (max 200 lines per section)
        if (current.bodyLines.length < 200 && line.trim() && !line.startsWith('#')) {
          current.bodyLines.push(line.trim());
        }
      }
    }
  }
  if (current) {
    current.body = current.bodyLines.join('\n').toLowerCase();
    delete current.bodyLines;
    sections.push(current);
  }
  return sections;
}

// Boss name → section anchor mapping for guaranteed matches
const BOSS_MAP = {
  'igglanova': ['s15-1-1', 's15-1-2'],
  'juza': ['s15-2-1'],
  'zio': ['s15-2-2', 's15-2-4'],
  'gy-laguiah': ['s15-2-3', 's15-3-2'],
  'chaossorcr': ['s15-2-5'],
  'dark force i': ['s15-3-1'],
  'dark force ii': ['s15-4-3'],
  'dark force iii': ['s15-5-1'],
  'd-elm-lars': ['s15-3-3'],
  'carnivorous trees': ['s15-3-4'],
  'xe-a-thouls': ['s15-4-1'],
  'lashiec': ['s15-4-2'],
  'de-vars': ['s15-5-2'],
  'sa-lews': ['s15-5-3'],
  'profound darkness': ['s15-5-4'],
  'king rappy': ['s15-6-2'],
  'fract ooze': ['s15-6-1'],
  'dominators': ['s15-6-3'],
  'alys': ['s15-6-4'],
};

// Section number → anchor mapping
const SECTION_MAP = {
  '6.1.1': 's6-1-1', '6.1.2': 's6-1-2', '6.1.3': 's6-1-3', '6.1.4': 's6-1-4',
  '6.1.5': 's6-1-5', '6.1.6': 's6-1-6', '6.1.7': 's6-1-7', '6.1.8': 's6-1-8',
  '6.1.9': 's6-1-9', '6.1.10': 's6-1-10', '6.1.11': 's6-1-11',
  '6.2.1': 's6-2-1', '6.2.2': 's6-2-2', '6.2.3': 's6-2-3', '6.2.4': 's6-2-4',
  '6.2.5': 's6-2-5', '6.2.6': 's6-2-6', '6.2.7': 's6-2-7', '6.2.8': 's6-2-8',
  '6.2.9': 's6-2-9', '6.2.10': 's6-2-10', '6.2.11': 's6-2-11', '6.2.12': 's6-2-12',
  '6.2.13': 's6-2-13',
  '6.3.1': 's6-3-1', '6.3.2': 's6-3-2', '6.3.3': 's6-3-3', '6.3.4': 's6-3-4',
  '6.3.5': 's6-3-5', '6.3.6': 's6-3-6', '6.3.7': 's6-3-7', '6.3.8': 's6-3-8',
  '6.3.9': 's6-3-9', '6.3.10': 's6-3-10',
  '6.4.1': 's6-4-1', '6.4.2': 's6-4-2', '6.4.3': 's6-4-3', '6.4.4': 's6-4-4',
  '6.4.5': 's6-4-5', '6.4.6': 's6-4-6', '6.4.7': 's6-4-7', '6.4.8': 's6-4-8',
  '6.4.9': 's6-4-9', '6.4.10': 's6-4-10',
  '6.5.1': 's6-5-1', '6.5.2': 's6-5-2', '6.5.3': 's6-5-3', '6.5.4': 's6-5-4',
  '6.5.5': 's6-5-5', '6.5.6': 's6-5-6', '6.5.7': 's6-5-7', '6.5.8': 's6-5-8',
  '6.5.9': 's6-5-9', '6.5.10': 's6-5-10', '6.5.11': 's6-5-11',
};

// Step 2: Find relevant sections for a given achievement
function findSections(achievement, sections) {
  const title = (achievement.title || '').toLowerCase();
  const desc = (achievement.description || '').toLowerCase();
  const fullText = title + ' ' + desc;

  // 1. Check boss map for guaranteed matches
  for (const [boss, anchors] of Object.entries(BOSS_MAP)) {
    if (fullText.includes(boss)) {
      const matched = anchors.map(a => sections.find(s => s.anchor === a)).filter(Boolean);
      if (matched.length > 0) return matched.map(s => ({ ...s, score: 100 }));
    }
  }

  // 2. Extract search terms: words, phrases, and special terms
  const words = fullText.split(/[\s,\(\)\.\-–—]+/).filter(w => w.length > 2);
  // Also extract 2-3 word phrases
  const phrases = [];
  const allWords = fullText.split(/\s+/).filter(w => w.length > 1);
  for (let i = 0; i < allWords.length - 2; i++) {
    phrases.push(allWords.slice(i, i + 2).join(' '));
    phrases.push(allWords.slice(i, i + 3).join(' '));
  }

  const scored = sections.map(s => {
    let score = 0;
    const titleText = s.title.toLowerCase();
    const allText = titleText + ' ' + (s.body || '');

    // Title matches (weighted 5x)
    for (const w of words) {
      if (titleText.includes(w)) score += w.length * 5;
    }

    // Body matches — only if there's already a title or phrase match
    if (score > 0 || phrases.some(p => titleText.includes(p) || (s.body && s.body.includes(p)))) {
      for (const w of words) {
        if (s.body && s.body.includes(w)) score += w.length;
      }
    }

    // Phrase matches in title (weighted 5x - very strong signal)
    for (const p of phrases) {
      if (titleText.includes(p)) score += p.length * 5;
      else if (s.body && s.body.includes(p)) score += p.length * 2;
    }

    // Location keyword bonus
    if (/tower|castle|cave|valley|temple|dungeon|fort|ruins|town|village|fortress|academy|basement|mansion|shrine|lab/i.test(titleText)) {
      for (const w of words) {
        if (/^tower|castle|cave|valley|temple|dungeon|fort|ruins|town|village|fortress|academy|basement|mansion|shrine|lab$/i.test(w)) score += 10;
      }
    }

    // Section number matching (if achievement mentions a section number)
    const sectionNumMatch = fullText.match(/(\d+\.\d+(?:\.\d+)?)/);
    if (sectionNumMatch && titleText.includes(sectionNumMatch[1])) score += 50;

    return { ...s, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  // Minimum score threshold
  if (scored.length === 0 || scored[0].score < 8) return [];

  // If the top match has a very high score, only return it
  if (scored[0].score > 30) return scored.slice(0, 1);

  return scored.slice(0, 2);
}

// Step 3: Inject achievements into the markdown
function injectAchievements(md, achievements, sections) {
  const lines = md.split('\n');
  const injections = {}; // line number → array of strings to insert
  const unmatched = [];

  for (const ach of achievements) {
    const matches = findSections(ach, sections);
    if (matches.length === 0) {
      unmatched.push(ach);
      continue;
    }

    const best = matches[0];
    const injectLine = best.line + 1;

    if (!injections[injectLine]) injections[injectLine] = [];
    const medal = ach.points >= 25 ? '🏅' : ach.points >= 10 ? '🥈' : '🥉';
    injections[injectLine].push(
      '> ' + medal + ' **' + ach.title + '** — ' + ach.description + ' _(RetroAchievements · ' + ach.points + ' pts)_',
    );
  }

  // Build output with injections in reverse line order
  for (const lnum of Object.keys(injections).sort((a, b) => b - a)) {
    lines.splice(lnum, 0, '', ...injections[lnum], '');
  }

  // Append unmatched achievements at the end
  if (unmatched.length > 0) {
    lines.push('', '<a id="s-achievements"></a>', '', '## RetroAchievements', '');
    lines.push('These achievements could not be matched to a specific walkthrough section:');
    lines.push('');
    for (const ach of unmatched.sort((a, b) => b.points - a.points)) {
      const medal = ach.points >= 25 ? '🏅' : ach.points >= 10 ? '🥈' : '🥉';
      lines.push('- ' + medal + ' **' + ach.title + '** — ' + ach.description + ' _(· ' + ach.points + ' pts)_');
    }
    lines.push('');
  }

  // Add summary at the top
  const totalPts = achievements.reduce((s, a) => s + (a.points || 0), 0);
  const matchedCount = achievements.length - unmatched.length;
  const summary = [
    '',
    '---',
    '',
    '> 🏆 **RetroAchievements** — ' + matchedCount + ' matched' + (unmatched.length > 0 ? ', ' + unmatched.length + ' unmatched' : '') + ' of ' + achievements.length + ' achievements (' + totalPts + ' total pts)',
    '',
  ];
  // Find the next non-blank line after separator
  const tocEnd = lines.findIndex((l, i) => {
    if (i <= 5 || !l.startsWith('---')) return false;
    const next = lines[i + 1], next2 = lines[i + 2];
    return (next && next.startsWith('<')) || (next2 && next2.startsWith('<'));
  });
  if (tocEnd > 0) {
    lines.splice(tocEnd + 1, 0, ...summary);
  }

  return lines.join('\n');
}

// Main
(async function () {
  const gameId = await resolveGameId(gameArg);
  console.log('Fetching achievements for game ID ' + gameId + '...');
  const data = await getGameInfoAndUserProgress(auth, { gameId, userName: USERNAME });

  const achievements = Object.values(data.achievements || {}).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
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
