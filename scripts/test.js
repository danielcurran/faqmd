#!/usr/bin/env node
// Unit tests for faqmd converter + reformatting
// Usage: node scripts/test.js
const fs = require('fs');
const path = require('path');

const { extractText, parseTOC, splitSections, escapeMd, anchorId, detectFormat, romanToInt, parseRomanTOC, splitRomanSections } = require('../lib/convert-core');
const {
  reformat, reformatBlock, formatProse, formatStatBlock, formatDecorativeText,
  classifyArtBlock, formatEquipmentTable, formatBossCard,
  formatCharacterSheet, formatCharacterPortrait, formatRomanSubHeader
} = require('./reformat');
const { stripFrameChars, isPureBorderRow, formatShopList } = require('../lib/reformat/format');
const { hasEquipSlotLines, isBossCard, isShopBlock, isCharacterSheet, isCharacterPortrait } = require('../lib/reformat/detect');

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
assert('formatStatBlock: handles multi-column stat lines', () => {
  const r = formatStatBlock([
    'Met: Academy Basement           Recommended Level before fighting:',
    '  HP: 300                          Alys: 7',
    ' EXP: 173                          Chaz: 2-3',
    ' MST: 54                           Hahn: 2-3'
  ]);
  if (!r.includes('**Met:** Academy Basement')) throw new Error('Missing Met');
  if (!r.includes('**HP:** 300')) throw new Error('Missing HP');
  if (!r.includes('**Alys:** 7')) throw new Error('Missing Alys');
  if (!r.includes('**EXP:** 173')) throw new Error('Missing EXP');
  if (!r.includes('**Chaz:** 2-3')) throw new Error('Missing Chaz');
  if (r.includes('Recommended Level before fighting:')) throw new Error('Should not include empty-value key');
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

// ── Phase 2: detection ──
assert('isBossCard: detects boss cards', () => {
  const lines = ['| BOSS #1  \\____________', '| Igglanova', '|  HP: 300'];
  if (!isBossCard(lines)) throw new Error('Should detect boss card');
});

assert('isShopBlock: detects shop listings', () => {
  const lines = ['| Mile | Inn | 10 MST', '| Tool Store | MONOMATE | 20 MST'];
  if (!isShopBlock(lines)) throw new Error('Should detect shop block');
});

assert('isCharacterSheet: detects character sheets', () => {
  const lines = ['|Joins Party: At start|Starting Level: 1|Initial Stats|', '| Head LTHR-HELM | HP 25 |'];
  if (!isCharacterSheet(lines)) throw new Error('Should detect character sheet');
});

assert('isCharacterPortrait: detects ASCII portrait', () => {
  const lines = [
    '  @%@@x**x.                            Chaz Ashley',
    '             #@.   .....                Parmanian',
    '          .%x-@##*========--=========--=+@@x*x###x           (Hunter)',
    '        =#*#    +.- *+---.-=-. .-     ..+++**+***+x#         Age: 16',
    '       *%=#.  *#.- @# .=.+#-..##-#% ##- %#.x#+@x+*+x#       Sex: Male',
    '        -#%*=# -# #% x# #  ###%##########x# -#@.#x+**+#.     Lives:',
    '         @x#.x#-#@-# =# *# ##@%@=   .  -@@# %#=###**        Aiedo'
  ];
  if (!isCharacterPortrait(lines)) throw new Error('Should detect character portrait');
});

// ── Phase 2: formatBossCard ──
assert('formatBossCard: renders plain-text boss stats', () => {
  const lines = [
    '| BOSS #1  \\\\____________  ____________________',
    '| Igglanova             ||                    |',
    '|  HP: 300              ||                    |',
    '| EXP: 173    MST: 54   || Alys: 7           /',
    '| Weak: -               || Chaz: 2-3        /',
    '| Res:  -               || Hahn: 2-3       /',
  ];
  const r = formatBossCard(lines);
  if (!r.includes('BOSS #1 — Igglanova')) throw new Error('Missing boss header');
  if (!r.includes('**HP:** 300')) throw new Error('Missing HP');
  if (!r.includes('Alys (7)')) throw new Error('Missing recommended level');
  if (r.includes('EXP (173)')) throw new Error('Should not treat stats as character levels');
});

// ── Phase 2: formatShopList ──
assert('formatShopList: renders grouped plain-text shop list', () => {
  const lines = [
    '| Mile | Inn | Per person 10 MST |',
    '| Tool Store | MONOMATE 20 MST |  |',
    '|  | ANTIDOTE 10 MST |  |',
    '| Weapon Store | DAGGER 40 MST | +2 ATK |',
    '|  | HUNT-KNIFE 120 MST | +5 ATK |',
  ];
  const r = formatShopList(lines);
  if (!r.includes('**Mile Shops**')) throw new Error('Missing location header');
  if (!r.includes('MONOMATE — 20 MST')) throw new Error('Missing MONOMATE');
  if (!r.includes('ANTIDOTE — 10 MST')) throw new Error('Missing ANTIDOTE');
  if (!r.includes('DAGGER — 40 MST (+2 ATK)')) throw new Error('Missing DAGGER bonus');
});

// ── Phase 2: formatCharacterSheet ──
assert('formatCharacterSheet: extracts stats and equipment', () => {
  const lines = [
    '|Joins Party: At start|Starting Level: 1|Initial Stats|',
    '| Head LTHR-HELM |Initial Techniques: RES| HP 25 |',
    '| Right HUNT-KNIFE |Initial Skills: EARTH (3)| TP 10 |',
    '| Left HUNT-KNIFE | | Str 8 |',
    '| Body LTHR-CLOTH | | Men 6 |',
  ];
  const r = formatCharacterSheet(lines);
  if (!r.includes('**Joins Party:** At start')) throw new Error('Missing join info');
  if (!r.includes('HP 25')) throw new Error('Missing HP stat');
  if (!r.includes('Head: LTHR-HELM')) throw new Error('Missing equipment');
  if (!r.includes('EARTH (3)')) throw new Error('Missing skills');
});

// ── Phase 2: formatCharacterPortrait ──
assert('formatCharacterPortrait: extracts profile labels', () => {
  const lines = [
    '                       @%%@@x**x.                            Chaz Ashley',
    '             #@.   ..... .=+==--.--------=--###@             Parmanian',
    '          .%x-@##*========--=========--=+@@x*x###x           (Hunter)',
    '        =#*#    +.- *+---.-=-. .-     ..+++**+***+x#         Age: 16',
    '       *%=#.  *#.- @# .=.+#-..##-#% ##- %#.x#+@x+*+x#       Sex: Male',
    '        -#%*=# -# #% x# #  ###%##########x# -#@.#x+**+#.     Lives:',
    '         @x#.x#-#@-# =# *# ##@%@=   .  -@@# %#=###**        Aiedo',
  ];
  const r = formatCharacterPortrait(lines);
  if (!r.includes('**Chaz Ashley**')) throw new Error('Missing name');
  if (!r.includes('Parmanian (Hunter)')) throw new Error('Missing race/class');
  if (!r.includes('Age: 16')) throw new Error('Missing age');
  if (!r.includes('Lives: Aiedo')) throw new Error('Missing lives');
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

// ── Roman-numeral format: romanToInt ──
assert('romanToInt: single letters', () => {
  if (romanToInt('i') !== 1) throw new Error('i should be 1');
  if (romanToInt('v') !== 5) throw new Error('v should be 5');
  if (romanToInt('x') !== 10) throw new Error('x should be 10');
  if (romanToInt('l') !== 50) throw new Error('l should be 50');
});

assert('romanToInt: subtractive notation', () => {
  if (romanToInt('iv') !== 4) throw new Error('iv should be 4');
  if (romanToInt('ix') !== 9) throw new Error('ix should be 9');
  if (romanToInt('xlv') !== 45) throw new Error('xlv should be 45, got ' + romanToInt('xlv'));
});

assert('romanToInt: multi-letter', () => {
  if (romanToInt('xx') !== 20) throw new Error('xx should be 20');
  if (romanToInt('xviii') !== 18) throw new Error('xviii should be 18');
  if (romanToInt('xxxix') !== 39) throw new Error('xxxix should be 39');
});

assert('romanToInt: zero passes through', () => {
  if (romanToInt('0') !== 0) throw new Error('0 should be 0');
});

// ── Roman-numeral format: detectFormat ──
assert('detectFormat: detects roman format with +===+', () => {
  if (detectFormat('+====================================+\n| i. Title |\n+======+') !== 'roman')
    throw new Error('Should detect roman format');
});

assert('detectFormat: detects roman format with diamond header', () => {
  const diamond = '/\\' + '='.repeat(30) + '/\\\n|| 0. Version ||\n\\/' + '='.repeat(30) + '/';
  if (detectFormat(diamond) !== 'roman')
    throw new Error('Should detect diamond roman format');
});

assert('detectFormat: detects standard format with CCODE', () => {
  if (detectFormat('1. Intro                             CINRO\nCWALK') !== 'standard')
    throw new Error('Should detect standard format');
});

assert('detectFormat: returns unknown for plain text', () => {
  if (detectFormat('Just a walkthrough with no markers.') !== 'unknown')
    throw new Error('Should return unknown');
});

// ── Roman-numeral format: parseRomanTOC ──
assert('parseRomanTOC: parses full TOC structure', () => {
  const tocText = [
    ' 0---0------------------------------------------------------0---0',
    ' |   |                   TABLE OF CONTENTS                  |   |',
    ' |   |                  +-----------------+                 |   |',
    ' 0---0------------------------------------------------------0---0',
    ' |   |   0. VERSION HISTORY                                 |   |',
    ' |   |   I. INTRODUCTION                                    |   |',
    ' |===|======================================================|===|',
    ' |   |                    DRAGON QUEST I                    |   |',
    ' |===|======================================================|===|',
    ' |   |     I. WALKTHROUGH                                   |   |',
    ' |   |      i. Introduction                                 |   |',
    ' |   |     ii. Radatome Castle                              |   |',
    ' |===|======================================================|===|',
    ' |   |      DRAGON QUEST II: GODS OF THE EVIL SPIRITS       |   |',
    ' |===|======================================================|===|',
    ' |   |     I. WALKTHROUGH                                   |   |',
    ' |   |      i. Introduction                                 |   |',
    ' |   |     ii. Laurasia Castle                              |   |',
    ' |   |   II. CONCLUSION                                     |   |',
    ' |   |  III. NEXT TIME...                                   |   |',
  ].join('\n');

  const toc = parseRomanTOC(tocText);
  if (toc.length < 7) throw new Error('Expected at least 7 entries, got ' + toc.length);
  if (toc[0].num !== '0' || toc[0].title !== 'VERSION HISTORY') throw new Error('Entry 0: ' + JSON.stringify(toc[0]));
  if (toc[1].num !== '1' || toc[1].title !== 'INTRODUCTION') throw new Error('Entry 1: ' + JSON.stringify(toc[1]));
  if (toc[2].num !== '2' || toc[2].title !== 'WALKTHROUGH') throw new Error('Entry 2: ' + JSON.stringify(toc[2]));
  if (toc[3].num !== '2.1' || toc[3].title !== 'Introduction') throw new Error('Entry 3: ' + JSON.stringify(toc[3]));
  if (toc[4].num !== '2.2' || toc[4].title !== 'Radatome Castle') throw new Error('Entry 4: ' + JSON.stringify(toc[4]));
  // DQ II sections
  const dq2Walk = toc.find(e => e.num === '3');
  if (!dq2Walk || dq2Walk.title !== 'WALKTHROUGH') throw new Error('Missing DQ II walkthrough');
  const dq2Intro = toc.find(e => e.num === '3.1');
  if (!dq2Intro || dq2Intro.title !== 'Introduction') throw new Error('Missing DQ II intro');
  const dq2Laur = toc.find(e => e.num === '3.2');
  if (!dq2Laur || dq2Laur.title !== 'Laurasia Castle') throw new Error('Missing DQ II Laurasia');
  // Post-game sections
  const concl = toc.find(e => e.num === '4');
  if (!concl || concl.title !== 'CONCLUSION') throw new Error('Missing CONCLUSION');
  const next = toc.find(e => e.num === '5');
  if (!next || next.title !== 'NEXT TIME...') throw new Error('Missing NEXT TIME');
});

assert('parseRomanTOC: sets correct levels', () => {
  const tocText = [
    ' |   |                   TABLE OF CONTENTS                  |   |',
    ' |   |   0. VERSION HISTORY                                 |   |',
    ' |   |                    DRAGON QUEST I                    |   |',
    ' |   |     I. WALKTHROUGH                                   |   |',
    ' |   |      i. Introduction                                 |   |',
  ].join('\n');

  const toc = parseRomanTOC(tocText);
  if (toc[0].level !== 1) throw new Error('Level-1 entry should be level 1, got ' + toc[0].level);
  if (toc[1].level !== 1) throw new Error('Level-1 walkthrough should be level 1, got ' + toc[1].level);
  if (toc[2].level !== 2) throw new Error('Level-2 subsection should be level 2, got ' + toc[2].level);
});

// ── Roman-numeral format: splitRomanSections ──
assert('splitRomanSections: splits body by diamond headers', () => {
  const body = [
    ' 0---0------------------------------------------------------0---0',
    ' |   |                   TABLE OF CONTENTS                  |   |',
    ' 0---0------------------------------------------------------0---0',
    ' 0---0------------------------------------------------------0---0',
    ' |   |                   TABLE OF CONTENTS                  |   |',
    ' 0---0------------------------------------------------------0---0',
    '  /\\============================================================/\\',
    '  ||                     0. VERSION HISTORY                      ||',
    '  \\/============================================================\\/',
    '  Version: Final',
    '',
    '  Guide completed!',
    '',
    '  /\\============================================================/\\',
    '  ||                      I. INTRODUCTION                       ||',
    '  \\/============================================================\\/',
    '  Welcome to this guide.',
  ].join('\n');

  const toc = parseRomanTOC(body);
  const sections = splitRomanSections(body, toc);
  if (sections.length !== 2) throw new Error('Expected 2 sections, got ' + sections.length);
  if (!sections[0].content.includes('Version: Final')) throw new Error('Missing version content: ' + sections[0].content);
  if (!sections[1].content.includes('Welcome')) throw new Error('Missing intro content: ' + sections[1].content);
});

assert('splitRomanSections: splits body by box headers', () => {
  const body = [
    ' |   |                   TABLE OF CONTENTS                  |   |',
    ' |   |   0. VERSION HISTORY                                 |   |',
    ' |   |     I. WALKTHROUGH                                   |   |',
    ' |   |      i. Introduction                                 |   |',
    ' 0---0------------------------------------------------------0---0',
    ' |   |                   TABLE OF CONTENTS                  |   |',
    ' 0---0------------------------------------------------------0---0',
    '  /\\============================================================/\\',
    '  ||                     0. VERSION HISTORY                      ||',
    '  \\/============================================================\\/',
    '  Version info here.',
    '',
    '  /\\============================================================/\\',
    '  ||                      I. WALKTHROUGH                        ||',
    '  \\/============================================================\\/',
    '  Walkthrough starts.',
    '',
    '  +==============================================================+',
    '  |                      i. Introduction                         |',
    '  +==============================================================+',
    '  Introduction text here.',
  ].join('\n');

  const toc = parseRomanTOC(body);
  const sections = splitRomanSections(body, toc);
  if (sections.length !== 3) throw new Error('Expected 3 sections, got ' + sections.length);
  if (!sections[2].content.includes('Introduction text')) throw new Error('Missing walkthrough intro: ' + sections[2].content);
});

// ── Roman-format: reformat sub-headers ──
assert('formatRomanSubHeader: formats overworld sub-header', () => {
  const lines = [
    '+--------------------------------------------------------------+',
    '|                        - Overworld -                         |',
    '|                     (Radatome Outskirts)                     |',
    '+--------------------------------------------------------------+',
  ];
  const r = formatRomanSubHeader(lines);
  if (!r.includes('**Overworld**')) throw new Error('Expected Overworld bold, got: ' + r);
  if (!r.includes('*(Radatome Outskirts)*')) throw new Error('Expected parenthetical italic, got: ' + r);
});

assert('formatRomanSubHeader: formats simple location label', () => {
  const lines = [
    '+--------------------------------------------------------------+',
    '|                        - Dungeon B1 -                        |',
    '+--------------------------------------------------------------+',
  ];
  const r = formatRomanSubHeader(lines);
  if (!r.includes('**Dungeon B1**')) throw new Error('Expected Dungeon B1 bold, got: ' + r);
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
