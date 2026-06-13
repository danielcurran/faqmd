#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'https://gamefaqs.gamespot.com/genesis/563334-phantasy-star-iv/faqs/31907?print=1';

// Extract output filename from URL
function outputName(url) {
  const m = url.match(/faqs\/(\d+)/);
  if (m) return 'guide-' + m[1] + '.md';
  return 'walkthrough.md';
}

const OUTPUT = path.join(__dirname, outputName(URL));

// Step 1: Fetch the page
function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  });
}

// Step 2: Extract walkthrough text from <pre> tags
function extractText(html) {
  const re = /<pre[^>]*>(.*?)<\/pre>/gs;
  let text = '';
  let m;
  while ((m = re.exec(html)) !== null) {
    text += m[1] + '\n';
  }
  // Decode HTML entities
  return text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Step 3: Parse TOC to build a section tree
function parseTOC(text) {
  const lines = text.split('\n');
  const tocEntries = [];
  let inTOC = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'Table of Contents') { inTOC = true; continue; }
    if (!inTOC) continue;
    // Detect TOC entries like: " 6.1. An Ancient Civilization      ANCV"
    // or "     6.1.1. The Town of Learning      TWLR"
    const m = line.match(/^\s*(\d+(?:\.\d+)*)\.?\s+(.+?)\s{2,}([A-Z]{4})\s*$/);
    if (m) {
      const num = m[1];
      const title = m[2].trim();
      const code = m[3];
      // Calculate heading level: count dots
      const dots = (num.match(/\./g) || []).length;
      tocEntries.push({ num, title, code, level: dots + 1 });
    }
  }
  return tocEntries;
}

// Step 4: Find section boundaries in text using codes
function splitSections(text, tocEntries) {
  // Find where TOC ends — look for the last TOC line
  const tocEndMatch = text.match(/20\.\s+Contact Information.*?CNIF/);
  const tocEnd = tocEndMatch ? tocEndMatch.index + tocEndMatch[0].length : 0;

  // Only search body text (after TOC)
  const body = text.substring(tocEnd);

  // Find positions of each body code (C + 4-letter code)
  const positions = [];
  for (const entry of tocEntries) {
    const code = 'C' + entry.code;
    const idx = body.indexOf(code);
    if (idx >= 0) {
      // Find the actual content start: after the header block
      // Header looks like: ***\n6.4.8. Title    CCODE\n***\n___\nStarting Party...\n---\n
      const headerEnd = findHeaderEnd(body, idx + code.length);
      const contentStart = tocEnd + headerEnd;
      positions.push({ ...entry, pos: contentStart });
    }
  }

  // Sort by position
  positions.sort((a, b) => a.pos - b.pos);

  // Assign each entry the text from its position to the next entry's position
  const sections = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos;
    const end = i < positions.length - 1 ? positions[i + 1].pos - 30 : text.length;
    let content = text.substring(start, end);
    content = cleanSection(content);
    sections.push({ ...positions[i], content });
  }
  return sections;
}

function findHeaderEnd(body, fromPos) {
  // After the code, find the end of the header block
  // Header pattern: newline, possible *** or ___, Party info, another separator
  const sub = body.substring(fromPos);
  const match = sub.match(/(?:.*\n){0,3}[\*\-_¯\s]{10,}\n/);
  if (match) {
    return fromPos + match.index + match[0].length;
  }
  return fromPos + 100; // fallback
}

function cleanSection(text) {
  // Remove separator lines (long lines of ___ or *** or ¯¯)
  text = text.replace(/^[_\*¯\s]{30,}$/gm, '');
  // Remove next section headers that leaked in
  text = text.replace(/\n\d+\.\d+(?:\.\d+)*\.?\s+.+?C[A-Z]{4}\s*$/gm, '');
  text = text.replace(/\n\d+\.\d+(?:\.\d+)*\.?\s+[A-Z][\w\s'-]{2,50}\s{2,}C[A-Z]{4}\s*$/gm, '');
  // Remove "6.1.1. Title    CTWLR" style headers from content
  text = text.replace(/\n\d+\.\d+(?:\.\d+)*\.?\s+[A-Z][\w\s'-]{3,50}\s{3,}C[A-Z]{4}\s*$/gm, '');
  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

// Step 5: Build anchor IDs
function anchorId(entry) {
  const num = entry.num.replace(/\./g, '-');
  return 's' + num;
}

// Step 6: Generate markdown
function generateMD(sections) {
  let md = '# Phantasy Star IV — Complete Walkthrough\n\n';
  md += '> By Seb Holt (Sir Pobalot) — Converted from GameFAQs\n\n';

  // Table of Contents
  md += '## Table of Contents\n\n';
  for (const s of sections) {
    const indent = '  '.repeat(s.level - 1);
    md += indent + '- [' + s.num + '. ' + escapeMd(s.title) + '](#' + anchorId(s) + ')\n';
  }

  md += '\n---\n\n';

  // Sections
  for (const s of sections) {
    md += '<a id="' + anchorId(s) + '"></a>\n\n';
    md += '#'.repeat(s.level) + ' ' + s.num + '. ' + s.title + '\n\n';
    md += formatContent(s.content);
  }

  return md;
}

function formatContent(text) {
  const lines = text.split('\n');
  let out = '';
  let proseBuf = [];
  let artBuf = [];

  function flushProse() {
    if (proseBuf.length === 0) { proseBuf = []; return; }

    // Split prose buffer into sub-blocks at transition points
    const subBlocks = [];
    let current = [];
    let currentType = 'prose';

    for (let i = 0; i < proseBuf.length; i++) {
      const line = proseBuf[i];
      const trimmed = line.trim();

      // Detect line type
      let lineType = 'prose';
      if (/(?:leaves|joins)\s+the\s+party/i.test(trimmed)) {
        lineType = 'event';
      } else if (trimmed === '') {
        lineType = currentType; // blank lines keep current type
      } else if (/^(Recommended|Starting)\b/.test(trimmed) && i + 1 < proseBuf.length && proseBuf[i+1].includes('|')) {
        lineType = 'equipment';
      }

      // If type changes and we have content, flush current block
      if (lineType !== 'prose' && currentType !== lineType && current.some(l => l !== '')) {
        subBlocks.push({ type: currentType, lines: current });
        current = [];
      }
      if (lineType !== 'prose') currentType = lineType;

      current.push(trimmed);
    }
    if (current.some(l => l !== '')) subBlocks.push({ type: currentType, lines: current });

    // Process each sub-block
    for (const block of subBlocks) {
      const nonEmpty = block.lines.filter(l => l !== '');

      if (block.type === 'equipment') {
        out += '\n```\n' + nonEmpty.join('\n') + '\n```\n\n';
        continue;
      }

      if (block.type === 'event') {
        for (const l of nonEmpty) {
          if (/(?:leaves|joins)\s+the\s+party/i.test(l)) {
            out += '> **' + l + '**\n\n';
          }
        }
        continue;
      }

      // Prose block: preserve line breaks
      let paragraph = '';
      for (let j = 0; j < block.lines.length; j++) {
        const l = block.lines[j];
        if (l === '') continue;
        if (j > 0 && block.lines[j-1] !== '' && !/[.!?)\]'">]$/.test(paragraph.slice(-1)) && !paragraph.endsWith(':') && !paragraph.endsWith(',')) {
          paragraph += ' ' + l;
        } else {
          if (paragraph) paragraph += '\n';
          paragraph += l;
        }
      }
      if (paragraph.trim()) out += paragraph.trim() + '\n\n';
    }

    proseBuf = [];
  }

  function flushArt() {
    while (artBuf.length > 0 && artBuf[artBuf.length - 1] === '') artBuf.pop();
    if (artBuf.length >= 2) {
      out += '\n```\n' + artBuf.join('\n') + '\n```\n\n';
    } else if (artBuf.length === 1) {
      out += '---\n\n';
    }
    artBuf = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^\d+\.\d+(?:\.\d+)*\.?\s+[A-Z][\w\s'\-–]{3,60}\s{3,}C[A-Z]{4}\s*$/.test(trimmed)) {
      flushProse(); flushArt(); continue;
    }
    if (/^C[A-Z]{4}\s*$/.test(trimmed)) continue;

    if (!trimmed) {
      if (proseBuf.length > 0 && proseBuf[proseBuf.length - 1] !== '') proseBuf.push('');
      if (artBuf.length > 0 && artBuf[artBuf.length - 1] !== '') artBuf.push('');
      continue;
    }

    if (isArtLine(trimmed)) {
      flushProse();
      artBuf.push(trimmed);
    } else {
      flushArt();
      proseBuf.push(trimmed);
    }
  }

  flushProse();
  flushArt();
  return out;
}

function isEquipmentBlock(lines) {
  if (lines.length < 3) return false;
  const txt = lines.join('\n');
  if (!txt.includes('|')) return false;
  const hasEquipment = /Equipment|Starting|Recommended/.test(txt);
  const hasPipes = (txt.match(/\|/g) || []).length >= 6;
  return hasEquipment || hasPipes;
}

function isPartyEvent(lines) {
  if (lines.length > 5) return false;
  const txt = lines.join(' ');
  return /(?:leaves|joins)\s+the\s+party/i.test(txt);
}

function isArtLine(line) {
  if (!line) return false;
  // Box drawing with lots of pipe chars
  if ((line.match(/\|/g) || []).length >= 3) return true;
  // Box drawing with pipes and bars
  if (/[|‖\/\\]{2,}/.test(line) && !/\w{3,}\s\w{3,}/.test(line)) return true;
  // Lines of repeated decorative characters
  if (/^[_\*¯\-=#]{10,}$/.test(line)) return true;
  // Mostly special characters (but not prose with a few specials)
  const specials = (line.match(/[^\w\s]/g) || []).length;
  const letters = (line.match(/[a-zA-Z]/g) || []).length;
  if (specials > letters && specials >= 5) return true;
  // Lines with no letters at all (pure decoration)
  if (letters === 0 && specials >= 3) return true;
  return false;
}

function isDefBlock(lines) {
  if (lines.length < 2) return false;
  let defs = 0;
  for (const line of lines) {
    if (/^[A-Z][\w\s\(\)\/-]{2,30}\s[-–]\s/.test(line)) defs++;
  }
  return defs >= lines.length * 0.6;
}

function escapeMd(text) {
  return text.replace(/[\[\]\(\)#*_`]/g, '');
}

// Main
(async function () {
  console.log('Fetching walkthrough...');
  const html = await fetch(URL);
  console.log('Got ' + html.length + ' bytes');
  const text = extractText(html);
  console.log('Extracted ' + text.length + ' chars of text');

  console.log('Parsing table of contents...');
  const toc = parseTOC(text);
  console.log('Found ' + toc.length + ' sections');

  console.log('Splitting into sections...');
  const sections = splitSections(text, toc);
  console.log('Split into ' + sections.length + ' sections');

  console.log('Generating markdown...');
  const md = generateMD(sections);

  fs.writeFileSync(OUTPUT, md);
  console.log('Saved to ' + OUTPUT + ' (' + md.length + ' bytes)');
})();
