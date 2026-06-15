// Main reformatting entry points and public API.

const {
  isDecorativeLine, isAsciiArtBlock, isTableBlock, isStatBlock,
  hasEquipSlotLines
} = require('./detect');
const {
  formatProse, formatTable, formatAscii, classifyArtBlock,
  formatStatBlock, formatDecorativeText, formatEquipmentTable
} = require('./format');
const { formatMixed } = require('./classify');

function reformatBlock(lines) {
  // Phase 1: Full-block checks for content that must stay whole
  if (lines.every(l => isDecorativeLine(l))) return '';

  // Phase 2: Check ASCII art — if mixed with stat/table lines, segment anyway
  if (isAsciiArtBlock(lines)) {
    const hasStat = lines.some(l => /^\w[\w\s]+\s*:\s*\w/.test(l.trim()));
    const hasTablePipes = lines.some(l => {
      const s = l.trim();
      if (!s.includes('|')) return false;
      return s.replace(/\|/g, '').replace(/[^a-zA-Z0-9]/g, '').length >= 3;
    });
    if (hasStat || hasTablePipes) {
      return '<!-- MIXED -->\n\n' + formatMixed(lines);
    }
    return formatAscii(lines);
  }

  // Phase 3: Equipment blocks — detect before decorative text
  if (hasEquipSlotLines(lines)) {
    const mixed = formatMixed(lines);
    if (mixed && !mixed.startsWith('<!-- MIXED -->')) {
      return formatEquipmentTable(lines);
    }
    return mixed;
  }

  // Phase 4: Strip simple decorative elements to plain text
  const dec = formatDecorativeText(lines);
  if (dec !== null) return dec;

  // Phase 5: Pure-type formatting
  if (isTableBlock(lines)) return formatTable(lines);
  if (isStatBlock(lines)) return formatStatBlock(lines);
  return formatProse(lines);
}

function postProcess(md) {
  // Collapse 3+ consecutive blank lines to exactly 1
  md = md.replace(/\n{4,}/g, '\n\n\n');
  md = md.replace(/\n{3,}/g, '\n\n');
  // Ensure labels like **DUNGEON #N** have consistent spacing
  md = md.replace(/\n{3,}\*\*DUNGEON #\d/g, '\n\n**DUNGEON #');
  md = md.replace(/\n{3,}\*\*Boss:/g, '\n\n**Boss:');
  // Strip trailing whitespace from every line
  md = md.replace(/ +$/gm, '');
  return md;
}

function reformat(content) {
  if (!content || !content.trim()) return '';
  const blocks = content.split(/\n{2,}/);
  const result = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) continue;
    const formatted = reformatBlock(lines);
    if (formatted) result.push(formatted);
  }
  let md = result.join('\n\n').trim();
  md = postProcess(md);
  return md;
}

module.exports = {
  reformat,
  reformatBlock,
  formatMixed,
  formatTable,
  formatAscii,
  formatProse,
  formatStatBlock,
  formatDecorativeText,
  formatEquipmentTable,
  classifyArtBlock
};