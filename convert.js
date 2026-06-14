#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2];
const OUTPUT = path.join(__dirname, 'phantasy-star-iv-guide-and-walkthrough.md');

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

function extractText(html) {
  const re = /<pre[^>]*>(.*?)<\/pre>/gs;
  let text = '';
  let m;
  while ((m = re.exec(html)) !== null) text += m[1] + '\n';
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function parseTOC(text) {
  const lines = text.split('\n');
  const tocEntries = [];
  let inTOC = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'Table of Contents') { inTOC = true; continue; }
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
  const tocEndMatch = text.match(/20\.\s+Contact Information.*?CNIF/);
  const tocEnd = tocEndMatch ? tocEndMatch.index + tocEndMatch[0].length : 0;
  const body = text.substring(tocEnd);
  const positions = [];
  for (const entry of tocEntries) {
    const code = 'C' + entry.code;
    const idx = body.indexOf(code);
    if (idx >= 0) {
      const sub = body.substring(idx + code.length);
      const match = sub.match(/(?:.*\n){0,3}[\*\-_¯\s]{10,}\n/);
      const headerEnd = match ? idx + code.length + match.index + match[0].length : idx + code.length + 100;
      positions.push({ ...entry, pos: tocEnd + headerEnd });
    }
  }
  positions.sort((a, b) => a.pos - b.pos);
  const sections = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos;
    const end = i < positions.length - 1 ? positions[i + 1].pos - 30 : text.length;
    let content = text.substring(start, end);
    content = content.replace(/^[_\*¯\s]{30,}$/gm, '');
    content = content.replace(/\n\d+\.\d+(?:\.\d+)*\.?\s+[A-Z][\w\s'-]{3,50}\s{3,}C[A-Z]{4}\s*$/gm, '');
    content = content.replace(/\n{3,}/g, '\n\n').trim();
    if (content) sections.push({ ...positions[i], content });
  }
  return sections;
}

function escapeMd(t) { return t.replace(/[\[\]\(\)#*_`]/g, ''); }
function anchorId(e) { return 's' + e.num.replace(/\./g, '-'); }

// Detect if a line is ASCII art (should be in code block) vs prose
function isAsciiArt(line) {
  const s = line.trim();
  if (!s) return false;
  // Lines with 3+ pipe chars (tables)
  if ((s.match(/\|/g) || []).length >= 3) return true;
  // Repeated decorative chars
  if (/^[\*\-_=¯]{10,}$/.test(s)) return true;
  // Lines where special chars outnumber letters
  const letters = (s.match(/[a-zA-Z]/g) || []).length;
  const special = (s.match(/[^a-zA-Z0-9\s]/g) || []).length;
  if (special > 0 && special > letters * 1.5) return true;
  // Box-drawing patterns
  if ((s.match(/[\/\\\|\-]/g) || []).length >= 4 && letters < 5) return true;
  return false;
}

// Format content: detect ASCII art blocks and prose blocks
function formatContent(content) {
  const lines = content.split('\n');
  const blocks = [];
  let currentBlock = [];
  let currentIsCode = null;

  for (const line of lines) {
    const code = isAsciiArt(line);
    if (currentIsCode !== null && code !== currentIsCode) {
      blocks.push({ lines: currentBlock, isCode: currentIsCode });
      currentBlock = [];
    }
    currentIsCode = code;
    currentBlock.push(line);
  }
  if (currentBlock.length > 0) {
    blocks.push({ lines: currentBlock, isCode: currentIsCode });
  }

  return blocks.map(b => {
    const text = b.lines.join('\n').trim();
    if (!text) return '';
    if (b.isCode) return '```\n' + text + '\n```';
    return text;
  }).filter(Boolean).join('\n\n');
}

(async function () {
  let html;
  if (URL && !URL.startsWith('http')) {
    html = fs.readFileSync(URL, 'utf8');
  } else if (URL) {
    html = await fetch(URL);
  } else {
    const cached = path.join(__dirname, 'raw.txt');
    console.log('Using cached raw.txt...');
    html = fs.readFileSync(cached, 'utf8');
  }
  console.log('Got ' + html.length + ' bytes');

  const text = extractText(html);
  console.log('Extracted ' + text.length + ' chars');

  const toc = parseTOC(text);
  console.log('Found ' + toc.length + ' sections');

  const sections = splitSections(text, toc);
  console.log('Split into ' + sections.length + ' sections');

  let md = '# Phantasy Star IV — Guide and Walkthrough\n\n';
  md += '> By Seb Holt (Sir Pobalot) — Converted from GameFAQs\n\n';
  md += '## Table of Contents\n\n';
  for (const s of sections) {
    md += '  '.repeat(s.level - 1) + '- [' + s.num + '. ' + escapeMd(s.title) + '](#' + anchorId(s) + ')\n';
  }
  md += '\n---\n\n';
  for (const s of sections) {
    md += '<a id="' + anchorId(s) + '"></a>\n\n';
    md += '#'.repeat(s.level) + ' ' + s.num + '. ' + s.title + '\n\n';
    md += formatContent(s.content) + '\n\n';
  }

  fs.writeFileSync(OUTPUT, md);
  console.log('Saved to ' + OUTPUT + ' (' + md.length + ' bytes)');
})();
