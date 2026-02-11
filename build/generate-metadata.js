#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG = {
  txtDir: './data/TXTs',
  outputFile: './src/issues-metadata.json'
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
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
// Build metadata
// ---------------------------------------------------------------------------

async function buildMetadata() {
  // 1. Discover and parse all text files
  const files = await getAllTextFiles(CONFIG.txtDir);
  console.log(`Found ${files.length} text files to process...`);

  const issueMap = new Map(); // issueId -> { metadata, pages[] }
  let errorCount = 0;

  for (const filepath of files) {
    const filename = path.basename(filepath);
    const parsed = parseFilename(filename);

    if (!parsed) {
      console.warn(`Skipping invalid filename: ${filename}`);
      errorCount++;
      continue;
    }

    if (!issueMap.has(parsed.issueId)) {
      issueMap.set(parsed.issueId, {
        id: parsed.issueId,
        newspaper: parsed.newspaper,
        date: parsed.date,
        dateDisplay: parsed.dateDisplay,
        pages: []
      });
    }

    issueMap.get(parsed.issueId).pages.push({
      pageNumber: parsed.pageNumber,
      filename: parsed.filename,
      thumbnail: `data/THUMBs/${parsed.issueId}/${parsed.filename}.jpg`,
      jpg: `data/JPEGs/${parsed.issueId}/${parsed.filename}.jpg`
    });
  }

  if (errorCount > 0) {
    console.warn(`Skipped ${errorCount} files due to errors`);
  }

  // 2. Sort pages within each issue by page number
  for (const issue of issueMap.values()) {
    issue.pages.sort((a, b) => a.pageNumber - b.pageNumber);
    issue.pageCount = issue.pages.length;
  }

  // 3. Sort issues chronologically (by date, then by issueId for duplicates)
  const sortedIssues = Array.from(issueMap.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.id.localeCompare(b.id);
  });

  console.log(`Grouped into ${sortedIssues.length} issues`);

  // 4. Build allPages array with prev/next links
  const allPages = [];

  for (let i = 0; i < sortedIssues.length; i++) {
    const issue = sortedIssues[i];
    const prevIssue = i > 0 ? sortedIssues[i - 1] : null;
    const nextIssue = i < sortedIssues.length - 1 ? sortedIssues[i + 1] : null;

    for (let j = 0; j < issue.pages.length; j++) {
      const page = issue.pages[j];
      allPages.push({
        filename: page.filename,
        newspaper: issue.newspaper,
        date: issue.date,
        dateDisplay: issue.dateDisplay,
        pageNumber: page.pageNumber,
        issueId: issue.id,
        thumbnail: page.thumbnail,
        jpg: page.jpg,
        prevPage: j > 0 ? issue.pages[j - 1].filename : null,
        prevPageNumber: j > 0 ? issue.pages[j - 1].pageNumber : null,
        nextPage: j < issue.pages.length - 1 ? issue.pages[j + 1].filename : null,
        nextPageNumber: j < issue.pages.length - 1 ? issue.pages[j + 1].pageNumber : null,
        prevIssue: prevIssue ? prevIssue.pages[0].filename : null,
        prevIssueDateDisplay: prevIssue ? prevIssue.dateDisplay : null,
        nextIssue: nextIssue ? nextIssue.pages[0].filename : null,
        nextIssueDateDisplay: nextIssue ? nextIssue.dateDisplay : null
      });
    }
  }

  // 5. Group issues by year
  const years = {};
  for (const issue of sortedIssues) {
    const year = issue.date.slice(0, 4);
    if (!years[year]) {
      years[year] = { totalPages: 0, issues: [] };
    }
    years[year].issues.push({
      id: issue.id,
      newspaper: issue.newspaper,
      date: issue.date,
      dateDisplay: issue.dateDisplay,
      pageCount: issue.pageCount,
      pages: issue.pages
    });
    years[year].totalPages += issue.pageCount;
  }

  // 6. Aggregate by publication title
  const pubMap = new Map();
  for (const issue of sortedIssues) {
    if (!pubMap.has(issue.newspaper)) {
      pubMap.set(issue.newspaper, { title: issue.newspaper, issueCount: 0, minDate: issue.date, maxDate: issue.date });
    }
    const pub = pubMap.get(issue.newspaper);
    pub.issueCount++;
    if (issue.date < pub.minDate) pub.minDate = issue.date;
    if (issue.date > pub.maxDate) pub.maxDate = issue.date;
  }
  function formatDateShort(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${y} ${MONTHS_SHORT[parseInt(m, 10) - 1]} ${parseInt(d, 10).toString().padStart(2, '0')}`;
  }
  for (const pub of pubMap.values()) {
    pub.minDateDisplay = formatDateShort(pub.minDate);
    pub.maxDateDisplay = formatDateShort(pub.maxDate);
  }
  const publications = Array.from(pubMap.values()).sort((a, b) => b.issueCount - a.issueCount);

  // 7. Compute aggregate stats
  const yearKeys = Object.keys(years).sort();
  const dateRange = yearKeys.length > 0
    ? `${yearKeys[0]} - ${yearKeys[yearKeys.length - 1]}`
    : '';

  return {
    version: '1.0',
    generated: new Date().toISOString(),
    totalIssues: sortedIssues.length,
    totalPages: allPages.length,
    dateRange,
    publications,
    years,
    allPages
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log('Issues Metadata Generator for Newspaper Archive');
  console.log('='.repeat(60));
  console.log();

  try {
    const metadata = await buildMetadata();

    if (metadata.totalPages === 0) {
      console.error('No pages found to process');
      process.exit(1);
    }

    // Write output
    console.log();
    console.log('Writing metadata file...');

    await fs.mkdir(path.dirname(CONFIG.outputFile), { recursive: true });

    const jsonString = JSON.stringify(metadata);
    await fs.writeFile(CONFIG.outputFile, jsonString, 'utf-8');

    const stats = await fs.stat(CONFIG.outputFile);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log(`Metadata written to ${CONFIG.outputFile}`);
    console.log(`  File size: ${sizeKB} KB`);
    console.log(`  Total issues: ${metadata.totalIssues}`);
    console.log(`  Total pages: ${metadata.totalPages}`);
    console.log(`  Date range: ${metadata.dateRange}`);
    console.log(`  Years covered: ${Object.keys(metadata.years).length}`);

    console.log();
    console.log('='.repeat(60));
    console.log('Metadata generation complete');
    console.log('='.repeat(60));
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();
