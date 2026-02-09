# Styling Plan: Minimal Mid-Century Single Column Layout

## Project Overview
Create a minimal, sophisticated single-column website using mid-century modern design principles. Rely on typography, color, and spacing rather than decorative elements.

## Color Palette (Warm Minimalist)
```css
--ivory: #faf8f3;
--pale-honey: #e8dcc7;
--honey: #c4a574;
--olive: #6b6b47;
--deep-charcoal: #2d2d2d;
```

## Typography

### Fonts
- **H1 only**: Josefin Sans, weight 300
  - Vendored locally at `src/assets/fonts/josefin-sans-300.ttf` (57 KB) for offline/file:// support
- **Body & all other elements**: System sans-serif stack
  ```css
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  ```

### Vertical Rhythm
- **Base font size**: 18px (1.125rem)
- **Base line height**: 1.7 (30.6px)
- **Rhythm unit**: 1.7rem (30.6px) - all spacing should be multiples of this

### Type Scale
Use a modular scale with ratio of 1.25 (major third):
- **H1**: 3.052rem (54.9px) - Josefin Sans 300
- **H2**: 2.441rem (43.9px) - System sans 400
- **H3**: 1.953rem (35.2px) - System sans 400
- **H4**: 1.563rem (28.1px) - System sans 500
- **H5**: 1.25rem (22.5px) - System sans 500
- **H6**: 1rem (18px) - System sans 600
- **Body**: 1.125rem (18px) - System sans 400
- **Small**: 0.9rem (16.2px) - System sans 400

### Heading Spacing
- H1: margin-top: 0, margin-bottom: 1.7rem
- H2: margin-top: 3.4rem, margin-bottom: 1.7rem
- H3: margin-top: 3.4rem, margin-bottom: 1.7rem
- H4-H6: margin-top: 1.7rem, margin-bottom: 0.85rem

## Layout Structure

### Container
- **Max-width**: 680px (optimal for readability at 18px base)
- **Padding**: 1.7rem on sides (mobile), 3.4rem on sides (tablet+)
- **Margin**: 0 auto (centered)

### Header
- **Padding**: 3.4rem 0
- **Border-bottom**: 1px solid var(--pale-honey)
- **Background**: var(--ivory)

### Main
- **Padding**: 5.1rem 0 (3 rhythm units)
- **Background**: var(--ivory)

### Footer
- **Padding**: 3.4rem 0
- **Border-top**: 1px solid var(--pale-honey)
- **Background**: var(--ivory)
- **Font size**: 0.9rem
- **Color**: slightly muted (use #666 or similar)

## CSS Reset
Use a modern, minimal reset:
```css
/* Box sizing */
*, *::before, *::after {
  box-sizing: border-box;
}

/* Remove default margin */
* {
  margin: 0;
}

/* Body defaults */
body {
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

/* Media defaults */
img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
  height: auto;
}

/* Form elements */
input, button, textarea, select {
  font: inherit;
}

/* Avoid text overflow */
p, h1, h2, h3, h4, h5, h6 {
  overflow-wrap: break-word;
}
```

## Color Application

### Background & Text
- **Body background**: var(--ivory)
- **Body text**: var(--deep-charcoal)
- **Headings**: var(--deep-charcoal)

### Links
- **Default**: var(--olive)
- **Hover**: var(--deep-charcoal)
- **Text decoration**: none (default), underline (hover)
- **Transition**: all 0.2s ease

### Accents
- Use var(--olive) for interactive elements
- Use var(--honey) sparingly for special emphasis
- Use var(--pale-honey) for subtle borders/dividers

## Responsive Images
```css
img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1.7rem 0;
}

/* Optional: Add subtle border for definition */
img {
  border: 1px solid var(--pale-honey);
}
```

## Table Styling
Clean, minimal approach:
```css
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.7rem 0;
  font-size: 0.95rem;
}

th {
  text-align: left;
  font-weight: 500;
  color: var(--deep-charcoal);
  padding: 0.85rem;
  border-bottom: 2px solid var(--olive);
}

td {
  padding: 0.85rem;
  border-bottom: 1px solid var(--pale-honey);
}

tr:last-child td {
  border-bottom: none;
}

/* Optional: Subtle hover for data rows */
tbody tr:hover {
  background: rgba(232, 220, 199, 0.3); /* pale-honey with transparency */
}
```

## Additional Elements

### Blockquotes
```css
blockquote {
  margin: 1.7rem 0;
  padding-left: 1.7rem;
  border-left: 3px solid var(--olive);
  font-style: italic;
  color: #555;
}
```

### Horizontal Rules
```css
hr {
  border: none;
  border-top: 1px solid var(--pale-honey);
  margin: 3.4rem 0;
}
```

### Lists
```css
ul, ol {
  margin: 1.7rem 0;
  padding-left: 1.7rem;
}

li {
  margin-bottom: 0.85rem;
}

li:last-child {
  margin-bottom: 0;
}
```

### Code
```css
code {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  background: var(--pale-honey);
  padding: 0.2em 0.4em;
  border-radius: 2px;
}

pre {
  background: var(--pale-honey);
  padding: 1.7rem;
  margin: 1.7rem 0;
  overflow-x: auto;
  border-radius: 2px;
}

pre code {
  background: none;
  padding: 0;
}
```

## Focus States (Accessibility)
```css
a:focus,
button:focus,
input:focus,
textarea:focus {
  outline: 2px solid var(--olive);
  outline-offset: 2px;
}
```

## Responsive Breakpoints

### Mobile (default)
- Container padding: 1.7rem
- Font size: 18px (base)

### Tablet (min-width: 768px)
- Container padding: 3.4rem
- Slightly increase spacing if needed

### Desktop (min-width: 1024px)
- Maintain max-width: 680px
- All else remains consistent (single column)

## Key Principles
1. **Restraint**: Let typography and spacing do the work
2. **Vertical rhythm**: All spacing in multiples of 1.7rem
3. **Minimal decoration**: No borders except where functionally necessary
4. **Color purpose**: Use color sparingly and intentionally
5. **Readability first**: Generous line-height and optimal measure

## Implementation Notes
- Start with the CSS reset
- Set up CSS custom properties for colors
- Import Josefin Sans for H1 only
- Apply vertical rhythm consistently
- Test responsive behavior, especially images
- Ensure all interactive elements have clear hover/focus states
- Verify sufficient color contrast for accessibility (all combinations should pass WCAG AA)

## Implementation Outcome

**Completed 2026-02-08** on branch `feature/mid-century-styling`.

### Changes Made
- **Removed** `simple.css` (classless CSS framework) — replaced entirely by `custom.css`
- **Replaced** `src/assets/css/custom.css` with a single self-contained stylesheet covering: CSS reset, color palette, modular type scale, vertical rhythm, layout, and all component styles
- **Added** `src/assets/fonts/josefin-sans-300.ttf` — vendored locally (not Google Fonts CDN) to preserve offline/file:// support
- **Updated** `src/_includes/layouts/base.njk` — removed simple.css `<link>`, wrapped body content in `.container` div for 680px max-width centering

### Design Decisions During Implementation
- **Font hosting**: Vendored TTF locally rather than Google Fonts CDN, preserving the project's offline capability
- **Existing component styles**: Preserved and adapted all page-specific styles (thumbnail grids, search results, Panzoom viewer, card layouts, navigation) to match the new palette and spacing system
- **Thumbnail grid**: Kept within the 680px container width using `auto-fill` with 180px minimum column width

## Optional Enhancements (if needed later)
- Image captions: smaller text in var(--honey)
- Pull quotes: larger text with olive accent
- Subtle fade-in animations on scroll
- Dark mode variant (swap ivory/charcoal)
