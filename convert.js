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

      let lineType = 'prose';
      if (/(?:leaves|joins)\s+the\s+party/i.test(trimmed)) {
        lineType = 'event';
      } else if (trimmed === '') {
        lineType = currentType;
      } else if (/^(Recommended|Starting)\b/.test(trimmed) && i + 1 < proseBuf.length && proseBuf[i+1].includes('|')) {
        lineType = 'equipment';
      }

      if (lineType !== 'prose' && currentType !== lineType && current.some(l => l !== '')) {
        subBlocks.push({ type: currentType, lines: current });
        current = [];
      }
      if (lineType !== 'prose') currentType = lineType;

      current.push(trimmed);
    }
    if (current.some(l => l !== '')) subBlocks.push({ type: currentType, lines: current });

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
          } else if (/^[¯_]{5,}$/.test(l)) continue;
          else out += l + '\n\n';
        }
        continue;
      }

      // Prose — apply aggressive readability editing
      out += editProse(block.lines);
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

// ===== Expert prose editor =====

function editProse(lines) {
  let out = '';

  // Group lines into paragraphs (separated by blank lines)
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
    if (line === '') {
      if (current.length > 0) { paragraphs.push(current); current = []; }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) paragraphs.push(current);

  for (const para of paragraphs) {
    const joined = para.join(' ').trim();
    if (!joined) continue;

    // Check if this is a definition list (term followed by a dash/double space definition)
    if (isDefinitionPara(para)) {
      out += formatDefinitions(para) + '\n\n';
      continue;
    }

    // Check if this is a step-by-step walkthrough block
    if (isStepList(para)) {
      out += formatSteps(para) + '\n\n';
      continue;
    }

    // Check if this is a plain list (items, concepts, etc.)
    if (isBulletList(para)) {
      out += formatBulletList(para) + '\n\n';
      continue;
    }

    // Regular narrative: bold key terms, split into sensible paragraphs
    out += formatNarrative(joined) + '\n\n';
  }

  return out;
}

function isDefinitionPara(lines) {
  let count = 0;
  for (const l of lines) {
    const t = l.trim();
    if (/^[A-Z][\w\s\/\(\)'-]{2,40}\s{2,}/.test(t)) count++;
    else if (/^[A-Z][\w\s\/\(\)'-]{2,40}\s[-–]\s/.test(t)) count++;
  }
  // Any definition lines = definition block
  return count >= 1;
}

function formatDefinitions(lines) {
  let out = '';
  for (const l of lines) {
    // Try "Term    definition" pattern first
    let m = l.match(/^(.+?)\s{2,}(.+)$/);
    if (m) {
      let def = m[2].trim();
      // Strip leading dash if present
      if (/^[-–—]\s/.test(def)) def = def.replace(/^[-–—]\s*/, '');
      out += '- **' + m[1].trim() + '** — ' + def + '\n';
      continue;
    }
    // Try "Term - definition" pattern
    m = l.match(/^(.+?)\s[-–]\s(.+)$/);
    if (m) {
      out += '- **' + m[1].trim() + '** — ' + m[2].trim() + '\n';
      continue;
    }
    // Continuation line
    out += l + '\n';
  }
  return out;
}

function isStepList(lines) {
  // Walkthrough steps: each line starts with an action verb
  const stepVerbs = /^(Go|Head|Walk|Take|Enter|Leave|Return|Ascend|Descend|Open|Use|Equip|Sell|Buy|Rest|Save|Talk|Speak|Examine|Continue|Follow|Turn|Make|Pick|Collect|Retrieve|Now|After|When|If|You|The|This|There|At|In|From|Before|Once|Navigate|Drive|Cross|Approach)\b/i;
  let count = 0;
  for (const l of lines) {
    if (stepVerbs.test(l.trim())) count++;
  }
  return lines.length >= 3 && count >= lines.length * 0.5;
}

function formatSteps(lines) {
  let out = '';
  // Group into sub-paragraphs separated by blank-ish context clues
  const chunks = [];
  let chunk = [];
  for (const l of lines) {
    if (/^(Recommended|Starting|Equipment|You are now|A cut-scene|Back in|Meanwhile)/i.test(l.trim())) {
      if (chunk.length > 0) chunks.push(chunk);
      chunk = [l];
    } else {
      chunk.push(l);
    }
  }
  if (chunk.length > 0) chunks.push(chunk);

  for (const chk of chunks) {
    const text = chk.join(' ').trim();
    // Internal step list: lines with numbers or action verbs get bullets
    const steps = text.split(/;\s(?=[A-Z])/); // split on semicolons followed by capitals
    if (steps.length > 1) {
      for (const s of steps) {
        const t = s.trim();
        if (t) out += '- ' + capitalize(t) + '\n';
      }
    } else if (chk.length === 1) {
      out += chk[0].trim() + '\n\n';
    } else {
      out += text + '\n\n';
    }
  }
  return out;
}

function isBulletList(lines) {
  // Lines that look like items or brief descriptions
  let count = 0;
  for (const l of lines) {
    const t = l.trim();
    if (/^[A-Z][\w\s\/\(\)]+:/.test(t) && t.length < 60) count++;
    else if (/^[•·\-*]/.test(t)) count++;
    else if (/^[A-Z]/.test(t) && t.length < 50 && !/[\.\?\!]$/.test(t)) count++;
  }
  return lines.length >= 3 && count >= lines.length * 0.5;
}

function formatBulletList(lines) {
  let out = '';
  for (const l of lines) {
    const t = l.trim();
    if (/^[A-Z][\w\s\/\(\)]+:/.test(t)) {
      out += '- ' + t + '\n';
    } else {
      out += '- ' + t + '\n';
    }
  }
  return out;
}

function formatNarrative(text) {
  // Bold key RPG terms
  text = text.replace(/\b(HP|TP|EXP|ATK|DFS|MST|MTL\s*PWR|SP)\b/g, '**$1**');
  text = text.replace(/\b(Fire|Water|Energy|Force|Gravity|Electric|Radiation|Light)\b(?=\s*(?:element|damage|Skill|Technique|attack))/gi, '**$1**');

  // Split into sentences and group 2-3 sentences per paragraph
  const sentences = text.match(/[^.!?]+[.!?]+"?\s*/g) || [text];
  let out = '';
  let chunk = '';
  for (let i = 0; i < sentences.length; i++) {
    chunk += sentences[i];
    if ((i + 1) % 3 === 0 || i === sentences.length - 1) {
      out += chunk.trim() + '\n\n';
      chunk = '';
    }
  }
  return out || text + '\n\n';
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
