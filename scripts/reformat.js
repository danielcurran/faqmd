#!/usr/bin/env node

// --- Detection helpers ---

function isDecorativeLine(line) {
  return /^[\*\-_=¯]{30,}$/.test(line.trim());
}

function isAsciiArtBlock(lines) {
  let artLines = 0;
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    if ((s.match(/\|/g) || []).length >= 3) { artLines++; continue; }
    if (/^[\*\-_=¯]{8,}$/.test(s)) { artLines++; continue; }
    if ((s.match(/[\/\\\|\-]/g) || []).length >= 5) { artLines++; continue; }
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

function classifyBlock(lines) {
  if (lines.every(l => isDecorativeLine(l))) return 'decorative';
  if (isTableBlock(lines)) return 'table';
  if (isStatBlock(lines)) return 'statblock';
  if (isAsciiArtBlock(lines)) return 'ascii';
  return 'prose';
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
    const type = classifyBlock(lines);
    switch (type) {
      case 'decorative': continue;
      case 'ascii': result.push(formatAscii(lines)); break;
      case 'table': result.push(formatTable(lines)); break;
      case 'statblock': result.push(formatStatBlock(lines)); break;
      default: result.push(formatProse(lines)); break;
    }
  }
  return result.join('').trim();
}

module.exports = { reformat, classifyBlock, formatTable, formatAscii, formatProse, formatStatBlock };
