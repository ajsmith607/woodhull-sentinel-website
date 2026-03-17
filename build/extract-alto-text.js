#!/usr/bin/env node
/**
 * extract-alto-text.js
 * Extracts plain text from ALTO XML files in data/ALTOs/ and writes
 * corresponding .txt files to data/TXTs/, mirroring the issue directory structure.
 *
 * Usage: node build/extract-alto-text.js
 */

const fs = require('fs');
const path = require('path');

const ALTOS_DIR = path.join(__dirname, '../data/ALTOs');
const TXTS_DIR  = path.join(__dirname, '../data/TXTs');

// Decode basic XML entities
function decodeEntities(str) {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractText(xml) {
  const blocks = [];

  const blockRe = /<TextBlock[^>]*>([\s\S]*?)<\/TextBlock>/g;
  let blockMatch;

  while ((blockMatch = blockRe.exec(xml)) !== null) {
    const blockContent = blockMatch[1];
    const lines = [];

    const lineRe = /<TextLine[^>]*>([\s\S]*?)<\/TextLine>/g;
    let lineMatch;

    while ((lineMatch = lineRe.exec(blockContent)) !== null) {
      const lineContent = lineMatch[1];
      const words = [];

      const stringRe = /<String[^>]+CONTENT="([^"]*)"[^>]*\/?>/g;
      let stringMatch;

      while ((stringMatch = stringRe.exec(lineContent)) !== null) {
        const content = decodeEntities(stringMatch[1]);
        if (content) words.push(content);
      }

      if (words.length > 0) {
        lines.push(words.join(' '));
      }
    }

    if (lines.length > 0) {
      blocks.push(lines.join('\n'));
    }
  }

  return blocks.join('\n\n');
}

const issues = fs.readdirSync(ALTOS_DIR).filter(f =>
  fs.statSync(path.join(ALTOS_DIR, f)).isDirectory()
);

let totalFiles = 0;
let errors = 0;

for (const issue of issues) {
  const issueAltosDir = path.join(ALTOS_DIR, issue);
  const issueTxtsDir  = path.join(TXTS_DIR,  issue);

  fs.mkdirSync(issueTxtsDir, { recursive: true });

  const xmlFiles = fs.readdirSync(issueAltosDir).filter(f => f.endsWith('.xml'));

  for (const xmlFile of xmlFiles) {
    const xmlPath = path.join(issueAltosDir, xmlFile);
    const txtPath = path.join(issueTxtsDir,  xmlFile.replace(/\.xml$/, '.txt'));

    try {
      const xml  = fs.readFileSync(xmlPath, 'utf-8');
      const text = extractText(xml);
      fs.writeFileSync(txtPath, text, 'utf-8');
      totalFiles++;
      process.stdout.write(`\rProcessed: ${totalFiles}`);
    } catch (err) {
      errors++;
      process.stderr.write(`\nError: ${xmlPath}: ${err.message}\n`);
    }
  }
}

console.log(`\nDone: ${totalFiles} files extracted, ${errors} errors`);
