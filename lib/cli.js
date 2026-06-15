// Minimal CLI helpers for faqmd scripts (zero dependencies).

const fs = require('fs');
const path = require('path');

/**
 * Parse command-line arguments.
 * Supports --flag=value and --flag value. Unknown args are collected as positional.
 */
function parseArgs(argv, opts = {}) {
  const flags = {};
  const positional = [];
  const knownFlags = opts.flags || {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      return { help: true, flags, positional };
    }

    let matched = false;
    for (const name of Object.keys(knownFlags)) {
      const prefix = '--' + name + '=';
      if (arg.startsWith(prefix)) {
        flags[name] = arg.slice(prefix.length);
        matched = true;
        break;
      }
      if (arg === '--' + name) {
        flags[name] = argv[++i];
        if (flags[name] === undefined) flags[name] = '';
        matched = true;
        break;
      }
    }

    if (!matched) positional.push(arg);
  }

  return { help: false, flags, positional };
}

/**
 * Print usage help and exit.
 */
function showHelp(scriptName, description, opts = {}) {
  const usage = opts.usage || '';
  const flags = opts.flags || {};
  const examples = opts.examples || [];

  console.log('Usage: ' + scriptName + (usage ? ' ' + usage : ''));
  console.log('');
  console.log(description);
  console.log('');

  const flagNames = Object.keys(flags);
  const helpLabels = ['-h, --help'];
  const helpDescs = ['Show this help message'];
  for (const name of flagNames) {
    const info = flags[name];
    helpLabels.push('--' + name + (info.value ? '=' + info.value : ''));
    helpDescs.push(info.desc || '');
  }
  if (helpLabels.length > 0) {
    const maxLen = Math.max(...helpLabels.map(l => l.length));
    console.log('Options:');
    for (let i = 0; i < helpLabels.length; i++) {
      console.log('  ' + helpLabels[i].padEnd(maxLen) + '  ' + helpDescs[i]);
    }
    console.log('');
  }

  if (examples.length > 0) {
    console.log('Examples:');
    for (const ex of examples) console.log('  ' + ex);
    console.log('');
  }
}

/**
 * Validate that an output path stays within allowed directories.
 */
function validateOutputPath(outputPath, allowedBases) {
  const resolved = path.resolve(outputPath);
  for (const base of allowedBases) {
    const baseResolved = path.resolve(base);
    if (resolved === baseResolved || resolved.startsWith(baseResolved + path.sep)) return;
  }
  throw new Error('output path must be within an allowed directory: ' + outputPath);
}

/**
 * Validate that an input file exists and is readable.
 */
function validateInputFile(inputPath) {
  if (!inputPath) throw new Error('input file is required');
  if (!fs.existsSync(inputPath)) throw new Error('input file not found: ' + inputPath);
  const stat = fs.statSync(inputPath);
  if (!stat.isFile()) throw new Error('input path is not a file: ' + inputPath);
  if (stat.size === 0) throw new Error('input file is empty: ' + inputPath);
}

module.exports = { parseArgs, showHelp, validateOutputPath, validateInputFile };
