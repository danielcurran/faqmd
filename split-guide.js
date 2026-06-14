#!/usr/bin/env node
// Split a large walkthrough markdown into per-section files with navigation
// Usage: node split-guide.js <input.md> [output-dir]

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputDir = process.argv[3] || 'guide';

if (!inputFile) {
  console.error('Usage: node split-guide.js <input.md> [output-dir]');
  process.exit(1);
}

const md = fs.readFileSync(inputFile, 'utf8');
const lines = md.split('\n');

// Find where the header (title, author, TOC) ends and sections begin
let headerEnd = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/<a id="s\d/)) {
    headerEnd = i;
    break;
  }
}

const header = lines.slice(0, headerEnd).join('\n');

// Find all section boundaries by scanning anchor tags
const anchorLines = [];
for (let i = headerEnd; i < lines.length; i++) {
  const m = lines[i].match(/<a id="(s\d+(?:-\d+)*)"><\/a>/);
  if (m) {
    anchorLines.push({ line: i, anchor: m[1] });
  }
}

// Build sections from anchor boundaries
const sections = [];
for (let a = 0; a < anchorLines.length; a++) {
  const startLine = anchorLines[a].line;
  const endLine = a + 1 < anchorLines.length ? anchorLines[a + 1].line : lines.length;
  const body = lines.slice(startLine, endLine).join('\n').trim();
  sections.push({ anchor: anchorLines[a].anchor, body });
}

// Extract section number from anchor (e.g. "s6-4-8" → "6.4.8")
function getNumber(anchor) {
  return anchor.replace(/^s/, '').replace(/-/g, '.');
}

// Extract heading text from section body
function getHeading(body) {
  const bodyLines = body.split('\n');
  for (const line of bodyLines) {
    const hMatch = line.match(/^#+\s+(.+)/);
    if (hMatch) return hMatch[1].trim();
  }
  return '';
}

// Create a URL-safe slug from heading text
function slugify(text) {
  let s = text.toLowerCase();
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '');
  s = s.replace(/[^a-z0-9\s-']/g, '');
  s = s.replace(/\s+/g, '-');
  s = s.replace(/'/g, '');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s || 'section';
}

// Build parent chain for breadcrumb
function getParents(idx, tocEntries) {
  const parts = tocEntries[idx].num.split('.');
  const parents = [];
  for (let p = 1; p < parts.length; p++) {
    const parentNum = parts.slice(0, p).join('.');
    const parent = tocEntries.find(e => e.num === parentNum);
    if (parent && parent.num !== tocEntries[idx].num) {
      parents.push(parent);
    }
  }
  return parents;
}

// Assign filenames, titles, numbers
const tocEntries = [];
for (const s of sections) {
  const num = getNumber(s.anchor);
  const title = getHeading(s.body);
  const strippedTitle = title.replace(new RegExp(`^${num.replace(/\./g, '\\.')}\\.?\\s*`), '');
  const slug = slugify(strippedTitle) || slugify(title);
  const depth = (num.match(/\./g) || []).length;
  const indent = '  '.repeat(depth);
  const filename = `${num}-${slug}.md`;

  tocEntries.push({ indent, num, title, filename, strippedTitle });
  s.filename = filename;
  s.num = num;
  s.title = title;
  s.strippedTitle = strippedTitle;
}

// Build search index: word → [section numbers]
const searchIndex = {};
const stopWords = new Set(['the', 'and', 'for', 'you', 'this', 'that', 'with', 'from',
  'are', 'was', 'has', 'have', 'not', 'but', 'can', 'all', 'will', 'one', 'its', 'your',
  'been', 'were', 'they', 'their', 'what', 'when', 'how', 'who', 'which', 'each', 'into',
  'about', 'over', 'than', 'then', 'also', 'very', 'just', 'here', 'there', 'more',
  'some', 'only', 'other', 'after', 'before', 'between']);

for (const s of sections) {
  const text = s.body.replace(/<[^>]+>/g, ' ').replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase();
  const words = new Set(text.split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w)));
  for (const w of words) {
    if (!searchIndex[w]) searchIndex[w] = [];
    if (!searchIndex[w].includes(s.num)) {
      searchIndex[w].push(s.num);
    }
  }
}

// Search index stats
const uniqueTerms = Object.keys(searchIndex).length;
console.log(`Search index: ${uniqueTerms} unique terms`);

// Create output directory
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

// Write section files with navigation
function display(sec) {
  return sec.strippedTitle || sec.title;
}

function makeNavbar(sectionIdx) {
  const s = sections[sectionIdx];
  const parents = getParents(sectionIdx, tocEntries);

  // Find parent sections in the sections array
  const parentSections = parents.map(p => sections.find(sec => sec.num === p.num)).filter(Boolean);
  const breadcrumb = ['[↑ Index](./index.md)', ...parentSections.map(p => `[${p.num}. ${display(p)}](${p.filename})`)];

  let nav = `> 📑 ${breadcrumb.join(' > ')}`;
  nav += `  \n> `;

  const links = [];
  if (sectionIdx > 0) {
    const prev = sections[sectionIdx - 1];
    links.push(`← [${prev.num}. ${display(prev)}](${prev.filename})`);
  }
  if (sectionIdx < sections.length - 1) {
    const next = sections[sectionIdx + 1];
    links.push(`[${next.num}. ${display(next)}](${next.filename}) →`);
  }
  if (links.length > 0) {
    nav += links.join(' · ');
  }

  return nav;
}

console.log(`Writing ${sections.length} sections with navigation...`);
const sizes = [];
for (let i = 0; i < sections.length; i++) {
  const s = sections[i];
  const nav = makeNavbar(i);

  // Add navigation at top and bottom
  const content = [nav, '', '---', '', s.body, '', '---', '', nav, ''].join('\n');
  fs.writeFileSync(path.join(outputDir, s.filename), content);
  sizes.push(s.body.length);
}

// Build index.md with search note
let indexContent = header.split('\n');

// Update TOC links
const newTocLines = [];
for (const line of indexContent) {
  const tocMatch = line.match(/^(\s*-\s+\[)(.+?)(\]\(#)(s[\d-]+)(\)\s*)$/);
  if (tocMatch) {
    const anchor = tocMatch[4];
    const entry = sections.find(s => s.anchor === anchor);
    if (entry) {
      newTocLines.push(`${tocMatch[1]}${tocMatch[2]}](${entry.filename})`);
    } else {
      newTocLines.push(line);
    }
  } else {
    newTocLines.push(line);
  }
}

// Insert search tip after the title block
const titleIdx = newTocLines.findIndex(l => l.startsWith('> By'));
const searchTip = [
  '',
  '> 💡 **Tip:** Press `t` in the GitHub app or website to search across all section files.',
  '',
];
newTocLines.splice(titleIdx + 1, 0, ...searchTip);

indexContent = newTocLines;

// Add section file listing at the bottom
indexContent.push('');
indexContent.push('---');
indexContent.push('');
indexContent.push('## All Sections');
indexContent.push('');
for (const e of tocEntries) {
  indexContent.push(`${e.indent}- [${e.num}. ${e.title}](${e.filename})`);
}

const indexFile = path.join(outputDir, 'index.md');
fs.writeFileSync(indexFile, indexContent.join('\n'));

// Write search index
const indexJson = path.join(outputDir, 'search-index.json');
fs.writeFileSync(indexJson, JSON.stringify(searchIndex, null, 2));

// Stats
const totalChars = sizes.reduce((a, b) => a + b, 0);
const avgChars = Math.round(totalChars / sections.length);
const maxChars = Math.max(...sizes);
console.log(`\n${outputDir}/index.md created`);
console.log(`${outputDir}/search-index.json created (${uniqueTerms} terms)`);
console.log(`${sections.length} section files | avg ${avgChars} chars | range ${Math.min(...sizes)}-${maxChars} chars`);
