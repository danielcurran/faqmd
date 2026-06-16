#!/usr/bin/env node
/**
 * validate-achievements.js
 *
 * Validates an achievements.json file against the schema and cross-references
 * section numbers against toc.json.
 *
 * Usage:
 *   node scripts/validate-achievements.js guide/achievements.json
 */

const fs = require('fs');
const path = require('path');
const { parseArgs, showHelp } = require('../lib/cli');

const SCRIPT_NAME = 'faqmd-validate-achievements';

const VALID_TYPES = new Set(['story', 'missable', 'collectible', 'challenge', 'secret', 'progress']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);

const REQUIRED_FIELDS = [
  'id', 'title', 'description', 'points', 'badgeUrl', 'displayOrder',
  'type', 'missable', 'section', 'confidence', 'notes'
];

function collectSections(tocNodes) {
  const nums = new Set();
  function walk(nodes) {
    if (!nodes) return;
    for (const n of Array.isArray(nodes) ? nodes : [nodes]) {
      if (n.num) nums.add(n.num);
      if (n.children) walk(n.children);
    }
  }
  walk(tocNodes);
  return nums;
}

function validate(achPath, tocPath) {
  const errors = [];

  if (!fs.existsSync(achPath)) {
    console.log('FAIL: ' + achPath + ' not found');
    process.exit(1);
  }

  const ach = JSON.parse(fs.readFileSync(achPath, 'utf8'));

  // ── Top-level fields ──
  if (ach.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (typeof ach.gameId !== 'number') errors.push('gameId must be a number');
  if (!ach.gameTitle) errors.push('gameTitle is required');
  if (typeof ach.totalAchievements !== 'number') errors.push('totalAchievements must be a number');
  if (typeof ach.totalPoints !== 'number') errors.push('totalPoints must be a number');
  if (!Array.isArray(ach.achievements)) errors.push('achievements must be an array');

  const list = ach.achievements || [];

  if (list.length !== ach.totalAchievements) {
    errors.push('totalAchievements (' + ach.totalAchievements + ') does not match array length (' + list.length + ')');
  }

  // ── Point sum check ──
  const pointSum = list.reduce((s, a) => s + (a.points || 0), 0);
  if (pointSum !== ach.totalPoints) {
    errors.push('totalPoints (' + ach.totalPoints + ') does not match sum of points (' + pointSum + ')');
  }

  // ── Load TOC sections ──
  let tocSections = null;
  if (tocPath && fs.existsSync(tocPath)) {
    const toc = JSON.parse(fs.readFileSync(tocPath, 'utf8'));
    tocSections = collectSections(toc);
  }

  // ── Achievement-level validation ──
  const seenIds = new Set();

  for (const a of list) {
    const prefix = '[' + a.id + ' "' + (a.title || '?') + '"]';

    // Missing fields
    for (const field of REQUIRED_FIELDS) {
      if (a[field] === undefined || a[field] === null) {
        errors.push(prefix + ' missing field: ' + field);
      }
    }

    // Section must be non-empty
    if (a.section === '') {
      errors.push(prefix + ' section is empty (not yet matched)');
    }

    // Type enum
    if (a.type && !VALID_TYPES.has(a.type)) {
      errors.push(prefix + ' invalid type: ' + a.type);
    }

    // Confidence enum
    if (a.confidence && !VALID_CONFIDENCE.has(a.confidence)) {
      errors.push(prefix + ' invalid confidence: ' + a.confidence);
    }

    // Missable must have cutoff info
    if (a.missable === true) {
      if (!a.missableCutoff) {
        errors.push(prefix + ' missable but missing missableCutoff');
      }
      if (!a.missableCutoffSection) {
        errors.push(prefix + ' missable but missing missableCutoffSection');
      }
    }

    // ongoing must be boolean if present
    if (a.ongoing !== undefined && typeof a.ongoing !== 'boolean') {
      errors.push(prefix + ' ongoing must be boolean');
    }

    // Section must exist in TOC
    if (tocSections && a.section && !tocSections.has(a.section)) {
      errors.push(prefix + ' section "' + a.section + '" not found in toc.json');
    }

    // communityTips format
    if (a.communityTips && Array.isArray(a.communityTips)) {
      for (const tip of a.communityTips) {
        if (!tip.user || !tip.text) {
          errors.push(prefix + ' communityTips entry missing user or text');
        }
      }
    }

    // Duplicate IDs
    if (seenIds.has(a.id)) {
      errors.push(prefix + ' duplicate ID');
    }
    seenIds.add(a.id);
  }

  if (errors.length > 0) {
    console.log('FAIL: ' + errors.length + ' validation error(s):');
    for (const e of errors) console.log('  ' + e);
    process.exit(1);
  }

  console.log('PASS: ' + list.length + ' achievements validated');
  if (tocSections) {
    console.log('  ' + tocSections.size + ' sections in toc.json');
  }
}

function main() {
  const cli = parseArgs(process.argv.slice(2));

  if (cli.help) {
    showHelp(SCRIPT_NAME, 'Validate an achievements.json file against the schema. Cross-references section numbers with toc.json.', {
      usage: '<achievements.json>',
      examples: [
        'faqmd-validate-achievements guide/achievements.json'
      ]
    });
    return;
  }

  const achPath = cli.positional[0];
  if (!achPath) {
    showHelp(SCRIPT_NAME, 'Validate an achievements.json file.', { usage: '<achievements.json>' });
    process.exit(1);
  }

  const tocPath = path.join(path.dirname(achPath), 'toc.json');
  validate(achPath, tocPath);
}

main();
