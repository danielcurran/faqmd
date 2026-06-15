// Line-level classification and mixed-content segmentation for reformatting.

const { isDecorativeLine, isAsciiArtBlock, hasEquipSlotLines } = require('./detect');
const {
  formatProse, formatTable, formatAscii, formatStatBlock, formatDecorativeText,
  formatEquipmentTable
} = require('./format');

function classifyLine(line) {
  const s = line.trim();
  if (!s) return 'blank';
  if (isDecorativeLine(line)) return 'decorative';
  if (s.includes('|')) return 'pipe';
  if (/^\w[\w\s]+\s*:\s*\w/.test(s)) return 'stat';
  return 'prose';
}

function segmentLines(lines) {
  const groups = [];
  let current = null;
  for (const line of lines) {
    const type = classifyLine(line);
    if (!current || type !== current.type) {
      if (current) groups.push(current);
      current = { type, lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current) groups.push(current);
  return groups;
}

function hasConsistentPipes(lines) {
  const counts = lines.map(l => (l.match(/\|/g) || []).length).filter(c => c > 0);
  if (counts.length < 2) return false;
  const mode = counts.sort((a, b) => counts.filter(v => v === a).length - counts.filter(v => v === b).length).pop();
  if (counts.filter(c => c === mode).length / counts.length < 0.6) return false;

  // Verify this is tabular data, not ASCII art with pipes
  let wordCells = 0, totalCells = 0;
  let artPatterns = 0;
  for (const line of lines) {
    const cells = line.split('|').map(c => c.trim()).filter(c => c);
    for (const cell of cells) {
      totalCells++;
      if (/[a-zA-Z]{2,}/.test(cell)) wordCells++;
      if (/[^\w\s]{3,}/.test(cell)) artPatterns++;
    }
  }
  if (totalCells > 0 && artPatterns / totalCells >= 0.3) return false;
  return totalCells > 0 && wordCells / totalCells >= 0.5;
}

function formatMixed(lines) {
  const groups = segmentLines(lines);
  return groups.map(group => {
    if (group.type === 'pipe') {
      // Check if this group is an equipment table
      if (hasEquipSlotLines(group.lines)) {
        return formatEquipmentTable(group.lines);
      }
      if (group.lines.length >= 2) {
        if (hasConsistentPipes(group.lines)) {
          return formatTable(group.lines);
        }
        if (isAsciiArtBlock(group.lines)) {
          return formatAscii(group.lines);
        }
      } else {
        // Single isolated pipe line — keep if it has data, strip decorative headers
        const line = group.lines[0].trim();
        // Strip single-line dungeon entrance markers like:
        //   |/  Academy Basement       \_________________________________
        // The location name is already in **DUNGEON #N** from the companion
        // decorative header line.
        if ((line.match(/\|/g) || []).length === 1 && /^\|?\s*\/\s+/.test(line)) return '';
        const notWord = line.replace(/[a-zA-Z0-9\s]/g, '');
        if (notWord.length > line.length / 2) {
          // Mostly decorative — check if this is a one-line map header
          const words = (line.match(/[a-zA-Z]{2,}/g) || []).length;
          if (words < 2) return ''; // Strip single-line decorative fragments
          return formatAscii(group.lines);
        }
      }
      return formatProse(group.lines);
    }
    switch (group.type) {
      case 'stat':      return formatStatBlock(group.lines);
      case 'decorative': return '';
      default: {
        const dec = formatDecorativeText(group.lines);
        return dec !== null ? dec : formatProse(group.lines);
      }
    }
  }).filter(s => s).join('\n\n');
}

module.exports = { classifyLine, segmentLines, hasConsistentPipes, formatMixed };
