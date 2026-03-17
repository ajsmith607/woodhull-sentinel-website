# Search Term Image Highlighting

**Date:** 2026-02-26
**Status:** In analysis — viable with reduced scope; see strategies section

## Overview

Explore adding search term highlighting to newspaper page images — a feature that lets users arriving from a search result immediately see *where* on the page their search term appears.

## Core Constraint

The existing `.txt` OCR files are plain text with no positional data. True on-image highlighting requires **word-level bounding box coordinates** (pixel positions for each word on the scanned page). These do not currently exist in any form in the data directory.

---

## Option A — Re-run OCR with hOCR output *(true image highlighting)*

Tesseract can output **hOCR format**: HTML with `bbox` attributes giving pixel coordinates for every word. This enables overlaying colored rectangles directly on the scanned image.

### Build-time pipeline

1. Re-run Tesseract on all 3,144 JPEGs:
   ```bash
   tesseract image.jpg output hocr
   ```
2. A build script parses each `.hocr` file, extracts per-word coordinates, and outputs compact per-page JSON:
   ```json
   { "homestead": [[120, 340, 80, 22]], "farm": [[210, 340, 45, 22]] }
   ```
3. Eleventy embeds the JSON inline (or loads it lazily) on each detail page.

### Runtime behavior

- Search results link to detail pages with `?q=searchterm` in the URL
- JavaScript reads the query param, looks up matching words in the coordinate JSON
- Renders an SVG layer *inside* the panzoom container, absolutely positioned over the image
- SVG highlights scale correctly with panzoom transforms since they share the same transform context

### Tradeoffs

| | |
|---|---|
| **Pro** | Highlights appear directly on the image at exact word positions |
| **Pro** | SVG + panzoom integration is technically straightforward |
| **Con** | Requires re-running OCR on all 3,144 images (multi-hour build job, repeated on every collection update) |
| **Con** | Coordinate JSON adds ~300–600 MB to hosting storage footprint |
| **Con** | Per-page runtime load is manageable (~50–150 KB on demand), but the build cost and storage overhead are not justified by the result |
| **Con** | **OCR alignment quality is the real disqualifier** — Tesseract on 1930s–40s newsprint produces coordinate drift due to column gutters, page skew, and period typefaces. Highlights that are visibly offset look worse than no highlighting at all, and manual correction is not feasible at this scale |

### Verdict: not recommended

Build complexity and storage are not concerns. The sole disqualifier is OCR coordinate quality on historical newsprint — highlights that are visibly offset look worse than no highlighting at all.

---

## Option B — OCR text panel with term highlighting *(no re-OCR required)*

Add a collapsible OCR text panel below the image viewer. When a user arrives from a search result via `?q=searchterm`, JavaScript highlights matches in the text using `<mark>` tags.

### What's needed

1. Embed OCR text in each detail page at build time (Eleventy reads `.txt` files during pagination — text is already available in the build pipeline)
2. JavaScript reads `?q=` from the URL and wraps matches in `<mark>` tags
3. Search results link to `/pages/woodhull-sentinel-19390803-001/?q=homestead`
4. Optionally: auto-scroll to the first highlighted match in the text panel

### Tradeoffs

| | |
|---|---|
| **Pro** | Implementable today with no new data, tooling, or compute |
| **Pro** | OCR text is already available in the build pipeline |
| **Pro** | Text panel is useful on its own (full-text readable alongside the image) |
| **Con** | Highlighting is in a text panel, not on the image itself |
| **Con** | Embedding full OCR text in each HTML page adds page weight (~23 KB avg per page) |
| **Con** | **Doesn't solve the core problem** — the user's need is to *locate a term spatially on the image*. A text panel lets them read context and confirm the hit is genuine, but they still have to visually scan a dense newspaper page column by column. Not a meaningful UX improvement for the primary task. |

### Verdict: not recommended

Option B helps users read context, but doesn't help them find the word on the page. It addresses a lesser problem than the one worth solving.

---

## Strategies for improving OCR coordinate quality

The core problem is coordinate drift on historical newsprint. Several approaches could mitigate this without requiring perfect results across the entire page.

### hOCR data available for filtering

Tesseract's hOCR output contains two useful per-result fields that enable post-hoc filtering without any additional OCR passes:

- **`x_wconf`** — per-word confidence score (0–100). Available at the word level (`ocrx_word` elements).
- **`x_size`** — estimated font size in pixels. Available at the **line** level (`ocr_line` elements), not per word — but all words in a line inherit the line's size.

Filtering on these values at build time costs nothing extra once hOCR output exists.

---

### Strategy 1 — Confidence thresholding

Only include words in the coordinate JSON where `x_wconf` exceeds a threshold (e.g., ≥ 75).

| | |
|---|---|
| **Pro** | Zero additional tooling — just parse existing hOCR fields |
| **Pro** | Removes the most garbled results, where coordinate drift is also worst |
| **Pro** | Composable with any other strategy |
| **Con** | Low confidence correlates with bad *text* recognition, but not always with bad *coordinates* — the two failure modes are somewhat independent |
| **Con** | Doesn't fix systematic drift from skewed pages; removes individual bad words but not column-level misalignment |
| **Estimated value** | Moderate. Useful as a filter layer but not sufficient on its own. |

---

### Strategy 2 — Font size filtering (large text only)

Only include words from lines where `x_size` exceeds a threshold (e.g., ≥ 20–24px on a 400 DPI scan — roughly headline/masthead scale).

This is the key insight: large text (headlines, section headers, mastheads) OCRs more accurately *and* has less coordinate drift, because each character occupies more pixels. Body text columns at 8–10pt are where drift is worst.

| | |
|---|---|
| **Pro** | Large text genuinely OCRs better — higher character accuracy and better coordinate precision |
| **Pro** | Much smaller coordinate dataset per page — only a handful of words per page qualify |
| **Pro** | Headlines are high-value search targets; many user queries will hit this tier |
| **Pro** | No additional OCR pass — just filter hOCR output at build time |
| **Con** | Coverage is limited — body text (the majority of each page) gets no highlighting |
| **Con** | A user searching for a person's name in a news article won't see it highlighted |
| **Estimated value** | High for the subset of searches that match headline-scale text. Poor overall coverage. |

---

### Strategy 3 — Combined: font size + confidence

Apply both filters simultaneously: large text (`x_size` ≥ threshold) AND high confidence (`x_wconf` ≥ threshold). Only coordinates passing both gates are included.

| | |
|---|---|
| **Pro** | Likely very high precision — large + confident = genuinely good results |
| **Pro** | Still zero additional tooling beyond hOCR parsing |
| **Con** | Coverage is even narrower than either filter alone |
| **Estimated value** | Best accuracy of any filtering-only approach, but lowest coverage. Suitable if "only show highlights when confident" is acceptable UX. |

---

### Strategy 4 — Image pre-processing with `unpaper` before re-OCR

`unpaper` is a dedicated post-processing tool for scanned documents. It corrects page skew/rotation, removes dark scanning edges, and generally cleans the image before OCR. The tool is free, runs locally, and is well-established (used in `ocrmypdf`).

Deskewing is the single biggest factor in coordinate drift — a rotated page causes all coordinates to shear progressively across the page.

| | |
|---|---|
| **Pro** | Addresses the root cause of drift (skew) rather than filtering the output |
| **Pro** | If skew is corrected, word-level coordinates could be significantly more accurate across the whole page |
| **Pro** | Could enable body-text highlighting that filtering alone can't achieve |
| **Con** | Requires re-processing all 3,144 images + re-running OCR |
| **Con** | Results are unpredictable and require per-page parameter tuning; `unpaper` can introduce artifacts |
| **Con** | Significant pipeline complexity; must validate output quality |
| **Estimated value** | Potentially high if skew is a significant factor in coordinate drift. Unknown until tested. Worth testing on a sample of 10–20 pages before committing. |

---

### Strategy 5 — Tesseract 5 (LSTM) re-OCR

Re-run OCR using Tesseract 5's LSTM neural network mode, which improves character recognition accuracy over the legacy engine.

**Important caveat from research:** Tesseract 5's LSTM mode has a documented coordinate alignment bug (GitHub issue #1015 — the CTC algorithm assumes independence between x-coordinates). LSTM may improve *text quality* but could produce *worse* coordinate precision than Tesseract 4's legacy engine. This would need testing before assuming it helps.

| | |
|---|---|
| **Pro** | Better text recognition accuracy (fewer garbled words) |
| **Pro** | Improved character accuracy may correlate with better confidence scores for filtering |
| **Con** | Known coordinate alignment bug in LSTM mode — may make positioning *worse* |
| **Con** | Multi-hour re-OCR job for 3,144 images |
| **Estimated value** | Uncertain, possibly counterproductive for coordinates specifically. Test on a sample before committing. |

---

### Strategy 6 — Text detection models (region-level highlighting)

Modern deep-learning text detection models (CRAFT, DBNet via EasyOCR) can locate text *regions* on an image without reading them. Rather than highlighting individual words, this approach highlights the approximate column or article block containing the search term — coarser but more robust.

The approach would be:
1. Run a detection model on each page to get block/line region bounding boxes
2. Run Tesseract to read the text within each detected region
3. At runtime, highlight the block containing the matched term rather than the individual word

| | |
|---|---|
| **Pro** | Region-level boxes are much larger targets — small alignment errors become invisible |
| **Pro** | Detection models are more robust to skew and aged paper than OCR coordinate output |
| **Pro** | "The article is in this column, upper half" is genuinely useful spatial information |
| **Con** | Requires Python dependencies (PyTorch) in the build pipeline |
| **Con** | Significantly more complex build process |
| **Con** | Models are not specifically trained on 1930s newspaper layouts — results on historical material are unknown |
| **Estimated value** | Potentially the best balance of accuracy and coverage, but highest implementation cost. Would need a prototype to assess quality on this specific material. |

---

## Revised conclusion

The feature remains viable if scope is narrowed. A practical path forward:

**Recommended starting point:** Run hOCR on a sample of ~20 pages covering a range of scan quality (good, average, poor). Measure actual coordinate accuracy visually. This costs nothing and directly answers whether the drift problem is bad enough to rule out filtering-only approaches.

**If skew is the main problem:** Add `unpaper` pre-processing and re-test the same sample. If it materially improves alignment, the full pipeline is justified.

**If filtering is sufficient:** Strategy 3 (font size + confidence) is the lowest-effort path to a working feature. Accept that body text gets no highlighting and treat it as a "headlines only" feature.

**If region-level is acceptable UX:** Strategy 6 offers the best robustness but requires significant pipeline work and an unknown model quality bar on this material.

**Note on Tesseract 5:** Test coordinate accuracy against Tesseract 4 on a sample before assuming newer is better — the LSTM coordinate bug is real.

---

## OCR sample analysis

Sample reviewed: 13 pages across 8 issues spanning 1930–1939 (front pages and interior pages, spread evenly across the decade). Notes below reflect consistent patterns across the full sample.

### Finding 1 — Column segmentation: poor on front pages, good on interior pages

This is the single most important finding. Front pages (Page 1) consistently show heavy interleaving of multiple articles throughout the entire decade. Multiple article headlines appear on the same line; article body text jumps between stories mid-sentence. This is a classic multi-column newspaper OCR problem — the system read across columns rather than down within them.

Interior pages (Page 2) show dramatically better coherence. Editorial and feature content, which tends toward single- or double-column layouts, flows naturally.

**Implication:** The column segmentation failure on front pages affects *reading order* (the sequence of words in the text output), but this is separate from *coordinate accuracy* (where individual words physically sit on the page). For word-level highlighting, coordinate accuracy is what matters — the word "rustlers" occupies the same pixel location on the image regardless of what the OCR reads before or after it in the text stream. The interleaving is a real problem for the existing search index quality but may matter less for highlighting than initially assumed.

### Finding 2 — Character error rate: moderate, tolerable

Body text error rate appears roughly 2–5% at the character level. Most errors are isolated garbled words ("Addisoin", "asction", "surrogiteijM") rather than systematic page-wide corruption. Names are the most error-prone content. Sentences and paragraphs are generally readable in context.

Clear article headlines read well throughout the decade: "Rustlers in Southern Tier Stealing The Farmers' Calves", "Dr. Getman Guest Speaker at Annual Future Farmers Banquet". These would produce reliable, high-confidence hOCR entries.

### Finding 3 — Masthead and ornamental text: poor

Decorative front-page banners and mastheads OCR badly in every issue sampled. Examples:
- 1930: `WQODHULL SENTINEL` (Q for O in the masthead)
- 1932: `*■**»`, `íN.`, `¥L`, `til`, `TINEL` (banner completely garbled)
- 1939: `¿ r w e w 0* * '`, `SU-'x&'idK 31` (masthead garbage)

This is expected — reversed-out type, ornamental fonts, and decorative rules all defeat OCR. These are low-value for search and highlighting alike.

### Finding 4 — Strong indicator this is NOT a naive Tesseract run

Every OCR file in the sample uses `U+00AD` (Unicode soft hyphen `­`) systematically for hyphenated line breaks. Tesseract does not output soft hyphens by default — it outputs a plain `-` or nothing. The consistent use of the correct Unicode soft hyphen character across the entire collection is a strong signal that the vendor used either a commercial OCR engine (ABBYY FineReader is the most common for professional archival scanning) or a post-processing pipeline sophisticated enough to distinguish line-break hyphens from real hyphens. This raises confidence that the underlying coordinate quality may be better than a naive Tesseract baseline.

### Finding 5 — No evidence of severe page skew

The text output does not show the kind of progressive coordinate drift that would result from severely skewed source images. Lines remain coherent and words are generally in plausible positions. Skew may still exist in the images, but if so, it does not appear to be catastrophic. `unpaper` pre-processing may therefore have limited marginal value.

### Prioritized implications for re-OCR strategies

| Strategy | Assessment based on sample |
|---|---|
| **Confidence thresholding** | High value. Isolated garbled words ("surrogiteijM", "asction") would have low confidence scores and are exactly what this filter would remove. |
| **Font size filtering** | High value. Clear article headlines throughout the decade have strong character accuracy. Body text error rate is tolerable. The headline tier is the safest bet for reliable coordinates. |
| **Page segmentation (newspaper-aware)** | Would improve reading order on front pages. May or may not help coordinate accuracy — that's a separate question. Worth testing on a sample if re-OCR is undertaken. |
| **Deskew / unpaper pre-processing** | Uncertain value. No clear evidence of severe skew in this sample. Would need to visually inspect source images before committing. |
| **Tesseract 5 LSTM** | Unknown. Given the soft hyphen evidence suggesting a non-Tesseract original, any re-OCR introduces regression risk for both text and coordinates. Test on a sample first. |

### What this sample cannot tell you

- Whether the vendor has hOCR or ALTO XML output retained (this is still the most important vendor question)
- The identity of the OCR engine (the soft hyphen is a strong *indicator* of a competent system, not proof of a specific engine)
- Actual coordinate accuracy — that requires running hOCR on a sample page and visually comparing word bounding boxes against the image

---

## Reviewing OCR sample files before contacting the vendor

Reviewing a small sample of the existing `.txt` files can answer some questions directly and provide useful context for the vendor conversation — but cannot replace it.

### What a sample review CAN tell you

**Column segmentation quality** — the most useful thing to assess. If the vendor's OCR correctly segmented newspaper columns, the text will flow coherently within each column before moving to the next. If segmentation was poor, you'll see sentences and paragraphs jumping between columns mid-thought. This matters because poor column segmentation is a primary cause of coordinate drift, and it's directly visible in plain text output.

**General OCR error rate** — reading a few pages gives a subjective sense of how many garbled words, broken hyphenations, and misread characters appear. Useful context even if it doesn't answer any specific technical question.

### What a sample review CANNOT tell you

- **OCR engine or version** — plain text files contain no embedded metadata about the tool that produced them
- **Pre-processing steps applied** — image operations (deskewing, denoising, binarization) leave no trace in text output
- **Whether structured output exists** — the fact that only `.txt` was delivered doesn't mean hOCR or ALTO XML wasn't produced; it may simply not have been included in the deliverable
- **Per-word confidence scores** — this is metadata that only exists in structured output formats, not plain text

### Recommendation

~~Review 5–10 pages spanning a range of dates and scan quality before contacting the vendor.~~ **Done** — see OCR sample analysis section above. The sample confirmed poor column segmentation on front pages, moderate body text accuracy, and a strong signal (Unicode soft hyphen) that the vendor used a competent OCR system. The vendor questions section has been updated with this context.

---

## Vendor questions

Before investing in any re-OCR strategy, the vendor may be able to answer questions that substantially change the approach — or even provide coordinate data that already exists and was simply never delivered.

Questions are grouped by priority. Several have been sharpened by findings from the OCR sample analysis above.

### Priority 1 — Structured output (could eliminate re-OCR entirely)

**"When you performed OCR, did your process produce structured output formats such as hOCR, ALTO XML, or PDF with embedded text layers? If so, are those outputs still available, and could you provide them for the collection?"**

This is the most important question. Commercial OCR workflows routinely produce coordinate-rich structured formats internally even when the deliverable is plain text. If the vendor still has hOCR or ALTO XML output, the entire re-OCR problem goes away.

**"Did you deliver all output formats from your OCR process, or only plain text? Is there additional data from the OCR run that wasn't included in the delivery?"**

If they used ABBYY FineReader, a more specific version of this ask: **"Can you export the collection to ALTO XML from your retained project files?"** ABBYY saves all recognition data internally in its project format (`.fpr`). ALTO XML export is a built-in option that takes minutes — it's an open standard maintained by the Library of Congress, specifically designed for digitized newspaper archives, and contains word-level bounding boxes, confidence scores, and page layout structure. Note: `.fpr` project files themselves are proprietary and require ABBYY to open, so requesting them directly would not be useful unless you have the software. ALTO XML is the right deliverable to ask for.

### Priority 2 — OCR engine and version

**"Which OCR engine did you use, and what version? (e.g., ABBYY FineReader, Tesseract, Kofax, OmniPage, or other)"**

*Context from sample analysis:* Every OCR file in the collection uses the Unicode soft hyphen character (`U+00AD`) consistently for line-break hyphens. Tesseract does not produce this by default. This is a strong indicator of either a commercial OCR engine or a sophisticated post-processing pipeline. ABBYY FineReader is the most common engine in professional archival scanning workflows and would be consistent with this finding.

A more targeted version of this question: **"The OCR output consistently uses the Unicode soft hyphen character (U+00AD) for line-break hyphens rather than a plain dash. Can you tell us which engine or post-processing step produced this?"** This is more specific and may prompt a more useful answer than a general "what engine did you use."

### Priority 3 — Column segmentation

**"Did you configure the OCR engine specifically for newspaper column layouts? Multi-column page segmentation is a known challenge — did you use a specific page segmentation mode or profile for this material?"**

*Context from sample analysis:* Front page text in every sampled issue shows clear interleaving of multiple columns — article content jumps between stories mid-sentence. Interior pages with simpler layouts are much more coherent. This suggests the column segmentation mode used was not well-suited to the dense multi-column front page layout typical of this newspaper. Knowing this helps assess whether re-OCR with better segmentation settings would be worth attempting.

### Priority 4 — Pre-processing pipeline

**"Beyond deskewing, what other image pre-processing did you apply before OCR? For example: binarization, contrast enhancement, denoising, border/shadow removal, resolution normalization."**

**"Are the pre-processed (deskewed and cleaned) images available, separate from the original scans? Running OCR on your pre-processed images would produce better results than re-running on the raw JPEGs."**

*Context from sample analysis:* The text output does not show evidence of severe page skew (which would produce progressive coordinate drift across lines). Deskewing may have been effective, or skew may simply not have been a major issue with these scans. Either way, access to pre-processed images would be valuable for any re-OCR attempt.

### Priority 5 — Quality and confidence data

**"Did your OCR process produce per-word confidence scores? If so, is that data available even if it wasn't included in the plain text delivery?"**

**"Did you apply any quality thresholds, post-processing corrections, or manual QA to the OCR output?"**


---

## ALTO XML sample analysis

The vendor provided a sample ALTO XML file: `addison-advertiser-and-woodhull-sentinel-19390803_0001.xml` (page 1 of the 1939-08-03 issue). This directly answers the Priority 1 vendor question — structured coordinate output exists.

### Format and engine

- **ALTO v2** (`http://www.loc.gov/standards/alto/ns-v2#`)
- **ABBYY FineReader 11** (`softwareName: Limb Processing 4.7.4.8108`, `applicationDescription: Abbyy11 OCR Engine`) — confirms the soft-hyphen finding from the OCR sample analysis above
- Page dimensions `HEIGHT=9181 WIDTH=6736` match the source image exactly — coordinates are in pixel space and directly usable with no scaling

### Data coverage

- **4,397 `String` elements** on this page, every one with `HPOS`, `VPOS`, `HEIGHT`, `WIDTH` pixel coordinates
- **`WC` (word confidence)** 0–1 scale present on all strings. Note: ALTO uses 0–1, not the 0–100 scale Tesseract's hOCR uses. WC ≥ 0.75 covers 1,130 strings (26%); WC ≥ 0.50 covers 2,939 (67%).
- **`SUBS_TYPE`/`SUBS_CONTENT`** on 186 hyphenated line-break words — allows reconstructing the full word across the break
- `Page ACCURACY=0.596` (59.6%); quality detail reports 54% of characters with recognition > 50%. Expected for a dense 1930s front page.

### Strategy assessment updated with real data

| Strategy | Assessment |
|---|---|
| **Confidence thresholding (WC ≥ 0.65–0.75)** | Solid. Body text strings like "Administration", "expected", "Tuesday" score 0.73–0.87. Good coordinates and readable content. |
| **Font size filtering (large text only)** | **Revised:** large text on this front page has *lower* confidence, not higher. The decorative masthead strings ("Addison" WC=0.67, "Advertiser" WC=0.71, "Sentinel" WC=0.39) are the ornamental-font tier — the same garbled content noted in the OCR sample analysis. Strategy 2's assumption ("large text OCRs better") does not hold for front-page mastheads. |
| **Combined font size + confidence** | Would exclude most large-text content since large text has poor WC. Narrower than expected. |
| **WC threshold on all text** | The pragmatic choice. Body text with WC ≥ 0.65 is readable and likely has accurate coordinates. |

### Issues to verify before implementing

1. **Filename mismatch:** The XML's `<fileName>` references `addison-advertiser-and-woodhull-sentinel-19390803_0001.jpg` (underscore separator, 4-digit page number, full newspaper name) while the data directory uses `woodhull-sentinel-19390803-001.jpg` (hyphen, 3-digit, shortened name). Matching by date + page number extraction will be necessary, or the vendor should be asked to align naming with the existing convention.

2. **Coverage:** This is one sample file. Must confirm whether all 3,144 pages have corresponding ALTO XML before committing to the pipeline.

3. **WC scale:** Build script must treat `WC` as 0–1. A threshold of 0.65 is roughly equivalent to Tesseract's `x_wconf ≥ 65`.

### Implementation path (ALTO-based, no re-OCR required)

1. Parse ALTO XML per page → extract `String` elements: `CONTENT`, `HPOS`, `VPOS`, `WIDTH`, `HEIGHT`, `WC`
2. Filter by `WC ≥ 0.65` (tune threshold after visual inspection on a sample)
3. For `SUBS_TYPE="HypPart1"` strings, use `SUBS_CONTENT` as the word key (reconstructed whole word)
4. Output compact per-page JSON: `{ "word": [[hpos, vpos, width, height], ...] }`
5. At runtime: SVG overlay inside the panzoom container (see Notes below)

### Cost and size estimate for full collection

- **Sample file:** 875,921 bytes (855 KB), 4,397 words (front page — likely above average density)
- **Cost at $0.03/page:** 3,144 × $0.03 = **$94.32**
- **Estimated download size:** 875,921 × 3,144 ≈ **2.75 GB** (upper bound; interior pages run ~60–70% the size of a front page, so realistic total is closer to 2.0–2.3 GB)
- For reference, the existing `.txt` files are 70.57 MB total — ALTO XML would be roughly 30× larger due to per-word coordinate and confidence metadata

---

## Notes

- The panzoom container in `detail.njk` wraps `#panzoom-container > img#newspaper-image`. An SVG overlay would sit as a sibling to the `<img>` inside `#panzoom-container`, sharing the same CSS dimensions as the image. Panzoom applies its transform to the container, so the SVG moves and scales with the image automatically.
- The search results currently do not pass query terms through to detail page URLs — this link needs to be added regardless of which option is chosen.
- FlexSearch returns page filenames as document IDs, which map directly to detail page URLs (`/pages/{filename}/`).
