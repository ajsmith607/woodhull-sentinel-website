# Issues Metadata Build Script

**Purpose:** Node.js build script that scans the newspaper collection directory structure and generates a structured JSON file containing issue/page metadata for the Eleventy site.

**Status:** Implemented and tested 2026-02-08

---

## Overview

### What This Script Does

1. Recursively scans the `data/TXTs/` directory for `.txt` files
2. Parses filenames to extract metadata (newspaper name, date, page number, issue ID)
3. Groups pages into issues, sorts chronologically
4. Computes prev/next page navigation within each issue
5. Computes prev/next issue navigation across the full collection
6. Groups issues by year with aggregate stats
7. Writes a single JSON file to disk

### Why This Script Exists

The Eleventy site requires structured metadata to:
- Generate 3,144 individual detail pages via pagination (`allPages` array)
- Populate the browse page with year/issue listings (`years` object)
- Display collection statistics on the home and about pages
- Provide prev/next navigation links for pages and issues

---

## Technical Requirements

### Dependencies

None beyond Node.js built-ins (`fs/promises`, `path`).

### Node Version

- Node.js 16+ (for `fs/promises` support)

---

## File Structure

```
woodhull-sentinel-website/
├── data/
│   └── TXTs/                              # Source directory (scanned)
│       ├── woodhull-sentinel-19390803/
│       │   ├── woodhull-sentinel-19390803-001.txt
│       │   └── ...
│       └── ...
├── build/
│   └── generate-metadata.js               # This script
├── src/
│   └── issues-metadata.json               # Generated output (gitignored)
└── package.json
```

**Output Location:** `src/issues-metadata.json`
- Eleventy will load this as global data and pass it through to `_site/`
- Configure in `.eleventy.js` via `addGlobalData()` and `addPassthroughCopy()`

---

## Running the Script

```bash
node build/generate-metadata.js
```

Or via npm:
```bash
npm run build:metadata   # Just rebuild metadata
npm run build            # Metadata + search index + Eleventy site
npm run dev              # Metadata + search index + Eleventy dev server
```

---

## Implementation Details

### Configuration

```javascript
const CONFIG = {
  txtDir: './data/TXTs',
  outputFile: './src/issues-metadata.json'
};
```

### Filename Parsing

Same `parseFilename()` function as `generate-search-index.js` (duplicated for script independence).

**Input format:** `lowercase-newspaper-name-YYYYMMDD[suffix]-NNN.txt`

**Regex:** `/^(.+?)-(\d{8}[a-z]?)-(\d{3})$/`

**Date formatting note:** Display dates are formatted manually from parsed string components (month lookup table) rather than using `new Date()`, which can shift dates by one day due to UTC timezone interpretation.

### Grouping and Sorting

1. Pages are grouped by `issueId` into a Map
2. Pages within each issue are sorted by page number (ascending)
3. Issues are sorted by `date` then by `issueId` (ensures duplicates like `19310604` sort before `19310604a`)

### Navigation Links

**Page navigation:** Within each issue, each page gets `prevPage` and `nextPage` filenames. First page gets `prevPage: null`, last page gets `nextPage: null`.

**Issue navigation:** Each page gets `prevIssue` and `nextIssue` set to the *first page filename* of the adjacent issue (not the issue ID). This lets templates link directly without string concatenation.

### Path Format

All image paths are site-root-relative with no leading prefix:
- `data/THUMBs/issue-id/filename.jpg`
- `data/JPEGs/issue-id/filename.jpg`

The UI templates compute the correct relative prefix based on each page's output depth.

### Output Schema

```json
{
  "version": "1.0",
  "generated": "2026-02-08T...",
  "totalIssues": 397,
  "totalPages": 3144,
  "dateRange": "1895 - 1967",
  "years": {
    "1939": {
      "totalPages": 245,
      "issues": [
        {
          "id": "woodhull-sentinel-19390803",
          "newspaper": "Woodhull Sentinel",
          "date": "1939-08-03",
          "dateDisplay": "August 3, 1939",
          "pageCount": 6,
          "pages": [
            {
              "pageNumber": 1,
              "filename": "woodhull-sentinel-19390803-001",
              "thumbnail": "data/THUMBs/woodhull-sentinel-19390803/woodhull-sentinel-19390803-001.jpg",
              "jpg": "data/JPEGs/woodhull-sentinel-19390803/woodhull-sentinel-19390803-001.jpg"
            }
          ]
        }
      ]
    }
  },
  "allPages": [
    {
      "filename": "woodhull-sentinel-19390803-001",
      "newspaper": "Woodhull Sentinel",
      "date": "1939-08-03",
      "dateDisplay": "August 3, 1939",
      "pageNumber": 1,
      "issueId": "woodhull-sentinel-19390803",
      "thumbnail": "data/THUMBs/woodhull-sentinel-19390803/woodhull-sentinel-19390803-001.jpg",
      "jpg": "data/JPEGs/woodhull-sentinel-19390803/woodhull-sentinel-19390803-001.jpg",
      "prevPage": null,
      "nextPage": "woodhull-sentinel-19390803-002",
      "prevIssue": "woodhull-sentinel-19390726-001",
      "nextIssue": "woodhull-sentinel-19390810-001"
    }
  ]
}
```

---

## Actual Results

```
============================================================
Issues Metadata Generator for Newspaper Archive
============================================================

Found 3144 text files to process...
Grouped into 397 issues

Writing metadata file...
Metadata written to ./src/issues-metadata.json
  File size: 2574.66 KB
  Total issues: 397
  Total pages: 3144
  Date range: 1895 - 1967
  Years covered: 18

============================================================
Metadata generation complete
============================================================
```

- **Pages processed:** 3,144 (zero errors, zero skipped)
- **Issues found:** 397 (including 11 duplicate issues with `a` suffix)
- **Output file size:** 2.57 MB
- **Years covered:** 18 (1895, 1930-1941, 1955, 1959, 1964-1965, 1967)
- **Newspapers:** Steuben Republican, Woodhull Sentinel, Addison Advertiser And Woodhull Sentinel, Canisteo Times, Evening Leader (and others)

### Verification

- Year page count sums match total: 3,144 = 3,144
- All 397 issues have first page `prevPage: null` and last page `nextPage: null`
- Duplicate issues sort after their non-suffixed counterparts (e.g., `19310604` then `19310604a`)
- Duplicate issue navigation is correct (e.g., `19310604a` prevIssue points to `19310604-001`)

---

## Error Handling

- **Invalid filenames:** Logged as warnings, file skipped, processing continues
- **Missing input directory:** Fatal error, exits with code 1
- **No pages found:** Fatal error, exits with code 1
- **Write errors:** Fatal error, exits with code 1

---

## Relationship to Other Build Scripts

| Script | Input | Output | Purpose |
|--------|-------|--------|---------|
| `generate-metadata.js` | `data/TXTs/` directory listing | `src/issues-metadata.json` | Collection structure, navigation, stats |
| `generate-search-index.js` | `data/TXTs/` file contents | `src/search-index.json` | Full-text search index |
| `generate-images.sh` | `data/JPEGs/` images | `data/THUMBs/` | Image thumbnails |

Both JS scripts share the same filename parsing logic (duplicated for independence). The metadata script only reads filenames, not file contents, so it runs in under a second.

---

**Document Version:** 1.0
**Created:** 2026-02-08
**Implemented:** 2026-02-08
