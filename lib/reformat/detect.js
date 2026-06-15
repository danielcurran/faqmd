// Detection helpers for reformatting GameFAQs plain-text walkthroughs.

function isDecorativeLine(line) {
  return /^[\*\-_=¯]{8,}$/.test(line.trim());
}

function isAsciiArtBlock(lines) {
  let artLines = 0;
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    if ((s.match(/\|/g) || []).length >= 5) { artLines++; continue; }
    // Decorative section markers (// DUNGEON, // CHAPTER, etc)
    if (/^\/\/\s+[A-Z][A-Z\s\d#]+/.test(s) && /[\|\/\\¯_\-]/g.test(s)) { artLines++; continue; }
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
  return kvLines.length / nonEmpty.length >= 0.3;
}

function hasEquipSlotLines(lines) {
  // True if block contains equipment slot labels (Head, Right, Left, Body)
  // or character headers (Starting, Recommended) with pipes
  return lines.some(l => {
    const s = l.trim();
    return /^\|?\s*(Head|Right|Left|Body)\s*\|/.test(s) ||
      /^(Starting|Recommended)\s+\|/.test(s);
  });
}

module.exports = {
  isDecorativeLine, isAsciiArtBlock, isTableBlock, isStatBlock,
  hasEquipSlotLines
};
