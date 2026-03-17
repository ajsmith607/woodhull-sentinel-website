# Reference for Woodhull Sentinel Website

## Collection Statistics
- **Total newspaper issues:** 397 distinct newspaper editions
- **Total page files:** 3,144 pages across all issues
- **Average pages per issue:** ~6.3 pages

## Data Directory Statistics

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
│   │   └── custom.css        # Full stylesheet (typography, layout, components)
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

## Configuration

Tunable values that control site appearance and behavior.

### CSS (`src/assets/css/custom.css`)

| Variable | Default | Effect |
|---|---|---|
| `--scale` | `100%` | Global scaling factor. Set on `html { font-size }`. Proportionally adjusts all font sizes, vertical spacing, and container max-width since they use `rem` units. |
| `--rhythm` | `1.7rem` | Base vertical spacing unit. All margins, padding, and gaps are derived from this value. |

### Layout (`src/_includes/layouts/base.njk`)

Pages use the `.container` class (max-width `42.5rem`, centered) by default. Add `wide: true` to a page's front matter to use `.container-wide` instead (full viewport width with horizontal padding only). Currently used by `search.njk` and `detail.njk`.

### Search (`src/assets/js/search.js`)

| Constant | Default | Effect |
|---|---|---|
| `BATCH_SIZE` | `24` | Number of result cards rendered per infinite-scroll batch. |
| `limit` (in `index.search()` call) | `200` | Maximum results returned by FlexSearch per query. |

