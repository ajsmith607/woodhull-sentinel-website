# FlexSearch Index Build Script

**Purpose:** Node.js build script that reads OCR text files from the newspaper collection and generates a pre-built FlexSearch index for client-side search.

**Status:** Implemented and tested 2026-02-07

---

## Overview

### What This Script Does

1. Recursively scans the `data/TXTs/` directory
2. Reads all `.txt` files containing OCR text
3. Parses filenames to extract metadata (newspaper name, date, page number)
4. Creates a FlexSearch Document index
5. Adds all documents to the index with full OCR content
6. Exports the serialized index using FlexSearch's callback-based export API
7. Writes a single JSON file to disk containing all index segments

### Why Pre-Build the Index?

**Benefits:**
- Faster client-side search initialization (no indexing overhead)
- Reduced bandwidth (no need to transfer 70MB of raw OCR text)
- Better performance on mobile/low-power devices
- Index is optimized at build time

**Trade-offs:**
- Index file is larger than raw text (74.56 MB vs 70.57 MB raw) due to index structures
- Must rebuild when content changes (acceptable for static collection)

---

## Technical Requirements

### Dependencies

```json
{
  "dependencies": {
    "flexsearch": "^0.7.31"
  }
}
```

No other runtime dependencies. Uses Node.js built-in `fs/promises` for file I/O (no `fs-extra`).

**Installation:**
```bash
npm install
```

### Node Version
- Node.js 16+ (for `fs/promises` support)

---

## File Structure

```
woodhull-sentinel-website/
├── data/
│   └── TXTs/                          # Source OCR text files
│       ├── woodhull-sentinel-19390803/
│       │   ├── woodhull-sentinel-19390803-001.txt
│       │   └── ...
│       └── ...
├── build/
│   └── generate-search-index.js       # This script
├── src/
│   └── search-index.json              # Generated output (gitignored)
└── package.json
```

**Output Location:** `src/search-index.json`
- Eleventy will pass this through to `_site/search-index.json`
- Configure in `.eleventy.js`: `eleventyConfig.addPassthroughCopy("src/search-index.json");`

---

## Running the Script

```bash
node build/generate-search-index.js
```

Or via npm:
```bash
npm run build:search   # Just rebuild search index
npm run build          # Search index + Eleventy site
npm run dev            # Search index + Eleventy dev server
```

---

## Implementation Details

### Configuration

```javascript
const CONFIG = {
  txtDir: './data/TXTs',
  outputFile: './src/search-index.json',
  flexsearch: {
    tokenize: 'forward',
    context: {
      resolution: 9,
      depth: 3,
      bidirectional: true
    },
    document: {
      id: 'id',
      index: ['content', 'newspaper'],
      store: ['filename', 'newspaper', 'date', 'dateDisplay', 'pageNumber', 'issueId']
    }
  }
};
```

- `tokenize: 'forward'` — prefix matching (good for partial word search)
- `context` — contextual search for better relevance
- `document.index` — fields to search: OCR content and newspaper name
- `document.store` — metadata returned with search results (not indexed, just stored)

### Filename Parsing

**Input format:** `lowercase-newspaper-name-YYYYMMDD[suffix]-NNN.txt`

**Regex:** `/^(.+?)-(\d{8}[a-z]?)-(\d{3})$/`

**Examples:**
- `woodhull-sentinel-19390803-001.txt` — standard
- `woodhull-sentinel-19310604a-001.txt` — duplicate issue with suffix

**Extracted fields:**
- `newspaper` — title-cased name ("Woodhull Sentinel")
- `date` — ISO format ("1939-08-03")
- `dateDisplay` — human-readable ("August 3, 1939")
- `pageNumber` — integer (1)
- `issueId` — slug ("woodhull-sentinel-19390803")

**Date formatting note:** Display dates are formatted manually from parsed string components (month lookup table) rather than using `new Date()` + `toLocaleDateString()`, which can shift dates by one day due to UTC timezone interpretation.

### FlexSearch Export/Import

FlexSearch 0.7.x uses a callback-based export API, not a synchronous return:

```javascript
// Export: callback fires once per index segment
const exportedKeys = {};
await index.export(function(key, data) {
  exportedKeys[key] = data != null ? JSON.parse(data) : null;
});
```

The exported data is parsed from JSON strings during collection so it doesn't get double-encoded when the wrapper object is serialized.

**Output format (`src/search-index.json`):**
```json
{
  "version": "1.0",
  "generated": "2026-02-07T22:11:34.835Z",
  "documentCount": 3144,
  "config": { "...FlexSearch config..." },
  "keys": {
    "reg": "...",
    "content.cfg": "...",
    "content.map": "...",
    "content.ctx": "...",
    "newspaper.cfg": "...",
    "newspaper.map": "...",
    "newspaper.ctx": "...",
    "tag": "...",
    "store": "..."
  }
}
```

The FlexSearch config is embedded in the output so client-side code can reconstruct the index with the same configuration.

### Client-Side Usage

```javascript
async function initializeSearch() {
  const response = await fetch('search-index.json');
  const data = await response.json();

  // Create index with same config used at build time
  const index = new FlexSearch.Document(data.config);

  // Import each key/data pair
  for (const [key, value] of Object.entries(data.keys)) {
    if (value != null) {
      index.import(key, value);
    }
  }

  return index;
}

// Search with enriched results (includes stored metadata)
const results = index.search(query, { limit: 100, enrich: true });
```

---

## Actual Results

```
============================================================
FlexSearch Index Generator for Newspaper Archive
============================================================

Found 3144 text files to process...
  Processed 500/3144 files...
  Processed 1000/3144 files...
  Processed 1500/3144 files...
  Processed 2000/3144 files...
  Processed 2500/3144 files...
  Processed 3000/3144 files...
Processed 3144 documents

Creating FlexSearch index...
Indexed 3144 documents
Exporting search index...
Index exported to ./src/search-index.json
  File size: 74.56 MB
  Keys exported: 9

============================================================
Search index generation complete
============================================================
```

- **Documents processed:** 3,144 (zero errors, zero skipped)
- **Output file size:** 74.56 MB
- **Index keys:** 9 (reg, content.cfg, content.map, content.ctx, newspaper.cfg, newspaper.map, newspaper.ctx, tag, store)
- **Round-trip test:** Verified — import + search returns correct enriched results with metadata

---

## Changes from Original Plan

The original plan (2026-01-31) had several issues that were corrected during implementation:

1. **FlexSearch export/import API:** The plan used a synchronous `index.export()` return value and single-call `index.import(data.index)`. FlexSearch 0.7.x actually uses a callback-based export and per-key import. Fixed to collect key/data pairs via callback and replay them individually on import.

2. **Date timezone bug:** The plan used `new Date('YYYY-MM-DD')` + `toLocaleDateString()`, which can shift dates back one day in US timezones due to UTC interpretation. Fixed to format dates manually from parsed string components using a month name lookup table.

3. **Dropped `fs-extra` dependency:** The plan listed `fs-extra` as a dependency, but only used functions available in Node's built-in `fs/promises`. Removed the unnecessary dependency.

4. **Output directory creation:** The plan didn't ensure the `src/` output directory exists. Added `fs.mkdir(dir, { recursive: true })` before writing.

5. **Output file size:** The plan estimated 10-30 MB. Actual output is 74.56 MB, which is expected given 70 MB of source text plus index structures. Gzip compression (standard for web servers) would significantly reduce transfer size.

---

## Error Handling

- **Invalid filenames:** Logged as warnings, file skipped, processing continues
- **File read errors:** Logged as errors, file skipped, processing continues
- **Missing input directory:** Fatal error, exits with code 1
- **No documents found:** Fatal error, exits with code 1
- **FlexSearch/export failures:** Fatal error, exits with code 1

---

## Future Enhancements

1. **Compression:** Gzip output for smaller file size / faster transfer
2. **Incremental indexing:** Only process new/modified files
3. **`--verbose` / `--stats` flags:** Detailed progress and statistics output
4. **Watch mode:** Auto-rebuild when text files change
5. **Custom stopwords:** Remove common OCR errors from index

---

**Document Version:** 2.0
**Created:** 2026-01-31
**Implemented:** 2026-02-07
