#!/usr/bin/env node
// Unit tests for faqmd converter + reformatting
// Usage: node scripts/test.js
const fs = require('fs');
const path = require('path');

const { extractText, parseTOC, splitSections, escapeMd, anchorId } = require('../lib/convert-core');
const { reformat, reformatBlock, formatProse, formatStatBlock, formatDecorativeText, classifyArtBlock, formatEquipmentTable } = require('./reformat');
const { stripFrameChars, isPureBorderRow } = require('../lib/reformat/format');
const { hasEquipSlotLines } = require('../lib/reformat/detect');

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

// ── convert-core: extractText ──
assert('extractText: captures pre content', () => {
  const html = '<html><body><pre id="faqspan-1">Section 1\n\nSection 2</pre></body></html>';
  const text = extractText(html);
  if (!text.includes('Section 1')) throw new Error('Missing Section 1');
  if (!text.includes('Section 2')) throw new Error('Missing Section 2');
});

assert('extractText: decodes HTML entities', () => {
  const html = '<pre>A &amp; B &lt; C &gt; D &quot;E&quot; &#39;F&#39;</pre>';
  const text = extractText(html);
  if (text !== 'A & B < C > D "E" \'F\'\n') throw new Error('Entity decode failed: ' + JSON.stringify(text));
});

assert('extractText: strips carriage return', () => {
  const html = '<pre>Line 1\r\nLine 2\r\n</pre>';
  const text = extractText(html);
  if (text.includes('\r')) throw new Error('\\r not stripped: ' + JSON.stringify(text));
});

// ── convert-core: parseTOC ──
assert('parseTOC: finds all sections', () => {
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
  const toc = parseTOC(tocText);
  if (toc.length !== 5) throw new Error('Expected 5 entries, got ' + toc.length);
});

assert('parseTOC: extracts 4-letter code', () => {
  const toc = parseTOC('Table of Contents\n 1. Introduction                             INRO\n');
  if (toc[0].code !== 'INRO') throw new Error('Expected INRO, got ' + toc[0].code);
});

assert('parseTOC: extracts level 3 section', () => {
  const toc = parseTOC('Table of Contents\n      6.1.1. The Town of Learning            TWLR\n');
  const l3 = toc.find(e => e.num === '6.1.1');
  if (!l3) throw new Error('Expected 6.1.1 entry not found');
  if (l3.code !== 'TWLR') throw new Error('Expected TWLR code, got ' + l3.code);
});

assert('parseTOC: is case-insensitive on header', () => {
  const toc = parseTOC('table of contents\n 1. Introduction                             INRO\n');
  if (toc.length !== 1) throw new Error('Expected 1 entry, got ' + toc.length);
});

// ── convert-core: escapeMd ──
assert('escapeMd: strips markdown special chars', () => {
  const r = escapeMd('[Title](url) #section *bold* _italic_ `code`');
  if (r !== 'Titleurl section bold italic code') throw new Error('Got: ' + r);
});

// ── convert-core: anchorId ──
assert('anchorId: converts dots to hyphens', () => {
  if (anchorId({ num: '6.4.8' }) !== 's6-4-8') throw new Error('Got: ' + anchorId({ num: '6.4.8' }));
});
assert('anchorId: handles single section', () => {
  if (anchorId({ num: '2' }) !== 's2') throw new Error('Got: ' + anchorId({ num: '2' }));
});

// ── convert-core: splitSections ──
assert('splitSections: splits content by section codes', () => {
  const text = [
    'Table of Contents',
    ' 1. Intro                             AAAA',
    ' 2. Walkthrough                       BBBB',
    '',
    '***************************************************************************',
    '1. Intro                                                               CAAAA',
    '***************************************************************************',
    'Intro text here.',
    '',
    '',
    '',
    '',
    '***************************************************************************',
    '2. Walkthrough                                                         CBBBB',
    '***************************************************************************',
    'Walkthrough text here.',
  ].join('\n');
  const toc = parseTOC(text);
  const sections = splitSections(text, toc);
  if (sections.length !== 2) throw new Error('Expected 2 sections, got ' + sections.length);
  if (!sections[0].content.includes('Intro text')) throw new Error('Missing intro content');
  if (!sections[1].content.includes('Walkthrough text')) throw new Error('Missing walkthrough content');
});

// ── reformat: formatProse ──
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

// ── reformat: formatStatBlock ──
assert('formatStatBlock: formats key-value pairs', () => {
  const r = formatStatBlock(['HP: 300', 'EXP: 173', 'MST: 54']);
  if (!r.includes('**HP:** 300')) throw new Error('Missing HP');
  if (!r.includes('**EXP:** 173')) throw new Error('Missing EXP');
  if (!r.includes(' · ')) throw new Error('Missing separator');
});

// ── reformat: formatDecorativeText ──
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

// ── reformat: classifyArtBlock ──
assert('classifyArtBlock: detects boss cards', () => {
  const r = classifyArtBlock(['BOSS #1', 'HP: 300', 'Recommended Level: 12+']);
  if (r !== 'boss') throw new Error('Expected boss, got: ' + r);
});
assert('classifyArtBlock: detects stat blocks', () => {
  const r = classifyArtBlock(['LV: 99    HP: 999/999    TP: 999/999']);
  if (r !== 'statblock') throw new Error('Expected statblock, got: ' + r);
});

// ── reformat: reformatBlock ──
assert('reformatBlock: classifies prose block', () => {
  const r = reformatBlock(['first sentence here', 'second sentence continues']);
  if (!r.includes('first sentence here second sentence continues')) throw new Error('Got: ' + r);
});
assert('reformatBlock: classifies stat block', () => {
  const r = reformatBlock(['HP: 300', 'EXP: 173']);
  if (!r.includes('**HP:** 300')) throw new Error('Got: ' + r);
});

assert('extractText: concatenates multiple pre tags', () => {
  const html = '<pre>Part one</pre><div>ignore</div><pre>Part two</pre>';
  const text = extractText(html);
  if (!text.includes('Part one')) throw new Error('Missing part one');
  if (!text.includes('Part two')) throw new Error('Missing part two');
  if (text.includes('ignore')) throw new Error('Should not include non-pre content');
});

assert('escapeMd: handles empty string', () => {
  if (escapeMd('') !== '') throw new Error('Should return empty string');
});

assert('anchorId: handles deeply nested section', () => {
  if (anchorId({ num: '6.4.8.2' }) !== 's6-4-8-2') throw new Error('Got: ' + anchorId({ num: '6.4.8.2' }));
});

assert('splitSections: tolerates missing body code', () => {
  const text = [
    'Table of Contents',
    ' 1. Intro                             AAAA',
    ' 2. Missing                           MISS',
    '',
    '***************************************************************************',
    '1. Intro                                                               CAAAA',
    '***************************************************************************',
    'Intro text here.',
  ].join('\n');
  const toc = parseTOC(text);
  const sections = splitSections(text, toc);
  if (sections.length !== 1) throw new Error('Expected 1 section, got ' + sections.length);
  if (!sections[0].content.includes('Intro text')) throw new Error('Missing intro content');
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

// ── Phase 1: equipment detection ──
assert('hasEquipSlotLines: detects equipment slots', () => {
  if (!hasEquipSlotLines(['|Head |LTHR-HELM |', '|Right|HUNT-KNIFE|'])) throw new Error('Should detect equipment slots');
  if (hasEquipSlotLines(['| Location | Inn |'])) throw new Error('Should NOT detect as equipment');
  if (hasEquipSlotLines(['Some prose here', 'More prose'])) throw new Error('Should NOT detect equipment');
});

// ── Phase 1: formatEquipmentTable ──
assert('formatEquipmentTable: single character as list', () => {
  const lines = [
    'Starting          |   Chaz   |',
    'Equipment   |¯¯¯¯¯|¯¯¯¯¯¯¯¯¯¯|',
    '            |Head |LTHR-HELM |',
    '            |Right|HUNT-KNIFE|',
    '            |Left |HUNT-KNIFE|',
    '            |Body |LTHR-CLOTH|',
  ];
  const r = formatEquipmentTable(lines);
  if (!r.includes('**Head:**')) throw new Error('Expected bullet list for single char equipment');
  if (!r.includes('LTHR-HELM')) throw new Error('Expected LTHR-HELM in output');
  if (!r.includes('**Equipment**')) throw new Error('Expected equipment header');
});

assert('formatEquipmentTable: multi-character as table', () => {
  const lines = [
    'Recommended       |   Alys   |   Chaz   |',
    'Equipment   |¯¯¯¯¯|¯¯¯¯¯¯¯¯¯¯|¯¯¯¯¯¯¯¯¯¯|',
    '            |Head |LTHR-CROWN|LTHR-HELM |',
    '            |Right|BOOMERANG |HUNT-KNIFE|',
    '            |Left |          |HUNT-KNIFE|',
    '            |Body |LTHR-CLOTH|LTHR-CLOTH|',
  ];
  const r = formatEquipmentTable(lines);
  if (!r.includes('| Slot |')) throw new Error('Expected table header in multi-char equipment');
  if (!r.includes('Alys')) throw new Error('Expected Alys in table');
  if (!r.includes('Chaz')) throw new Error('Expected Chaz in table');
});

// ── Phase 1: stripFrameChars ──
assert('stripFrameChars: removes trailing frame chars', () => {
  if (stripFrameChars('Test') !== 'Test') throw new Error('Should not strip normal text');
  if (stripFrameChars('MONOMATE       20 MST /') !== 'MONOMATE       20 MST') throw new Error('Should strip trailing /');
  if (stripFrameChars('Item    \\') !== 'Item') throw new Error('Should strip trailing \\');
});

// ── Phase 1: isPureBorderRow ──
assert('isPureBorderRow: detects decorative rows', () => {
  if (!isPureBorderRow('|---------------|')) throw new Error('Should detect dash border');
  if (!isPureBorderRow('|¯¯¯¯¯|¯¯¯¯¯|')) throw new Error('Should detect overline border');
  if (!isPureBorderRow('|===|===|')) throw new Error('Should detect equals border');
  if (isPureBorderRow('|Head |LTHR-HELM |')) throw new Error('Should NOT detect equipment as border');
});

// ── Phase 1: formatDecorativeText skips equipment ──
assert('formatDecorativeText: bails on equipment data', () => {
  const lines = [
    'Equipment   |¯¯¯¯¯|¯¯¯¯¯¯¯¯¯¯|',
    '|Head |LTHR-HELM |',
  ];
  const r = formatDecorativeText(lines);
  if (r !== null) throw new Error('Should return null for equipment blocks, got: ' + r);
});

assert('formatDecorativeText: works on real decorative text', () => {
  const r = formatDecorativeText(['// DUNGEON #2 ¯¯\\']);
  if (r === null) throw new Error('Should NOT return null for real decorative text');
  if (!r.includes('**DUNGEON #2**')) throw new Error('Expected dungeon label, got: ' + r);
});

// ── Phase 1: reformatBlock equipment routing ──
assert('reformatBlock: routes equipment to equipment formatter', () => {
  const lines = [
    'Starting          |   Chaz   |',
    '|Head |LTHR-HELM |',
    '|Body |LTHR-CLOTH|',
  ];
  const r = reformatBlock(lines);
  // Must NOT be broken pipe fragments — either a table or a list
  if (!r.includes('LTHR-HELM')) throw new Error('Missing equipment data in output');
  if (r.includes('Starting          |')) throw new Error('Should not have raw pipe text in output');
});

// ── Phase 1: postProcess whitespace ──
assert('reformat: collapses excessive blank lines', () => {
  const input = 'Paragraph one.\n\n\n\nParagraph two.\n\n\nParagraph three.';
  const r = reformat(input);
  const blankSeq = (r.match(/\n\n+/g) || []).map(m => m.length);
  if (blankSeq.some(n => n > 2)) throw new Error('Should not have 3+ consecutive newlines');
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
