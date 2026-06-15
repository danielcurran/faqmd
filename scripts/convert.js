#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');
const { reformat } = require('./reformat');

let URL = null;
let OUTPUT = path.join(__dirname, 'walkthrough.md');

// Parse named flags: --title="Game Name", --author="Author Name"
let titleOverride = null;
let authorOverride = null;
const positional = [];
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--title=')) {
    titleOverride = arg.slice('--title='.length);
  } else if (arg.startsWith('--author=')) {
    authorOverride = arg.slice('--author='.length);
  } else {
    positional.push(arg);
  }
}
if (positional.length > 0) URL = positional[0];
if (positional.length > 1) OUTPUT = positional[1];

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode + ' (expected 200)'));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timed out after 30s'));
    });
  });
}

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
    if (line.includes('Table of Contents')) { inTOC = true; continue; }
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
      const match = sub.match(/(?:.*\n){0,3}[\*\-_¯\s]{10,}\n/);
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
    content = content.replace(/^[_\*¯\s]{30,}$/gm, '');
    content = content.replace(/\n\d+\.\d+(?:\.\d+)*\.?\s+[A-Z][\w\s'-]{3,50}\s{3,}C[A-Z]{4}\s*$/gm, '');
    content = content.replace(/\n{3,}/g, '\n\n').trim();
    if (content) sections.push({ ...positions[i], content });
  }
  return sections;
}

function escapeMd(t) { return t.replace(/[\[\]\(\)#*_`]/g, ''); }
function anchorId(e) { return 's' + e.num.replace(/\./g, '-'); }



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

  let md = '# ' + (titleOverride || sections[0]?.title || 'Walkthrough') + '\n\n';
  if (authorOverride) {
    md += '> By ' + authorOverride + ' — Converted from GameFAQs\n\n';
  } else {
    md += '> By Seb Holt (Sir Pobalot) — Converted from GameFAQs\n\n';
  }
  md += '## Table of Contents\n\n';
  for (const s of sections) {
    md += '  '.repeat(s.level - 1) + '- [' + s.num + '. ' + escapeMd(s.title) + '](#' + anchorId(s) + ')\n';
  }
  md += '\n---\n\n';
  for (const s of sections) {
    md += '<a id="' + anchorId(s) + '"></a>\n\n';
    md += '#'.repeat(s.level) + ' ' + s.num + '. ' + escapeMd(s.title) + '\n\n';
    md += reformat(s.content) + '\n\n';
  }

  const resolved = path.resolve(OUTPUT);
  const safeBase = path.resolve(process.cwd());
  if (!resolved.startsWith(safeBase + path.sep) && resolved !== safeBase && !resolved.startsWith(path.resolve(__dirname) + path.sep)) {
    console.error('Error: output path must be within the current working directory or script directory');
    process.exit(1);
  }
  fs.writeFileSync(OUTPUT, md);
  console.log('Saved to ' + OUTPUT + ' (' + md.length + ' bytes)');
})();
