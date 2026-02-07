#!/bin/bash

#==============================================================================
# Image Derivatives Generation Script
# Generates image derivatives (e.g., thumbnails, format conversions) from
# original JPEG scans. Run once per derivative type with desired settings.
#==============================================================================

# Source directory (fixed)
SOURCE_DIR="data/JPEGs"
LOG_FILE="build/logs/image-generation-errors.log"

# Derivative settings (set via flags)
OUTPUT_DIR=""
OUTPUT_FORMAT=""
OUTPUT_QUALITY=""
OUTPUT_WIDTH=""

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
  cat << 'EOF'
Image Derivatives Generation Script

Generates a single type of image derivative from source JPEGs.
Run once per derivative type with the desired settings.

USAGE:
  ./build/generate-images.sh --output DIR --format FMT [OPTIONS]

REQUIRED:
  -o, --output DIR     Output directory (e.g., data/THUMBs, data/WEBPs)
  -F, --format FMT     Output format: jpg, webp, png

IMAGE OPTIONS:
  -q, --quality NUM    Output quality 1-100 (default: 80)
  -w, --width NUM      Resize to width in pixels (omit to keep original size)

FLAGS:
  -f, --force          Regenerate all images (ignore existing files)
  -d, --dry-run        Preview operations without generating files
  -v, --verbose        Show detailed progress for each file
  -h, --help           Show this help message

EXAMPLES:
  # Generate 200px thumbnails
  ./build/generate-images.sh -o data/THUMBs -F jpg -w 200 -q 70

  # Generate full-size WEBPs
  ./build/generate-images.sh -o data/WEBPs -F webp -q 90

  # Dry run to preview
  ./build/generate-images.sh -o data/THUMBs -F jpg -w 200 -q 70 --dry-run

  # Force regenerate thumbnails
  ./build/generate-images.sh -o data/THUMBs -F jpg -w 200 -q 70 --force
EOF
}

#==============================================================================
# Argument parsing
#==============================================================================

while [[ $# -gt 0 ]]; do
  case $1 in
    -o|--output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -F|--format)
      OUTPUT_FORMAT="$2"
      shift 2
      ;;
    -q|--quality)
      OUTPUT_QUALITY="$2"
      shift 2
      ;;
    -w|--width)
      OUTPUT_WIDTH="$2"
      shift 2
      ;;
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
# Validate required arguments
#==============================================================================

if [[ -z "$OUTPUT_DIR" ]]; then
  echo -e "${RED}Error: --output is required${NC}"
  echo ""
  show_help
  exit 1
fi

if [[ -z "$OUTPUT_FORMAT" ]]; then
  echo -e "${RED}Error: --format is required${NC}"
  echo ""
  show_help
  exit 1
fi

# Validate format
case "$OUTPUT_FORMAT" in
  jpg|webp|png) ;;
  *)
    echo -e "${RED}Error: unsupported format '$OUTPUT_FORMAT' (use jpg, webp, or png)${NC}"
    exit 1
    ;;
esac

# Default quality
if [[ -z "$OUTPUT_QUALITY" ]]; then
  OUTPUT_QUALITY=80
fi

# Validate quality range
if [[ "$OUTPUT_QUALITY" -lt 1 ]] || [[ "$OUTPUT_QUALITY" -gt 100 ]]; then
  echo -e "${RED}Error: quality must be between 1 and 100${NC}"
  exit 1
fi

# Validate width if provided
if [[ -n "$OUTPUT_WIDTH" ]] && [[ "$OUTPUT_WIDTH" -lt 1 ]]; then
  echo -e "${RED}Error: width must be a positive number${NC}"
  exit 1
fi

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

# Check for WEBP support if needed
if [[ "$OUTPUT_FORMAT" == "webp" ]]; then
  if ! $CONVERT_CMD -list format | grep -qi WEBP; then
    echo -e "${RED}Error: ImageMagick does not have WEBP support${NC}"
    echo "Install WEBP support: sudo apt-get install imagemagick webp"
    exit 1
  fi
fi

# Verify source directory exists
if [[ ! -d "$SOURCE_DIR" ]]; then
  echo -e "${RED}Error: Source directory not found: $SOURCE_DIR${NC}"
  echo "Run this script from the project root directory."
  exit 1
fi

# Create output directories and log file (skip output dir in dry-run mode)
mkdir -p "$(dirname "$LOG_FILE")"
> "$LOG_FILE"
if [[ "$DRY_RUN" == false ]]; then
  mkdir -p "$OUTPUT_DIR"
fi

# Build description of resize setting
RESIZE_DESC="original size"
if [[ -n "$OUTPUT_WIDTH" ]]; then
  RESIZE_DESC="${OUTPUT_WIDTH}px wide"
fi

# Display configuration
echo "Configuration:"
echo "  Source:       $SOURCE_DIR"
echo "  Output:       $OUTPUT_DIR"
echo "  Format:       $OUTPUT_FORMAT"
echo "  Quality:      ${OUTPUT_QUALITY}%"
echo "  Resize:       $RESIZE_DESC"
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

  # Output path
  local out_dir="$OUTPUT_DIR/$dir_name"
  local out_path="$out_dir/${file_name}.${OUTPUT_FORMAT}"

  # Create subdirectory if needed (skip in dry-run mode)
  if [[ "$DRY_RUN" == false ]]; then
    mkdir -p "$out_dir"
  fi

  # Track operation
  local status="SKIP"

  if [[ "$FORCE" == true ]] || [[ ! -f "$out_path" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      status="DRY-RUN"
      if [[ "$VERBOSE" == true ]]; then
        echo "  [dry-run] Would create: $out_path" >&2
      fi
    else
      # Build convert command arguments
      local convert_args=()
      convert_args+=("$jpeg_path")
      if [[ -n "$OUTPUT_WIDTH" ]]; then
        convert_args+=(-resize "${OUTPUT_WIDTH}x")
      fi
      convert_args+=(-quality "$OUTPUT_QUALITY")
      convert_args+=("$out_path")

      if $CONVERT_CMD "${convert_args[@]}" 2>> "$LOG_FILE"; then
        status="CREATED"
        if [[ "$VERBOSE" == true ]]; then
          local out_size
          out_size=$(stat -c%s "$out_path" 2>/dev/null || echo "?")
          echo "  Created: $out_path ($out_size bytes)" >&2
        fi
      else
        status="ERROR"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] Failed to create: $out_path (source: $jpeg_path)" >> "$LOG_FILE"
      fi
    fi
  else
    if [[ "$VERBOSE" == true ]]; then
      echo "  Exists, skipping: $out_path" >&2
    fi
  fi

  # Return status for counter parsing (stdout only)
  echo "$status"
}

#==============================================================================
# Main processing loop
#==============================================================================

# Record start time
START_TIME=$(date +%s)

# Counters
created=0
skipped=0
errors=0

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
  status=$(process_image "$jpeg_path")

  # Update counters
  case "$status" in
    CREATED)  created=$((created + 1)) ;;
    DRY-RUN)  created=$((created + 1)) ;;
    SKIP)     skipped=$((skipped + 1)) ;;
    ERROR)    errors=$((errors + 1)) ;;
  esac
done

#==============================================================================
# Statistics & summary
#==============================================================================

# Record end time
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

# Calculate disk usage
OUTPUT_SIZE="N/A"
if [[ "$DRY_RUN" == false ]]; then
  echo ""
  echo "Calculating disk usage..."
  OUTPUT_SIZE=$(du -sh "$OUTPUT_DIR" 2>/dev/null | cut -f1)
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

echo "Output: $OUTPUT_DIR (${OUTPUT_FORMAT}, ${OUTPUT_QUALITY}% quality, ${RESIZE_DESC})"
echo "  Created:    ${created}"
echo "  Skipped:    ${skipped}"
echo "  Errors:     ${errors}"
echo "  Total size: ${OUTPUT_SIZE}"
echo ""

# Report errors
if [[ $errors -gt 0 ]]; then
  echo -e "${RED}Errors occurred during processing${NC}"
  echo "Check error log: $LOG_FILE"
  echo ""
  echo "Last 10 errors:"
  tail -n 10 "$LOG_FILE"
  echo ""
fi

# Final status
if [[ $created -gt 0 ]] && [[ "$DRY_RUN" == false ]]; then
  echo -e "${GREEN}Successfully generated $created image derivatives${NC}"
elif [[ "$DRY_RUN" == true ]]; then
  echo -e "${YELLOW}Dry run complete - would generate $created derivatives${NC}"
else
  echo -e "${YELLOW}All files already exist (use --force to regenerate)${NC}"
fi

echo -e "${BLUE}============================================================${NC}"
