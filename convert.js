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
  // Remove next section headers that leaked in (e.g. "15.6. Side Missions CBSSM")
  text = text.replace(/\n\d+\.\d+(?:\.\d+)*\.?\s+.+?\s+C[A-Z]{4}\s*$/gm, '');
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
    // Format content: join lines that aren't blank
    const paragraphs = s.content.split('\n\n');
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;

      // Remove extra spaces from fixed-width formatting
      let formatted = trimmed.replace(/\s{2,}/g, ' ');

      // Detect ASCII art (lines with lots of special chars)
      if (trimmed.match(/[_¯\*\#%=\/\\-]{4,}/) ||
          trimmed.match(/^[\.\s\|\(\)\/\\=\*#@%\+\-;\.,]+$/)) {
        // ASCII art - put in code block
        md += '\n```\n' + trimmed + '\n```\n\n';
      } else {
        md += formatted + '\n\n';
      }
    }
  }

  return md;
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
