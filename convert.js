#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2];
const OUTPUT = process.argv[3] || path.join(__dirname, 'walkthrough.md');

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

// Detect line types for smarter formatting
function isDecorative(line) {
  return /^[\*\-_=¯]{10,}$/.test(line.trim());
}

function isPipeTable(lines) {
  let pipeCounts = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    const pipes = (s.match(/\|/g) || []).length;
    // Table rows need 3+ pipes and actual data between them
    if (pipes >= 3) {
      const cells = s.split('|').map(c => c.trim());
      const meaningful = cells.filter(c => c && c.length > 1 && !/^[¯\-_=*]+$/.test(c));
      if (meaningful.length >= 2) pipeCounts.push(pipes);
    }
  }
  // Need at least 2 data rows with consistent pipe count
  if (pipeCounts.length < 2) return false;
  const mostCommon = pipeCounts.sort((a,b) => pipeCounts.filter(x => x===a).length - pipeCounts.filter(x => x===b).length).pop();
  return pipeCounts.filter(x => x === mostCommon).length >= 2;
}

function isPartyBlock(lines) {
  const text = lines.join(' ').toLowerCase();
  return /starting (party|level|equipment)/i.test(text) ||
         /recommended/i.test(text) ||
         /you begin with/i.test(text) ||
         /joins the party/i.test(text) ||
         /^\s*[a-z]+ (joins|leaves)/im.test(text) ||
         /equipment\s{2,}[¯]/i.test(text);
}

function isAsciiArt(line) {
  const s = line.trim();
  if (!s) return false;
  if ((s.match(/[\/\\\|\-]/g) || []).length >= 5 && (s.match(/[a-zA-Z]/g) || []).length < 5) return true;
  const letters = (s.match(/[a-zA-Z]/g) || []).length;
  const special = (s.match(/[^a-zA-Z0-9\s]/g) || []).length;
  if (special > 0 && special > letters * 3) return true;
  return false;
}

function asciiTableToMarkdown(lines) {
  // Filter out decorative separator rows
  const rows = lines.filter(l => l.trim() && !isDecorative(l));
  if (rows.length < 2) return lines.join('\n');
  
  // Split each row on pipe, trim cells
  const cells = rows.map(r => r.split('|').map(c => c.trim()).filter(c => c));
  // Find max columns
  const maxCols = Math.max(...cells.map(r => r.length));
  
  // Pad rows to max columns
  const padded = cells.map(r => {
    while (r.length < maxCols) r.push('');
    return r;
  });
  
  const header = padded[0];
  const data = padded.slice(1);
  
  let out = '| ' + header.join(' | ') + ' |\n';
  out += '| ' + header.map(() => '---').join(' | ') + ' |\n';
  for (const row of data) {
    out += '| ' + row.join(' | ') + ' |\n';
  }
  return out;
}

// Format content: detect table, art, party, and prose blocks
function formatContent(content) {
  const lines = content.split('\n');
  const blocks = [];
  let currentBlock = [];
  
  function flush() {
    if (currentBlock.length === 0) return;
    const text = currentBlock.join('\n').trim();
    if (!text) { currentBlock = []; return; }
    
    // Check block type
    const nonDecorative = currentBlock.filter(l => !isDecorative(l.trim()));
    
    if (nonDecorative.length === 0) {
      // All decorative — skip entirely
    } else if (isPartyBlock(nonDecorative)) {
      blocks.push('> ' + text.replace(/\n/g, '\n> '));
    } else if (isPipeTable(nonDecorative)) {
      blocks.push(asciiTableToMarkdown(currentBlock));
    } else if (nonDecorative.some(l => isAsciiArt(l))) {
      blocks.push('```\n' + text + '\n```');
    } else {
      blocks.push(text);
    }
    currentBlock = [];
  }
  
  for (const line of lines) {
    if (line.trim() === '') {
      flush();
    } else {
      currentBlock.push(line);
    }
  }
  flush();
  
  return blocks.filter(Boolean).join('\n\n');
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

  let md = '# ' + (sections[0]?.title || 'Walkthrough') + '\n\n';
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
