#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { Document } = require('flexsearch');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG = {
  txtDir: './data/TXTs',
  outputFile: './src/search-index.json',

  flexsearch: {
    tokenize: 'strict',
    resolution: 3,
    document: {
      id: 'id',
      index: ['content', 'newspaper'],
      store: ['filename', 'newspaper', 'date', 'dateDisplay', 'pageNumber', 'issueId']
    }
  }
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ---------------------------------------------------------------------------
// Filename parsing
// ---------------------------------------------------------------------------

function parseFilename(filename) {
  const base = filename.replace(/\.txt$/i, '');

  // Pattern: newspaper-name-YYYYMMDD[suffix]-NNN
  const match = base.match(/^(.+?)-(\d{8}[a-z]?)-(\d{3})$/);
  if (!match) return null;

  const [, newspaperSlug, dateStr, pageNumStr] = match;

  // "woodhull-sentinel" -> "Woodhull Sentinel"
  const newspaper = newspaperSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);

  const date = `${year}-${month}-${day}`;

  // Format display date from components directly (avoids timezone shift)
  const dateDisplay = `${MONTHS[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;

  const pageNumber = parseInt(pageNumStr, 10);
  const issueId = `${newspaperSlug}-${dateStr}`;

  return { filename: base, newspaper, date, dateDisplay, pageNumber, issueId };
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

async function getAllTextFiles(dir) {
  const files = [];

  async function scan(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.txt')) {
        files.push(fullPath);
      }
    }
  }

  await scan(dir);
  files.sort();
  return files;
}

// ---------------------------------------------------------------------------
// Process text files into documents
// ---------------------------------------------------------------------------

async function processTextFiles() {
  const documents = [];
  let errorCount = 0;

  const files = await getAllTextFiles(CONFIG.txtDir);
  console.log(`Found ${files.length} text files to process...`);

  for (const filepath of files) {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const filename = path.basename(filepath);
      const metadata = parseFilename(filename);

      if (!metadata) {
        console.warn(`Skipping invalid filename: ${filename}`);
        errorCount++;
        continue;
      }

      documents.push({
        id: documents.length,
        filename: metadata.filename,
        newspaper: metadata.newspaper,
        date: metadata.date,
        dateDisplay: metadata.dateDisplay,
        pageNumber: metadata.pageNumber,
        issueId: metadata.issueId,
        content: content.trim()
      });

      if (documents.length % 500 === 0) {
        console.log(`  Processed ${documents.length}/${files.length} files...`);
      }
    } catch (error) {
      console.error(`Error processing ${filepath}: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`Processed ${documents.length} documents`);
  if (errorCount > 0) {
    console.warn(`Skipped ${errorCount} files due to errors`);
  }

  return documents;
}

// ---------------------------------------------------------------------------
// Build and export FlexSearch index
// ---------------------------------------------------------------------------

async function createAndExportIndex(documents) {
  console.log('Creating FlexSearch index...');

  const index = new Document(CONFIG.flexsearch);

  for (const doc of documents) {
    index.add(doc);
  }

  console.log(`Indexed ${documents.length} documents`);
  console.log('Exporting search index...');

  // FlexSearch 0.7.x export is callback-based: handler receives (key, data)
  // for each index segment. Collect all key/data pairs into a single object.
  const exportedKeys = {};

  await index.export(function (key, data) {
    // data is a JSON string (or null); parse so it doesn't double-encode
    // when we JSON.stringify the wrapper object
    exportedKeys[key] = data != null ? JSON.parse(data) : null;
  });

  const output = {
    version: '1.0',
    generated: new Date().toISOString(),
    documentCount: documents.length,
    config: CONFIG.flexsearch,
    keys: exportedKeys
  };

  // Ensure output directory exists
  await fs.mkdir(path.dirname(CONFIG.outputFile), { recursive: true });

  const jsonString = JSON.stringify(output);
  await fs.writeFile(CONFIG.outputFile, jsonString, 'utf-8');

  const stats = await fs.stat(CONFIG.outputFile);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log(`Index exported to ${CONFIG.outputFile}`);
  console.log(`  File size: ${sizeMB} MB`);
  console.log(`  Keys exported: ${Object.keys(exportedKeys).length}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log('FlexSearch Index Generator for Newspaper Archive');
  console.log('='.repeat(60));
  console.log();

  try {
    const documents = await processTextFiles();

    if (documents.length === 0) {
      console.error('No documents found to index');
      process.exit(1);
    }

    console.log();
    await createAndExportIndex(documents);

    console.log();
    console.log('='.repeat(60));
    console.log('Search index generation complete');
    console.log('='.repeat(60));
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();
