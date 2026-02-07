# Image Derivatives Generation Script

**Status:** Implemented
**Date:** 2026-02-07
**Branch:** `feature/generate-images`

---

## Summary

A general-purpose Bash script (`build/generate-images.sh`) that generates image derivatives from the original JPEG newspaper scans using ImageMagick. The script produces one derivative type per invocation, configured via command-line flags for output directory, format, quality, and resize width.

### What Was Built

- A parameterized script that accepts `--output`, `--format`, `--quality`, and `--width` flags
- Scans `data/JPEGs/` for all source files and mirrors the directory structure in the output
- Skips existing files by default (incremental/idempotent)
- Progress reporting every 50 files, optional `--verbose` per-file detail
- Errors logged with timestamps to `build/logs/image-generation-errors.log`
- Supports `--dry-run` (creates no files or directories) and `--force` (regenerate all)

### Design Decisions

- **Single-derivative per run** — the original plan hardcoded both WEBP and thumbnail generation in one pass. Refactored to a parameterized tool so each derivative type is an independent invocation. This decouples the decision of *which* derivatives to generate from the script itself.
- **Sequential only** — no GNU parallel dependency. Simpler script; the full thumbnail run took ~55 minutes, which is acceptable for a rare operation.
- **No `set -e`** — explicit error handling throughout so one bad image doesn't abort the entire run.
- **ImageMagick v6/v7 detection** — detects `magick` (v7) first, falls back to `convert` (v6).
- **Verbose to stderr** — verbose output writes to stderr, status strings to stdout, so counter parsing is never corrupted.
- **Dry-run creates nothing** — no output directories or subdirectories are created in dry-run mode.

---

## Usage

```bash
# Generate 200px thumbnails (current use)
./build/generate-images.sh -o data/THUMBs -F jpg -w 200 -q 70

# Generate full-size WEBPs (deferred — see findings below)
./build/generate-images.sh -o data/WEBPs -F webp -q 90

# Preview without generating
./build/generate-images.sh -o data/THUMBs -F jpg -w 200 -q 70 --dry-run

# Force regenerate
./build/generate-images.sh -o data/THUMBs -F jpg -w 200 -q 70 --force

# Verbose output
./build/generate-images.sh -o data/THUMBs -F jpg -w 200 -q 70 --verbose
```

### Flags

| Flag | Description |
|------|-------------|
| `-o, --output DIR` | Output directory (required) |
| `-F, --format FMT` | Output format: `jpg`, `webp`, `png` (required) |
| `-q, --quality NUM` | Quality 1-100 (default: 80) |
| `-w, --width NUM` | Resize to width in pixels (omit for original size) |
| `-f, --force` | Regenerate all (ignore existing files) |
| `-d, --dry-run` | Preview only, create nothing |
| `-v, --verbose` | Per-file progress detail |
| `-h, --help` | Show help |

---

## Thumbnail Generation Results

Full run completed 2026-02-07:

| Metric | Value |
|--------|-------|
| Files processed | 3,144 |
| Errors | 0 |
| Total size | 109 MB |
| Time elapsed | 54m 59s |
| Output dimensions | 200px wide (proportional height) |
| Quality | 70% JPEG |

---

## WEBP Compression Findings

Testing WEBP generation at 90% quality on 8 sample images showed that **WEBPs were consistently 10-19% *larger* than the original JPEGs**, not the 25-40% smaller predicted by the original plan.

| Image | JPEG size | WEBP size | Difference |
|-------|-----------|-----------|------------|
| page-001 | 9.16 MB | 10.03 MB | +9.5% |
| page-002 | 11.43 MB | 13.37 MB | +16.9% |
| page-003 | 11.61 MB | 13.86 MB | +19.3% |
| page-004 | 10.50 MB | 11.80 MB | +12.3% |
| page-005 | 9.79 MB | 10.87 MB | +10.9% |
| page-006 | 11.19 MB | 13.23 MB | +18.1% |
| page-007 | 11.68 MB | 13.65 MB | +16.8% |
| page-008 | 9.65 MB | 10.69 MB | +10.7% |

**Likely cause:** The original 400 DPI scans are already well-compressed JPEGs. Re-encoding to WEBP at 90% quality (which targets higher fidelity) produces larger files for this content type.

**Decision:** WEBP generation deferred. The script supports it if revisited later — a lower quality setting (e.g., 75%) or a different format (AVIF) might yield actual savings. For now, the site will serve original JPEGs directly.

---

## Bugs Fixed From Original Plan

1. **Verbose output corrupted status parsing** — verbose text and status both went to stdout. Fixed: verbose to stderr.
2. **`stat -f%z` is macOS syntax** — replaced with `stat -c%s` for Linux.
3. **Error log timestamps missing** — added `[YYYY-MM-DD HH:MM:SS]` prefix.
4. **ImageMagick v6 vs v7** — added detection for `magick` (v7) with `convert` (v6) fallback.
5. **`set -e` with loop error handling** — removed `set -e`, explicit error checks throughout.
6. **Install instructions referenced `brew`** — changed to `apt-get` for Linux.
7. **Parallel support removed** — unnecessary complexity for a rare operation.
8. **Dry-run created directories** — fixed to create nothing on disk.

---

## Dependencies

- **ImageMagick** 6.9.10+ or 7.x (`sudo apt-get install imagemagick`)
- WEBP delegate required only if generating WEBP output
- Standard Unix tools: `bash` (4.0+), `find`, `mkdir`, `date`, `du`

---

## File Structure

```
build/
  generate-images.sh               # The script
  logs/
    image-generation-errors.log     # Error log (cleared each run)
data/
  JPEGs/                            # Source (read-only, 3,144 files, ~31 GB)
  THUMBs/                           # Generated thumbnails (3,144 files, 109 MB)
```
