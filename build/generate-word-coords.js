#!/usr/bin/env node
/**
 * generate-word-coords.js
 * Parses ALTO XML files and outputs per-page word coordinate JSON files.
 *
 * Output: data/word-coords/{issue-id}/{page-id}.json
 *
 * JSON format:
 *   { "_size": [width, height], "word": [[hpos, vpos, w, h], ...], ... }
 *
 * Only includes words with WC >= WC_THRESHOLD (default 0.65).
 * Hyphenated line-break words (SUBS_TYPE="HypPart1") use SUBS_CONTENT as the key.
 * Words are normalized to lowercase with leading/trailing punctuation stripped.
 *
 * Usage: node build/generate-word-coords.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ALTOS_DIR  = path.join(__dirname, '../data/ALTOs');
const OUTPUT_DIR = path.join(__dirname, '../data/word-coords');

const WC_THRESHOLD = 0.30;

function decodeEntities(str) {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function attr(attrStr, name) {
  const re = new RegExp('\\b' + name + '="([^"]*)"');
  const m = attrStr.match(re);
  return m ? m[1] : null;
}

function parseCoords(xml) {
  // Extract page dimensions
  const pageMatch = xml.match(/<Page\b([^>]*)>/);
  if (!pageMatch) return null;
  const pageAttrs = pageMatch[1];
  const pageWidth  = parseInt(attr(pageAttrs, 'WIDTH'),  10);
  const pageHeight = parseInt(attr(pageAttrs, 'HEIGHT'), 10);
  if (!pageWidth || !pageHeight) return null;

  const words = Object.create(null);

  // Match all self-closing String elements
  const stringRe = /<String\s([^/]*?)\/?>/g;
  let m;

  while ((m = stringRe.exec(xml)) !== null) {
    const a = m[1];

    // Filter by word confidence
    const wcStr = attr(a, 'WC');
    if (!wcStr) continue;
    const wc = parseFloat(wcStr);
    if (wc < WC_THRESHOLD) continue;

    // Skip HypPart2 — already captured via HypPart1's SUBS_CONTENT
    const subsType = attr(a, 'SUBS_TYPE');
    if (subsType === 'HypPart2') continue;

    // Word content: use reconstructed whole word for HypPart1, else CONTENT
    let raw;
    if (subsType === 'HypPart1') {
      raw = attr(a, 'SUBS_CONTENT');
    } else {
      raw = attr(a, 'CONTENT');
    }
    if (!raw) continue;

    const word = decodeEntities(raw)
      .toLowerCase()
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
    if (!word) continue;

    // Parse pixel coordinates
    const hpos   = parseInt(attr(a, 'HPOS'),   10);
    const vpos   = parseInt(attr(a, 'VPOS'),   10);
    const width  = parseInt(attr(a, 'WIDTH'),  10);
    const height = parseInt(attr(a, 'HEIGHT'), 10);
    if (isNaN(hpos) || isNaN(vpos) || isNaN(width) || isNaN(height)) continue;

    if (!words[word]) words[word] = [];
    words[word].push([hpos, vpos, width, height]);
  }

  return Object.assign({ _size: [pageWidth, pageHeight] }, words);
}

const issues = fs.readdirSync(ALTOS_DIR).filter(function(f) {
  return fs.statSync(path.join(ALTOS_DIR, f)).isDirectory();
});

let totalFiles = 0;
let errors = 0;

for (const issue of issues) {
  const issueAltosDir  = path.join(ALTOS_DIR,  issue);
  const issueOutputDir = path.join(OUTPUT_DIR, issue);

  fs.mkdirSync(issueOutputDir, { recursive: true });

  const xmlFiles = fs.readdirSync(issueAltosDir).filter(function(f) {
    return f.endsWith('.xml');
  });

  for (const xmlFile of xmlFiles) {
    const xmlPath    = path.join(issueAltosDir, xmlFile);
    const pageId     = xmlFile.replace(/\.xml$/, '');
    const outputPath = path.join(issueOutputDir, pageId + '.json');

    try {
      const xml  = fs.readFileSync(xmlPath, 'utf-8');
      const data = parseCoords(xml);
      if (data) {
        fs.writeFileSync(outputPath, JSON.stringify(data), 'utf-8');
        totalFiles++;
        process.stdout.write('\rProcessed: ' + totalFiles);
      }
    } catch (err) {
      errors++;
      process.stderr.write('\nError: ' + xmlPath + ': ' + err.message + '\n');
    }
  }
}

console.log('\nDone: ' + totalFiles + ' pages processed, ' + errors + ' errors');
