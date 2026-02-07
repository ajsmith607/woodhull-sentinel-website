# Image Derivatives Generation Script - Implementation Plan

**Purpose:** This document provides detailed specifications for a Bash script that generates optimized image derivatives (WEBP versions and thumbnails) from the original JPEG newspaper scans using ImageMagick.

---

## Overview

### What This Script Does

1. Scans `data/JPEGs/` directory for all original JPEG files
2. For each JPEG, generates:
   - **Full-resolution WEBP** (90% quality, lossy compression)
   - **Thumbnail JPEG** (200px wide, 70% quality)
3. Maintains parallel directory structure in `data/WEBPs/` and `data/THUMBs/`
4. Skips existing files by default (incremental processing)
5. Provides detailed progress reporting and statistics
6. Logs errors to file and continues processing

### Why These Derivatives?

**Full-Resolution WEBP:**
- 25-40% smaller than original JPEGs
- Faster page load times
- Modern browser support
- Visually indistinguishable quality at 90%

**Thumbnails:**
- Fast preview loading in browse/search interfaces
- Minimal bandwidth for grid views
- 200px wide is perfect for responsive grids

---

## Technical Requirements

### Dependencies

**ImageMagick:**
- Version: 6.9.10+ or 7.x
- Commands used: `convert`, `identify`
- WEBP support must be enabled (check with `convert -list format | grep WEBP`)

**Standard Unix Tools:**
- `bash` (4.0+)
- `find`
- `mkdir`
- `date`
- `bc` (for statistics calculations)
- `du` (for disk usage calculations)
- Optional: `parallel` (GNU parallel for parallel processing mode)

### System Verification

```bash
# Check ImageMagick version
convert -version

# Check WEBP support
convert -list format | grep WEBP

# Check for GNU parallel (optional)
which parallel
```

---

## File Structure

```
newspaper-archive/
├── data/
│   ├── JPEGs/                           # Source images (read-only)
│   │   ├── woodhull-sentinel-19390803/
│   │   │   ├── woodhull-sentinel-19390803-001.jpg
│   │   │   ├── woodhull-sentinel-19390803-002.jpg
│   │   │   └── ...
│   │   └── ...
│   ├── WEBPs/                           # Generated (mirrored structure)
│   │   ├── woodhull-sentinel-19390803/
│   │   │   ├── woodhull-sentinel-19390803-001.webp
│   │   │   └── ...
│   │   └── ...
│   └── THUMBs/                          # Generated (mirrored structure)
│       ├── woodhull-sentinel-19390803/
│       │   ├── woodhull-sentinel-19390803-001.jpg
│       │   └── ...
│       └── ...
├── build/
│   ├── generate-images.sh               # This script
│   └── logs/
│       └── image-generation-errors.log  # Error log file
└── package.json
```

---

## Script Specification

### File: `build/generate-images.sh`

**Make executable:**
```bash
chmod +x build/generate-images.sh
```

**Basic usage:**
```bash
./build/generate-images.sh
```

**Command-line flags:**
```bash
./build/generate-images.sh [OPTIONS]

OPTIONS:
  -f, --force          Regenerate all images (skip existing file check)
  -d, --dry-run        Preview operations without generating files
  -v, --verbose        Show detailed progress for each file
  -p, --parallel       Process images in parallel (4 jobs by default)
  -j, --jobs NUM       Number of parallel jobs (requires --parallel)
  -h, --help           Show help message

EXAMPLES:
  ./build/generate-images.sh                    # Normal run (skip existing)
  ./build/generate-images.sh --force            # Regenerate everything
  ./build/generate-images.sh --dry-run          # Preview without processing
  ./build/generate-images.sh --verbose          # Show detailed progress
  ./build/generate-images.sh --parallel         # Use 4 parallel jobs
  ./build/generate-images.sh --parallel -j 8    # Use 8 parallel jobs
```

---

## Implementation Details

### 1. Script Header & Configuration

```bash
#!/bin/bash

#==============================================================================
# Image Derivatives Generation Script
# Generates WEBP versions and thumbnails from original JPEG scans
#==============================================================================

set -e  # Exit on error (but we'll handle errors in the loop)

# Configuration
SOURCE_DIR="data/JPEGs"
WEBP_DIR="data/WEBPs"
THUMB_DIR="data/THUMBs"
LOG_FILE="build/logs/image-generation-errors.log"

# Image settings
WEBP_QUALITY=90          # High quality, lossy compression
THUMB_WIDTH=200          # Thumbnail width in pixels
THUMB_QUALITY=70         # Thumbnail JPEG quality

# Default flags
FORCE=false
DRY_RUN=false
VERBOSE=false
PARALLEL=false
PARALLEL_JOBS=4

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
```

---

### 2. Command-Line Argument Parsing

```bash
# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -f|--force)
      FORCE=true
      shift
      ;;
    -d|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -p|--parallel)
      PARALLEL=true
      shift
      ;;
    -j|--jobs)
      PARALLEL_JOBS="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Validate parallel jobs
if [[ "$PARALLEL" == true ]] && ! command -v parallel &> /dev/null; then
  echo -e "${RED}Error: GNU parallel is not installed${NC}"
  echo "Install with: brew install parallel (macOS) or apt-get install parallel (Linux)"
  exit 1
fi
```

**Help function:**

```bash
show_help() {
  cat << EOF
Image Derivatives Generation Script

USAGE:
  ./build/generate-images.sh [OPTIONS]

OPTIONS:
  -f, --force          Regenerate all images (ignore existing files)
  -d, --dry-run        Preview operations without generating files
  -v, --verbose        Show detailed progress for each file
  -p, --parallel       Process images in parallel (4 jobs by default)
  -j, --jobs NUM       Number of parallel jobs (requires --parallel)
  -h, --help           Show this help message

EXAMPLES:
  ./build/generate-images.sh                    # Normal run (skip existing)
  ./build/generate-images.sh --force            # Regenerate everything
  ./build/generate-images.sh --dry-run          # Preview without processing
  ./build/generate-images.sh --verbose          # Show detailed progress
  ./build/generate-images.sh --parallel         # Use 4 parallel jobs
  ./build/generate-images.sh --parallel -j 8    # Use 8 parallel jobs

OUTPUT:
  - WEBP files: $WEBP_DIR (90% quality, lossy)
  - Thumbnails: $THUMB_DIR (200px wide, 70% quality)
  - Error log: $LOG_FILE
EOF
}
```

---

### 3. Initialization & Setup

```bash
# Initialize
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Image Derivatives Generation Script${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Check for ImageMagick
if ! command -v convert &> /dev/null; then
  echo -e "${RED}Error: ImageMagick 'convert' command not found${NC}"
  echo "Install ImageMagick: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)"
  exit 1
fi

# Check for WEBP support
if ! convert -list format | grep -q WEBP; then
  echo -e "${RED}Error: ImageMagick does not have WEBP support${NC}"
  echo "Reinstall ImageMagick with WEBP support enabled"
  exit 1
fi

# Verify source directory exists
if [[ ! -d "$SOURCE_DIR" ]]; then
  echo -e "${RED}Error: Source directory not found: $SOURCE_DIR${NC}"
  exit 1
fi

# Create output directories
mkdir -p "$WEBP_DIR"
mkdir -p "$THUMB_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Clear or create log file
> "$LOG_FILE"

# Display configuration
echo "Configuration:"
echo "  Source:      $SOURCE_DIR"
echo "  WEBP output: $WEBP_DIR (quality: ${WEBP_QUALITY}%)"
echo "  Thumb output: $THUMB_DIR (${THUMB_WIDTH}px wide, quality: ${THUMB_QUALITY}%)"
echo "  Force regenerate: $FORCE"
echo "  Dry run: $DRY_RUN"
echo "  Verbose: $VERBOSE"
echo "  Parallel: $PARALLEL"
if [[ "$PARALLEL" == true ]]; then
  echo "  Parallel jobs: $PARALLEL_JOBS"
fi
echo ""
```

---

### 4. File Discovery

```bash
# Find all JPEG files
echo "Scanning for JPEG files..."
mapfile -t JPEG_FILES < <(find "$SOURCE_DIR" -type f -name "*.jpg" | sort)

TOTAL_FILES=${#JPEG_FILES[@]}

if [[ $TOTAL_FILES -eq 0 ]]; then
  echo -e "${RED}Error: No JPEG files found in $SOURCE_DIR${NC}"
  exit 1
fi

echo -e "${GREEN}Found $TOTAL_FILES JPEG files${NC}"
echo ""
```

---

### 5. Image Processing Function

This is the core function that processes a single image:

```bash
process_image() {
  local jpeg_path="$1"
  
  # Extract relative path from source directory
  local rel_path="${jpeg_path#$SOURCE_DIR/}"
  local dir_name="$(dirname "$rel_path")"
  local file_name="$(basename "$rel_path" .jpg)"
  
  # Output paths
  local webp_dir="$WEBP_DIR/$dir_name"
  local thumb_dir="$THUMB_DIR/$dir_name"
  local webp_path="$webp_dir/${file_name}.webp"
  local thumb_path="$thumb_dir/${file_name}.jpg"
  
  # Create subdirectories if needed
  mkdir -p "$webp_dir"
  mkdir -p "$thumb_dir"
  
  # Track operations
  local webp_status="SKIP"
  local thumb_status="SKIP"
  
  # Process WEBP
  if [[ "$FORCE" == true ]] || [[ ! -f "$webp_path" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      webp_status="DRY-RUN"
    else
      if convert "$jpeg_path" -quality "$WEBP_QUALITY" "$webp_path" 2>> "$LOG_FILE"; then
        webp_status="CREATED"
      else
        webp_status="ERROR"
        echo "[ERROR] Failed to create WEBP: $webp_path" >> "$LOG_FILE"
      fi
    fi
  fi
  
  # Process Thumbnail
  if [[ "$FORCE" == true ]] || [[ ! -f "$thumb_path" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      thumb_status="DRY-RUN"
    else
      if convert "$jpeg_path" -resize "${THUMB_WIDTH}x" -quality "$THUMB_QUALITY" "$thumb_path" 2>> "$LOG_FILE"; then
        thumb_status="CREATED"
      else
        thumb_status="ERROR"
        echo "[ERROR] Failed to create thumbnail: $thumb_path" >> "$LOG_FILE"
      fi
    fi
  fi
  
  # Output status (verbose mode)
  if [[ "$VERBOSE" == true ]]; then
    echo "  $file_name.jpg → WEBP: $webp_status, THUMB: $thumb_status"
  fi
  
  # Return status codes for counting
  echo "$webp_status|$thumb_status"
}

export -f process_image
export SOURCE_DIR WEBP_DIR THUMB_DIR WEBP_QUALITY THUMB_WIDTH THUMB_QUALITY
export FORCE DRY_RUN VERBOSE LOG_FILE
```

---

### 6. Main Processing Loop

**Sequential Processing:**

```bash
process_sequential() {
  local webp_created=0
  local webp_skipped=0
  local webp_errors=0
  local thumb_created=0
  local thumb_skipped=0
  local thumb_errors=0
  
  local count=0
  
  echo "Processing images sequentially..."
  echo ""
  
  for jpeg_path in "${JPEG_FILES[@]}"; do
    count=$((count + 1))
    
    # Progress indicator (every 50 files or if verbose)
    if [[ "$VERBOSE" == true ]] || [[ $((count % 50)) -eq 0 ]]; then
      echo "[$count/$TOTAL_FILES] Processing..."
    fi
    
    # Process image
    result=$(process_image "$jpeg_path")
    
    # Parse result
    IFS='|' read -r webp_status thumb_status <<< "$result"
    
    # Update counters
    case "$webp_status" in
      CREATED|DRY-RUN) webp_created=$((webp_created + 1)) ;;
      SKIP) webp_skipped=$((webp_skipped + 1)) ;;
      ERROR) webp_errors=$((webp_errors + 1)) ;;
    esac
    
    case "$thumb_status" in
      CREATED|DRY-RUN) thumb_created=$((thumb_created + 1)) ;;
      SKIP) thumb_skipped=$((thumb_skipped + 1)) ;;
      ERROR) thumb_errors=$((thumb_errors + 1)) ;;
    esac
  done
  
  # Return statistics
  echo "$webp_created|$webp_skipped|$webp_errors|$thumb_created|$thumb_skipped|$thumb_errors"
}
```

**Parallel Processing:**

```bash
process_parallel() {
  echo "Processing images in parallel ($PARALLEL_JOBS jobs)..."
  echo ""
  
  # Use GNU parallel to process images
  # Store results in temporary file
  local results_file=$(mktemp)
  
  printf '%s\n' "${JPEG_FILES[@]}" | \
    parallel --jobs "$PARALLEL_JOBS" --bar process_image {} > "$results_file"
  
  # Parse results
  local webp_created=0
  local webp_skipped=0
  local webp_errors=0
  local thumb_created=0
  local thumb_skipped=0
  local thumb_errors=0
  
  while IFS='|' read -r webp_status thumb_status; do
    case "$webp_status" in
      CREATED|DRY-RUN) webp_created=$((webp_created + 1)) ;;
      SKIP) webp_skipped=$((webp_skipped + 1)) ;;
      ERROR) webp_errors=$((webp_errors + 1)) ;;
    esac
    
    case "$thumb_status" in
      CREATED|DRY-RUN) thumb_created=$((thumb_created + 1)) ;;
      SKIP) thumb_skipped=$((thumb_skipped + 1)) ;;
      ERROR) thumb_errors=$((thumb_errors + 1)) ;;
    esac
  done < "$results_file"
  
  rm -f "$results_file"
  
  # Return statistics
  echo "$webp_created|$webp_skipped|$webp_errors|$thumb_created|$thumb_skipped|$thumb_errors"
}
```

---

### 7. Statistics & Summary

```bash
# Record start time
START_TIME=$(date +%s)

# Process images (sequential or parallel)
if [[ "$PARALLEL" == true ]]; then
  STATS=$(process_parallel)
else
  STATS=$(process_sequential)
fi

# Parse statistics
IFS='|' read -r WEBP_CREATED WEBP_SKIPPED WEBP_ERRORS \
                THUMB_CREATED THUMB_SKIPPED THUMB_ERRORS <<< "$STATS"

# Record end time
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

# Calculate disk usage
echo ""
echo "Calculating disk usage..."
WEBP_SIZE=$(du -sh "$WEBP_DIR" 2>/dev/null | cut -f1)
THUMB_SIZE=$(du -sh "$THUMB_DIR" 2>/dev/null | cut -f1)

# Display summary
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Generation Complete${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo "Time elapsed: ${ELAPSED}s ($(($ELAPSED / 60))m $(($ELAPSED % 60))s)"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo -e "${YELLOW}DRY RUN MODE - No files were actually generated${NC}"
  echo ""
fi

echo "WEBP Files:"
echo "  Created:  ${WEBP_CREATED}"
echo "  Skipped:  ${WEBP_SKIPPED}"
echo "  Errors:   ${WEBP_ERRORS}"
echo "  Total size: ${WEBP_SIZE}"
echo ""

echo "Thumbnail Files:"
echo "  Created:  ${THUMB_CREATED}"
echo "  Skipped:  ${THUMB_SKIPPED}"
echo "  Errors:   ${THUMB_ERRORS}"
echo "  Total size: ${THUMB_SIZE}"
echo ""

# Report errors
if [[ $WEBP_ERRORS -gt 0 ]] || [[ $THUMB_ERRORS -gt 0 ]]; then
  echo -e "${RED}Errors occurred during processing${NC}"
  echo "Check error log: $LOG_FILE"
  echo ""
  
  # Show last 10 errors
  echo "Last 10 errors:"
  tail -n 10 "$LOG_FILE"
  echo ""
fi

# Final status
TOTAL_OPERATIONS=$((WEBP_CREATED + THUMB_CREATED))
if [[ $TOTAL_OPERATIONS -gt 0 ]] && [[ "$DRY_RUN" == false ]]; then
  echo -e "${GREEN}✓ Successfully generated $TOTAL_OPERATIONS image derivatives${NC}"
elif [[ "$DRY_RUN" == true ]]; then
  echo -e "${YELLOW}✓ Dry run complete - would generate $TOTAL_OPERATIONS derivatives${NC}"
else
  echo -e "${YELLOW}✓ All files already exist (use --force to regenerate)${NC}"
fi

echo -e "${BLUE}============================================================${NC}"
```

---

## Expected Performance

### Processing Time Estimates

**Sequential processing (1 job):**
- ~2-3 seconds per image (WEBP + thumbnail)
- 3,144 images × 2.5s = ~7,860 seconds = **~2 hours 10 minutes**

**Parallel processing (4 jobs):**
- ~0.5-0.75 seconds per image (effective)
- 3,144 images × 0.625s = ~1,965 seconds = **~33 minutes**

**Parallel processing (8 jobs):**
- ~0.3-0.4 seconds per image (effective)
- 3,144 images × 0.35s = ~1,100 seconds = **~18 minutes**

**Disk Space:**
- Original JPEGs: 31.16 GB
- WEBP files (estimated): **~20-23 GB** (25-30% smaller)
- Thumbnails (estimated): **~150-200 MB** (very small at 200px)
- **Total additional space: ~20-23 GB**

---

## Usage Examples

### First Run (Generate Everything)

```bash
# Normal mode - generate missing files
./build/generate-images.sh

# With parallel processing (faster)
./build/generate-images.sh --parallel

# With 8 parallel jobs (if you have cores available)
./build/generate-images.sh --parallel -j 8

# Dry run to preview
./build/generate-images.sh --dry-run
```

### Adding New Scans

```bash
# Process only new files (skips existing)
./build/generate-images.sh

# With verbose output to see what's being processed
./build/generate-images.sh --verbose
```

### Regenerate Everything

```bash
# Force regeneration of all files
./build/generate-images.sh --force

# With parallel processing
./build/generate-images.sh --force --parallel
```

---

## Error Handling

### Error Categories

1. **Missing source file:**
   - Should not occur (files found by `find` command)
   - If occurs: Log error, skip file, continue

2. **ImageMagick conversion error:**
   - Corrupt JPEG: Log error, skip file, continue
   - Disk full: Log error, exit immediately
   - Permission denied: Log error, skip file, continue

3. **Directory creation error:**
   - Permission denied: Exit immediately
   - Disk full: Exit immediately

### Error Log Format

**File:** `build/logs/image-generation-errors.log`

```
[2026-01-31 14:23:45] [ERROR] Failed to create WEBP: data/WEBPs/issue-name/page-001.webp
convert: Corrupt JPEG data: premature end of data segment
[2026-01-31 14:23:47] [ERROR] Failed to create thumbnail: data/THUMBs/issue-name/page-002.jpg
convert: unable to open image `data/JPEGs/issue-name/page-002.jpg': No such file or directory
```

### Exit Codes

- `0` - Success (all images processed, some may have been skipped)
- `1` - Fatal error (missing dependencies, invalid arguments, etc.)

---

## Integration with Project Workflow

### NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "build:images": "bash build/generate-images.sh",
    "build:images:force": "bash build/generate-images.sh --force",
    "build:images:parallel": "bash build/generate-images.sh --parallel",
    "build:images:dry-run": "bash build/generate-images.sh --dry-run"
  }
}
```

### Full Build Workflow

```bash
# Step 1: Generate image derivatives (if needed)
npm run build:images

# Step 2: Generate search index
npm run build:search

# Step 3: Build Eleventy site
npm run build:site
```

---

## Picture Element Implementation

The UI will use the HTML `<picture>` element to serve WEBP with JPEG fallback:

```html
<picture>
  <source srcset="../data/WEBPs/issue/page.webp" type="image/webp">
  <img src="../data/JPEGs/issue/page.jpg" alt="Newspaper page">
</picture>
```

**Panzoom Compatibility:**
- Panzoom works with the `<img>` element inside `<picture>`
- The `<source>` elements provide the browser with format choices
- Modern browsers choose WEBP, older browsers fall back to JPEG
- Panzoom applies to whichever image the browser loads

---

## Maintenance & Optimization

### Adding New Scans

When new newspaper pages are scanned:

1. Add JPEG files to `data/JPEGs/` in appropriate subdirectories
2. Run script normally: `./build/generate-images.sh`
3. Only new files will be processed
4. Rebuild search index and Eleventy site

### Storage Optimization

If disk space becomes a concern, stop the script and report the issue.

---

## Testing & Validation

### Pre-flight Checks

```bash
# Verify ImageMagick installation
convert -version

# Verify WEBP support
convert -list format | grep WEBP

# Check available disk space
df -h .

# Test with dry run
./build/generate-images.sh --dry-run
```

### Post-generation Validation

```bash
# Count generated files
echo "Source JPEGs: $(find data/JPEGs -name '*.jpg' | wc -l)"
echo "Generated WEBPs: $(find data/WEBPs -name '*.webp' | wc -l)"
echo "Generated Thumbnails: $(find data/THUMBs -name '*.jpg' | wc -l)"

# Check for errors
if [[ -s build/logs/image-generation-errors.log ]]; then
  echo "Errors detected:"
  cat build/logs/image-generation-errors.log
else
  echo "No errors"
fi

# Verify a sample output
identify data/WEBPs/woodhull-sentinel-19390803/woodhull-sentinel-19390803-001.webp
identify data/THUMBs/woodhull-sentinel-19390803/woodhull-sentinel-19390803-001.jpg
```

### Sample Quality Check

```bash
# Compare file sizes
original=$(stat -f%z "data/JPEGs/woodhull-sentinel-19390803/woodhull-sentinel-19390803-001.jpg")
webp=$(stat -f%z "data/WEBPs/woodhull-sentinel-19390803/woodhull-sentinel-19390803-001.webp")
reduction=$(echo "scale=2; (1 - $webp / $original) * 100" | bc)
echo "WEBP file is ${reduction}% smaller than JPEG"

# View generated images to verify quality
open data/WEBPs/woodhull-sentinel-19390803/woodhull-sentinel-19390803-001.webp
open data/THUMBs/woodhull-sentinel-19390803/woodhull-sentinel-19390803-001.jpg
```

---

## Troubleshooting

### Common Issues

**Issue:** "ImageMagick 'convert' command not found"
- **Solution:** Install ImageMagick: `brew install imagemagick` (macOS) or `apt-get install imagemagick` (Linux)

**Issue:** "ImageMagick does not have WEBP support"
- **Solution:** Reinstall ImageMagick with WEBP support: `brew reinstall imagemagick --with-webp`

**Issue:** "parallel: command not found" (when using --parallel)
- **Solution:** Install GNU parallel: `brew install parallel` (macOS) or `apt-get install parallel` (Linux)
- **Alternative:** Run without --parallel flag (sequential mode)

**Issue:** Script runs very slowly
- **Solution:** Use parallel processing: `./build/generate-images.sh --parallel -j 8`
- Check disk I/O with `iostat` - slow disk may be bottleneck

**Issue:** "No space left on device"
- **Solution:** Free up disk space (need ~23 GB for WEBP + thumbnails)
- Consider reducing WEBP quality or thumbnail size

**Issue:** Some images fail to convert
- **Check error log:** `cat build/logs/image-generation-errors.log`
- **Common causes:** Corrupt JPEG files, unusual image dimensions
- **Solution:** Fix source JPEGs or manually exclude problematic files

---

## Future Enhancements

**Potential improvements (out of scope for initial implementation):**

1. **Progressive JPEGs:** Generate progressive JPEGs for better perceived load time
2. **Multiple thumbnail sizes:** Create 200px, 400px, and 800px versions for responsive images
3. **AVIF format:** Generate AVIF versions (better compression than WEBP, but newer format)
4. **Image optimization:** Run additional optimization (e.g., `jpegoptim`, `oxipng`)
5. **Metadata preservation:** Copy EXIF data from original to derivatives
6. **Resume capability:** Save progress and resume if interrupted
7. **Checksum verification:** Verify output file integrity with checksums
8. **Cloud storage:** Automatically upload derivatives to cloud storage

---

**Document Version:** 1.0  
**Created:** 2026-01-31  
**For:** Claude Code Implementation
