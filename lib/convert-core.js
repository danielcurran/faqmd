#!/usr/bin/env node
// Pure conversion functions extracted from scripts/convert.js for testability and reuse.

function extractText(html) {
  const re = /<pre[^>]*>(.*?)<\/pre>/gs;
  let text = '';
  let m;
  while ((m = re.exec(html)) !== null) text += m[1] + '\n';
  return text.replace(/\r/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function parseTOC(text) {
  const lines = text.split('\n');
  const tocEntries = [];
  let inTOC = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.toLowerCase().includes('table of contents')) { inTOC = true; continue; }
    if (!inTOC) continue;
    const m = line.match(/^\s*(\d+(?:\.\d+)*)\.?\s+(.+?)\s{2,}([A-Z]{4})\s*$/);
    if (m) {
      const num = m[1], title = m[2].trim(), code = m[3];
      tocEntries.push({ num, title, code, level: (num.match(/\./g) || []).length + 1 });
    }
  }
  return tocEntries;
}

function splitSections(text, tocEntries) {
  if (!tocEntries || tocEntries.length === 0) return [];
  // Find the TOC end marker in body text (last entry's code appears in body)
  const lastEntry = tocEntries[tocEntries.length - 1];
  const tocEndMatch = text.match(lastEntry.num + '\\.\\s+' + lastEntry.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.*?' + lastEntry.code);
  const tocEnd = tocEndMatch ? tocEndMatch.index + tocEndMatch[0].length : 0;
  const body = text.substring(tocEnd);
  const positions = [];
  for (const entry of tocEntries) {
    const code = 'C' + entry.code;
    const idx = body.indexOf(code);
    if (idx >= 0) {
      const sub = body.substring(idx + code.length);
      const match = sub.match(/^(?:.*\n){0,3}?[\*\-_¯\s]{10,}\n/);
      const headerEnd = match ? idx + code.length + match.index + match[0].length : idx + code.length + 100;
      positions.push({ ...entry, pos: tocEnd + headerEnd });
    }
  }
  positions.sort((a, b) => a.pos - b.pos);
  const sections = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos;
    const end = i < positions.length - 1 ? positions[i + 1].pos : text.length;
    let content = text.substring(start, end);
    // Trim trailing section header bleed: decoration line + title + decoration line
    content = content.replace(/\n[\*\-_¯]{10,}(?:\r?\n)+[^\n]*?C[A-Z]{4}\s*\n[\*\-_¯]{10,}(?:\r?\n)*\s*$/, '\n');
    content = content.replace(/^[\_\*¯\s]{30,}$/gm, '');
    content = content.replace(/\n\d+(?:\.\d+)*\.?\s+[A-Z][\w\s'-]{3,50}\s{3,}C[A-Z]{4}\s*$/gm, '');
    content = content.replace(/\n{3,}/g, '\n\n').trim();
    if (content) sections.push({ ...positions[i], content });
  }
  return sections;
}

function escapeMd(t) { return t.replace(/[\[\]\(\)#*_`]/g, ''); }
function anchorId(e) { return 's' + e.num.replace(/\./g, '-'); }

// ── Roman-numeral format support ──

function detectFormat(text) {
  // Roman format: uses +=====+ or /\====\/ section headers
  if (/\+={30,}\+/.test(text) || /\/[\\\/]+={30,}[\\\/]+/.test(text)) return 'roman';
  if (/C[A-Z]{4}/.test(text)) return 'standard';
  return 'unknown';
}

function romanToInt(roman) {
  const map = { i: 1, v: 5, x: 10, l: 50, c: 100 };
  let result = 0;
  const s = roman.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]] || 0;
    const next = map[s[i + 1]] || 0;
    result += cur < next ? -cur : cur;
  }
  return result;
}

function parseRomanTOC(text) {
  const lines = text.split('\n');
  let inTOC = false;
  let tocStartIdx = -1;

  // Find the first TABLE OF CONTENTS section
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase().includes('table of contents')) {
      tocStartIdx = i;
      inTOC = true;
      break;
    }
  }
  if (!inTOC) return [];

  // Parse raw entries from the TOC box lines
  const rawEntries = [];
  for (let i = tocStartIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Second TABLE OF CONTENTS marker — end of the first TOC section
    if (i > tocStartIdx + 5 && trimmed.toLowerCase().includes('table of contents')) break;

    // Skip pure decorative lines
    if (/^[0\-=+|*\/\\_¯\s]+$/.test(trimmed)) continue;
    if (trimmed === '' || trimmed === '+-----------------+') continue;

    // Detect game header lines (DRAGON QUEST I / II)
    if (trimmed.includes('DRAGON QUEST I') && !trimmed.includes('DRAGON QUEST II')) {
      rawEntries.push({ type: 'game_header', title: 'Dragon Quest I' });
      continue;
    }
    if (trimmed.includes('DRAGON QUEST II')) {
      rawEntries.push({ type: 'game_header', title: 'Dragon Quest II' });
      continue;
    }

    // Extract roman numeral + title from TOC line
    // Lines look like: ` |   |   0. VERSION HISTORY   |   |`
    // Strip away the box framing and leading spaces
    const content = line.replace(/^\s*\|.*?\|/, '').replace(/\|.*?\|\s*$/, '').trim();
    const m = content.match(/^([IVXixvlc0]+)\.\s+(.+)/);
    if (!m) continue;

    rawEntries.push({
      type: 'section',
      romanNum: m[1],
      title: m[2].trim()
    });
  }

  // Assign decimal section numbers based on position and context
  const tocEntries = [];
  let state = 'top'; // top, dq1_game, dq1_walkthru, dq2_game, dq2_walkthru
  let counter = 0;
  let topCounter = 2; // After intro, next top-level is section 2

  for (const entry of rawEntries) {
    if (entry.type === 'game_header') {
      if (entry.title.includes('Dragon Quest I') && !entry.title.includes('Dragon Quest II')) state = 'dq1_game';
      else if (entry.title.includes('Dragon Quest II')) state = 'dq2_game';
      continue;
    }

    let num, level;
    const isUpper = /^[IVX]+$/.test(entry.romanNum);

    switch (state) {
      case 'top':
        if (entry.romanNum === '0') { num = '0'; level = 1; }
        else if (isUpper && entry.romanNum === 'I') { num = '1'; level = 1; }
        else if (isUpper) {
          const postMap = { II: '4', III: '5', IV: '6', V: '7' };
          num = postMap[entry.romanNum]; level = 1;
        } else {
          // Lowercase entry in top state — treat as walkthrough subsection
          counter = 1;
          num = '2.' + counter;
          level = 2;
          state = 'dq1_walkthru';
        }
        break;
      case 'dq1_game':
        if (isUpper) { num = '2'; level = 1; counter = 0; state = 'dq1_walkthru'; }
        break;
      case 'dq1_walkthru':
        if (isUpper) {
          // Uppercase in walkthrough — transition back to top-level
          state = 'top'; topCounter = 3;
          const postMap = { II: '4', III: '5', IV: '6', V: '7' };
          num = postMap[entry.romanNum]; level = 1;
        } else {
          counter++;
          num = '2.' + counter;
          level = 2;
        }
        break;
      case 'dq2_game':
        if (isUpper) { num = '3'; level = 1; counter = 0; state = 'dq2_walkthru'; }
        break;
      case 'dq2_walkthru':
        if (isUpper) {
          // Uppercase in walkthrough — transition back to top-level
          state = 'top';
          const postMap = { II: '4', III: '5', IV: '6', V: '7' };
          num = postMap[entry.romanNum]; level = 1;
        } else {
          counter++;
          num = '3.' + counter;
          level = 2;
          if (entry.romanNum.toLowerCase() === 'xlv') state = 'top';
        }
        break;
    }

    if (num !== undefined) {
      tocEntries.push({ num, title: entry.title, code: entry.romanNum, level });
    }
  }

  return tocEntries;
}

function splitRomanSections(text, tocEntries) {
  if (!tocEntries || tocEntries.length === 0) return [];

  const lines = text.split('\n');

  // Find the second TOC marker to identify where body sections begin
  let tocCount = 0;
  let bodyStartLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase().includes('table of contents')) {
      tocCount++;
      if (tocCount === 2) {
        bodyStartLine = i;
        break;
      }
    }
  }

  // Find all roman-numeral section headers in the body (diamond and box formats)
  const headerPositions = [];
  for (let i = bodyStartLine; i < lines.length - 2; i++) {
    const top = lines[i].trim();
    const mid = lines[i + 1].trim();
    const bot = lines[i + 2].trim();

    // Diamond header: /\===...===/\ , || num. title || , \/===...===/
    if (/^[\/\\]+={30,}[\/\\]+$/.test(top) && /^\|\|?\s+([IVXixvlc0]+)\.\s+(.+?)\s+\|?\|?\s*$/.test(mid) &&
        /^[\\\/]+={30,}[\\\/]+$/.test(bot)) {
      const m = mid.match(/^\|\|?\s+([IVXixvlc0]+)\.\s+(.+?)\s+\|?\|?\s*$/);
      if (m) {
        headerPositions.push({ headerStart: i, contentStart: i + 3, romanNum: m[1], title: m[2].trim() });
        i += 2;
        continue;
      }
    }

    // Box header: +===...===+ , | num. title | , +===...===+
    if (/^\+={30,}\+$/.test(top) && /^\|\s+([IVXixvlc]+)\.\s+(.+?)\s+\|\s*$/.test(mid) &&
        /^\+={30,}\+$/.test(bot)) {
      const m = mid.match(/^\|\s+([IVXixvlc]+)\.\s+(.+?)\s+\|\s*$/);
      if (m) {
        headerPositions.push({ headerStart: i, contentStart: i + 3, romanNum: m[1], title: m[2].trim() });
        i += 2;
        continue;
      }
    }
  }

  // Zip header positions with TOC entries (they appear in the same order)
  const sections = [];
  for (let i = 0; i < headerPositions.length && i < tocEntries.length; i++) {
    const hp = headerPositions[i];
    const entry = tocEntries[i];
    const endLine = i + 1 < headerPositions.length ? headerPositions[i + 1].headerStart : lines.length;

    let content = lines.slice(hp.contentStart, endLine).join('\n');
    content = content.replace(/\n{3,}/g, '\n\n').trim();
    if (content) {
      sections.push({ ...entry, content });
    }
  }

  return sections;
}

module.exports = {
  extractText, parseTOC, splitSections, escapeMd, anchorId,
  detectFormat, romanToInt, parseRomanTOC, splitRomanSections
};
