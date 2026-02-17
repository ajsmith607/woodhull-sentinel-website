# Plan: Add Table of Contents Shortcode

**Date:** 2026-02-17
**Status:** Implemented

## Context

The `about.md` page has multiple heading levels (h2, h3, h4) but no table of contents for navigation. Markdown-it rendered headings without `id` attributes, so anchor links would not work. Two things were needed: heading IDs on rendered headings, and a shortcode to generate the TOC.

## What Was Done

### 1. Added `slugify` helper function (`.eleventy.js`)

A simple slugify function (lowercase, strips non-word chars, hyphens for spaces) defined at module scope, shared by both the heading renderer and the TOC shortcode.

### 2. Added heading IDs to markdown output (`.eleventy.js`)

Used `eleventyConfig.amendLibrary('md', ...)` to customize the markdown-it heading renderer. The custom `heading_open` rule extracts text content from the next inline token's children (filtering for `text` and `code_inline` types), slugifies it, and sets it as the `id` attribute on h2-h6 tags. No new npm dependencies.

### 3. Created `toc` async shortcode (`.eleventy.js`)

Registered an async shortcode `toc` that:
- Reads the current page's source file via `this.page.inputPath`
- Extracts markdown headers with regex (`/^(#{2,6})\s+(.+)$/gm`)
- Strips inline markdown formatting (bold, italic, links, code) from header text
- Slugifies header text using the same function as the heading renderer
- Accepts an optional `levels` string (e.g., `"2,3"`) to filter which heading levels appear (defaults to `"2,3"`)
- Returns a `<nav class="toc">` with a flat `<ul>` list, each `<li>` styled with a class indicating depth (`toc-h2`, `toc-h3`, etc.)

### 4. Added TOC styles (`src/assets/css/custom.css`)

Added a "Component: Table of Contents" section with:
- `.toc` nav with vertical rhythm margin
- `.toc ul` with `list-style: none`, `display: block` (overrides the site-wide `nav ul { display: flex }` rule that was making TOC items display horizontally)
- `.toc li` with compact spacing
- Indentation via left padding on `.toc-h3` through `.toc-h6` classes, using multiples of `--rhythm`

### 5. Placed shortcode in `src/about.md`

Added `{% toc %}` at the top of the about page content, before the first heading.

## Files Modified

- `.eleventy.js` — added `slugify()` helper, markdown-it heading renderer amendment, `toc` async shortcode
- `src/assets/css/custom.css` — added `.toc` component styles
- `src/about.md` — inserted `{% toc %}` call

## Verification

- `npm run build:site` builds without errors (3,147 files)
- Built `_site/about/index.html` contains headings with `id` attributes (e.g., `<h2 id="about-the-archive">`)
- TOC renders as a vertical list with `toc-h2` and `toc-h3` classed items
- Anchor links in TOC match heading IDs
