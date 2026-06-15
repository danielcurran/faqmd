// Formatters for reformatting GameFAQs plain-text walkthroughs.

const { isDecorativeLine } = require('./detect');

function formatProse(lines) {
  let text = lines.join(' ').replace(/ +/g, ' ').trim();
  if (!text) return '';
  return text + '\n\n';
}

function stripFrameChars(cell) {
  // Remove trailing frame/decoration characters from a cell
  return cell.replace(/[\/\\¯]+$/g, '').trim();
}

function isPureBorderRow(s) {
  // Detect rows that are purely decorative separators between pipes
  // e.g. |-------------|, |¯¯¯¯¯|¯¯¯¯¯|, |=====|, +-----------+
  const betweenPipes = s.split('|').slice(1, -1);
  if (betweenPipes.length === 0) return false;
  const content = betweenPipes.map(c => c.trim()).join('');
  // If all content between pipes is decorative chars, it's a border row
  if (/^[+\-=\*_¯\s]*$/.test(content)) return true;
  // Individual cells that are all decorative
  return betweenPipes.every(c => {
    const t = c.trim();
    return !t || /^[+\-=\*_¯\s]+$/.test(t);
  });
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
    // Skip pure border rows that separate table sections
    if (isPureBorderRow(s)) continue;
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
    return slice.slice(0, maxCols).map(c => stripFrameChars(c.trim()));
  });

  if (rows.length === 0) return '';

  // Detect header row: first row with word content that isn't all data rows
  const headerIdx = 0;

  // Build markdown table
  let md = '';
  for (let i = 0; i < rows.length; i++) {
    md += '| ' + rows[i].join(' | ') + ' |\n';
    if (i === headerIdx) {
      md += '| ' + rows[i].map(() => '---').join(' | ') + ' |\n';
    }
  }
  return md + '\n';
}

function formatEquipmentTable(lines) {
  // Format equipment block as either a markdown table or bullet list
  const dataRows = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s || isPureBorderRow(s)) continue;
    dataRows.push(s);
  }
  if (dataRows.length <= 2) return formatTable(lines);

  // Extract characters from header row
  const headerRow = dataRows.find(r => /^(Starting|Recommended)\s+\|/.test(r.trim()));
  let charNames = [];
  if (headerRow) {
    const cells = headerRow.split('|').slice(1).map(c => c.trim()).filter(c => c);
    charNames = cells;
  }

  // Extract slot rows
  const slotRows = [];
  for (const row of dataRows) {
    const s = row.trim();
    const m = s.match(/^\s*\|?(Head|Right|Left|Body)\s*\|(.*)$/);
    if (m) {
      slotRows.push({ slot: m[1], rest: m[2] });
    }
  }

  if (slotRows.length === 0) return formatTable(lines);

  // If multiple characters with consistent columns, render a table
  if (charNames.length >= 1) {
    // Parse equipment items per character, preserving empty cells for alignment
    const parsed = slotRows.map(r => {
      const cells = r.rest.split('|');
      const end = cells[cells.length - 1] === '' ? cells.length - 1 : cells.length;
      const items = cells.slice(0, end).map(c => stripFrameChars(c.trim()));
      return { slot: r.slot, items };
    });

    const maxItems = Math.max(...parsed.map(r => r.items.length), 1);
    const allSameCols = parsed.every(r => r.items.length === maxItems || r.items.length === maxItems - 1);
    const cols = Math.min(maxItems, charNames.length);

    if (allSameCols && cols >= 1) {
      let md = '';
      if (charNames.length === 1) {
        // Single character: render as definition list
        md += '**Equipment**\n\n';
        for (const r of parsed) {
          md += '- **' + r.slot + ':** ' + (r.items[0] || '') + '\n';
        }
        return md + '\n';
      } else {
        // Multi-character: render as table
        md += '| Slot | ' + charNames.slice(0, cols).join(' | ') + ' |\n';
        md += '| --- | ' + charNames.slice(0, cols).map(() => '---').join(' | ') + ' |\n';
        for (const r of parsed) {
          const cells = r.items.slice(0, cols);
          while (cells.length < cols) cells.push('');
          md += '| ' + r.slot + ' | ' + cells.join(' | ') + ' |\n';
        }
        return md + '\n';
      }
    }
  }

  // Fallback: render as simple markdown table using formatTable with cleanup
  return formatTable(lines);
}

function formatAscii(lines) {
  const text = lines.map(l => l.trimEnd()).join('\n').trim();
  if (!text) return '';
  // Skip single-line decorative fragments that look like map headers
  if (lines.length === 1) {
    const s = lines[0].trim();
    const words = (s.match(/[a-zA-Z]{2,}/g) || []).length;
    if (words < 2) return ''; // Single decorative line, strip it
  }
  const type = classifyArtBlock(lines);
  return '<!-- MODERNIZE:' + type + ' -->\n\n```\n' + text + '\n```\n\n';
}

function classifyArtBlock(lines) {
  const text = lines.join('\n');

  // boss — BOSS # markers or boss HP/level indicators
  if (/BOSS\s*#?\s*\d|Boss\s*:|Recommended Level.*\d+\+|Requires.*boss/i.test(text)) return 'boss';

  // statblock — RPG stat labels with values
  if (/\b(LV|HP|TP|ATK|DFS|MST|STRNGTH|AGILITY|DEXTRTY|MENTAL|EXP)\s*[:\d]/i.test(text)) return 'statblock';

  // menu — menu option markers
  if (/\|\s*o\s+(CONTINUE|SAVE|ITEM|EQUIP|MAGIC|STATUS|OPTIONS|CONFIG|LOAD|NEW\s+GAME)/i.test(text)) return 'menu';

  // dungeon — area/dungeon headers with decorative framing
  if (/\/\/\s*DUNGEON|^\s*\|?\/\s+[\w\s]+\s*[/\\_¯]{4,}/m.test(text)) return 'map';

  // map — location names with prices or services
  if (/(Inn|Shop|Store|Bar|Temple|Church|Guild)\s.*(MST|\d+\s*MST)/i.test(text)) return 'map';

  // equipment — equipment slot labels or item stat lines
  if (/\b(Head|Right|Left|Body|Weapon|Shield|Armor|Accessory)\b.*[A-Z]/i.test(text)) return 'equipment';

  return 'unknown';
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

function formatDecorativeText(lines) {
  // Don't run on blocks that contain equipment/table data
  const hasEquipment = lines.some(l => /^\|?\s*(Head|Right|Left|Body)\s*\|/.test(l.trim()));
  const hasTableData = lines.filter(l => l.includes('|')).length >= 2;
  if (hasEquipment || hasTableData) return null;

  const cleaned = [];
  let anyChanged = false;
  for (const line of lines) {
    const orig = line.trim();
    if (!orig || /^[\/\\¯_|\-=\s]+$/.test(orig)) continue;
    if (/^[\*\-_=¯]{8,}$/.test(orig)) continue;
    let s = orig;
    s = s.replace(/^\/\/\s*/, '')
         .replace(/^\|?\s*\/\s*/, '')
         .replace(/^[\/\\]+\s*/, '')
         .replace(/[\/\\¯_|=\-]{2,}/g, ' ');
    if (s !== orig) {
      s = s.replace(/\s+/g, ' ').trim();
      if (s) {
        cleaned.push('**' + s + '**');
        anyChanged = true;
      }
    } else if (orig) {
      cleaned.push(orig);
    }
  }
  if (!anyChanged) return null;
  return cleaned.join('\n\n') + '\n\n';
}

module.exports = {
  formatProse, formatTable, formatAscii, classifyArtBlock,
  formatStatBlock, formatDecorativeText, formatEquipmentTable,
  stripFrameChars, isPureBorderRow
};
