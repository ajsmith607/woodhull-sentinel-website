#!/bin/bash

#==============================================================================
# Image Derivatives Generation Script
# Generates WEBP versions and thumbnails from original JPEG scans
#==============================================================================

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

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect ImageMagick command (v7 "magick" or v6 "convert")
CONVERT_CMD=""
if command -v magick &> /dev/null; then
  CONVERT_CMD="magick"
elif command -v convert &> /dev/null; then
  CONVERT_CMD="convert"
fi

#==============================================================================
# Help
#==============================================================================

show_help() {
  cat << EOF
Image Derivatives Generation Script

USAGE:
  ./build/generate-images.sh [OPTIONS]

OPTIONS:
  -f, --force          Regenerate all images (ignore existing files)
  -d, --dry-run        Preview operations without generating files
  -v, --verbose        Show detailed progress for each file
  -h, --help           Show this help message

EXAMPLES:
  ./build/generate-images.sh                    # Normal run (skip existing)
  ./build/generate-images.sh --force            # Regenerate everything
  ./build/generate-images.sh --dry-run          # Preview without processing
  ./build/generate-images.sh --verbose          # Show detailed progress

OUTPUT:
  - WEBP files: $WEBP_DIR (${WEBP_QUALITY}% quality, lossy)
  - Thumbnails: $THUMB_DIR (${THUMB_WIDTH}px wide, ${THUMB_QUALITY}% quality)
  - Error log: $LOG_FILE
EOF
}

#==============================================================================
# Argument parsing
#==============================================================================

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

#==============================================================================
# Initialization
#==============================================================================

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Image Derivatives Generation Script${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Check for ImageMagick
if [[ -z "$CONVERT_CMD" ]]; then
  echo -e "${RED}Error: ImageMagick not found (neither 'magick' nor 'convert')${NC}"
  echo "Install with: sudo apt-get install imagemagick"
  exit 1
fi

# Check for WEBP support
if ! $CONVERT_CMD -list format | grep -qi WEBP; then
  echo -e "${RED}Error: ImageMagick does not have WEBP support${NC}"
  echo "Install WEBP support: sudo apt-get install imagemagick webp"
  exit 1
fi

# Verify source directory exists
if [[ ! -d "$SOURCE_DIR" ]]; then
  echo -e "${RED}Error: Source directory not found: $SOURCE_DIR${NC}"
  echo "Run this script from the project root directory."
  exit 1
fi

# Create output directories and log file (skip in dry-run mode except log dir)
mkdir -p "$(dirname "$LOG_FILE")"
> "$LOG_FILE"
if [[ "$DRY_RUN" == false ]]; then
  mkdir -p "$WEBP_DIR"
  mkdir -p "$THUMB_DIR"
fi

# Display configuration
echo "Configuration:"
echo "  Source:       $SOURCE_DIR"
echo "  WEBP output:  $WEBP_DIR (quality: ${WEBP_QUALITY}%)"
echo "  Thumb output: $THUMB_DIR (${THUMB_WIDTH}px wide, quality: ${THUMB_QUALITY}%)"
echo "  Force:        $FORCE"
echo "  Dry run:      $DRY_RUN"
echo "  Verbose:      $VERBOSE"
echo "  ImageMagick:  $($CONVERT_CMD -version | head -1)"
echo ""

#==============================================================================
# File discovery
#==============================================================================

echo "Scanning for JPEG files..."
mapfile -t JPEG_FILES < <(find "$SOURCE_DIR" -type f -name "*.jpg" | sort)

TOTAL_FILES=${#JPEG_FILES[@]}

if [[ $TOTAL_FILES -eq 0 ]]; then
  echo -e "${RED}Error: No JPEG files found in $SOURCE_DIR${NC}"
  exit 1
fi

echo -e "${GREEN}Found $TOTAL_FILES JPEG files${NC}"
echo ""

#==============================================================================
# Image processing function
#==============================================================================

process_image() {
  local jpeg_path="$1"

  # Extract relative path from source directory
  local rel_path="${jpeg_path#$SOURCE_DIR/}"
  local dir_name
  dir_name="$(dirname "$rel_path")"
  local file_name
  file_name="$(basename "$rel_path" .jpg)"

  # Output paths
  local webp_dir="$WEBP_DIR/$dir_name"
  local thumb_dir="$THUMB_DIR/$dir_name"
  local webp_path="$webp_dir/${file_name}.webp"
  local thumb_path="$thumb_dir/${file_name}.jpg"

  # Create subdirectories if needed (skip in dry-run mode)
  if [[ "$DRY_RUN" == false ]]; then
    mkdir -p "$webp_dir"
    mkdir -p "$thumb_dir"
  fi

  # Track operations
  local webp_status="SKIP"
  local thumb_status="SKIP"

  # Process WEBP
  if [[ "$FORCE" == true ]] || [[ ! -f "$webp_path" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      webp_status="DRY-RUN"
      if [[ "$VERBOSE" == true ]]; then
        echo "  [dry-run] Would create WEBP: $webp_path" >&2
      fi
    else
      if $CONVERT_CMD "$jpeg_path" -quality "$WEBP_QUALITY" "$webp_path" 2>> "$LOG_FILE"; then
        webp_status="CREATED"
        if [[ "$VERBOSE" == true ]]; then
          local webp_size
          webp_size=$(stat -c%s "$webp_path" 2>/dev/null || echo "?")
          echo "  WEBP created: $webp_path ($webp_size bytes)" >&2
        fi
      else
        webp_status="ERROR"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] Failed to create WEBP: $webp_path (source: $jpeg_path)" >> "$LOG_FILE"
      fi
    fi
  else
    if [[ "$VERBOSE" == true ]]; then
      echo "  WEBP exists, skipping: $webp_path" >&2
    fi
  fi

  # Process Thumbnail
  if [[ "$FORCE" == true ]] || [[ ! -f "$thumb_path" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      thumb_status="DRY-RUN"
      if [[ "$VERBOSE" == true ]]; then
        echo "  [dry-run] Would create thumbnail: $thumb_path" >&2
      fi
    else
      if $CONVERT_CMD "$jpeg_path" -resize "${THUMB_WIDTH}x" -quality "$THUMB_QUALITY" "$thumb_path" 2>> "$LOG_FILE"; then
        thumb_status="CREATED"
        if [[ "$VERBOSE" == true ]]; then
          local thumb_size
          thumb_size=$(stat -c%s "$thumb_path" 2>/dev/null || echo "?")
          echo "  Thumb created: $thumb_path ($thumb_size bytes)" >&2
        fi
      else
        thumb_status="ERROR"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] Failed to create thumbnail: $thumb_path (source: $jpeg_path)" >> "$LOG_FILE"
      fi
    fi
  else
    if [[ "$VERBOSE" == true ]]; then
      echo "  Thumb exists, skipping: $thumb_path" >&2
    fi
  fi

  # Return status for counter parsing (stdout only)
  echo "$webp_status|$thumb_status"
}

#==============================================================================
# Main processing loop
#==============================================================================

# Record start time
START_TIME=$(date +%s)

# Counters
webp_created=0
webp_skipped=0
webp_errors=0
thumb_created=0
thumb_skipped=0
thumb_errors=0

echo "Processing images sequentially..."
echo ""

count=0

for jpeg_path in "${JPEG_FILES[@]}"; do
  count=$((count + 1))

  # Progress indicator every 50 files
  if [[ $((count % 50)) -eq 0 ]]; then
    echo -e "  [${count}/${TOTAL_FILES}] Processing..."
  fi

  if [[ "$VERBOSE" == true ]]; then
    echo -e "[$count/$TOTAL_FILES] $jpeg_path" >&2
  fi

  # Process image and capture status from stdout
  result=$(process_image "$jpeg_path")

  # Parse result
  IFS='|' read -r webp_status thumb_status <<< "$result"

  # Update counters
  case "$webp_status" in
    CREATED)  webp_created=$((webp_created + 1)) ;;
    DRY-RUN)  webp_created=$((webp_created + 1)) ;;
    SKIP)     webp_skipped=$((webp_skipped + 1)) ;;
    ERROR)    webp_errors=$((webp_errors + 1)) ;;
  esac

  case "$thumb_status" in
    CREATED)  thumb_created=$((thumb_created + 1)) ;;
    DRY-RUN)  thumb_created=$((thumb_created + 1)) ;;
    SKIP)     thumb_skipped=$((thumb_skipped + 1)) ;;
    ERROR)    thumb_errors=$((thumb_errors + 1)) ;;
  esac
done

#==============================================================================
# Statistics & summary
#==============================================================================

# Record end time
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

# Calculate disk usage
WEBP_SIZE="N/A"
THUMB_SIZE="N/A"
if [[ "$DRY_RUN" == false ]]; then
  echo ""
  echo "Calculating disk usage..."
  WEBP_SIZE=$(du -sh "$WEBP_DIR" 2>/dev/null | cut -f1)
  THUMB_SIZE=$(du -sh "$THUMB_DIR" 2>/dev/null | cut -f1)
fi

# Display summary
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Generation Complete${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo "Time elapsed: ${ELAPSED}s ($((ELAPSED / 60))m $((ELAPSED % 60))s)"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo -e "${YELLOW}DRY RUN MODE - No files were actually generated${NC}"
  echo ""
fi

echo "WEBP Files:"
echo "  Created:    ${webp_created}"
echo "  Skipped:    ${webp_skipped}"
echo "  Errors:     ${webp_errors}"
echo "  Total size: ${WEBP_SIZE}"
echo ""

echo "Thumbnail Files:"
echo "  Created:    ${thumb_created}"
echo "  Skipped:    ${thumb_skipped}"
echo "  Errors:     ${thumb_errors}"
echo "  Total size: ${THUMB_SIZE}"
echo ""

# Report errors
if [[ $webp_errors -gt 0 ]] || [[ $thumb_errors -gt 0 ]]; then
  echo -e "${RED}Errors occurred during processing${NC}"
  echo "Check error log: $LOG_FILE"
  echo ""
  echo "Last 10 errors:"
  tail -n 10 "$LOG_FILE"
  echo ""
fi

# Final status
TOTAL_OPERATIONS=$((webp_created + thumb_created))
if [[ $TOTAL_OPERATIONS -gt 0 ]] && [[ "$DRY_RUN" == false ]]; then
  echo -e "${GREEN}Successfully generated $TOTAL_OPERATIONS image derivatives${NC}"
elif [[ "$DRY_RUN" == true ]]; then
  echo -e "${YELLOW}Dry run complete - would generate $TOTAL_OPERATIONS derivatives${NC}"
else
  echo -e "${YELLOW}All files already exist (use --force to regenerate)${NC}"
fi

echo -e "${BLUE}============================================================${NC}"
