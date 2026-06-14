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
const rawSections = [];
for (let a = 0; a < anchorLines.length; a++) {
  const startLine = anchorLines[a].line;
  const endLine = a + 1 < anchorLines.length ? anchorLines[a + 1].line : lines.length;
  const body = lines.slice(startLine, endLine).join('\n').trim();
  rawSections.push({ anchor: anchorLines[a].anchor, body });
}

// Detect stub sections: heading + code-block TOC reference only, no real content
// Stub sections are typically < 500 chars (heading + decorative TOC code block)
// Real sections have 1000+ chars of walkthrough content
function isStub(section) {
  return section.body.length < 500;
}

// Merge stub sections into their next non-stub sibling
// When multiple stubs precede a real section, all their headings are prepended
// Track stub→target mapping for TOC redirects
const stubTargets = {}; // stubAnchor → targetSection
const sections = [];
for (let a = 0; a < rawSections.length; a++) {
  if (isStub(rawSections[a])) {
    // Collect consecutive stubs
    const stubs = [rawSections[a]];
    while (a + 1 < rawSections.length && isStub(rawSections[a + 1])) {
      stubs.push(rawSections[++a]);
    }
    // Prepend stub headings to the next non-stub section
    if (a + 1 < rawSections.length) {
      const target = rawSections[a + 1];
      const prefixLines = [];
      for (const stub of stubs) {
        const bodyLines = stub.body.split('\n');
        for (const l of bodyLines) {
          if (l.match(/^<a id=/) || l.match(/^#+\s/)) prefixLines.push(l);
        }
        stubTargets[stub.anchor] = target;
      }
      target.body = prefixLines.join('\n') + '\n\n' + target.body;
    }
  } else {
    sections.push(rawSections[a]);
  }
}
console.log(`Merged ${rawSections.length - sections.length} stub sections`);

// Extract section number from anchor (e.g. "s6-4-8" → "6.4.8")
function getNumber(anchor) {
  return anchor.replace(/^s/, '').replace(/-/g, '.');
}

// Extract heading text from section body (use the last/deepest heading)
function getHeading(body) {
  const bodyLines = body.split('\n');
  let last = '';
  for (const line of bodyLines) {
    const hMatch = line.match(/^#+\s+(.+)/);
    if (hMatch) last = hMatch[1].trim();
  }
  return last;
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

// Assign filenames to real sections
for (const s of sections) {
  const num = getNumber(s.anchor);
  const title = getHeading(s.body);
  const strippedTitle = title.replace(new RegExp(`^${num.replace(/\./g, '\\.')}\\.?\\s*`), '');
  const slug = slugify(strippedTitle) || slugify(title);
  s.filename = `${num}-${slug}.md`;
  s.num = num;
  s.title = title;
  s.strippedTitle = strippedTitle;
}

// Build full TOC from rawSections (including stubs for proper tree hierarchy)
const tocEntries = [];
for (const rs of rawSections) {
  const num = getNumber(rs.anchor);
  const title = getHeading(rs.body);
  const strippedTitle = title.replace(new RegExp(`^${num.replace(/\./g, '\\.')}\\.?\\s*`), '');
  const depth = (num.match(/\./g) || []).length;
  // Get the real section's filename (redirect stubs)
  let filename = null;
  const real = sections.find(s => s.num === num);
  if (real) {
    filename = real.filename;
  } else if (stubTargets[rs.anchor]) {
    filename = stubTargets[rs.anchor].filename;
  }
  tocEntries.push({ num, title, strippedTitle, filename, depth, anchor: rs.anchor });
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

// Write section files
console.log(`Writing ${sections.length} sections...`);
const sizes = [];
for (let i = 0; i < sections.length; i++) {
  const s = sections[i];
  fs.writeFileSync(path.join(outputDir, s.filename), s.body + '\n');
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
    let entry = sections.find(s => s.anchor === anchor);
    if (!entry && stubTargets[anchor]) {
      entry = stubTargets[anchor];
    }
    if (entry && entry.filename) {
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
  const indent = '  '.repeat(e.depth);
  const link = e.filename ? `[${e.num}. ${e.title}](${e.filename})` : `**${e.num}. ${e.title}**`;
  indexContent.push(`${indent}- ${link}`);
}

const indexFile = path.join(outputDir, 'index.md');
fs.writeFileSync(indexFile, indexContent.join('\n'));

// Write TOC as JSON for the reader app
const tocTree = [];
const stack = [{ children: tocTree, depth: -1 }];
for (const e of tocEntries) {
  const depth = (e.num.match(/\./g) || []).length;
  const node = { num: e.num, title: e.title, file: e.filename, depth, children: [] };
  while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
    stack.pop();
  }
  stack[stack.length - 1].children.push(node);
  stack.push({ ...node, depth });
}
const tocJson = path.join(outputDir, 'toc.json');
fs.writeFileSync(tocJson, JSON.stringify(tocTree, null, 2));

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
