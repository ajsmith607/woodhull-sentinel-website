# Newspaper Archive Website - Project Specification

## Project Overview

A lightweight, static JAMStack website for browsing and searching a collection of historical newspaper page images with accompanying OCR text. 

**Key Features:**
- Can be statically hosted or run in a non-networked environment
- Full-text search across OCR'd newspaper content
- Pan/zoom image viewing for newspaper pages
- Fast, responsive interface

**Components used:**
  - simple.css (classless CSS framework, vendored locally)
  - FlexSearch (client-side full-text search, vendored locally)
  - Panzoom (image pan/zoom viewer, vendored locally)

## Data Specifications

This section describes the scope and organization of the images that make up the newspaper collection. 

"Issue" and "edition" are used interchangeably to refer to each distinct physical newspaper copy in the collection. There are several instances of duplicate editions that were also intentionally scanned.

### Collection Statistics
- **Total newspaper issues:** 497 distinct newspaper editions
- **Total page files:** 3,144 pages across all issues
- **Average pages per issue:** ~6.3 pages

### Directory Structure

The actual newspaper collection files are located under the `data/` directory of the project root. Sub-directories are organized as follows:
- `data/JPEGs`: Full-size scanned images in jpg format (source, read-only)
- `data/TXTs`: OCR text files (source, read-only)
- `data/THUMBs`: Thumbnail images in jpg format (generated, 200px wide, 70% quality)

**File Pairing:**
- Text and image files are paired by identical filenames in parallel directory structures
  - `data/TXTs/issue-name/page-name.txt`
  - `data/JPEGs/issue-name/page-name.jpg`
  - `data/THUMBs/issue-name/page-name.jpg`

### Naming Conventions

**Issue Directories:**
- Format: `lowercase-newspaper-name-YYYYMMDD`
- Example: `woodhull-sentinel-19390803`

**Page Files:**
- Format: `lowercase-newspaper-name-YYYYMMDD-NNN.ext`
- Where `NNN` is the page number (001, 002, 003, etc.)
- Example: `woodhull-sentinel-19390803-001.jpg`, `woodhull-sentinel-19390803-002.txt`

**Duplicate Issues:**
- The collection contains duplicate copies of several issues. In these cases, a suffix letters is added to issue and page names:
  - Ex. `/data/JPEGs/woodhull-sentinel-19310604a/woodhull-sentinel-19310604a-001.jpg`

### Data Directory Statistics
  - OCR text directory
      - 3,144 text files
      - 70.57 MB total
      - 137 bytes smallest file
      - 43.85 KB largest file
      - 22.98 KB average size

  - Full-size scanned JPG images directory
      - 3,144 jpg files
      - 31.16 GB total
      - 3.55 MB smallest file
      - 13.44 MB largest file
      - 10.15 MB average size

The full-size scanned images are 400DPI with 6500x9000 pixels as typical dimensions.

## Build Scripts

### `build/generate-images.sh`

General-purpose image derivative generator. Produces one derivative type per invocation.

```bash
# Generate thumbnails (200px wide, 70% quality JPEG)
./build/generate-images.sh -o data/THUMBs -F jpg -w 200 -q 70

# Run with --help for all options
./build/generate-images.sh --help
```

Thumbnails have been generated for all 3,144 pages (109 MB total). See `plans/20260207-generate-images.md` for full details and WEBP compression findings.

### `build/generate-search-index.js`

Node.js script that reads all OCR text files, builds a FlexSearch Document index, and exports it as a single JSON file for client-side search.

```bash
node build/generate-search-index.js
```

**Output:** `src/search-index.json` (~24 MB, 3,144 documents indexed)

The exported index contains all FlexSearch key/data segments in a single file. Client-side code reconstructs the index by calling `index.import(key, value)` for each key. The FlexSearch config is embedded in the output file under the `config` field.

**Dependencies:** `flexsearch` (installed via `npm install`)

### `build/generate-metadata.js`

Node.js script that scans `data/TXTs/` directory structure and generates structured collection metadata for the Eleventy site (browse page, detail page pagination, navigation links, stats).

```bash
node build/generate-metadata.js
```

**Output:** `src/issues-metadata.json` (~2.6 MB, 397 issues, 3,144 pages)

Contains `years` (grouped by year with issue listings), `allPages` (flat array with prev/next navigation links for Eleventy pagination), and aggregate stats (`totalIssues`, `totalPages`, `dateRange`). All image paths are site-root-relative (`data/THUMBs/...`). See `plans/20260208-generate-metadata.md` for full schema and details.

**Dependencies:** None (Node.js built-ins only)

**NPM scripts:**
```bash
npm run build:metadata # Just rebuild metadata
npm run build:search   # Just rebuild search index
npm run build:site     # Just rebuild Eleventy site
npm run build          # Metadata + search index + Eleventy site
npm run dev            # Eleventy dev server with live reload
```

## Eleventy Site

### Configuration

`.eleventy.js` — Eleventy config (CommonJS). Key features:
- Loads `src/issues-metadata.json` as `metadata` global data
- Passthrough copies vendor JS/CSS from `node_modules/` to `assets/js/vendor/` and `assets/css/`
- `htmlTransformer.addUrlTransform` converts root-relative URLs to depth-correct relative URLs at build time (enables file:// protocol support)
- `eleventy.after` event creates `_site/data` symlink to `../data` (avoids copying 31 GB)
- Custom filters: `sortedYearsDesc` (years object to descending array), `rootRelative` (prepends `/` to bare data paths)

### Site Structure

Templates use root-relative paths (`/browse/`, `/assets/css/custom.css`) — the URL transform handles depth automatically.

```
src/
├── _includes/
│   ├── layouts/
│   │   └── base.njk          # HTML boilerplate, loads CSS
│   └── components/
│       ├── header.njk        # Site nav
│       ├── footer.njk        # Site footer
│       └── search-form.njk   # Reusable search form
├── assets/
│   ├── css/
│   │   ├── simple.min.css    # Vendored simple.css
│   │   └── custom.css        # Minimal overrides (grids, cards, viewer)
│   └── js/
│       ├── search.js         # FlexSearch client-side integration
│       └── viewer.js         # Panzoom initialization
├── index.njk                 # Home page (stats, search, links)
├── browse.njk                # Browse by year (descending, thumbnail grid)
├── search.njk                # Search page (client-side via FlexSearch)
├── detail.njk                # Detail page (paginated, 3,144 pages, Panzoom viewer)
└── about.njk                 # About page
```

### Build Output

`_site/` contains the built site (~3,148 HTML files). The `data` symlink inside `_site/` points to `../data` so image paths resolve without copying files.

```bash
# Build and serve
npm run build:site
python3 -m http.server 8080 -d _site

# Or use Eleventy dev server with live reload
npm run dev
```

### Limitations

- **Search requires HTTP** — `fetch()` for the ~24 MB search index does not work via `file://` protocol. All other pages work via file://.
- **Search index size** — `search-index.json` is ~24 MB (uses `strict` tokenization — whole-word matching only, no prefix search). Shows a loading indicator while parsing.

## DO NOT

- DO NOT edit original jpg image files
- DO NOT edit original OCR text files

---

**Document Version:** 3.0
**Last Updated:** 2026-02-08
**Architecture:** JAMStack (Eleventy 3.x, Nunjucks)
**Status:** Site UI implemented
