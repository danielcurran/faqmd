#!/usr/bin/env node

// --- Detection helpers ---

function isDecorativeLine(line) {
  return /^[\*\-_=¯]{8,}$/.test(line.trim());
}

function isAsciiArtBlock(lines) {
  let artLines = 0;
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    if ((s.match(/\|/g) || []).length >= 5) { artLines++; continue; }
    if (/^[\*\-_=¯]{8,}$/.test(s)) { artLines++; continue; }
    if ((s.match(/[\/\\\|]/g) || []).length >= 5) { artLines++; continue; }
    const letters = (s.match(/[a-zA-Z]/g) || []).length;
    const special = (s.match(/[^a-zA-Z0-9\s]/g) || []).length;
    if (special > letters * 2 && special > 3) artLines++;
  }
  return artLines >= 2;
}

function isTableBlock(lines) {
  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length < 2) return false;
  const pipeLines = nonEmpty.filter(l => l.includes('|'));
  return pipeLines.length / nonEmpty.length >= 0.5;
}

function isStatBlock(lines) {
  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length < 2) return false;
  const kvRe = /^\s*\w[\w\s]+\s*:\s*\w/;
  const kvLines = nonEmpty.filter(l => kvRe.test(l.trim()));
  return kvLines.length / nonEmpty.length >= 0.4;
}

// --- Main ---

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
      return formatMixed(lines);
    }
    return formatAscii(lines);
  }

  // Phase 3: Pure-type formatting
  if (isTableBlock(lines)) return formatTable(lines);
  if (isStatBlock(lines)) return formatStatBlock(lines);
  return formatProse(lines);
}

// --- Line-level classification ---

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

function formatMixed(lines) {
  const groups = segmentLines(lines);
  return groups.map(group => {
    if (group.type === 'pipe') {
      if (group.lines.length >= 2) {
        if (hasConsistentPipes(group.lines)) {
          return formatTable(group.lines);
        }
        if (isAsciiArtBlock(group.lines)) {
          return formatAscii(group.lines);
        }
      } else {
        // Single isolated pipe line — keep decorative frames, drop stray pipes
        const line = group.lines[0].trim();
        const notWord = line.replace(/[a-zA-Z0-9\s]/g, '');
        if (notWord.length > line.length / 2) return formatAscii(group.lines);
      }
      return formatProse(group.lines);
    }
    switch (group.type) {
      case 'stat':      return formatStatBlock(group.lines);
      case 'decorative': return '';
      default:          return formatProse(group.lines);
    }
  }).filter(s => s).join('\n\n');
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

// --- Formatters ---

function formatProse(lines) {
  let text = lines.join(' ').replace(/ +/g, ' ').trim();
  if (!text) return '';
  return text + '\n\n';
}

function formatTable(lines) {
  const dataRows = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    // Skip rows that are purely decorative between pipes
    const betweenPipes = s.split('|').slice(1, -1);
    if (betweenPipes.length === 0) continue;
    if (betweenPipes.every(c => /^[\*\-_=¯\s]+$/.test(c.trim()))) continue;
    dataRows.push(s);
  }
  if (dataRows.length === 0) return '';

  // Determine column count from the row with most pipe separators
  const colCounts = dataRows.map(r => r.split('|').length - 1);
  const maxCols = Math.max(...colCounts);
  if (maxCols < 2) return '';

  // Extract cells
  const rows = dataRows.map(row => {
    const cells = row.split('|');
    // Skip leading/trailing empty cell from leading/trailing pipe
    const firstCell = cells[0].trim().length > 0 ? 0 : 1;
    const slice = cells.slice(firstCell);
    // Pad to maxCols
    while (slice.length < maxCols) slice.push('');
    return slice.slice(0, maxCols).map(c => c.trim());
  });

  if (rows.length === 0) return '';

  // Build markdown table
  let md = '';
  for (let i = 0; i < rows.length; i++) {
    md += '| ' + rows[i].join(' | ') + ' |\n';
    if (i === 0) {
      md += '| ' + rows[i].map(() => '---').join(' | ') + ' |\n';
    }
  }
  return md + '\n';
}

function formatAscii(lines) {
  const text = lines.map(l => l.trimEnd()).join('\n').trim();
  if (!text) return '';
  return '```\n' + text + '\n```\n\n';
}

function formatStatBlock(lines) {
  const kvRe = /^\s*\w[\w\s]+\s*:\s*\w/;
  const kvLines = [];
  const otherLines = [];

  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    if (kvRe.test(s)) {
      const [key, ...rest] = s.split(':');
      kvLines.push('**' + key.trim() + ':** ' + rest.join(':').trim());
    } else {
      otherLines.push(s);
    }
  }

  let out = '';
  if (kvLines.length > 0) out += kvLines.join(' · ') + '\n\n';
  if (otherLines.length > 0) out += otherLines.join(' ').replace(/ +/g, ' ').trim() + '\n\n';
  return out;
}

// --- Main ---

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
  return result.join('\n\n').trim();
}

module.exports = { reformat, formatMixed, formatTable, formatAscii, formatProse, formatStatBlock };
