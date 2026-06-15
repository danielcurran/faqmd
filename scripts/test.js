#!/usr/bin/env node
// Unit tests for faqmd converter + reformatting
// Usage: node scripts/test.js
const fs = require('fs');
const path = require('path');

const { reformat, formatProse, formatStatBlock, formatDecorativeText, classifyArtBlock } = require('./reformat');

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push('FAIL: ' + label + ' — ' + e.message);
  }
}

// ── extractText (inline test) ──
{
  const html = '<html><body><pre id="faqspan-1">Section 1\n\nSection 2</pre></body></html>';
  const re = /<pre[^>]*>(.*?)<\/pre>/gs;
  let text = '';
  let m;
  while ((m = re.exec(html)) !== null) text += m[1] + '\n';
  text = text.replace(/\r/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  assert('extractText: captures pre content', () => {
    if (!text.includes('Section 1')) throw new Error('Missing Section 1');
    if (!text.includes('Section 2')) throw new Error('Missing Section 2');
  });

  const ents = 'A &amp; B &lt; C &gt; D &quot;E&quot; &#39;F&#39;';
  const fixed = ents.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  assert('extractText: decodes HTML entities', () => {
    if (fixed !== 'A & B < C > D "E" \'F\'') throw new Error('Entity decode failed: ' + fixed);
  });

  const crlf = 'Line 1\r\nLine 2\r\n';
  assert('extractText: strips carriage return', () => {
    if (crlf.replace(/\r/g, '').includes('\r')) throw new Error('\\r not stripped');
  });
}

// ── parseTOC (inline test) ──
{
  const tocText = [
    'Table of Contents',
    ' 1. Introduction                             INRO',
    '    1.1. Foreword                            FRWR',
    ' 6. Walkthrough                              WKTH',
    '    6.1. An Ancient Civilization             ANCV',
    '      6.1.1. The Town of Learning            TWLR',
    '',
    'Some other content',
  ].join('\n');

  const lines = tocText.split('\n');
  const tocEntries = [];
  let inTOC = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('Table of Contents')) { inTOC = true; continue; }
    if (!inTOC) continue;
    const tm = line.match(/^\s*(\d+(?:\.\d+)*)\.?\s+(.+?)\s{2,}([A-Z]{4})\s*$/);
    if (tm) {
      tocEntries.push({ num: tm[1], title: tm[2].trim(), code: tm[3] });
    }
  }

  assert('parseTOC: finds all sections', () => {
    if (tocEntries.length !== 5) throw new Error('Expected 5 entries, got ' + tocEntries.length);
  });
  assert('parseTOC: extracts 4-letter code', () => {
    if (tocEntries[0].code !== 'INRO') throw new Error('Expected INRO, got ' + tocEntries[0].code);
  });
  assert('parseTOC: extracts level 3 section', () => {
    const l3 = tocEntries.find(e => e.num === '6.1.1');
    if (!l3) throw new Error('Expected 6.1.1 entry not found');
    if (l3.code !== 'TWLR') throw new Error('Expected TWLR code, got ' + l3.code);
  });
  assert('parseTOC: all numbers extracted correctly', () => {
    const nums = tocEntries.map(e => e.num);
    const expected = ['1', '1.1', '6', '6.1', '6.1.1'];
    if (JSON.stringify(nums) !== JSON.stringify(expected)) throw new Error('Expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(nums));
  });
}

// ── escapeMd (inline test) ──
{
  function escapeMd(t) { return t.replace(/[\[\]\(\)#*_`]/g, ''); }
  assert('escapeMd: strips markdown special chars', () => {
    const r = escapeMd('[Title](url) #section *bold* _italic_ `code`');
    if (r !== 'Titleurl section bold italic code') throw new Error('Got: ' + r);
  });
}

// ── anchorId (inline test) ──
{
  function anchorId(e) { return 's' + e.num.replace(/\./g, '-'); }
  assert('anchorId: converts dots to hyphens', () => {
    if (anchorId({ num: '6.4.8' }) !== 's6-4-8') throw new Error('Got: ' + anchorId({ num: '6.4.8' }));
  });
  assert('anchorId: handles single section', () => {
    if (anchorId({ num: '2' }) !== 's2') throw new Error('Got: ' + anchorId({ num: '2' }));
  });
}

// ── formatProse ──
assert('formatProse: joins lines with space', () => {
  const r = formatProse(['first line', 'second line', 'third line']);
  if (r !== 'first line second line third line\n\n') throw new Error('Got: ' + JSON.stringify(r));
});
assert('formatProse: handles single line', () => {
  const r = formatProse(['only one line']);
  if (r !== 'only one line\n\n') throw new Error('Got: ' + JSON.stringify(r));
});
assert('formatProse: returns empty for blank input', () => {
  const r = formatProse(['']);
  if (r !== '') throw new Error('Should be empty');
});

// ── formatStatBlock ──
assert('formatStatBlock: formats key-value pairs', () => {
  const r = formatStatBlock(['HP: 300', 'EXP: 173', 'MST: 54']);
  if (!r.includes('**HP:** 300')) throw new Error('Missing HP');
  if (!r.includes('**EXP:** 173')) throw new Error('Missing EXP');
  if (!r.includes(' · ')) throw new Error('Missing separator');
});

// ── formatDecorativeText ──
assert('formatDecorativeText: strips // prefix', () => {
  const r = formatDecorativeText(['// DUNGEON #2']);
  if (!r.includes('**DUNGEON #2**')) throw new Error('Got: ' + r);
});
assert('formatDecorativeText: returns null for plain text', () => {
  const r = formatDecorativeText(['Just normal prose text here']);
  if (r !== null) throw new Error('Should return null for plain text, got: ' + r);
});
assert('formatDecorativeText: does NOT mark stat lines as decorative', () => {
  // Stat lines with multi-space columns — shouldn't trigger decorative
  const r = formatDecorativeText(['HP: 300                          Alys: 7']);
  if (r !== null) throw new Error('Stat line with multi-spaces should not be decorative, got: ' + r);
});

// ── classifyArtBlock ──
assert('classifyArtBlock: detects boss cards', () => {
  const r = classifyArtBlock(['BOSS #1', 'HP: 300', 'Recommended Level: 12+']);
  if (r !== 'boss') throw new Error('Expected boss, got: ' + r);
});
assert('classifyArtBlock: detects stat blocks', () => {
  const r = classifyArtBlock(['LV: 99    HP: 999/999    TP: 999/999']);
  if (r !== 'statblock') throw new Error('Expected statblock, got: ' + r);
});

// ── reformat: end-to-end paragraph ──
assert('reformat: continuous prose paragraph', () => {
  const input = 'first sentence here\nsecond sentence continues\nthird sentence ends.';
  const r = reformat(input);
  if (r !== 'first sentence here second sentence continues third sentence ends.') throw new Error('Got: ' + JSON.stringify(r));
});

assert('reformat: splits stat block from prose', () => {
  const input = 'HP: 300\nEXP: 173\nMST: 54\n\nThis is a prose paragraph with multiple\nlines of text.';
  const r = reformat(input);
  if (!r.includes('**HP:** 300')) throw new Error('Missing stat formatting');
  if (!r.includes('prose paragraph')) throw new Error('Missing prose content');
});

// ── End-to-end: verify generated walkthrough.md ──
assert('e2e: walkthrough.md exists', () => {
  const p = path.join(__dirname, 'walkthrough.md');
  if (!fs.existsSync(p)) throw new Error('walkthrough.md not found');
});

assert('e2e: walkthrough.md has expected sections', () => {
  const p = path.join(__dirname, 'walkthrough.md');
  const md = fs.readFileSync(p, 'utf8');
  if (!md.includes('### 15.1.1. Igglanova 1')) throw new Error('Missing Igglanova 1 section');
  if (!md.includes('## Table of Contents')) throw new Error('Missing Table of Contents');
  if (!md.includes('6.1.1. The Town of Learning')) throw new Error('Missing nested section heading');
});

assert('e2e: walkthrough.md is substantial', () => {
  const p = path.join(__dirname, 'walkthrough.md');
  const stat = fs.statSync(p);
  if (stat.size < 500000) throw new Error('File too small: ' + stat.size + ' bytes');
});

// ── Summary ──
console.log('');
console.log('  \x1b[32mPassed:\x1b[0m ' + passed);
if (failed > 0) {
  console.log('  \x1b[31mFailed:\x1b[0m ' + failed);
  failures.forEach(f => console.log('    ' + f));
  process.exit(1);
} else {
  console.log('  \x1b[32mAll ' + passed + ' tests passed.\x1b[0m');
  process.exit(0);
}
