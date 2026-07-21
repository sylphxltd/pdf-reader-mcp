#!/usr/bin/env bash
# pdf-reader-mcp bounded claimed-subset checks.
# Slices: tool.read_pdf | tool.search_pdf|tool.pdf_evidence | transport.stdio-rust-rmcp | all
# Fail-closed: requires bun + built Rust artifacts (no SKIP-as-pass).
# See PARITY-VERIFICATION-STANDARD.md, DECISION-001 / rej-010.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRATCH="${SCRATCH_DIR:-/tmp/pdf-reader-mcp-differential}"
mkdir -p "$SCRATCH"
LOG="$SCRATCH/differential.log"
ARTIFACT="$SCRATCH/verification.json"
ORACLE_JSON="$SCRATCH/oracle.json"
TEXT_DIFFERENTIAL_JSON="$SCRATCH/ts-vs-rust-text.json"
V3014_BEHAVIOR_JSON="$SCRATCH/v3014-behavior-result.json"
V3014_TEXT_LAYER_JSON="$SCRATCH/v3014-text-layer-result.json"
V3014_SELECTABLE_TEXT_SEGMENTATION_JSON="$SCRATCH/v3014-selectable-text-segmentation-result.json"
V3014_OCR_SEARCH_JSON="$SCRATCH/v3014-ocr-search-result.json"
V3014_CITATION_CHUNK_JSON="$SCRATCH/v3014-citation-chunk-result.json"
V3014_SEMANTIC_HINT_JSON="$SCRATCH/v3014-semantic-hint-result.json"
V3014_DOCUMENT_AST_JSON="$SCRATCH/v3014-document-ast-result.json"
V3014_DOCUMENT_MAP_JSON="$SCRATCH/v3014-document-map-result.json"
V3014_TRUST_REPORT_JSON="$SCRATCH/v3014-trust-report-result.json"
V3014_SELECTABLE_TABLE_JSON="$SCRATCH/v3014-selectable-table-result.json"
V3014_CAPTION_LINK_JSON="$SCRATCH/v3014-caption-link-result.json"
V3014_VISUAL_CANDIDATE_JSON="$SCRATCH/v3014-visual-candidate-result.json"
V3014_VISUAL_FUSION_JSON="$SCRATCH/v3014-visual-fusion-result.json"
V3014_DOCUMENT_AST_VISUAL_FUSION_JSON="$SCRATCH/v3014-document-ast-visual-fusion-result.json"
V3014_READ_OCR_JSON="$SCRATCH/v3014-read-ocr-result.json"
V3014_READ_OCR_RESIDUAL_JSON="$SCRATCH/v3014-read-ocr-residual-result.json"
V3014_OCR_TSV_JSON="$SCRATCH/v3014-ocr-tsv-result.json"
V3014_OCR_TABLE_MERGE_JSON="$SCRATCH/v3014-ocr-table-merge-result.json"
V3014_OCR_SEARCH_RESIDUAL_JSON="$SCRATCH/v3014-ocr-search-residual-result.json"
V3014_OCR_SEARCH_INTERLEAVE_JSON="$SCRATCH/v3014-ocr-search-interleave-result.json"
V3014_URL_SINGLE_FETCH_JSON="$SCRATCH/v3014-url-single-fetch-result.json"
V3014_OCR_SEARCH_TSV_JSON="$SCRATCH/v3014-ocr-search-tsv-result.json"
V3014_SEARCH_MULTIWORD_GEOMETRY_JSON="$SCRATCH/v3014-search-multiword-geometry-result.json"
V3014_FORM_RESIDUAL_JSON="$SCRATCH/v3014-form-residual-result.json"
V3014_FORM_RADIO_GROUP_JSON="$SCRATCH/v3014-form-radio-group-result.json"
V3014_ATTACHMENT_RESIDUAL_JSON="$SCRATCH/v3014-attachment-residual-result.json"
V3014_MARKINFO_RESIDUAL_JSON="$SCRATCH/v3014-markinfo-residual-result.json"
V3014_FORM_PARENT_CHILD_JSON="$SCRATCH/v3014-form-parent-child-result.json"
V3014_ANNOTATION_RESIDUAL_JSON="$SCRATCH/v3014-annotation-residual-result.json"
V3014_ANNOTATION_DEST_RESIDUAL_JSON="$SCRATCH/v3014-annotation-dest-residual-result.json"
V3014_ANNOTATION_ACTION_DEST_RESIDUAL_JSON="$SCRATCH/v3014-annotation-action-dest-residual-result.json"
V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_JSON="$SCRATCH/v3014-annotation-action-precedence-residual-result.json"
V3014_INFO_FLAGS_RESIDUAL_JSON="$SCRATCH/v3014-info-flags-residual-result.json"
V3014_PAGE_GEOMETRY_RESIDUAL_JSON="$SCRATCH/v3014-page-geometry-residual-result.json"
V3014_PAGE_LABELS_RESIDUAL_JSON="$SCRATCH/v3014-page-labels-residual-result.json"
V3014_OUTLINE_RESIDUAL_JSON="$SCRATCH/v3014-outline-residual-result.json"
V3014_PERMISSIONS_RESIDUAL_JSON="$SCRATCH/v3014-permissions-residual-result.json"
V3014_METADATA_PRESENCE_RESIDUAL_JSON="$SCRATCH/v3014-metadata-presence-residual-result.json"
V3014_INFO_EXTRAS_RESIDUAL_JSON="$SCRATCH/v3014-info-extras-residual-result.json"
V3014_ENCRYPT_FILTER_RESIDUAL_JSON="$SCRATCH/v3014-encrypt-filter-residual-result.json"
V3014_LINEARIZED_RESIDUAL_JSON="$SCRATCH/v3014-linearized-residual-result.json"
V3014_FORM_FLAGS_RESIDUAL_JSON="$SCRATCH/v3014-form-flags-residual-result.json"
V3014_TEXT_ANNOTATION_RESIDUAL_JSON="$SCRATCH/v3014-text-annotation-residual-result.json"
V3014_REMOTE_ACTION_RESIDUAL_JSON="$SCRATCH/v3014-remote-action-residual-result.json"
V3014_POPUP_ANNOTATION_RESIDUAL_JSON="$SCRATCH/v3014-popup-annotation-residual-result.json"
V3014_POPUP_ZERO_SIZE_RESIDUAL_JSON="$SCRATCH/v3014-popup-zero-size-residual-result.json"
V3014_POPUP_GROUP_IRT_RESIDUAL_JSON="$SCRATCH/v3014-popup-group-irt-residual-result.json"
V3014_TEXT_APPEARANCE_RESIDUAL_JSON="$SCRATCH/v3014-text-appearance-residual-result.json"
V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_JSON="$SCRATCH/v3014-text-named-appearance-residual-result.json"
V3014_TEXT_INVERTED_RECT_RESIDUAL_JSON="$SCRATCH/v3014-text-inverted-rect-residual-result.json"
V3014_REMOTE_NAMED_DEST_RESIDUAL_JSON="$SCRATCH/v3014-remote-named-dest-residual-result.json"
V3014_PAGE_LABELS_KIDS_RESIDUAL_JSON="$SCRATCH/v3014-page-labels-kids-residual-result.json"
V3014_FORM_BUTTON_ARRAY_RESIDUAL_JSON="$SCRATCH/v3014-form-button-array-residual-result.json"
V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_JSON="$SCRATCH/v3014-form-button-default-off-residual-result.json"
V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_JSON="$SCRATCH/v3014-form-pushbutton-default-null-residual-result.json"
V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_JSON="$SCRATCH/v3014-form-checkbox-as-value-residual-result.json"
V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_JSON="$SCRATCH/v3014-attachment-odd-names-residual-result.json"
V3014_FORM_UTF16_TEXT_RESIDUAL_JSON="$SCRATCH/v3014-form-utf16-text-residual-result.json"
V3014_UTF16_TEXT_RESIDUAL_JSON="$SCRATCH/v3014-utf16-text-residual-result.json"
V3014_TEXT_INVALID_AS_RESIDUAL_JSON="$SCRATCH/v3014-text-invalid-as-residual-result.json"
V3014_LINE_ANNOTATION_RESIDUAL_JSON="$SCRATCH/v3014-line-annotation-residual-result.json"
V3014_POLYLINE_POLYGON_RESIDUAL_JSON="$SCRATCH/v3014-polyline-polygon-residual-result.json"
V3014_INK_ANNOTATION_RESIDUAL_JSON="$SCRATCH/v3014-ink-annotation-residual-result.json"
V3014_BORDER_WIDTH_CLAMP_RESIDUAL_JSON="$SCRATCH/v3014-border-width-clamp-residual-result.json"
V3014_BORDER_ARRAY_WIDTH_RESIDUAL_JSON="$SCRATCH/v3014-border-array-width-residual-result.json"
V3014_BORDER_BS_PREFERENCE_RESIDUAL_JSON="$SCRATCH/v3014-border-bs-preference-residual-result.json"
V3014_BORDER_BS_NONDICT_RESIDUAL_JSON="$SCRATCH/v3014-border-bs-nondict-residual-result.json"
V3014_BORDER_ARRAY_SHORT_RESIDUAL_JSON="$SCRATCH/v3014-border-array-short-residual-result.json"
V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_JSON="$SCRATCH/v3014-border-bs-wrong-type-residual-result.json"
V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_JSON="$SCRATCH/v3014-border-zero-size-clamp-bypass-residual-result.json"
V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_JSON="$SCRATCH/v3014-annotation-appearance-bbox-residual-result.json"
V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_JSON="$SCRATCH/v3014-annotation-ap-nonstream-residual-result.json"
V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_JSON="$SCRATCH/v3014-annotation-ap-named-state-residual-result.json"
V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_JSON="$SCRATCH/v3014-annotation-ap-named-state-polyline-ink-residual-result.json"
V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_JSON="$SCRATCH/v3014-annotation-ap-named-state-square-circle-residual-result.json"
V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_JSON="$SCRATCH/v3014-annotation-highlight-quadpoints-residual-result.json"
V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_JSON="$SCRATCH/v3014-annotation-text-markup-quadpoints-residual-result.json"
V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_JSON="$SCRATCH/v3014-annotation-text-markup-with-ap-residual-result.json"
V3014_VISUAL_JSON="$SCRATCH/v3014-visual-result.json"
SLICE_FILTER="all"
: >"$LOG"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slice)
      SLICE_FILTER="${2:-}"
      shift 2
      ;;
    *)
      echo "::error::unknown argument: $1" | tee -a "$LOG"
      exit 1
      ;;
  esac
done

case "$SLICE_FILTER" in
  all|tool.read_pdf|'tool.search_pdf|tool.pdf_evidence'|transport.stdio-rust-rmcp) ;;
  *)
    echo "::error::invalid --slice value: $SLICE_FILTER" | tee -a "$LOG"
    exit 1
    ;;
esac

cd "$REPO_ROOT"

if ! command -v bun >/dev/null 2>&1; then
  echo "::error::bun required for pdf-reader-mcp differential parity — no SKIP-as-pass" | tee -a "$LOG"
  exit 1
fi

echo "=== pdf-reader-mcp bounded differential parity $(date -Iseconds) slice=$SLICE_FILTER ===" | tee -a "$LOG"

echo "--- build Rust artifacts ---" | tee -a "$LOG"
bun run build:rust 2>&1 | tee -a "$LOG"

DROP_IN="$(jq -r '.productTruth.dropInFor3014' "$REPO_ROOT/docs/specs/pure-rust-capability-matrix.json")"
if [[ "$DROP_IN" == "true" ]]; then
  echo "--- final TS retirement gate ---" | tee -a "$LOG"
  bash "$REPO_ROOT/scripts/check-no-ts-stdio-backend.sh" 2>&1 | tee -a "$LOG"
else
  echo "--- recovery phase: TS production runtime must remain present ---" | tee -a "$LOG"
  test -f "$REPO_ROOT/src/index.ts" || {
    echo "::error::src/index.ts missing before dropInFor3014 is proven" | tee -a "$LOG"
    exit 1
  }
fi

echo "--- immutable TypeScript v3.0.14 input contract oracle ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/check-v3014-input-schema-oracle.ts" 2>&1 | tee -a "$LOG"

echo "--- deterministic v3.0.14 behavior fixtures + baseline replay ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/generate-v3014-behavior-fixtures.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-behavior-oracle.ts" 2>&1 | tee -a "$LOG"

echo "--- immutable v3.0.14 behavior differential (14 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-behavior-differential.ts" \
  --output "$V3014_BEHAVIOR_JSON" >>"$LOG"

echo "--- immutable v3.0.14 selectable-text layer/element/chunk geometry differential (1 exact case) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-text-layer-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-text-layer-differential.ts" \
  --output "$V3014_TEXT_LAYER_JSON" >>"$LOG"

echo "--- immutable v3.0.14 selectable-text segmentation/geometry differential (4 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/generate-v3014-selectable-text-segmentation-fixture.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-selectable-text-segmentation-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-selectable-text-segmentation-differential.ts" \
  --output "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON" >>"$LOG"

echo "--- immutable v3.0.14 command-provider OCR-search differential (15 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-ocr-search-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-ocr-search-differential.ts" \
  --output "$V3014_OCR_SEARCH_JSON" >>"$LOG"

echo "--- immutable v3.0.14 citation-chunk schema/boundary/dependency differential (6 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/generate-v3014-citation-chunk-fixture.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-citation-chunk-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-citation-chunk-differential.ts" \
  --output "$V3014_CITATION_CHUNK_JSON" >>"$LOG"

echo "--- immutable v3.0.14 semantic-hint classifier/chunk propagation differential (3 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/generate-v3014-semantic-hint-fixture.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-semantic-hint-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-semantic-hint-differential.ts" \
  --output "$V3014_SEMANTIC_HINT_JSON" >>"$LOG"

echo "--- immutable v3.0.14 text-only document-AST hierarchy/cache/warning differential (6 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/generate-v3014-document-ast-fixture.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-document-ast-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-document-ast-differential.ts" \
  --output "$V3014_DOCUMENT_AST_JSON" >>"$LOG"

echo "--- immutable v3.0.14 text-first document-map envelope/cache/routing differential (8 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/generate-v3014-document-map-fixture.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-document-map-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-document-map-differential.ts" \
  --output "$V3014_DOCUMENT_MAP_JSON" >>"$LOG"

echo "--- immutable v3.0.14 bounded trust-report envelope/dependency/redaction/linkage differential (9 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/generate-v3014-trust-report-fixture.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-trust-report-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-trust-report-differential.ts" \
  --output "$V3014_TRUST_REPORT_JSON" >>"$LOG"

echo "--- immutable v3.0.14 selectable-table/downstream-linkage differential (6 exact cases + hostile cap) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/generate-v3014-selectable-table-fixture.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-selectable-table-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-selectable-table-differential.ts" \
  --output "$V3014_SELECTABLE_TABLE_JSON" >>"$LOG"

echo "--- immutable v3.0.14 selectable-table caption-link differential (6 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/generate-v3014-caption-link-fixture.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-caption-link-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-caption-link-differential.ts" \
  --output "$V3014_CAPTION_LINK_JSON" >>"$LOG"

echo "--- immutable v3.0.14 provider-independent visual-candidate differential (11 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/generate-v3014-visual-candidate-fixtures.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-visual-candidate-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-visual-candidate-differential.ts" \
  --output "$V3014_VISUAL_CANDIDATE_JSON" >>"$LOG"

echo "--- immutable v3.0.14 configured-command visual-fusion differential (5 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-visual-fusion-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-visual-fusion-differential.ts" \
  --output "$V3014_VISUAL_FUSION_JSON" >>"$LOG"

echo "--- immutable v3.0.14 configured-command document-ast visual-fusion differential (5 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-document-ast-visual-fusion-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-document-ast-visual-fusion-differential.ts" \
  --output "$V3014_DOCUMENT_AST_VISUAL_FUSION_JSON" >>"$LOG"

echo "--- immutable v3.0.14 read_pdf include_ocr_text_layer differential (6 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-read-ocr-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-read-ocr-differential.ts" \
  --output "$V3014_READ_OCR_JSON" >>"$LOG"

echo "--- immutable v3.0.14 read_pdf OCR residual differential (3 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-read-ocr-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-read-ocr-residual-differential.ts" \
  --output "$V3014_READ_OCR_RESIDUAL_JSON" >>"$LOG"

echo "--- immutable v3.0.14 tesseract-tsv OCR differential (2 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-ocr-tsv-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-ocr-tsv-differential.ts" \
  --output "$V3014_OCR_TSV_JSON" >>"$LOG"

echo "--- immutable v3.0.14 mixed selectable/OCR table merge differential (3 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-ocr-table-merge-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-ocr-table-merge-differential.ts" \
  --output "$V3014_OCR_TABLE_MERGE_JSON" >>"$LOG"

echo "--- immutable v3.0.14 OCR-search residual differential (4 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-ocr-search-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-ocr-search-residual-differential.ts" \
  --output "$V3014_OCR_SEARCH_RESIDUAL_JSON" >>"$LOG"

echo "--- immutable v3.0.14 OCR-search selectable/OCR interleave differential (4 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-ocr-search-interleave-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-ocr-search-interleave-differential.ts" \
  --output "$V3014_OCR_SEARCH_INTERLEAVE_JSON" >>"$LOG"

echo "--- immutable v3.0.14 URL single-fetch differential (2 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-url-single-fetch-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-url-single-fetch-differential.ts" \
  --output "$V3014_URL_SINGLE_FETCH_JSON" >>"$LOG"

echo "--- immutable v3.0.14 OCR-search tesseract-tsv differential (2 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-ocr-search-tsv-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-ocr-search-tsv-differential.ts" \
  --output "$V3014_OCR_SEARCH_TSV_JSON" >>"$LOG"

echo "--- immutable v3.0.14 search multiword geometry differential (3 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-search-multiword-geometry-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-search-multiword-geometry-differential.ts" \
  --output "$V3014_SEARCH_MULTIWORD_GEOMETRY_JSON" >>"$LOG"

echo "--- immutable v3.0.14 form residual differential (2 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-form-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-form-residual-differential.ts" \
  --output "$V3014_FORM_RESIDUAL_JSON" >>"$LOG"

echo "--- immutable v3.0.14 form radio-group differential (2 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-form-radio-group-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-form-radio-group-differential.ts" \
  --output "$V3014_FORM_RADIO_GROUP_JSON" >>"$LOG"

echo "--- immutable v3.0.14 attachment residual differential (2 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-attachment-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-attachment-residual-differential.ts" \
  --output "$V3014_ATTACHMENT_RESIDUAL_JSON" >>"$LOG"

echo "--- immutable v3.0.14 markinfo residual differential (3 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-markinfo-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-markinfo-residual-differential.ts" \
  --output "$V3014_MARKINFO_RESIDUAL_JSON" >>"$LOG"

echo "--- immutable v3.0.14 form parent-child differential (2 exact cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-form-parent-child-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-form-parent-child-differential.ts" \
  --output "$V3014_FORM_PARENT_CHILD_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-residual-differential.ts" \
  --output "$V3014_ANNOTATION_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-dest-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-dest-residual-differential.ts" \
  --output "$V3014_ANNOTATION_DEST_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-action-dest-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-action-dest-residual-differential.ts" \
  --output "$V3014_ANNOTATION_ACTION_DEST_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-action-precedence-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-action-precedence-residual-differential.ts" \
  --output "$V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-info-flags-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-info-flags-residual-differential.ts" \
  --output "$V3014_INFO_FLAGS_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-page-geometry-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-page-geometry-residual-differential.ts" \
  --output "$V3014_PAGE_GEOMETRY_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-page-labels-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-page-labels-residual-differential.ts" \
  --output "$V3014_PAGE_LABELS_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-outline-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-outline-residual-differential.ts" \
  --output "$V3014_OUTLINE_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-permissions-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-permissions-residual-differential.ts" \
  --output "$V3014_PERMISSIONS_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-metadata-presence-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-metadata-presence-residual-differential.ts" \
  --output "$V3014_METADATA_PRESENCE_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-info-extras-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-info-extras-residual-differential.ts" \
  --output "$V3014_INFO_EXTRAS_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-encrypt-filter-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-encrypt-filter-residual-differential.ts" \
  --output "$V3014_ENCRYPT_FILTER_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-linearized-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-linearized-residual-differential.ts" \
  --output "$V3014_LINEARIZED_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-form-flags-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-form-flags-residual-differential.ts" \
  --output "$V3014_FORM_FLAGS_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-text-annotation-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-text-annotation-residual-differential.ts" \
  --output "$V3014_TEXT_ANNOTATION_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-remote-action-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-remote-action-residual-differential.ts" \
  --output "$V3014_REMOTE_ACTION_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-popup-annotation-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-popup-annotation-residual-differential.ts" \
  --output "$V3014_POPUP_ANNOTATION_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-popup-zero-size-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-popup-zero-size-residual-differential.ts" \
  --output "$V3014_POPUP_ZERO_SIZE_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-popup-group-irt-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-popup-group-irt-residual-differential.ts" \
  --output "$V3014_POPUP_GROUP_IRT_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-text-appearance-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-text-appearance-residual-differential.ts" \
  --output "$V3014_TEXT_APPEARANCE_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-text-named-appearance-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-text-named-appearance-residual-differential.ts" \
  --output "$V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-text-inverted-rect-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-text-inverted-rect-residual-differential.ts" \
  --output "$V3014_TEXT_INVERTED_RECT_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-remote-named-dest-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-remote-named-dest-residual-differential.ts" \
  --output "$V3014_REMOTE_NAMED_DEST_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-page-labels-kids-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-page-labels-kids-residual-differential.ts" \
  --output "$V3014_PAGE_LABELS_KIDS_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-form-button-array-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-form-button-array-residual-differential.ts" \
  --output "$V3014_FORM_BUTTON_ARRAY_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-form-button-default-off-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-form-button-default-off-residual-differential.ts" \
  --output "$V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-form-pushbutton-default-null-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-form-pushbutton-default-null-residual-differential.ts" \
  --output "$V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-form-checkbox-as-value-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-form-checkbox-as-value-residual-differential.ts" \
  --output "$V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-attachment-odd-names-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-attachment-odd-names-residual-differential.ts" \
  --output "$V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-form-utf16-text-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-form-utf16-text-residual-differential.ts" \
  --output "$V3014_FORM_UTF16_TEXT_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-utf16-text-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-utf16-text-residual-differential.ts" \
  --output "$V3014_UTF16_TEXT_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-text-invalid-as-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-text-invalid-as-residual-differential.ts" \
  --output "$V3014_TEXT_INVALID_AS_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-line-annotation-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-line-annotation-residual-differential.ts" \
  --output "$V3014_LINE_ANNOTATION_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-polyline-polygon-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-polyline-polygon-residual-differential.ts" \
  --output "$V3014_POLYLINE_POLYGON_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-ink-annotation-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-ink-annotation-residual-differential.ts" \
  --output "$V3014_INK_ANNOTATION_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-border-width-clamp-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-border-width-clamp-residual-differential.ts" \
  --output "$V3014_BORDER_WIDTH_CLAMP_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-border-array-width-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-border-array-width-residual-differential.ts" \
  --output "$V3014_BORDER_ARRAY_WIDTH_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-border-bs-preference-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-border-bs-preference-residual-differential.ts" \
  --output "$V3014_BORDER_BS_PREFERENCE_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-border-bs-nondict-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-border-bs-nondict-residual-differential.ts" \
  --output "$V3014_BORDER_BS_NONDICT_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-border-array-short-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-border-array-short-residual-differential.ts" \
  --output "$V3014_BORDER_ARRAY_SHORT_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-border-bs-wrong-type-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-border-bs-wrong-type-residual-differential.ts" \
  --output "$V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-border-zero-size-clamp-bypass-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-border-zero-size-clamp-bypass-residual-differential.ts" \
  --output "$V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-appearance-bbox-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-appearance-bbox-residual-differential.ts" \
  --output "$V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-ap-nonstream-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-ap-nonstream-residual-differential.ts" \
  --output "$V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_JSON" >>"$LOG"

bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-ap-named-state-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-ap-named-state-residual-differential.ts" \
  --output "$V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-ap-named-state-polyline-ink-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-ap-named-state-polyline-ink-residual-differential.ts" \
  --output "$V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-ap-named-state-square-circle-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-ap-named-state-square-circle-residual-differential.ts" \
  --output "$V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-highlight-quadpoints-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-highlight-quadpoints-residual-differential.ts" \
  --output "$V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-text-markup-quadpoints-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-text-markup-quadpoints-residual-differential.ts" \
  --output "$V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_JSON" >>"$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-annotation-text-markup-with-ap-residual-oracle.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-annotation-text-markup-with-ap-residual-differential.ts" \
  --output "$V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_JSON" >>"$LOG"

echo "--- deterministic v3.0.14 visual fixture + baseline replay ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/generate-v3014-visual-fixtures.ts" 2>&1 | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/capture-v3014-visual-oracle.ts" 2>&1 | tee -a "$LOG"

echo "--- immutable v3.0.14 render/crop/OCR/analyze/read-fusion differential (16 semantic cases) ---" | tee -a "$LOG"
bun "$REPO_ROOT/scripts/differential/check-v3014-visual-differential.ts" \
  --output "$V3014_VISUAL_JSON" >>"$LOG"

echo "--- live TypeScript handler -> Rust text claimed-subset check ---" | tee -a "$LOG"
env -u PDF_READER_USE_RUST_TEXT_SEARCH -u PDF_READER_ENGINE_MODE \
  bun "$REPO_ROOT/scripts/differential/ts-vs-rust-text-oracle.ts" \
  >"$TEXT_DIFFERENTIAL_JSON" 2>>"$LOG"

echo "--- Rust structural golden + stdio consistency check (not a TS behavioral oracle) ---" | tee -a "$LOG"
bun run "$REPO_ROOT/scripts/differential/pdf-reader-mcp-oracle.ts" >"$ORACLE_JSON" 2>>"$LOG"

echo "--- Rust native differential test (slice=$SLICE_FILTER) ---" | tee -a "$LOG"
PDF_READER_MCP_ORACLE_JSON="$ORACLE_JSON" \
PDF_READER_MCP_SLICE_FILTER="$SLICE_FILTER" \
  cargo test -p pdf-reader-mcp-server --test pdf_reader_mcp_differential pdf_reader_mcp_differential_matches_ts_oracle -- --nocapture 2>&1 | tee -a "$LOG"

CANDIDATE_SHA="${CANDIDATE_SHA:-$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)}"
BASELINE_TS_SHA="$(git -C "$REPO_ROOT" rev-list -n 1 v3.0.14 2>/dev/null || echo unknown)"
RUST_SHA="$CANDIDATE_SHA"
BEHAVIOR_SPEC_HASH="$(sha256sum \
  "$REPO_ROOT/scripts/differential/fixtures/pdf-reader-mcp-corpus.json" \
  "$REPO_ROOT/test/fixtures/read-pdf-golden.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-behavior-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-behavior-oracle.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-behavior-fixtures.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-layer-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-layer-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-selectable-text-segmentation-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-selectable-text-segmentation-projection.ts" \
  "$REPO_ROOT/scripts/differential/generate-v3014-selectable-text-segmentation-fixture.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-selectable-text-segmentation-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-selectable-text-segmentation-oracle.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-selectable-text-segmentation-fixture.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-selectable-text-segmentation-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-search-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-search-projection.ts" \
  "$REPO_ROOT/scripts/differential/reference-ocr-provider.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-search-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-search-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-visual-v1.pdf" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-citation-chunk-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-citation-chunk-oracle.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-citation-chunk-fixture.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-semantic-hint-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-semantic-hint-oracle.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-semantic-hint-fixture.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-document-ast-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-document-ast-oracle.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-document-ast-fixture.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-document-map-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-document-map-oracle.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-document-map-fixture.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-trust-report-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-trust-report-oracle.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-trust-report-fixture.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-selectable-table-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-selectable-table-oracle.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-selectable-table-fixture.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-caption-link-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-caption-link-oracle.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-caption-link-fixture.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-visual-candidate-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-visual-candidate-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-visual-fusion-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-visual-fusion-projection.ts" \
  "$REPO_ROOT/scripts/differential/reference-visual-fusion-provider.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-visual-fusion-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-visual-fusion-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-document-ast-visual-fusion-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-document-ast-visual-fusion-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-document-ast-visual-fusion-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-document-ast-visual-fusion-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-read-ocr-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-read-ocr-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-read-ocr-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-read-ocr-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-read-ocr-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-read-ocr-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/reference-ocr-residual-provider.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-read-ocr-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-read-ocr-residual-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-tsv-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-tsv-projection.ts" \
  "$REPO_ROOT/scripts/differential/reference-ocr-tsv-provider.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-tsv-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-tsv-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-table-merge-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-table-merge-projection.ts" \
  "$REPO_ROOT/scripts/differential/reference-ocr-table-merge-provider.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-table-merge-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-table-merge-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-search-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-search-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/reference-ocr-search-residual-provider.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-search-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-search-residual-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-search-interleave-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-search-interleave-projection.ts" \
  "$REPO_ROOT/scripts/differential/reference-ocr-search-interleave-provider.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-search-interleave-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-search-interleave-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-url-single-fetch-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-url-single-fetch-projection.ts" \
  "$REPO_ROOT/scripts/differential/url-single-fetch-fixture-server.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-url-single-fetch-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-url-single-fetch-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-search-tsv-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-ocr-search-tsv-projection.ts" \
  "$REPO_ROOT/scripts/differential/reference-ocr-search-tsv-provider.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-search-tsv-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ocr-search-tsv-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-search-multiword-geometry-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-search-multiword-geometry-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-search-multiword-geometry-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-search-multiword-geometry-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-form-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-form-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-residual-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-coercion-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-form-radio-group-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-form-radio-group-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-radio-group-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-radio-group-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-radio-group-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-radio-group-three-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-attachment-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-attachment-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-attachment-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-attachment-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-attachment-kids-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-attachment-filename-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-markinfo-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-markinfo-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-markinfo-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-markinfo-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-markinfo-nonbool-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-markinfo-alltrue-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-markinfo-empty-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-form-parent-child-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-form-parent-child-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-parent-child-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-parent-child-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-parent-child-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-parent-readonly-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-link-freetext-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-text-content-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-dest-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-dest-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-dest-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-dest-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-dest-fit-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-dest-xyz-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-action-dest-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-action-dest-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-action-dest-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-action-dest-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-named-dest-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-goto-action-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-action-precedence-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-action-precedence-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-action-precedence-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-action-precedence-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-goto-over-dest-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-uri-over-dest-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-launch-file-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-info-flags-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-info-flags-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-info-flags-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-info-flags-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-info-flags-acroform-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-info-flags-plain-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-page-geometry-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-page-geometry-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-page-geometry-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-page-geometry-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-page-geometry-rotate-userunit-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-page-geometry-default-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-page-geometry-inverted-mediabox-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-page-labels-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-page-labels-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-page-labels-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-page-labels-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-page-labels-multi-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-page-labels-prefix-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-page-labels-none-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-outline-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-outline-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-outline-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-outline-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-outline-uri-child-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-outline-fith-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-outline-none-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-permissions-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-permissions-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-permissions-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-permissions-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-permissions-print-copy-fill-a11y-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-permissions-modify-annotate-assemble-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-permissions-print-hq-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-permissions-none-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-metadata-presence-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-metadata-presence-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-metadata-presence-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-metadata-presence-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-metadata-absent-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-metadata-present-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-info-extras-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-info-extras-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-info-extras-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-info-extras-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-info-flags-acroform-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-info-flags-plain-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-encrypt-filter-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-encrypt-filter-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-encrypt-filter-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-encrypt-filter-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-permissions-print-copy-fill-a11y-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-permissions-none-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-linearized-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-linearized-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-linearized-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-linearized-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-info-linearized-valid-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-info-linearized-spurious-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-info-linearized-absent-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-form-flags-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-form-flags-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-flags-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-flags-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-info-xfa-present-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-info-collection-present-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-info-signatures-present-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-info-signatures-invisible-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-text-annotation-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-text-annotation-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-annotation-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-annotation-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-text-noap-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-freetext-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-remote-action-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-remote-action-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-remote-action-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-remote-action-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-launch-file-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-launch-filedict-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-gotor-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-popup-annotation-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-popup-annotation-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-popup-annotation-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-popup-annotation-residual-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-popup-zero-size-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-popup-zero-size-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-popup-zero-size-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-popup-zero-size-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-popup-zerosize-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-popup-group-irt-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-popup-group-irt-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-popup-group-irt-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-popup-group-irt-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-popup-group-irt-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-text-appearance-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-text-appearance-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-appearance-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-appearance-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-text-ap-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-text-emptyap-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-text-named-appearance-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-text-named-appearance-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-named-appearance-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-named-appearance-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-text-namedap-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-text-namedap-noas-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-text-inverted-rect-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-text-inverted-rect-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-inverted-rect-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-inverted-rect-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-text-inverted-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-remote-named-dest-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-remote-named-dest-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-remote-named-dest-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-remote-named-dest-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-gotor-named-string-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-gotor-named-name-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-page-labels-kids-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-page-labels-kids-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-page-labels-kids-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-page-labels-kids-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-page-labels-kids-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-form-button-array-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-form-button-array-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-button-array-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-button-array-residual-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-form-button-default-off-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-form-button-default-off-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-button-default-off-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-button-default-off-residual-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-form-pushbutton-default-null-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-form-pushbutton-default-null-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-pushbutton-default-null-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-pushbutton-default-null-residual-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-form-checkbox-as-value-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-form-checkbox-as-value-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-checkbox-as-value-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-checkbox-as-value-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-checkbox-as-overrides-v-off-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-checkbox-as-overrides-v-yes-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-checkbox-as-noap-keeps-v-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-pushbutton-ap-default-null-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-pushbutton-noap-default-null-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-checkbox-ap-default-off-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-radio-ap-default-off-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-checkbox-noap-default-null-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-button-array-v-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-button-array-dv-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-attachment-odd-names-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-attachment-odd-names-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-attachment-odd-names-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-attachment-odd-names-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-attachment-odd-names-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-attachment-odd-names-pair-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-form-utf16-text-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-form-utf16-text-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-utf16-text-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-form-utf16-text-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-utf16-odd-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-form-utf8-bom-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-utf16-text-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-utf16-text-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-utf16-text-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-utf16-text-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annot-utf16-odd-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-freetext-utf16-odd-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-catalog-utf16-odd-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-text-invalid-as-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-text-invalid-as-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-invalid-as-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-text-invalid-as-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-text-namedap-badas-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-text-namedap-as-nonstream-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-line-annotation-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-line-annotation-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-line-annotation-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-line-annotation-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-default-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-l-bbox-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-border2-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-polyline-polygon-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-polyline-polygon-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-polyline-polygon-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-polyline-polygon-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-l-bbox-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polygon-l-bbox-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-border2-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-ink-annotation-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-ink-annotation-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ink-annotation-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-ink-annotation-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-l-bbox-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-multistroke-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-border2-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-border-width-clamp-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-border-width-clamp-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-width-clamp-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-width-clamp-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-clamp-w2-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-clamp-w2-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-clamp-w2-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-border-array-width-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-border-array-width-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-array-width-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-array-width-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-border-array-w2-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-border-array-w2-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-border-array-w3-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-border-bs-preference-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-border-bs-preference-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-bs-preference-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-bs-preference-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-border-bs-pref-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-border-bs-pref-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-border-bs-pref-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-border-bs-nondict-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-border-bs-nondict-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-bs-nondict-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-bs-nondict-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-border-bs-null-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-border-bs-null-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-border-bs-null-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-border-array-short-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-border-array-short-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-array-short-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-array-short-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-border-short-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-border-empty-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-border-short-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-border-bs-wrong-type-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-border-bs-wrong-type-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-bs-wrong-type-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-bs-wrong-type-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-border-bs-wrong-type-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-border-bs-wrong-type-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-border-bs-wrong-type-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-border-zero-size-clamp-bypass-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-border-zero-size-clamp-bypass-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-zero-size-clamp-bypass-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-border-zero-size-clamp-bypass-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-zero-h-w2-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-zero-h-w2-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-zero-w-w2-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-appearance-bbox-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-appearance-bbox-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-appearance-bbox-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-appearance-bbox-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-ap-bbox-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-ap-bbox-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-ap-bbox-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-ap-nonstream-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-ap-nonstream-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-ap-nonstream-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-ap-nonstream-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-ap-n-null-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-ap-n-name-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-ap-named-state-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-ap-named-state-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-ap-named-state-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-ap-named-state-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-ap-as-on-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-ap-as-missing-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-line-ap-as-invalid-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-ap-named-state-polyline-ink-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-ap-named-state-polyline-ink-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-ap-named-state-polyline-ink-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-ap-named-state-polyline-ink-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-ap-as-on-v1.pdf" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-ap-named-state-square-circle-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-ap-named-state-square-circle-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-ap-named-state-square-circle-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-ap-named-state-square-circle-residual-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-highlight-quadpoints-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-highlight-quadpoints-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-highlight-quadpoints-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-highlight-quadpoints-residual-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-text-markup-quadpoints-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-text-markup-quadpoints-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-text-markup-quadpoints-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-text-markup-quadpoints-residual-oracle.json" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-text-markup-with-ap-residual-baseline-runner.ts" \
  "$REPO_ROOT/scripts/differential/v3014-annotation-text-markup-with-ap-residual-projection.ts" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-text-markup-with-ap-residual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-annotation-text-markup-with-ap-residual-oracle.json" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-underline-ap-keeps-rect-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-squiggly-ap-keeps-rect-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-strikeout-ap-keeps-rect-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-underline-quad-noap-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-squiggly-quad-noap-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-strikeout-quad-noap-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-highlight-quad-noap-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-highlight-ap-noext-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-highlight-ap-ext-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-square-ap-as-on-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-circle-ap-as-missing-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-square-ap-as-invalid-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-ap-as-missing-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-polyline-ap-as-invalid-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-ink-ap-n-null-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-popup-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-annotation-freetext-v1.pdf" \
  "$REPO_ROOT/test/fixtures/differential/v3014-visual-candidate-v1.pdf" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-visual-candidate-fixtures.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-visual-corpus.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-visual-oracle.json" \
  "$REPO_ROOT/scripts/differential/fixtures/v3014-visual-fixtures.json" \
  2>/dev/null | awk '{print $1}' | sha256sum | awk '{print $1}' || echo missing)"
FIXTURE_CORPUS_HASH="$(jq -r '.fixtureCorpusHash' "$ORACLE_JSON")"
GOLDEN_FIXTURE_HASH="$(jq -r '.goldenFixtureHash' "$ORACLE_JSON")"
CASE_COUNT="$(jq '.cases | length' "$ORACLE_JSON")"
READ_PDF_CASE_COUNT="$(jq '[.cases[] | select(.domain == "readPdfTool")] | length' "$ORACLE_JSON")"
STDIO_PROBE_CASE_COUNT="$(jq '[.cases[] | select(.domain == "stdioProbe")] | length' "$ORACLE_JSON")"
TOOL_ROUTE_CASE_COUNT="$(jq '[.cases[] | select(.domain == "toolRouteContract")] | length' "$ORACLE_JSON")"
V3014_BEHAVIOR_CASE_COUNT="$(jq '.caseCount' "$V3014_BEHAVIOR_JSON")"
V3014_BEHAVIOR_PASSED="$(jq '.passed' "$V3014_BEHAVIOR_JSON")"
V3014_BEHAVIOR_SKIPPED="$(jq '.skipped' "$V3014_BEHAVIOR_JSON")"
V3014_BEHAVIOR_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_BEHAVIOR_JSON")"
V3014_BEHAVIOR_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_BEHAVIOR_JSON")"
V3014_TEXT_LAYER_CASE_COUNT="$(jq '.caseCount' "$V3014_TEXT_LAYER_JSON")"
V3014_TEXT_LAYER_PASSED="$(jq '.passed' "$V3014_TEXT_LAYER_JSON")"
V3014_TEXT_LAYER_SKIPPED="$(jq '.skipped' "$V3014_TEXT_LAYER_JSON")"
V3014_TEXT_LAYER_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_TEXT_LAYER_JSON")"
V3014_TEXT_LAYER_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_TEXT_LAYER_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_CASE_COUNT="$(jq '.caseCount' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_PASSED="$(jq '.passed' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_SKIPPED="$(jq '.skipped' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_RUNNER_HASH="$(jq -r '.runnerSha256' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_PROJECTION_HASH="$(jq -r '.projectionSha256' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_GENERATOR_HASH="$(jq -r '.generatorSha256' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_FIXTURE_MANIFEST_HASH="$(jq -r '.fixtureManifestSha256' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_FIXTURE_HASH="$(jq -r '.fixtureSha256' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_PROFILE="$(jq -r '.profile' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_PASS="$(jq '.pass' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_MUTATION_SENSITIVE="$(jq -c '.mutationSensitive' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_SEMANTIC_PROOF="$(jq -c '.semanticProof' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_PDFJS_OBSERVATION="$(jq -c '.pdfjsObservation' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_NONCLAIMS="$(jq -c '.nonclaims' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_SELECTABLE_TEXT_SEGMENTATION_PRODUCT_TRUTH="$(jq -c '.productTruth' "$V3014_SELECTABLE_TEXT_SEGMENTATION_JSON")"
V3014_OCR_SEARCH_CASE_COUNT="$(jq '.caseCount' "$V3014_OCR_SEARCH_JSON")"
V3014_OCR_SEARCH_PASSED="$(jq '.passed' "$V3014_OCR_SEARCH_JSON")"
V3014_OCR_SEARCH_SKIPPED="$(jq '.skipped' "$V3014_OCR_SEARCH_JSON")"
V3014_OCR_SEARCH_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_OCR_SEARCH_JSON")"
V3014_OCR_SEARCH_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_OCR_SEARCH_JSON")"
V3014_OCR_SEARCH_PROFILE="$(jq -r '.profile' "$V3014_OCR_SEARCH_JSON")"
V3014_OCR_SEARCH_PASS="$(jq '.pass' "$V3014_OCR_SEARCH_JSON")"
V3014_OCR_SEARCH_MUTATION_SENSITIVE="$(jq -c '.mutationSensitive' "$V3014_OCR_SEARCH_JSON")"
V3014_OCR_SEARCH_RESOURCE_PROOF="$(jq -c '.resourceProof' "$V3014_OCR_SEARCH_JSON")"
V3014_OCR_SEARCH_NONCLAIMS="$(jq -c '.nonclaims' "$V3014_OCR_SEARCH_JSON")"
V3014_OCR_SEARCH_PRODUCT_TRUTH="$(jq -c '.productTruth' "$V3014_OCR_SEARCH_JSON")"
V3014_CITATION_CHUNK_CASE_COUNT="$(jq '.caseCount' "$V3014_CITATION_CHUNK_JSON")"
V3014_CITATION_CHUNK_PASSED="$(jq '.passed' "$V3014_CITATION_CHUNK_JSON")"
V3014_CITATION_CHUNK_SKIPPED="$(jq '.skipped' "$V3014_CITATION_CHUNK_JSON")"
V3014_CITATION_CHUNK_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_CITATION_CHUNK_JSON")"
V3014_CITATION_CHUNK_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_CITATION_CHUNK_JSON")"
V3014_SEMANTIC_HINT_CASE_COUNT="$(jq '.caseCount' "$V3014_SEMANTIC_HINT_JSON")"
V3014_SEMANTIC_HINT_PASSED="$(jq '.passed' "$V3014_SEMANTIC_HINT_JSON")"
V3014_SEMANTIC_HINT_SKIPPED="$(jq '.skipped' "$V3014_SEMANTIC_HINT_JSON")"
V3014_SEMANTIC_HINT_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_SEMANTIC_HINT_JSON")"
V3014_SEMANTIC_HINT_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_SEMANTIC_HINT_JSON")"
V3014_DOCUMENT_AST_CASE_COUNT="$(jq '.caseCount' "$V3014_DOCUMENT_AST_JSON")"
V3014_DOCUMENT_AST_PASSED="$(jq '.passed' "$V3014_DOCUMENT_AST_JSON")"
V3014_DOCUMENT_AST_SKIPPED="$(jq '.skipped' "$V3014_DOCUMENT_AST_JSON")"
V3014_DOCUMENT_AST_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_DOCUMENT_AST_JSON")"
V3014_DOCUMENT_AST_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_DOCUMENT_AST_JSON")"
V3014_DOCUMENT_MAP_CASE_COUNT="$(jq '.caseCount' "$V3014_DOCUMENT_MAP_JSON")"
V3014_DOCUMENT_MAP_PASSED="$(jq '.passed' "$V3014_DOCUMENT_MAP_JSON")"
V3014_DOCUMENT_MAP_SKIPPED="$(jq '.skipped' "$V3014_DOCUMENT_MAP_JSON")"
V3014_DOCUMENT_MAP_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_DOCUMENT_MAP_JSON")"
V3014_DOCUMENT_MAP_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_DOCUMENT_MAP_JSON")"
V3014_TRUST_REPORT_CASE_COUNT="$(jq '.caseCount' "$V3014_TRUST_REPORT_JSON")"
V3014_TRUST_REPORT_PASSED="$(jq '.passed' "$V3014_TRUST_REPORT_JSON")"
V3014_TRUST_REPORT_SKIPPED="$(jq '.skipped' "$V3014_TRUST_REPORT_JSON")"
V3014_TRUST_REPORT_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_TRUST_REPORT_JSON")"
V3014_TRUST_REPORT_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_TRUST_REPORT_JSON")"
V3014_SELECTABLE_TABLE_CASE_COUNT="$(jq '.caseCount' "$V3014_SELECTABLE_TABLE_JSON")"
V3014_SELECTABLE_TABLE_PASSED="$(jq '.passed' "$V3014_SELECTABLE_TABLE_JSON")"
V3014_SELECTABLE_TABLE_SKIPPED="$(jq '.skipped' "$V3014_SELECTABLE_TABLE_JSON")"
V3014_SELECTABLE_TABLE_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_SELECTABLE_TABLE_JSON")"
V3014_SELECTABLE_TABLE_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_SELECTABLE_TABLE_JSON")"
V3014_CAPTION_LINK_CASE_COUNT="$(jq '.caseCount' "$V3014_CAPTION_LINK_JSON")"
V3014_CAPTION_LINK_PASSED="$(jq '.passed' "$V3014_CAPTION_LINK_JSON")"
V3014_CAPTION_LINK_SKIPPED="$(jq '.skipped' "$V3014_CAPTION_LINK_JSON")"
V3014_CAPTION_LINK_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_CAPTION_LINK_JSON")"
V3014_CAPTION_LINK_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_CAPTION_LINK_JSON")"
V3014_VISUAL_CANDIDATE_CASE_COUNT="$(jq '.caseCount' "$V3014_VISUAL_CANDIDATE_JSON")"
V3014_VISUAL_CANDIDATE_PASSED="$(jq '.passed' "$V3014_VISUAL_CANDIDATE_JSON")"
V3014_VISUAL_CANDIDATE_SKIPPED="$(jq '.skipped' "$V3014_VISUAL_CANDIDATE_JSON")"
V3014_VISUAL_CANDIDATE_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_VISUAL_CANDIDATE_JSON")"
V3014_VISUAL_CANDIDATE_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_VISUAL_CANDIDATE_JSON")"
V3014_VISUAL_FUSION_CASE_COUNT="$(jq '.caseCount' "$V3014_VISUAL_FUSION_JSON")"
V3014_VISUAL_FUSION_PASSED="$(jq '.passed' "$V3014_VISUAL_FUSION_JSON")"
V3014_VISUAL_FUSION_SKIPPED="$(jq '.skipped' "$V3014_VISUAL_FUSION_JSON")"
V3014_VISUAL_FUSION_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_VISUAL_FUSION_JSON")"
V3014_VISUAL_FUSION_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_VISUAL_FUSION_JSON")"
V3014_DOCUMENT_AST_VISUAL_FUSION_CASE_COUNT="$(jq '.caseCount' "$V3014_DOCUMENT_AST_VISUAL_FUSION_JSON")"
V3014_DOCUMENT_AST_VISUAL_FUSION_PASSED="$(jq '.passed' "$V3014_DOCUMENT_AST_VISUAL_FUSION_JSON")"
V3014_DOCUMENT_AST_VISUAL_FUSION_SKIPPED="$(jq '.skipped' "$V3014_DOCUMENT_AST_VISUAL_FUSION_JSON")"
V3014_DOCUMENT_AST_VISUAL_FUSION_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_DOCUMENT_AST_VISUAL_FUSION_JSON")"
V3014_DOCUMENT_AST_VISUAL_FUSION_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_DOCUMENT_AST_VISUAL_FUSION_JSON")"
V3014_READ_OCR_CASE_COUNT="$(jq '.caseCount' "$V3014_READ_OCR_JSON")"
V3014_READ_OCR_PASSED="$(jq '.passed' "$V3014_READ_OCR_JSON")"
V3014_READ_OCR_SKIPPED="$(jq '.skipped' "$V3014_READ_OCR_JSON")"
V3014_READ_OCR_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_READ_OCR_JSON")"
V3014_READ_OCR_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_READ_OCR_JSON")"
V3014_READ_OCR_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_READ_OCR_RESIDUAL_JSON")"
V3014_READ_OCR_RESIDUAL_PASSED="$(jq '.passed' "$V3014_READ_OCR_RESIDUAL_JSON")"
V3014_READ_OCR_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_READ_OCR_RESIDUAL_JSON")"
V3014_READ_OCR_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_READ_OCR_RESIDUAL_JSON")"
V3014_READ_OCR_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_READ_OCR_RESIDUAL_JSON")"
V3014_OCR_TSV_CASE_COUNT="$(jq '.caseCount' "$V3014_OCR_TSV_JSON")"
V3014_OCR_TSV_PASSED="$(jq '.passed' "$V3014_OCR_TSV_JSON")"
V3014_OCR_TSV_SKIPPED="$(jq '.skipped' "$V3014_OCR_TSV_JSON")"
V3014_OCR_TSV_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_OCR_TSV_JSON")"
V3014_OCR_TSV_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_OCR_TSV_JSON")"
V3014_OCR_TABLE_MERGE_CASE_COUNT="$(jq '.caseCount' "$V3014_OCR_TABLE_MERGE_JSON")"
V3014_OCR_TABLE_MERGE_PASSED="$(jq '.passed' "$V3014_OCR_TABLE_MERGE_JSON")"
V3014_OCR_TABLE_MERGE_SKIPPED="$(jq '.skipped' "$V3014_OCR_TABLE_MERGE_JSON")"
V3014_OCR_TABLE_MERGE_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_OCR_TABLE_MERGE_JSON")"
V3014_OCR_TABLE_MERGE_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_OCR_TABLE_MERGE_JSON")"
V3014_OCR_SEARCH_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_OCR_SEARCH_RESIDUAL_JSON")"
V3014_OCR_SEARCH_RESIDUAL_PASSED="$(jq '.passed' "$V3014_OCR_SEARCH_RESIDUAL_JSON")"
V3014_OCR_SEARCH_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_OCR_SEARCH_RESIDUAL_JSON")"
V3014_OCR_SEARCH_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_OCR_SEARCH_RESIDUAL_JSON")"
V3014_OCR_SEARCH_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_OCR_SEARCH_RESIDUAL_JSON")"
V3014_OCR_SEARCH_INTERLEAVE_CASE_COUNT="$(jq '.caseCount' "$V3014_OCR_SEARCH_INTERLEAVE_JSON")"
V3014_OCR_SEARCH_INTERLEAVE_PASSED="$(jq '.passed' "$V3014_OCR_SEARCH_INTERLEAVE_JSON")"
V3014_OCR_SEARCH_INTERLEAVE_SKIPPED="$(jq '.skipped' "$V3014_OCR_SEARCH_INTERLEAVE_JSON")"
V3014_OCR_SEARCH_INTERLEAVE_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_OCR_SEARCH_INTERLEAVE_JSON")"
V3014_OCR_SEARCH_INTERLEAVE_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_OCR_SEARCH_INTERLEAVE_JSON")"
V3014_URL_SINGLE_FETCH_CASE_COUNT="$(jq '.caseCount' "$V3014_URL_SINGLE_FETCH_JSON")"
V3014_URL_SINGLE_FETCH_PASSED="$(jq '.passed' "$V3014_URL_SINGLE_FETCH_JSON")"
V3014_URL_SINGLE_FETCH_SKIPPED="$(jq '.skipped' "$V3014_URL_SINGLE_FETCH_JSON")"
V3014_URL_SINGLE_FETCH_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_URL_SINGLE_FETCH_JSON")"
V3014_URL_SINGLE_FETCH_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_URL_SINGLE_FETCH_JSON")"
V3014_OCR_SEARCH_TSV_CASE_COUNT="$(jq '.caseCount' "$V3014_OCR_SEARCH_TSV_JSON")"
V3014_OCR_SEARCH_TSV_PASSED="$(jq '.passed' "$V3014_OCR_SEARCH_TSV_JSON")"
V3014_OCR_SEARCH_TSV_SKIPPED="$(jq '.skipped' "$V3014_OCR_SEARCH_TSV_JSON")"
V3014_OCR_SEARCH_TSV_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_OCR_SEARCH_TSV_JSON")"
V3014_OCR_SEARCH_TSV_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_OCR_SEARCH_TSV_JSON")"
V3014_SEARCH_MULTIWORD_GEOMETRY_CASE_COUNT="$(jq '.caseCount' "$V3014_SEARCH_MULTIWORD_GEOMETRY_JSON")"
V3014_SEARCH_MULTIWORD_GEOMETRY_PASSED="$(jq '.passed' "$V3014_SEARCH_MULTIWORD_GEOMETRY_JSON")"
V3014_SEARCH_MULTIWORD_GEOMETRY_SKIPPED="$(jq '.skipped' "$V3014_SEARCH_MULTIWORD_GEOMETRY_JSON")"
V3014_SEARCH_MULTIWORD_GEOMETRY_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_SEARCH_MULTIWORD_GEOMETRY_JSON")"
V3014_SEARCH_MULTIWORD_GEOMETRY_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_SEARCH_MULTIWORD_GEOMETRY_JSON")"
V3014_FORM_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_FORM_RESIDUAL_JSON")"
V3014_FORM_RESIDUAL_PASSED="$(jq '.passed' "$V3014_FORM_RESIDUAL_JSON")"
V3014_FORM_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_FORM_RESIDUAL_JSON")"
V3014_FORM_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_FORM_RESIDUAL_JSON")"
V3014_FORM_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_FORM_RESIDUAL_JSON")"
V3014_FORM_RADIO_GROUP_CASE_COUNT="$(jq '.caseCount' "$V3014_FORM_RADIO_GROUP_JSON")"
V3014_FORM_RADIO_GROUP_PASSED="$(jq '.passed' "$V3014_FORM_RADIO_GROUP_JSON")"
V3014_FORM_RADIO_GROUP_SKIPPED="$(jq '.skipped' "$V3014_FORM_RADIO_GROUP_JSON")"
V3014_FORM_RADIO_GROUP_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_FORM_RADIO_GROUP_JSON")"
V3014_FORM_RADIO_GROUP_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_FORM_RADIO_GROUP_JSON")"
V3014_ATTACHMENT_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ATTACHMENT_RESIDUAL_JSON")"
V3014_ATTACHMENT_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ATTACHMENT_RESIDUAL_JSON")"
V3014_ATTACHMENT_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ATTACHMENT_RESIDUAL_JSON")"
V3014_ATTACHMENT_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ATTACHMENT_RESIDUAL_JSON")"
V3014_ATTACHMENT_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ATTACHMENT_RESIDUAL_JSON")"
V3014_MARKINFO_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_MARKINFO_RESIDUAL_JSON")"
V3014_MARKINFO_RESIDUAL_PASSED="$(jq '.passed' "$V3014_MARKINFO_RESIDUAL_JSON")"
V3014_MARKINFO_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_MARKINFO_RESIDUAL_JSON")"
V3014_MARKINFO_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_MARKINFO_RESIDUAL_JSON")"
V3014_MARKINFO_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_MARKINFO_RESIDUAL_JSON")"
V3014_FORM_PARENT_CHILD_CASE_COUNT="$(jq '.caseCount' "$V3014_FORM_PARENT_CHILD_JSON")"
V3014_FORM_PARENT_CHILD_PASSED="$(jq '.passed' "$V3014_FORM_PARENT_CHILD_JSON")"
V3014_FORM_PARENT_CHILD_SKIPPED="$(jq '.skipped' "$V3014_FORM_PARENT_CHILD_JSON")"
V3014_FORM_PARENT_CHILD_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_FORM_PARENT_CHILD_JSON")"
V3014_FORM_PARENT_CHILD_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_FORM_PARENT_CHILD_JSON")"
V3014_ANNOTATION_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_RESIDUAL_JSON")"
V3014_ANNOTATION_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_RESIDUAL_JSON")"
V3014_ANNOTATION_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_RESIDUAL_JSON")"
V3014_ANNOTATION_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_RESIDUAL_JSON")"
V3014_ANNOTATION_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_RESIDUAL_JSON")"
V3014_ANNOTATION_DEST_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_DEST_RESIDUAL_JSON")"
V3014_ANNOTATION_DEST_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_DEST_RESIDUAL_JSON")"
V3014_ANNOTATION_DEST_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_DEST_RESIDUAL_JSON")"
V3014_ANNOTATION_DEST_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_DEST_RESIDUAL_JSON")"
V3014_ANNOTATION_DEST_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_DEST_RESIDUAL_JSON")"
V3014_ANNOTATION_ACTION_DEST_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_ACTION_DEST_RESIDUAL_JSON")"
V3014_ANNOTATION_ACTION_DEST_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_ACTION_DEST_RESIDUAL_JSON")"
V3014_ANNOTATION_ACTION_DEST_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_ACTION_DEST_RESIDUAL_JSON")"
V3014_ANNOTATION_ACTION_DEST_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_ACTION_DEST_RESIDUAL_JSON")"
V3014_ANNOTATION_ACTION_DEST_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_ACTION_DEST_RESIDUAL_JSON")"
V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_JSON")"
V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_JSON")"
V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_JSON")"
V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_JSON")"
V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_JSON")"
V3014_INFO_FLAGS_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_INFO_FLAGS_RESIDUAL_JSON")"
V3014_INFO_FLAGS_RESIDUAL_PASSED="$(jq '.passed' "$V3014_INFO_FLAGS_RESIDUAL_JSON")"
V3014_INFO_FLAGS_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_INFO_FLAGS_RESIDUAL_JSON")"
V3014_INFO_FLAGS_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_INFO_FLAGS_RESIDUAL_JSON")"
V3014_INFO_FLAGS_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_INFO_FLAGS_RESIDUAL_JSON")"
V3014_PAGE_GEOMETRY_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_PAGE_GEOMETRY_RESIDUAL_JSON")"
V3014_PAGE_GEOMETRY_RESIDUAL_PASSED="$(jq '.passed' "$V3014_PAGE_GEOMETRY_RESIDUAL_JSON")"
V3014_PAGE_GEOMETRY_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_PAGE_GEOMETRY_RESIDUAL_JSON")"
V3014_PAGE_GEOMETRY_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_PAGE_GEOMETRY_RESIDUAL_JSON")"
V3014_PAGE_GEOMETRY_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_PAGE_GEOMETRY_RESIDUAL_JSON")"
V3014_PAGE_LABELS_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_PAGE_LABELS_RESIDUAL_JSON")"
V3014_PAGE_LABELS_RESIDUAL_PASSED="$(jq '.passed' "$V3014_PAGE_LABELS_RESIDUAL_JSON")"
V3014_PAGE_LABELS_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_PAGE_LABELS_RESIDUAL_JSON")"
V3014_PAGE_LABELS_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_PAGE_LABELS_RESIDUAL_JSON")"
V3014_PAGE_LABELS_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_PAGE_LABELS_RESIDUAL_JSON")"
V3014_OUTLINE_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_OUTLINE_RESIDUAL_JSON")"
V3014_OUTLINE_RESIDUAL_PASSED="$(jq '.passed' "$V3014_OUTLINE_RESIDUAL_JSON")"
V3014_OUTLINE_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_OUTLINE_RESIDUAL_JSON")"
V3014_OUTLINE_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_OUTLINE_RESIDUAL_JSON")"
V3014_OUTLINE_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_OUTLINE_RESIDUAL_JSON")"
V3014_PERMISSIONS_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_PERMISSIONS_RESIDUAL_JSON")"
V3014_PERMISSIONS_RESIDUAL_PASSED="$(jq '.passed' "$V3014_PERMISSIONS_RESIDUAL_JSON")"
V3014_PERMISSIONS_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_PERMISSIONS_RESIDUAL_JSON")"
V3014_PERMISSIONS_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_PERMISSIONS_RESIDUAL_JSON")"
V3014_PERMISSIONS_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_PERMISSIONS_RESIDUAL_JSON")"
V3014_METADATA_PRESENCE_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_METADATA_PRESENCE_RESIDUAL_JSON")"
V3014_METADATA_PRESENCE_RESIDUAL_PASSED="$(jq '.passed' "$V3014_METADATA_PRESENCE_RESIDUAL_JSON")"
V3014_METADATA_PRESENCE_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_METADATA_PRESENCE_RESIDUAL_JSON")"
V3014_METADATA_PRESENCE_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_METADATA_PRESENCE_RESIDUAL_JSON")"
V3014_METADATA_PRESENCE_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_METADATA_PRESENCE_RESIDUAL_JSON")"
V3014_INFO_EXTRAS_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_INFO_EXTRAS_RESIDUAL_JSON")"
V3014_INFO_EXTRAS_RESIDUAL_PASSED="$(jq '.passed' "$V3014_INFO_EXTRAS_RESIDUAL_JSON")"
V3014_INFO_EXTRAS_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_INFO_EXTRAS_RESIDUAL_JSON")"
V3014_INFO_EXTRAS_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_INFO_EXTRAS_RESIDUAL_JSON")"
V3014_INFO_EXTRAS_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_INFO_EXTRAS_RESIDUAL_JSON")"
V3014_ENCRYPT_FILTER_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ENCRYPT_FILTER_RESIDUAL_JSON")"
V3014_ENCRYPT_FILTER_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ENCRYPT_FILTER_RESIDUAL_JSON")"
V3014_ENCRYPT_FILTER_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ENCRYPT_FILTER_RESIDUAL_JSON")"
V3014_ENCRYPT_FILTER_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ENCRYPT_FILTER_RESIDUAL_JSON")"
V3014_ENCRYPT_FILTER_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ENCRYPT_FILTER_RESIDUAL_JSON")"
V3014_LINEARIZED_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_LINEARIZED_RESIDUAL_JSON")"
V3014_LINEARIZED_RESIDUAL_PASSED="$(jq '.passed' "$V3014_LINEARIZED_RESIDUAL_JSON")"
V3014_LINEARIZED_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_LINEARIZED_RESIDUAL_JSON")"
V3014_LINEARIZED_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_LINEARIZED_RESIDUAL_JSON")"
V3014_LINEARIZED_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_LINEARIZED_RESIDUAL_JSON")"
V3014_FORM_FLAGS_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_FORM_FLAGS_RESIDUAL_JSON")"
V3014_FORM_FLAGS_RESIDUAL_PASSED="$(jq '.passed' "$V3014_FORM_FLAGS_RESIDUAL_JSON")"
V3014_FORM_FLAGS_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_FORM_FLAGS_RESIDUAL_JSON")"
V3014_FORM_FLAGS_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_FORM_FLAGS_RESIDUAL_JSON")"
V3014_FORM_FLAGS_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_FORM_FLAGS_RESIDUAL_JSON")"
V3014_TEXT_ANNOTATION_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_TEXT_ANNOTATION_RESIDUAL_JSON")"
V3014_TEXT_ANNOTATION_RESIDUAL_PASSED="$(jq '.passed' "$V3014_TEXT_ANNOTATION_RESIDUAL_JSON")"
V3014_TEXT_ANNOTATION_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_TEXT_ANNOTATION_RESIDUAL_JSON")"
V3014_TEXT_ANNOTATION_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_TEXT_ANNOTATION_RESIDUAL_JSON")"
V3014_TEXT_ANNOTATION_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_TEXT_ANNOTATION_RESIDUAL_JSON")"
V3014_REMOTE_ACTION_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_REMOTE_ACTION_RESIDUAL_JSON")"
V3014_REMOTE_ACTION_RESIDUAL_PASSED="$(jq '.passed' "$V3014_REMOTE_ACTION_RESIDUAL_JSON")"
V3014_REMOTE_ACTION_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_REMOTE_ACTION_RESIDUAL_JSON")"
V3014_REMOTE_ACTION_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_REMOTE_ACTION_RESIDUAL_JSON")"
V3014_REMOTE_ACTION_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_REMOTE_ACTION_RESIDUAL_JSON")"
V3014_POPUP_ANNOTATION_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_POPUP_ANNOTATION_RESIDUAL_JSON")"
V3014_POPUP_ANNOTATION_RESIDUAL_PASSED="$(jq '.passed' "$V3014_POPUP_ANNOTATION_RESIDUAL_JSON")"
V3014_POPUP_ANNOTATION_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_POPUP_ANNOTATION_RESIDUAL_JSON")"
V3014_POPUP_ANNOTATION_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_POPUP_ANNOTATION_RESIDUAL_JSON")"
V3014_POPUP_ANNOTATION_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_POPUP_ANNOTATION_RESIDUAL_JSON")"
V3014_POPUP_ZERO_SIZE_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_POPUP_ZERO_SIZE_RESIDUAL_JSON")"
V3014_POPUP_ZERO_SIZE_RESIDUAL_PASSED="$(jq '.passed' "$V3014_POPUP_ZERO_SIZE_RESIDUAL_JSON")"
V3014_POPUP_ZERO_SIZE_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_POPUP_ZERO_SIZE_RESIDUAL_JSON")"
V3014_POPUP_ZERO_SIZE_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_POPUP_ZERO_SIZE_RESIDUAL_JSON")"
V3014_POPUP_ZERO_SIZE_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_POPUP_ZERO_SIZE_RESIDUAL_JSON")"
V3014_POPUP_GROUP_IRT_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_POPUP_GROUP_IRT_RESIDUAL_JSON")"
V3014_POPUP_GROUP_IRT_RESIDUAL_PASSED="$(jq '.passed' "$V3014_POPUP_GROUP_IRT_RESIDUAL_JSON")"
V3014_POPUP_GROUP_IRT_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_POPUP_GROUP_IRT_RESIDUAL_JSON")"
V3014_POPUP_GROUP_IRT_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_POPUP_GROUP_IRT_RESIDUAL_JSON")"
V3014_POPUP_GROUP_IRT_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_POPUP_GROUP_IRT_RESIDUAL_JSON")"
V3014_TEXT_APPEARANCE_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_TEXT_APPEARANCE_RESIDUAL_JSON")"
V3014_TEXT_APPEARANCE_RESIDUAL_PASSED="$(jq '.passed' "$V3014_TEXT_APPEARANCE_RESIDUAL_JSON")"
V3014_TEXT_APPEARANCE_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_TEXT_APPEARANCE_RESIDUAL_JSON")"
V3014_TEXT_APPEARANCE_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_TEXT_APPEARANCE_RESIDUAL_JSON")"
V3014_TEXT_APPEARANCE_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_TEXT_APPEARANCE_RESIDUAL_JSON")"
V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_JSON")"
V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_PASSED="$(jq '.passed' "$V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_JSON")"
V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_JSON")"
V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_JSON")"
V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_JSON")"
V3014_TEXT_INVERTED_RECT_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_TEXT_INVERTED_RECT_RESIDUAL_JSON")"
V3014_TEXT_INVERTED_RECT_RESIDUAL_PASSED="$(jq '.passed' "$V3014_TEXT_INVERTED_RECT_RESIDUAL_JSON")"
V3014_TEXT_INVERTED_RECT_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_TEXT_INVERTED_RECT_RESIDUAL_JSON")"
V3014_TEXT_INVERTED_RECT_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_TEXT_INVERTED_RECT_RESIDUAL_JSON")"
V3014_TEXT_INVERTED_RECT_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_TEXT_INVERTED_RECT_RESIDUAL_JSON")"
V3014_REMOTE_NAMED_DEST_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_REMOTE_NAMED_DEST_RESIDUAL_JSON")"
V3014_REMOTE_NAMED_DEST_RESIDUAL_PASSED="$(jq '.passed' "$V3014_REMOTE_NAMED_DEST_RESIDUAL_JSON")"
V3014_REMOTE_NAMED_DEST_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_REMOTE_NAMED_DEST_RESIDUAL_JSON")"
V3014_REMOTE_NAMED_DEST_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_REMOTE_NAMED_DEST_RESIDUAL_JSON")"
V3014_REMOTE_NAMED_DEST_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_REMOTE_NAMED_DEST_RESIDUAL_JSON")"
V3014_PAGE_LABELS_KIDS_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_PAGE_LABELS_KIDS_RESIDUAL_JSON")"
V3014_PAGE_LABELS_KIDS_RESIDUAL_PASSED="$(jq '.passed' "$V3014_PAGE_LABELS_KIDS_RESIDUAL_JSON")"
V3014_PAGE_LABELS_KIDS_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_PAGE_LABELS_KIDS_RESIDUAL_JSON")"
V3014_FORM_BUTTON_ARRAY_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_FORM_BUTTON_ARRAY_RESIDUAL_JSON")"
V3014_FORM_BUTTON_ARRAY_RESIDUAL_PASSED="$(jq '.passed' "$V3014_FORM_BUTTON_ARRAY_RESIDUAL_JSON")"
V3014_FORM_BUTTON_ARRAY_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_FORM_BUTTON_ARRAY_RESIDUAL_JSON")"
V3014_PAGE_LABELS_KIDS_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_PAGE_LABELS_KIDS_RESIDUAL_JSON")"
V3014_PAGE_LABELS_KIDS_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_PAGE_LABELS_KIDS_RESIDUAL_JSON")"
V3014_FORM_BUTTON_ARRAY_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_FORM_BUTTON_ARRAY_RESIDUAL_JSON")"
V3014_FORM_BUTTON_ARRAY_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_FORM_BUTTON_ARRAY_RESIDUAL_JSON")"
V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_JSON")"
V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_PASSED="$(jq '.passed' "$V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_JSON")"
V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_JSON")"
V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_JSON")"
V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_JSON")"
V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_JSON")"
V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_PASSED="$(jq '.passed' "$V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_JSON")"
V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_JSON")"
V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_JSON")"
V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_JSON")"
V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_JSON")"
V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_PASSED="$(jq '.passed' "$V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_JSON")"
V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_JSON")"
V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_JSON")"
V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_JSON")"
V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_JSON")"
V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_JSON")"
V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_JSON")"
V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_JSON")"
V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_JSON")"
V3014_FORM_UTF16_TEXT_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_FORM_UTF16_TEXT_RESIDUAL_JSON")"
V3014_FORM_UTF16_TEXT_RESIDUAL_PASSED="$(jq '.passed' "$V3014_FORM_UTF16_TEXT_RESIDUAL_JSON")"
V3014_FORM_UTF16_TEXT_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_FORM_UTF16_TEXT_RESIDUAL_JSON")"
V3014_FORM_UTF16_TEXT_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_FORM_UTF16_TEXT_RESIDUAL_JSON")"
V3014_FORM_UTF16_TEXT_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_FORM_UTF16_TEXT_RESIDUAL_JSON")"
V3014_UTF16_TEXT_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_UTF16_TEXT_RESIDUAL_JSON")"
V3014_UTF16_TEXT_RESIDUAL_PASSED="$(jq '.passed' "$V3014_UTF16_TEXT_RESIDUAL_JSON")"
V3014_UTF16_TEXT_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_UTF16_TEXT_RESIDUAL_JSON")"
V3014_UTF16_TEXT_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_UTF16_TEXT_RESIDUAL_JSON")"
V3014_UTF16_TEXT_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_UTF16_TEXT_RESIDUAL_JSON")"
V3014_TEXT_INVALID_AS_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_TEXT_INVALID_AS_RESIDUAL_JSON")"
V3014_TEXT_INVALID_AS_RESIDUAL_PASSED="$(jq '.passed' "$V3014_TEXT_INVALID_AS_RESIDUAL_JSON")"
V3014_TEXT_INVALID_AS_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_TEXT_INVALID_AS_RESIDUAL_JSON")"
V3014_TEXT_INVALID_AS_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_TEXT_INVALID_AS_RESIDUAL_JSON")"
V3014_TEXT_INVALID_AS_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_TEXT_INVALID_AS_RESIDUAL_JSON")"
V3014_LINE_ANNOTATION_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_LINE_ANNOTATION_RESIDUAL_JSON")"
V3014_LINE_ANNOTATION_RESIDUAL_PASSED="$(jq '.passed' "$V3014_LINE_ANNOTATION_RESIDUAL_JSON")"
V3014_LINE_ANNOTATION_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_LINE_ANNOTATION_RESIDUAL_JSON")"
V3014_LINE_ANNOTATION_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_LINE_ANNOTATION_RESIDUAL_JSON")"
V3014_LINE_ANNOTATION_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_LINE_ANNOTATION_RESIDUAL_JSON")"
V3014_POLYLINE_POLYGON_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_POLYLINE_POLYGON_RESIDUAL_JSON")"
V3014_POLYLINE_POLYGON_RESIDUAL_PASSED="$(jq '.passed' "$V3014_POLYLINE_POLYGON_RESIDUAL_JSON")"
V3014_POLYLINE_POLYGON_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_POLYLINE_POLYGON_RESIDUAL_JSON")"
V3014_POLYLINE_POLYGON_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_POLYLINE_POLYGON_RESIDUAL_JSON")"
V3014_POLYLINE_POLYGON_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_POLYLINE_POLYGON_RESIDUAL_JSON")"
V3014_INK_ANNOTATION_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_INK_ANNOTATION_RESIDUAL_JSON")"
V3014_INK_ANNOTATION_RESIDUAL_PASSED="$(jq '.passed' "$V3014_INK_ANNOTATION_RESIDUAL_JSON")"
V3014_INK_ANNOTATION_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_INK_ANNOTATION_RESIDUAL_JSON")"
V3014_INK_ANNOTATION_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_INK_ANNOTATION_RESIDUAL_JSON")"
V3014_INK_ANNOTATION_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_INK_ANNOTATION_RESIDUAL_JSON")"
V3014_BORDER_WIDTH_CLAMP_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_BORDER_WIDTH_CLAMP_RESIDUAL_JSON")"
V3014_BORDER_WIDTH_CLAMP_RESIDUAL_PASSED="$(jq '.passed' "$V3014_BORDER_WIDTH_CLAMP_RESIDUAL_JSON")"
V3014_BORDER_WIDTH_CLAMP_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_BORDER_WIDTH_CLAMP_RESIDUAL_JSON")"
V3014_BORDER_WIDTH_CLAMP_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_BORDER_WIDTH_CLAMP_RESIDUAL_JSON")"
V3014_BORDER_WIDTH_CLAMP_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_BORDER_WIDTH_CLAMP_RESIDUAL_JSON")"
V3014_BORDER_ARRAY_WIDTH_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_BORDER_ARRAY_WIDTH_RESIDUAL_JSON")"
V3014_BORDER_ARRAY_WIDTH_RESIDUAL_PASSED="$(jq '.passed' "$V3014_BORDER_ARRAY_WIDTH_RESIDUAL_JSON")"
V3014_BORDER_ARRAY_WIDTH_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_BORDER_ARRAY_WIDTH_RESIDUAL_JSON")"
V3014_BORDER_ARRAY_WIDTH_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_BORDER_ARRAY_WIDTH_RESIDUAL_JSON")"
V3014_BORDER_ARRAY_WIDTH_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_BORDER_ARRAY_WIDTH_RESIDUAL_JSON")"
V3014_BORDER_BS_PREFERENCE_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_BORDER_BS_PREFERENCE_RESIDUAL_JSON")"
V3014_BORDER_BS_PREFERENCE_RESIDUAL_PASSED="$(jq '.passed' "$V3014_BORDER_BS_PREFERENCE_RESIDUAL_JSON")"
V3014_BORDER_BS_PREFERENCE_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_BORDER_BS_PREFERENCE_RESIDUAL_JSON")"
V3014_BORDER_BS_PREFERENCE_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_BORDER_BS_PREFERENCE_RESIDUAL_JSON")"
V3014_BORDER_BS_PREFERENCE_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_BORDER_BS_PREFERENCE_RESIDUAL_JSON")"
V3014_BORDER_BS_NONDICT_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_BORDER_BS_NONDICT_RESIDUAL_JSON")"
V3014_BORDER_BS_NONDICT_RESIDUAL_PASSED="$(jq '.passed' "$V3014_BORDER_BS_NONDICT_RESIDUAL_JSON")"
V3014_BORDER_BS_NONDICT_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_BORDER_BS_NONDICT_RESIDUAL_JSON")"
V3014_BORDER_BS_NONDICT_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_BORDER_BS_NONDICT_RESIDUAL_JSON")"
V3014_BORDER_BS_NONDICT_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_BORDER_BS_NONDICT_RESIDUAL_JSON")"
V3014_BORDER_ARRAY_SHORT_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_BORDER_ARRAY_SHORT_RESIDUAL_JSON")"
V3014_BORDER_ARRAY_SHORT_RESIDUAL_PASSED="$(jq '.passed' "$V3014_BORDER_ARRAY_SHORT_RESIDUAL_JSON")"
V3014_BORDER_ARRAY_SHORT_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_BORDER_ARRAY_SHORT_RESIDUAL_JSON")"
V3014_BORDER_ARRAY_SHORT_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_BORDER_ARRAY_SHORT_RESIDUAL_JSON")"
V3014_BORDER_ARRAY_SHORT_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_BORDER_ARRAY_SHORT_RESIDUAL_JSON")"
V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_JSON")"
V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_PASSED="$(jq '.passed' "$V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_JSON")"
V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_JSON")"
V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_JSON")"
V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_JSON")"
V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_JSON")"
V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_PASSED="$(jq '.passed' "$V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_JSON")"
V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_JSON")"
V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_JSON")"
V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_JSON")"
V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_JSON")"
V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_JSON")"
V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_JSON")"
V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_JSON")"
V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_JSON")"
V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_JSON")"
V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_JSON")"
V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_JSON")"
V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_JSON")"
V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_JSON")"
V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_JSON")"
V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_JSON")"
V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_JSON")"
V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_JSON")"
V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_JSON")"
V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_JSON")"
V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_JSON")"
V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_PASSED="$(jq '.passed' "$V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_JSON")"
V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_SKIPPED="$(jq '.skipped' "$V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_JSON")"
V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_JSON")"
V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_JSON")"
V3014_VISUAL_CASE_COUNT="$(jq '.caseCount' "$V3014_VISUAL_JSON")"
V3014_VISUAL_PASSED="$(jq '.passed' "$V3014_VISUAL_JSON")"
V3014_VISUAL_SKIPPED="$(jq '.skipped' "$V3014_VISUAL_JSON")"
V3014_VISUAL_CORPUS_HASH="$(jq -r '.corpusSha256' "$V3014_VISUAL_JSON")"
V3014_VISUAL_ORACLE_HASH="$(jq -r '.oracleSha256' "$V3014_VISUAL_JSON")"

case "$SLICE_FILTER" in
  tool.read_pdf) ARTIFACT_SLICE="tool.read_pdf" ;;
  'tool.search_pdf|tool.pdf_evidence') ARTIFACT_SLICE="tool.search_pdf|tool.pdf_evidence" ;;
  transport.stdio-rust-rmcp) ARTIFACT_SLICE="transport.stdio-rust-rmcp" ;;
  all) ARTIFACT_SLICE="tool.read_pdf|tool.search_pdf|tool.pdf_evidence|transport.stdio-rust-rmcp" ;;
esac

jq -n \
  --arg verifiedAt "$(date -Iseconds)" \
  --arg candidateSha "$CANDIDATE_SHA" \
  --arg baselineTsSha "$BASELINE_TS_SHA" \
  --arg rustCandidateSha "$RUST_SHA" \
  --arg behaviorSpecHash "$BEHAVIOR_SPEC_HASH" \
  --arg fixtureCorpusHash "$FIXTURE_CORPUS_HASH" \
  --arg goldenFixtureHash "$GOLDEN_FIXTURE_HASH" \
  --arg v3014BehaviorCorpusHash "$V3014_BEHAVIOR_CORPUS_HASH" \
  --arg v3014BehaviorOracleHash "$V3014_BEHAVIOR_ORACLE_HASH" \
  --arg v3014TextLayerCorpusHash "$V3014_TEXT_LAYER_CORPUS_HASH" \
  --arg v3014TextLayerOracleHash "$V3014_TEXT_LAYER_ORACLE_HASH" \
  --arg v3014SelectableTextSegmentationCorpusHash "$V3014_SELECTABLE_TEXT_SEGMENTATION_CORPUS_HASH" \
  --arg v3014SelectableTextSegmentationOracleHash "$V3014_SELECTABLE_TEXT_SEGMENTATION_ORACLE_HASH" \
  --arg v3014SelectableTextSegmentationRunnerHash "$V3014_SELECTABLE_TEXT_SEGMENTATION_RUNNER_HASH" \
  --arg v3014SelectableTextSegmentationProjectionHash "$V3014_SELECTABLE_TEXT_SEGMENTATION_PROJECTION_HASH" \
  --arg v3014SelectableTextSegmentationGeneratorHash "$V3014_SELECTABLE_TEXT_SEGMENTATION_GENERATOR_HASH" \
  --arg v3014SelectableTextSegmentationFixtureManifestHash "$V3014_SELECTABLE_TEXT_SEGMENTATION_FIXTURE_MANIFEST_HASH" \
  --arg v3014SelectableTextSegmentationFixtureHash "$V3014_SELECTABLE_TEXT_SEGMENTATION_FIXTURE_HASH" \
  --arg v3014SelectableTextSegmentationProfile "$V3014_SELECTABLE_TEXT_SEGMENTATION_PROFILE" \
  --arg v3014OcrSearchCorpusHash "$V3014_OCR_SEARCH_CORPUS_HASH" \
  --arg v3014OcrSearchOracleHash "$V3014_OCR_SEARCH_ORACLE_HASH" \
  --arg v3014OcrSearchProfile "$V3014_OCR_SEARCH_PROFILE" \
  --arg v3014CitationChunkCorpusHash "$V3014_CITATION_CHUNK_CORPUS_HASH" \
  --arg v3014CitationChunkOracleHash "$V3014_CITATION_CHUNK_ORACLE_HASH" \
  --arg v3014SemanticHintCorpusHash "$V3014_SEMANTIC_HINT_CORPUS_HASH" \
  --arg v3014SemanticHintOracleHash "$V3014_SEMANTIC_HINT_ORACLE_HASH" \
  --arg v3014DocumentAstCorpusHash "$V3014_DOCUMENT_AST_CORPUS_HASH" \
  --arg v3014DocumentAstOracleHash "$V3014_DOCUMENT_AST_ORACLE_HASH" \
  --arg v3014DocumentMapCorpusHash "$V3014_DOCUMENT_MAP_CORPUS_HASH" \
  --arg v3014DocumentMapOracleHash "$V3014_DOCUMENT_MAP_ORACLE_HASH" \
  --arg v3014TrustReportCorpusHash "$V3014_TRUST_REPORT_CORPUS_HASH" \
  --arg v3014TrustReportOracleHash "$V3014_TRUST_REPORT_ORACLE_HASH" \
  --arg v3014SelectableTableCorpusHash "$V3014_SELECTABLE_TABLE_CORPUS_HASH" \
  --arg v3014SelectableTableOracleHash "$V3014_SELECTABLE_TABLE_ORACLE_HASH" \
  --arg v3014CaptionLinkCorpusHash "$V3014_CAPTION_LINK_CORPUS_HASH" \
  --arg v3014CaptionLinkOracleHash "$V3014_CAPTION_LINK_ORACLE_HASH" \
  --arg v3014VisualCandidateCorpusHash "$V3014_VISUAL_CANDIDATE_CORPUS_HASH" \
  --arg v3014VisualCandidateOracleHash "$V3014_VISUAL_CANDIDATE_ORACLE_HASH" \
  --arg v3014VisualFusionCorpusHash "$V3014_VISUAL_FUSION_CORPUS_HASH" \
  --arg v3014VisualFusionOracleHash "$V3014_VISUAL_FUSION_ORACLE_HASH" \
  --arg v3014DocumentAstVisualFusionCorpusHash "$V3014_DOCUMENT_AST_VISUAL_FUSION_CORPUS_HASH" \
  --arg v3014DocumentAstVisualFusionOracleHash "$V3014_DOCUMENT_AST_VISUAL_FUSION_ORACLE_HASH" \
  --arg v3014ReadOcrCorpusHash "$V3014_READ_OCR_CORPUS_HASH" \
  --arg v3014ReadOcrOracleHash "$V3014_READ_OCR_ORACLE_HASH" \
  --arg v3014ReadOcrResidualCorpusHash "$V3014_READ_OCR_RESIDUAL_CORPUS_HASH" \
  --arg v3014ReadOcrResidualOracleHash "$V3014_READ_OCR_RESIDUAL_ORACLE_HASH" \
  --arg v3014OcrTsvCorpusHash "$V3014_OCR_TSV_CORPUS_HASH" \
  --arg v3014OcrTsvOracleHash "$V3014_OCR_TSV_ORACLE_HASH" \
  --arg v3014OcrTableMergeCorpusHash "$V3014_OCR_TABLE_MERGE_CORPUS_HASH" \
  --arg v3014OcrTableMergeOracleHash "$V3014_OCR_TABLE_MERGE_ORACLE_HASH" \
  --arg v3014OcrSearchResidualCorpusHash "$V3014_OCR_SEARCH_RESIDUAL_CORPUS_HASH" \
  --arg v3014OcrSearchResidualOracleHash "$V3014_OCR_SEARCH_RESIDUAL_ORACLE_HASH" \
  --arg v3014OcrSearchInterleaveCorpusHash "$V3014_OCR_SEARCH_INTERLEAVE_CORPUS_HASH" \
  --arg v3014OcrSearchInterleaveOracleHash "$V3014_OCR_SEARCH_INTERLEAVE_ORACLE_HASH" \
  --arg v3014UrlSingleFetchCorpusHash "$V3014_URL_SINGLE_FETCH_CORPUS_HASH" \
  --arg v3014UrlSingleFetchOracleHash "$V3014_URL_SINGLE_FETCH_ORACLE_HASH" \
  --arg v3014OcrSearchTsvCorpusHash "$V3014_OCR_SEARCH_TSV_CORPUS_HASH" \
  --arg v3014OcrSearchTsvOracleHash "$V3014_OCR_SEARCH_TSV_ORACLE_HASH" \
  --arg v3014SearchMultiwordGeometryCorpusHash "$V3014_SEARCH_MULTIWORD_GEOMETRY_CORPUS_HASH" \
  --arg v3014SearchMultiwordGeometryOracleHash "$V3014_SEARCH_MULTIWORD_GEOMETRY_ORACLE_HASH" \
  --arg v3014FormResidualCorpusHash "$V3014_FORM_RESIDUAL_CORPUS_HASH" \
  --arg v3014FormResidualOracleHash "$V3014_FORM_RESIDUAL_ORACLE_HASH" \
  --arg v3014FormRadioGroupCorpusHash "$V3014_FORM_RADIO_GROUP_CORPUS_HASH" \
  --arg v3014FormRadioGroupOracleHash "$V3014_FORM_RADIO_GROUP_ORACLE_HASH" \
  --arg v3014AttachmentResidualCorpusHash "$V3014_ATTACHMENT_RESIDUAL_CORPUS_HASH" \
  --arg v3014AttachmentResidualOracleHash "$V3014_ATTACHMENT_RESIDUAL_ORACLE_HASH" \
  --arg v3014MarkinfoResidualCorpusHash "$V3014_MARKINFO_RESIDUAL_CORPUS_HASH" \
  --arg v3014MarkinfoResidualOracleHash "$V3014_MARKINFO_RESIDUAL_ORACLE_HASH" \
  --arg v3014FormParentChildCorpusHash "$V3014_FORM_PARENT_CHILD_CORPUS_HASH" \
  --arg v3014FormParentChildOracleHash "$V3014_FORM_PARENT_CHILD_ORACLE_HASH" \
  --arg v3014AnnotationResidualCorpusHash "$V3014_ANNOTATION_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationResidualOracleHash "$V3014_ANNOTATION_RESIDUAL_ORACLE_HASH" \
  --arg v3014AnnotationDestResidualCorpusHash "$V3014_ANNOTATION_DEST_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationDestResidualOracleHash "$V3014_ANNOTATION_DEST_RESIDUAL_ORACLE_HASH" \
  --arg v3014AnnotationActionDestResidualCorpusHash "$V3014_ANNOTATION_ACTION_DEST_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationActionDestResidualOracleHash "$V3014_ANNOTATION_ACTION_DEST_RESIDUAL_ORACLE_HASH" \
  --arg v3014AnnotationActionPrecedenceResidualCorpusHash "$V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationActionPrecedenceResidualOracleHash "$V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_ORACLE_HASH" \
  --arg v3014InfoFlagsResidualCorpusHash "$V3014_INFO_FLAGS_RESIDUAL_CORPUS_HASH" \
  --arg v3014InfoFlagsResidualOracleHash "$V3014_INFO_FLAGS_RESIDUAL_ORACLE_HASH" \
  --arg v3014PageGeometryResidualCorpusHash "$V3014_PAGE_GEOMETRY_RESIDUAL_CORPUS_HASH" \
  --arg v3014PageGeometryResidualOracleHash "$V3014_PAGE_GEOMETRY_RESIDUAL_ORACLE_HASH" \
  --arg v3014PageLabelsResidualCorpusHash "$V3014_PAGE_LABELS_RESIDUAL_CORPUS_HASH" \
  --arg v3014PageLabelsResidualOracleHash "$V3014_PAGE_LABELS_RESIDUAL_ORACLE_HASH" \
  --arg v3014OutlineResidualCorpusHash "$V3014_OUTLINE_RESIDUAL_CORPUS_HASH" \
  --arg v3014OutlineResidualOracleHash "$V3014_OUTLINE_RESIDUAL_ORACLE_HASH" \
  --arg v3014PermissionsResidualCorpusHash "$V3014_PERMISSIONS_RESIDUAL_CORPUS_HASH" \
  --arg v3014PermissionsResidualOracleHash "$V3014_PERMISSIONS_RESIDUAL_ORACLE_HASH" \
  --arg v3014MetadataPresenceResidualCorpusHash "$V3014_METADATA_PRESENCE_RESIDUAL_CORPUS_HASH" \
  --arg v3014MetadataPresenceResidualOracleHash "$V3014_METADATA_PRESENCE_RESIDUAL_ORACLE_HASH" \
  --arg v3014InfoExtrasResidualCorpusHash "$V3014_INFO_EXTRAS_RESIDUAL_CORPUS_HASH" \
  --arg v3014InfoExtrasResidualOracleHash "$V3014_INFO_EXTRAS_RESIDUAL_ORACLE_HASH" \
  --arg v3014EncryptFilterResidualCorpusHash "$V3014_ENCRYPT_FILTER_RESIDUAL_CORPUS_HASH" \
  --arg v3014EncryptFilterResidualOracleHash "$V3014_ENCRYPT_FILTER_RESIDUAL_ORACLE_HASH" \
  --arg v3014LinearizedResidualCorpusHash "$V3014_LINEARIZED_RESIDUAL_CORPUS_HASH" \
  --arg v3014LinearizedResidualOracleHash "$V3014_LINEARIZED_RESIDUAL_ORACLE_HASH" \
  --arg v3014FormFlagsResidualCorpusHash "$V3014_FORM_FLAGS_RESIDUAL_CORPUS_HASH" \
  --arg v3014FormFlagsResidualOracleHash "$V3014_FORM_FLAGS_RESIDUAL_ORACLE_HASH" \
  --arg v3014TextAnnotationResidualCorpusHash "$V3014_TEXT_ANNOTATION_RESIDUAL_CORPUS_HASH" \
  --arg v3014TextAnnotationResidualOracleHash "$V3014_TEXT_ANNOTATION_RESIDUAL_ORACLE_HASH" \
  --arg v3014RemoteActionResidualCorpusHash "$V3014_REMOTE_ACTION_RESIDUAL_CORPUS_HASH" \
  --arg v3014RemoteActionResidualOracleHash "$V3014_REMOTE_ACTION_RESIDUAL_ORACLE_HASH" \
  --arg v3014PopupAnnotationResidualCorpusHash "$V3014_POPUP_ANNOTATION_RESIDUAL_CORPUS_HASH" \
  --arg v3014PopupAnnotationResidualOracleHash "$V3014_POPUP_ANNOTATION_RESIDUAL_ORACLE_HASH" \
  --arg v3014PopupZeroSizeResidualCorpusHash "$V3014_POPUP_ZERO_SIZE_RESIDUAL_CORPUS_HASH" \
  --arg v3014PopupZeroSizeResidualOracleHash "$V3014_POPUP_ZERO_SIZE_RESIDUAL_ORACLE_HASH" \
  --arg v3014PopupGroupIrtResidualCorpusHash "$V3014_POPUP_GROUP_IRT_RESIDUAL_CORPUS_HASH" \
  --arg v3014PopupGroupIrtResidualOracleHash "$V3014_POPUP_GROUP_IRT_RESIDUAL_ORACLE_HASH" \
  --arg v3014TextAppearanceResidualCorpusHash "$V3014_TEXT_APPEARANCE_RESIDUAL_CORPUS_HASH" \
  --arg v3014TextAppearanceResidualOracleHash "$V3014_TEXT_APPEARANCE_RESIDUAL_ORACLE_HASH" \
  --arg v3014TextNamedAppearanceResidualCorpusHash "$V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_CORPUS_HASH" \
  --arg v3014TextNamedAppearanceResidualOracleHash "$V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_ORACLE_HASH" \
  --arg v3014TextInvertedRectResidualCorpusHash "$V3014_TEXT_INVERTED_RECT_RESIDUAL_CORPUS_HASH" \
  --arg v3014TextInvertedRectResidualOracleHash "$V3014_TEXT_INVERTED_RECT_RESIDUAL_ORACLE_HASH" \
  --arg v3014RemoteNamedDestResidualCorpusHash "$V3014_REMOTE_NAMED_DEST_RESIDUAL_CORPUS_HASH" \
  --arg v3014RemoteNamedDestResidualOracleHash "$V3014_REMOTE_NAMED_DEST_RESIDUAL_ORACLE_HASH" \
  --arg v3014PageLabelsKidsResidualCorpusHash "$V3014_PAGE_LABELS_KIDS_RESIDUAL_CORPUS_HASH" \
  --arg v3014PageLabelsKidsResidualOracleHash "$V3014_PAGE_LABELS_KIDS_RESIDUAL_ORACLE_HASH" \
  --arg v3014FormButtonArrayResidualCorpusHash "$V3014_FORM_BUTTON_ARRAY_RESIDUAL_CORPUS_HASH" \
  --arg v3014FormButtonArrayResidualOracleHash "$V3014_FORM_BUTTON_ARRAY_RESIDUAL_ORACLE_HASH" \
  --arg v3014FormButtonDefaultOffResidualCorpusHash "$V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_CORPUS_HASH" \
  --arg v3014FormButtonDefaultOffResidualOracleHash "$V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_ORACLE_HASH" \
  --arg v3014FormPushbuttonDefaultNullResidualCorpusHash "$V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_CORPUS_HASH" \
  --arg v3014FormPushbuttonDefaultNullResidualOracleHash "$V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_ORACLE_HASH" \
  --arg v3014FormCheckboxAsValueResidualCorpusHash "$V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_CORPUS_HASH" \
  --arg v3014FormCheckboxAsValueResidualOracleHash "$V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_ORACLE_HASH" \
  --arg v3014AttachmentOddNamesResidualCorpusHash "$V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_CORPUS_HASH" \
  --arg v3014AttachmentOddNamesResidualOracleHash "$V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_ORACLE_HASH" \
  --arg v3014FormUtf16TextResidualCorpusHash "$V3014_FORM_UTF16_TEXT_RESIDUAL_CORPUS_HASH" \
  --arg v3014FormUtf16TextResidualOracleHash "$V3014_FORM_UTF16_TEXT_RESIDUAL_ORACLE_HASH" \
  --arg v3014Utf16TextResidualCorpusHash "$V3014_UTF16_TEXT_RESIDUAL_CORPUS_HASH" \
  --arg v3014Utf16TextResidualOracleHash "$V3014_UTF16_TEXT_RESIDUAL_ORACLE_HASH" \
  --arg v3014TextInvalidAsResidualCorpusHash "$V3014_TEXT_INVALID_AS_RESIDUAL_CORPUS_HASH" \
  --arg v3014TextInvalidAsResidualOracleHash "$V3014_TEXT_INVALID_AS_RESIDUAL_ORACLE_HASH" \
  --arg v3014LineAnnotationResidualCorpusHash "$V3014_LINE_ANNOTATION_RESIDUAL_CORPUS_HASH" \
  --arg v3014LineAnnotationResidualOracleHash "$V3014_LINE_ANNOTATION_RESIDUAL_ORACLE_HASH" \
  --arg v3014PolylinePolygonResidualCorpusHash "$V3014_POLYLINE_POLYGON_RESIDUAL_CORPUS_HASH" \
  --arg v3014PolylinePolygonResidualOracleHash "$V3014_POLYLINE_POLYGON_RESIDUAL_ORACLE_HASH" \
  --arg v3014InkAnnotationResidualCorpusHash "$V3014_INK_ANNOTATION_RESIDUAL_CORPUS_HASH" \
  --arg v3014InkAnnotationResidualOracleHash "$V3014_INK_ANNOTATION_RESIDUAL_ORACLE_HASH" \
  --arg v3014BorderWidthClampResidualCorpusHash "$V3014_BORDER_WIDTH_CLAMP_RESIDUAL_CORPUS_HASH" \
  --arg v3014BorderWidthClampResidualOracleHash "$V3014_BORDER_WIDTH_CLAMP_RESIDUAL_ORACLE_HASH" \
  --arg v3014BorderArrayWidthResidualCorpusHash "$V3014_BORDER_ARRAY_WIDTH_RESIDUAL_CORPUS_HASH" \
  --arg v3014BorderArrayWidthResidualOracleHash "$V3014_BORDER_ARRAY_WIDTH_RESIDUAL_ORACLE_HASH" \
  --arg v3014BorderBsPreferenceResidualCorpusHash "$V3014_BORDER_BS_PREFERENCE_RESIDUAL_CORPUS_HASH" \
  --arg v3014BorderBsPreferenceResidualOracleHash "$V3014_BORDER_BS_PREFERENCE_RESIDUAL_ORACLE_HASH" \
  --arg v3014BorderBsNondictResidualCorpusHash "$V3014_BORDER_BS_NONDICT_RESIDUAL_CORPUS_HASH" \
  --arg v3014BorderBsNondictResidualOracleHash "$V3014_BORDER_BS_NONDICT_RESIDUAL_ORACLE_HASH" \
  --arg v3014BorderArrayShortResidualCorpusHash "$V3014_BORDER_ARRAY_SHORT_RESIDUAL_CORPUS_HASH" \
  --arg v3014BorderArrayShortResidualOracleHash "$V3014_BORDER_ARRAY_SHORT_RESIDUAL_ORACLE_HASH" \
  --arg v3014BorderBsWrongTypeResidualCorpusHash "$V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_CORPUS_HASH" \
  --arg v3014BorderBsWrongTypeResidualOracleHash "$V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_ORACLE_HASH" \
  --arg v3014BorderZeroSizeClampBypassResidualCorpusHash "$V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_CORPUS_HASH" \
  --arg v3014BorderZeroSizeClampBypassResidualOracleHash "$V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_ORACLE_HASH" \
  --arg v3014AnnotationAppearanceBboxResidualCorpusHash "$V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationAppearanceBboxResidualOracleHash "$V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_ORACLE_HASH" \
  --arg v3014AnnotationApNonstreamResidualCorpusHash "$V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationApNonstreamResidualOracleHash "$V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_ORACLE_HASH" \
  --arg v3014AnnotationApNamedStateResidualCorpusHash "$V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationApNamedStateResidualOracleHash "$V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_ORACLE_HASH" \
  --arg v3014AnnotationApNamedStatePolylineInkResidualCorpusHash "$V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationApNamedStatePolylineInkResidualOracleHash "$V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_ORACLE_HASH" \
  --arg v3014AnnotationApNamedStateSquareCircleResidualCorpusHash "$V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationApNamedStateSquareCircleResidualOracleHash "$V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_ORACLE_HASH" \
  --arg v3014AnnotationHighlightQuadpointsResidualCorpusHash "$V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationHighlightQuadpointsResidualOracleHash "$V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_ORACLE_HASH" \
  --arg v3014AnnotationTextMarkupQuadpointsResidualCorpusHash "$V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationTextMarkupQuadpointsResidualOracleHash "$V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_ORACLE_HASH" \
  --arg v3014AnnotationTextMarkupWithApResidualCorpusHash "$V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_CORPUS_HASH" \
  --arg v3014AnnotationTextMarkupWithApResidualOracleHash "$V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_ORACLE_HASH" \
  --arg v3014VisualCorpusHash "$V3014_VISUAL_CORPUS_HASH" \
  --arg v3014VisualOracleHash "$V3014_VISUAL_ORACLE_HASH" \
  --arg sliceFilter "$SLICE_FILTER" \
  --arg slice "$ARTIFACT_SLICE" \
  --argjson caseCount "$CASE_COUNT" \
  --argjson readPdfCaseCount "$READ_PDF_CASE_COUNT" \
  --argjson stdioProbeCaseCount "$STDIO_PROBE_CASE_COUNT" \
  --argjson toolRouteCaseCount "$TOOL_ROUTE_CASE_COUNT" \
  --argjson v3014BehaviorCaseCount "$V3014_BEHAVIOR_CASE_COUNT" \
  --argjson v3014BehaviorPassed "$V3014_BEHAVIOR_PASSED" \
  --argjson v3014BehaviorSkipped "$V3014_BEHAVIOR_SKIPPED" \
  --argjson v3014TextLayerCaseCount "$V3014_TEXT_LAYER_CASE_COUNT" \
  --argjson v3014TextLayerPassed "$V3014_TEXT_LAYER_PASSED" \
  --argjson v3014TextLayerSkipped "$V3014_TEXT_LAYER_SKIPPED" \
  --argjson v3014SelectableTextSegmentationCaseCount "$V3014_SELECTABLE_TEXT_SEGMENTATION_CASE_COUNT" \
  --argjson v3014SelectableTextSegmentationPassed "$V3014_SELECTABLE_TEXT_SEGMENTATION_PASSED" \
  --argjson v3014SelectableTextSegmentationSkipped "$V3014_SELECTABLE_TEXT_SEGMENTATION_SKIPPED" \
  --argjson v3014SelectableTextSegmentationPass "$V3014_SELECTABLE_TEXT_SEGMENTATION_PASS" \
  --argjson v3014SelectableTextSegmentationMutationSensitive "$V3014_SELECTABLE_TEXT_SEGMENTATION_MUTATION_SENSITIVE" \
  --argjson v3014SelectableTextSegmentationSemanticProof "$V3014_SELECTABLE_TEXT_SEGMENTATION_SEMANTIC_PROOF" \
  --argjson v3014SelectableTextSegmentationPdfjsObservation "$V3014_SELECTABLE_TEXT_SEGMENTATION_PDFJS_OBSERVATION" \
  --argjson v3014SelectableTextSegmentationNonclaims "$V3014_SELECTABLE_TEXT_SEGMENTATION_NONCLAIMS" \
  --argjson v3014SelectableTextSegmentationProductTruth "$V3014_SELECTABLE_TEXT_SEGMENTATION_PRODUCT_TRUTH" \
  --argjson v3014OcrSearchCaseCount "$V3014_OCR_SEARCH_CASE_COUNT" \
  --argjson v3014OcrSearchPassed "$V3014_OCR_SEARCH_PASSED" \
  --argjson v3014OcrSearchSkipped "$V3014_OCR_SEARCH_SKIPPED" \
  --argjson v3014OcrSearchPass "$V3014_OCR_SEARCH_PASS" \
  --argjson v3014OcrSearchMutationSensitive "$V3014_OCR_SEARCH_MUTATION_SENSITIVE" \
  --argjson v3014OcrSearchResourceProof "$V3014_OCR_SEARCH_RESOURCE_PROOF" \
  --argjson v3014OcrSearchNonclaims "$V3014_OCR_SEARCH_NONCLAIMS" \
  --argjson v3014OcrSearchProductTruth "$V3014_OCR_SEARCH_PRODUCT_TRUTH" \
  --argjson v3014CitationChunkCaseCount "$V3014_CITATION_CHUNK_CASE_COUNT" \
  --argjson v3014CitationChunkPassed "$V3014_CITATION_CHUNK_PASSED" \
  --argjson v3014CitationChunkSkipped "$V3014_CITATION_CHUNK_SKIPPED" \
  --argjson v3014SemanticHintCaseCount "$V3014_SEMANTIC_HINT_CASE_COUNT" \
  --argjson v3014SemanticHintPassed "$V3014_SEMANTIC_HINT_PASSED" \
  --argjson v3014SemanticHintSkipped "$V3014_SEMANTIC_HINT_SKIPPED" \
  --argjson v3014DocumentAstCaseCount "$V3014_DOCUMENT_AST_CASE_COUNT" \
  --argjson v3014DocumentAstPassed "$V3014_DOCUMENT_AST_PASSED" \
  --argjson v3014DocumentAstSkipped "$V3014_DOCUMENT_AST_SKIPPED" \
  --argjson v3014DocumentMapCaseCount "$V3014_DOCUMENT_MAP_CASE_COUNT" \
  --argjson v3014DocumentMapPassed "$V3014_DOCUMENT_MAP_PASSED" \
  --argjson v3014DocumentMapSkipped "$V3014_DOCUMENT_MAP_SKIPPED" \
  --argjson v3014TrustReportCaseCount "$V3014_TRUST_REPORT_CASE_COUNT" \
  --argjson v3014TrustReportPassed "$V3014_TRUST_REPORT_PASSED" \
  --argjson v3014TrustReportSkipped "$V3014_TRUST_REPORT_SKIPPED" \
  --argjson v3014SelectableTableCaseCount "$V3014_SELECTABLE_TABLE_CASE_COUNT" \
  --argjson v3014SelectableTablePassed "$V3014_SELECTABLE_TABLE_PASSED" \
  --argjson v3014SelectableTableSkipped "$V3014_SELECTABLE_TABLE_SKIPPED" \
  --argjson v3014CaptionLinkCaseCount "$V3014_CAPTION_LINK_CASE_COUNT" \
  --argjson v3014CaptionLinkPassed "$V3014_CAPTION_LINK_PASSED" \
  --argjson v3014CaptionLinkSkipped "$V3014_CAPTION_LINK_SKIPPED" \
  --argjson v3014VisualCandidateCaseCount "$V3014_VISUAL_CANDIDATE_CASE_COUNT" \
  --argjson v3014VisualCandidatePassed "$V3014_VISUAL_CANDIDATE_PASSED" \
  --argjson v3014VisualCandidateSkipped "$V3014_VISUAL_CANDIDATE_SKIPPED" \
  --argjson v3014VisualFusionCaseCount "$V3014_VISUAL_FUSION_CASE_COUNT" \
  --argjson v3014VisualFusionPassed "$V3014_VISUAL_FUSION_PASSED" \
  --argjson v3014VisualFusionSkipped "$V3014_VISUAL_FUSION_SKIPPED" \
  --argjson v3014DocumentAstVisualFusionCaseCount "$V3014_DOCUMENT_AST_VISUAL_FUSION_CASE_COUNT" \
  --argjson v3014DocumentAstVisualFusionPassed "$V3014_DOCUMENT_AST_VISUAL_FUSION_PASSED" \
  --argjson v3014DocumentAstVisualFusionSkipped "$V3014_DOCUMENT_AST_VISUAL_FUSION_SKIPPED" \
  --argjson v3014ReadOcrCaseCount "$V3014_READ_OCR_CASE_COUNT" \
  --argjson v3014ReadOcrPassed "$V3014_READ_OCR_PASSED" \
  --argjson v3014ReadOcrSkipped "$V3014_READ_OCR_SKIPPED" \
  --argjson v3014ReadOcrResidualCaseCount "$V3014_READ_OCR_RESIDUAL_CASE_COUNT" \
  --argjson v3014ReadOcrResidualPassed "$V3014_READ_OCR_RESIDUAL_PASSED" \
  --argjson v3014ReadOcrResidualSkipped "$V3014_READ_OCR_RESIDUAL_SKIPPED" \
  --argjson v3014OcrTsvCaseCount "$V3014_OCR_TSV_CASE_COUNT" \
  --argjson v3014OcrTsvPassed "$V3014_OCR_TSV_PASSED" \
  --argjson v3014OcrTsvSkipped "$V3014_OCR_TSV_SKIPPED" \
  --argjson v3014OcrTableMergeCaseCount "$V3014_OCR_TABLE_MERGE_CASE_COUNT" \
  --argjson v3014OcrTableMergePassed "$V3014_OCR_TABLE_MERGE_PASSED" \
  --argjson v3014OcrTableMergeSkipped "$V3014_OCR_TABLE_MERGE_SKIPPED" \
  --argjson v3014OcrSearchResidualCaseCount "$V3014_OCR_SEARCH_RESIDUAL_CASE_COUNT" \
  --argjson v3014OcrSearchResidualPassed "$V3014_OCR_SEARCH_RESIDUAL_PASSED" \
  --argjson v3014OcrSearchResidualSkipped "$V3014_OCR_SEARCH_RESIDUAL_SKIPPED" \
  --argjson v3014OcrSearchInterleaveCaseCount "$V3014_OCR_SEARCH_INTERLEAVE_CASE_COUNT" \
  --argjson v3014OcrSearchInterleavePassed "$V3014_OCR_SEARCH_INTERLEAVE_PASSED" \
  --argjson v3014OcrSearchInterleaveSkipped "$V3014_OCR_SEARCH_INTERLEAVE_SKIPPED" \
  --argjson v3014UrlSingleFetchCaseCount "$V3014_URL_SINGLE_FETCH_CASE_COUNT" \
  --argjson v3014UrlSingleFetchPassed "$V3014_URL_SINGLE_FETCH_PASSED" \
  --argjson v3014UrlSingleFetchSkipped "$V3014_URL_SINGLE_FETCH_SKIPPED" \
  --argjson v3014OcrSearchTsvCaseCount "$V3014_OCR_SEARCH_TSV_CASE_COUNT" \
  --argjson v3014OcrSearchTsvPassed "$V3014_OCR_SEARCH_TSV_PASSED" \
  --argjson v3014OcrSearchTsvSkipped "$V3014_OCR_SEARCH_TSV_SKIPPED" \
  --argjson v3014SearchMultiwordGeometryCaseCount "$V3014_SEARCH_MULTIWORD_GEOMETRY_CASE_COUNT" \
  --argjson v3014SearchMultiwordGeometryPassed "$V3014_SEARCH_MULTIWORD_GEOMETRY_PASSED" \
  --argjson v3014SearchMultiwordGeometrySkipped "$V3014_SEARCH_MULTIWORD_GEOMETRY_SKIPPED" \
  --argjson v3014FormResidualCaseCount "$V3014_FORM_RESIDUAL_CASE_COUNT" \
  --argjson v3014FormResidualPassed "$V3014_FORM_RESIDUAL_PASSED" \
  --argjson v3014FormResidualSkipped "$V3014_FORM_RESIDUAL_SKIPPED" \
  --argjson v3014FormRadioGroupCaseCount "$V3014_FORM_RADIO_GROUP_CASE_COUNT" \
  --argjson v3014FormRadioGroupPassed "$V3014_FORM_RADIO_GROUP_PASSED" \
  --argjson v3014FormRadioGroupSkipped "$V3014_FORM_RADIO_GROUP_SKIPPED" \
  --argjson v3014AttachmentResidualCaseCount "$V3014_ATTACHMENT_RESIDUAL_CASE_COUNT" \
  --argjson v3014AttachmentResidualPassed "$V3014_ATTACHMENT_RESIDUAL_PASSED" \
  --argjson v3014AttachmentResidualSkipped "$V3014_ATTACHMENT_RESIDUAL_SKIPPED" \
  --argjson v3014MarkinfoResidualCaseCount "$V3014_MARKINFO_RESIDUAL_CASE_COUNT" \
  --argjson v3014MarkinfoResidualPassed "$V3014_MARKINFO_RESIDUAL_PASSED" \
  --argjson v3014MarkinfoResidualSkipped "$V3014_MARKINFO_RESIDUAL_SKIPPED" \
  --argjson v3014FormParentChildCaseCount "$V3014_FORM_PARENT_CHILD_CASE_COUNT" \
  --argjson v3014FormParentChildPassed "$V3014_FORM_PARENT_CHILD_PASSED" \
  --argjson v3014FormParentChildSkipped "$V3014_FORM_PARENT_CHILD_SKIPPED" \
  --argjson v3014AnnotationResidualCaseCount "$V3014_ANNOTATION_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationResidualPassed "$V3014_ANNOTATION_RESIDUAL_PASSED" \
  --argjson v3014AnnotationResidualSkipped "$V3014_ANNOTATION_RESIDUAL_SKIPPED" \
  --argjson v3014AnnotationDestResidualCaseCount "$V3014_ANNOTATION_DEST_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationDestResidualPassed "$V3014_ANNOTATION_DEST_RESIDUAL_PASSED" \
  --argjson v3014AnnotationDestResidualSkipped "$V3014_ANNOTATION_DEST_RESIDUAL_SKIPPED" \
  --argjson v3014AnnotationActionDestResidualCaseCount "$V3014_ANNOTATION_ACTION_DEST_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationActionDestResidualPassed "$V3014_ANNOTATION_ACTION_DEST_RESIDUAL_PASSED" \
  --argjson v3014AnnotationActionDestResidualSkipped "$V3014_ANNOTATION_ACTION_DEST_RESIDUAL_SKIPPED" \
  --argjson v3014AnnotationActionPrecedenceResidualCaseCount "$V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationActionPrecedenceResidualPassed "$V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_PASSED" \
  --argjson v3014AnnotationActionPrecedenceResidualSkipped "$V3014_ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_SKIPPED" \
  --argjson v3014InfoFlagsResidualCaseCount "$V3014_INFO_FLAGS_RESIDUAL_CASE_COUNT" \
  --argjson v3014InfoFlagsResidualPassed "$V3014_INFO_FLAGS_RESIDUAL_PASSED" \
  --argjson v3014InfoFlagsResidualSkipped "$V3014_INFO_FLAGS_RESIDUAL_SKIPPED" \
  --argjson v3014PageGeometryResidualCaseCount "$V3014_PAGE_GEOMETRY_RESIDUAL_CASE_COUNT" \
  --argjson v3014PageGeometryResidualPassed "$V3014_PAGE_GEOMETRY_RESIDUAL_PASSED" \
  --argjson v3014PageGeometryResidualSkipped "$V3014_PAGE_GEOMETRY_RESIDUAL_SKIPPED" \
  --argjson v3014PageLabelsResidualCaseCount "$V3014_PAGE_LABELS_RESIDUAL_CASE_COUNT" \
  --argjson v3014PageLabelsResidualPassed "$V3014_PAGE_LABELS_RESIDUAL_PASSED" \
  --argjson v3014PageLabelsResidualSkipped "$V3014_PAGE_LABELS_RESIDUAL_SKIPPED" \
  --argjson v3014OutlineResidualCaseCount "$V3014_OUTLINE_RESIDUAL_CASE_COUNT" \
  --argjson v3014OutlineResidualPassed "$V3014_OUTLINE_RESIDUAL_PASSED" \
  --argjson v3014OutlineResidualSkipped "$V3014_OUTLINE_RESIDUAL_SKIPPED" \
  --argjson v3014PermissionsResidualCaseCount "$V3014_PERMISSIONS_RESIDUAL_CASE_COUNT" \
  --argjson v3014PermissionsResidualPassed "$V3014_PERMISSIONS_RESIDUAL_PASSED" \
  --argjson v3014PermissionsResidualSkipped "$V3014_PERMISSIONS_RESIDUAL_SKIPPED" \
  --argjson v3014MetadataPresenceResidualCaseCount "$V3014_METADATA_PRESENCE_RESIDUAL_CASE_COUNT" \
  --argjson v3014MetadataPresenceResidualPassed "$V3014_METADATA_PRESENCE_RESIDUAL_PASSED" \
  --argjson v3014MetadataPresenceResidualSkipped "$V3014_METADATA_PRESENCE_RESIDUAL_SKIPPED" \
  --argjson v3014InfoExtrasResidualCaseCount "$V3014_INFO_EXTRAS_RESIDUAL_CASE_COUNT" \
  --argjson v3014InfoExtrasResidualPassed "$V3014_INFO_EXTRAS_RESIDUAL_PASSED" \
  --argjson v3014InfoExtrasResidualSkipped "$V3014_INFO_EXTRAS_RESIDUAL_SKIPPED" \
  --argjson v3014EncryptFilterResidualCaseCount "$V3014_ENCRYPT_FILTER_RESIDUAL_CASE_COUNT" \
  --argjson v3014EncryptFilterResidualPassed "$V3014_ENCRYPT_FILTER_RESIDUAL_PASSED" \
  --argjson v3014EncryptFilterResidualSkipped "$V3014_ENCRYPT_FILTER_RESIDUAL_SKIPPED" \
  --argjson v3014LinearizedResidualCaseCount "$V3014_LINEARIZED_RESIDUAL_CASE_COUNT" \
  --argjson v3014LinearizedResidualPassed "$V3014_LINEARIZED_RESIDUAL_PASSED" \
  --argjson v3014LinearizedResidualSkipped "$V3014_LINEARIZED_RESIDUAL_SKIPPED" \
  --argjson v3014FormFlagsResidualCaseCount "$V3014_FORM_FLAGS_RESIDUAL_CASE_COUNT" \
  --argjson v3014FormFlagsResidualPassed "$V3014_FORM_FLAGS_RESIDUAL_PASSED" \
  --argjson v3014FormFlagsResidualSkipped "$V3014_FORM_FLAGS_RESIDUAL_SKIPPED" \
  --argjson v3014TextAnnotationResidualCaseCount "$V3014_TEXT_ANNOTATION_RESIDUAL_CASE_COUNT" \
  --argjson v3014TextAnnotationResidualPassed "$V3014_TEXT_ANNOTATION_RESIDUAL_PASSED" \
  --argjson v3014TextAnnotationResidualSkipped "$V3014_TEXT_ANNOTATION_RESIDUAL_SKIPPED" \
  --argjson v3014RemoteActionResidualCaseCount "$V3014_REMOTE_ACTION_RESIDUAL_CASE_COUNT" \
  --argjson v3014RemoteActionResidualPassed "$V3014_REMOTE_ACTION_RESIDUAL_PASSED" \
  --argjson v3014RemoteActionResidualSkipped "$V3014_REMOTE_ACTION_RESIDUAL_SKIPPED" \
  --argjson v3014PopupAnnotationResidualCaseCount "$V3014_POPUP_ANNOTATION_RESIDUAL_CASE_COUNT" \
  --argjson v3014PopupAnnotationResidualPassed "$V3014_POPUP_ANNOTATION_RESIDUAL_PASSED" \
  --argjson v3014PopupAnnotationResidualSkipped "$V3014_POPUP_ANNOTATION_RESIDUAL_SKIPPED" \
  --argjson v3014PopupZeroSizeResidualCaseCount "$V3014_POPUP_ZERO_SIZE_RESIDUAL_CASE_COUNT" \
  --argjson v3014PopupZeroSizeResidualPassed "$V3014_POPUP_ZERO_SIZE_RESIDUAL_PASSED" \
  --argjson v3014PopupZeroSizeResidualSkipped "$V3014_POPUP_ZERO_SIZE_RESIDUAL_SKIPPED" \
  --argjson v3014PopupGroupIrtResidualCaseCount "$V3014_POPUP_GROUP_IRT_RESIDUAL_CASE_COUNT" \
  --argjson v3014PopupGroupIrtResidualPassed "$V3014_POPUP_GROUP_IRT_RESIDUAL_PASSED" \
  --argjson v3014PopupGroupIrtResidualSkipped "$V3014_POPUP_GROUP_IRT_RESIDUAL_SKIPPED" \
  --argjson v3014TextAppearanceResidualCaseCount "$V3014_TEXT_APPEARANCE_RESIDUAL_CASE_COUNT" \
  --argjson v3014TextAppearanceResidualPassed "$V3014_TEXT_APPEARANCE_RESIDUAL_PASSED" \
  --argjson v3014TextAppearanceResidualSkipped "$V3014_TEXT_APPEARANCE_RESIDUAL_SKIPPED" \
  --argjson v3014TextNamedAppearanceResidualCaseCount "$V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_CASE_COUNT" \
  --argjson v3014TextNamedAppearanceResidualPassed "$V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_PASSED" \
  --argjson v3014TextNamedAppearanceResidualSkipped "$V3014_TEXT_NAMED_APPEARANCE_RESIDUAL_SKIPPED" \
  --argjson v3014TextInvertedRectResidualCaseCount "$V3014_TEXT_INVERTED_RECT_RESIDUAL_CASE_COUNT" \
  --argjson v3014TextInvertedRectResidualPassed "$V3014_TEXT_INVERTED_RECT_RESIDUAL_PASSED" \
  --argjson v3014TextInvertedRectResidualSkipped "$V3014_TEXT_INVERTED_RECT_RESIDUAL_SKIPPED" \
  --argjson v3014RemoteNamedDestResidualCaseCount "$V3014_REMOTE_NAMED_DEST_RESIDUAL_CASE_COUNT" \
  --argjson v3014RemoteNamedDestResidualPassed "$V3014_REMOTE_NAMED_DEST_RESIDUAL_PASSED" \
  --argjson v3014RemoteNamedDestResidualSkipped "$V3014_REMOTE_NAMED_DEST_RESIDUAL_SKIPPED" \
  --argjson v3014PageLabelsKidsResidualCaseCount "$V3014_PAGE_LABELS_KIDS_RESIDUAL_CASE_COUNT" \
  --argjson v3014PageLabelsKidsResidualPassed "$V3014_PAGE_LABELS_KIDS_RESIDUAL_PASSED" \
  --argjson v3014PageLabelsKidsResidualSkipped "$V3014_PAGE_LABELS_KIDS_RESIDUAL_SKIPPED" \
  --argjson v3014FormButtonArrayResidualCaseCount "$V3014_FORM_BUTTON_ARRAY_RESIDUAL_CASE_COUNT" \
  --argjson v3014FormButtonArrayResidualPassed "$V3014_FORM_BUTTON_ARRAY_RESIDUAL_PASSED" \
  --argjson v3014FormButtonArrayResidualSkipped "$V3014_FORM_BUTTON_ARRAY_RESIDUAL_SKIPPED" \
  --argjson v3014FormButtonDefaultOffResidualCaseCount "$V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_CASE_COUNT" \
  --argjson v3014FormButtonDefaultOffResidualPassed "$V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_PASSED" \
  --argjson v3014FormButtonDefaultOffResidualSkipped "$V3014_FORM_BUTTON_DEFAULT_OFF_RESIDUAL_SKIPPED" \
  --argjson v3014FormPushbuttonDefaultNullResidualCaseCount "$V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_CASE_COUNT" \
  --argjson v3014FormPushbuttonDefaultNullResidualPassed "$V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_PASSED" \
  --argjson v3014FormPushbuttonDefaultNullResidualSkipped "$V3014_FORM_PUSHBUTTON_DEFAULT_NULL_RESIDUAL_SKIPPED" \
  --argjson v3014FormCheckboxAsValueResidualCaseCount "$V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_CASE_COUNT" \
  --argjson v3014FormCheckboxAsValueResidualPassed "$V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_PASSED" \
  --argjson v3014FormCheckboxAsValueResidualSkipped "$V3014_FORM_CHECKBOX_AS_VALUE_RESIDUAL_SKIPPED" \
  --argjson v3014AttachmentOddNamesResidualCaseCount "$V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_CASE_COUNT" \
  --argjson v3014AttachmentOddNamesResidualPassed "$V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_PASSED" \
  --argjson v3014AttachmentOddNamesResidualSkipped "$V3014_ATTACHMENT_ODD_NAMES_RESIDUAL_SKIPPED" \
  --argjson v3014FormUtf16TextResidualCaseCount "$V3014_FORM_UTF16_TEXT_RESIDUAL_CASE_COUNT" \
  --argjson v3014FormUtf16TextResidualPassed "$V3014_FORM_UTF16_TEXT_RESIDUAL_PASSED" \
  --argjson v3014FormUtf16TextResidualSkipped "$V3014_FORM_UTF16_TEXT_RESIDUAL_SKIPPED" \
  --argjson v3014Utf16TextResidualCaseCount "$V3014_UTF16_TEXT_RESIDUAL_CASE_COUNT" \
  --argjson v3014Utf16TextResidualPassed "$V3014_UTF16_TEXT_RESIDUAL_PASSED" \
  --argjson v3014Utf16TextResidualSkipped "$V3014_UTF16_TEXT_RESIDUAL_SKIPPED" \
  --argjson v3014TextInvalidAsResidualCaseCount "$V3014_TEXT_INVALID_AS_RESIDUAL_CASE_COUNT" \
  --argjson v3014TextInvalidAsResidualPassed "$V3014_TEXT_INVALID_AS_RESIDUAL_PASSED" \
  --argjson v3014TextInvalidAsResidualSkipped "$V3014_TEXT_INVALID_AS_RESIDUAL_SKIPPED" \
  --argjson v3014LineAnnotationResidualCaseCount "$V3014_LINE_ANNOTATION_RESIDUAL_CASE_COUNT" \
  --argjson v3014LineAnnotationResidualPassed "$V3014_LINE_ANNOTATION_RESIDUAL_PASSED" \
  --argjson v3014LineAnnotationResidualSkipped "$V3014_LINE_ANNOTATION_RESIDUAL_SKIPPED" \
  --argjson v3014PolylinePolygonResidualCaseCount "$V3014_POLYLINE_POLYGON_RESIDUAL_CASE_COUNT" \
  --argjson v3014PolylinePolygonResidualPassed "$V3014_POLYLINE_POLYGON_RESIDUAL_PASSED" \
  --argjson v3014PolylinePolygonResidualSkipped "$V3014_POLYLINE_POLYGON_RESIDUAL_SKIPPED" \
  --argjson v3014InkAnnotationResidualCaseCount "$V3014_INK_ANNOTATION_RESIDUAL_CASE_COUNT" \
  --argjson v3014InkAnnotationResidualPassed "$V3014_INK_ANNOTATION_RESIDUAL_PASSED" \
  --argjson v3014InkAnnotationResidualSkipped "$V3014_INK_ANNOTATION_RESIDUAL_SKIPPED" \
  --argjson v3014BorderWidthClampResidualCaseCount "$V3014_BORDER_WIDTH_CLAMP_RESIDUAL_CASE_COUNT" \
  --argjson v3014BorderWidthClampResidualPassed "$V3014_BORDER_WIDTH_CLAMP_RESIDUAL_PASSED" \
  --argjson v3014BorderWidthClampResidualSkipped "$V3014_BORDER_WIDTH_CLAMP_RESIDUAL_SKIPPED" \
  --argjson v3014BorderArrayWidthResidualCaseCount "$V3014_BORDER_ARRAY_WIDTH_RESIDUAL_CASE_COUNT" \
  --argjson v3014BorderArrayWidthResidualPassed "$V3014_BORDER_ARRAY_WIDTH_RESIDUAL_PASSED" \
  --argjson v3014BorderArrayWidthResidualSkipped "$V3014_BORDER_ARRAY_WIDTH_RESIDUAL_SKIPPED" \
  --argjson v3014BorderBsPreferenceResidualCaseCount "$V3014_BORDER_BS_PREFERENCE_RESIDUAL_CASE_COUNT" \
  --argjson v3014BorderBsPreferenceResidualPassed "$V3014_BORDER_BS_PREFERENCE_RESIDUAL_PASSED" \
  --argjson v3014BorderBsPreferenceResidualSkipped "$V3014_BORDER_BS_PREFERENCE_RESIDUAL_SKIPPED" \
  --argjson v3014BorderBsNondictResidualCaseCount "$V3014_BORDER_BS_NONDICT_RESIDUAL_CASE_COUNT" \
  --argjson v3014BorderBsNondictResidualPassed "$V3014_BORDER_BS_NONDICT_RESIDUAL_PASSED" \
  --argjson v3014BorderBsNondictResidualSkipped "$V3014_BORDER_BS_NONDICT_RESIDUAL_SKIPPED" \
  --argjson v3014BorderArrayShortResidualCaseCount "$V3014_BORDER_ARRAY_SHORT_RESIDUAL_CASE_COUNT" \
  --argjson v3014BorderArrayShortResidualPassed "$V3014_BORDER_ARRAY_SHORT_RESIDUAL_PASSED" \
  --argjson v3014BorderArrayShortResidualSkipped "$V3014_BORDER_ARRAY_SHORT_RESIDUAL_SKIPPED" \
  --argjson v3014BorderBsWrongTypeResidualCaseCount "$V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_CASE_COUNT" \
  --argjson v3014BorderBsWrongTypeResidualPassed "$V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_PASSED" \
  --argjson v3014BorderBsWrongTypeResidualSkipped "$V3014_BORDER_BS_WRONG_TYPE_RESIDUAL_SKIPPED" \
  --argjson v3014BorderZeroSizeClampBypassResidualCaseCount "$V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_CASE_COUNT" \
  --argjson v3014BorderZeroSizeClampBypassResidualPassed "$V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_PASSED" \
  --argjson v3014BorderZeroSizeClampBypassResidualSkipped "$V3014_BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_SKIPPED" \
  --argjson v3014AnnotationAppearanceBboxResidualCaseCount "$V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationAppearanceBboxResidualPassed "$V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_PASSED" \
  --argjson v3014AnnotationAppearanceBboxResidualSkipped "$V3014_ANNOTATION_APPEARANCE_BBOX_RESIDUAL_SKIPPED" \
  --argjson v3014AnnotationApNonstreamResidualCaseCount "$V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationApNonstreamResidualPassed "$V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_PASSED" \
  --argjson v3014AnnotationApNonstreamResidualSkipped "$V3014_ANNOTATION_AP_NONSTREAM_RESIDUAL_SKIPPED" \
  --argjson v3014AnnotationApNamedStateResidualCaseCount "$V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationApNamedStateResidualPassed "$V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_PASSED" \
  --argjson v3014AnnotationApNamedStateResidualSkipped "$V3014_ANNOTATION_AP_NAMED_STATE_RESIDUAL_SKIPPED" \
  --argjson v3014AnnotationApNamedStatePolylineInkResidualCaseCount "$V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationApNamedStatePolylineInkResidualPassed "$V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_PASSED" \
  --argjson v3014AnnotationApNamedStatePolylineInkResidualSkipped "$V3014_ANNOTATION_AP_NAMED_STATE_POLYLINE_INK_RESIDUAL_SKIPPED" \
  --argjson v3014AnnotationApNamedStateSquareCircleResidualCaseCount "$V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationApNamedStateSquareCircleResidualPassed "$V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_PASSED" \
  --argjson v3014AnnotationApNamedStateSquareCircleResidualSkipped "$V3014_ANNOTATION_AP_NAMED_STATE_SQUARE_CIRCLE_RESIDUAL_SKIPPED" \
  --argjson v3014AnnotationHighlightQuadpointsResidualCaseCount "$V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationHighlightQuadpointsResidualPassed "$V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_PASSED" \
  --argjson v3014AnnotationHighlightQuadpointsResidualSkipped "$V3014_ANNOTATION_HIGHLIGHT_QUADPOINTS_RESIDUAL_SKIPPED" \
  --argjson v3014AnnotationTextMarkupQuadpointsResidualCaseCount "$V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationTextMarkupQuadpointsResidualPassed "$V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_PASSED" \
  --argjson v3014AnnotationTextMarkupQuadpointsResidualSkipped "$V3014_ANNOTATION_TEXT_MARKUP_QUADPOINTS_RESIDUAL_SKIPPED" \
  --argjson v3014AnnotationTextMarkupWithApResidualCaseCount "$V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_CASE_COUNT" \
  --argjson v3014AnnotationTextMarkupWithApResidualPassed "$V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_PASSED" \
  --argjson v3014AnnotationTextMarkupWithApResidualSkipped "$V3014_ANNOTATION_TEXT_MARKUP_WITH_AP_RESIDUAL_SKIPPED" \
  --argjson v3014VisualCaseCount "$V3014_VISUAL_CASE_COUNT" \
  --argjson v3014VisualPassed "$V3014_VISUAL_PASSED" \
  --argjson v3014VisualSkipped "$V3014_VISUAL_SKIPPED" \
  '{
    schemaVersion: 2,
    slice: $slice,
    sliceFilter: $sliceFilter,
    status: "claimed_subset_green",
    verifiedAt: $verifiedAt,
    lastComparedMainSha: $candidateSha,
    mergeGroupSha: $candidateSha,
    baselineTsSha: $baselineTsSha,
    rustCandidateSha: $rustCandidateSha,
    behaviorSpecHash: $behaviorSpecHash,
    fixtureCorpusHash: $fixtureCorpusHash,
    goldenFixtureHash: $goldenFixtureHash,
    v3014BehaviorCorpusHash: $v3014BehaviorCorpusHash,
    v3014BehaviorOracleHash: $v3014BehaviorOracleHash,
    caseCount: $caseCount,
    readPdfCaseCount: $readPdfCaseCount,
    stdioProbeCaseCount: $stdioProbeCaseCount,
    toolRouteCaseCount: $toolRouteCaseCount,
    v3014BehaviorCaseCount: $v3014BehaviorCaseCount,
    v3014BehaviorPassed: $v3014BehaviorPassed,
    v3014BehaviorSkipped: $v3014BehaviorSkipped,
    v3014TextLayerCorpusHash: $v3014TextLayerCorpusHash,
    v3014TextLayerOracleHash: $v3014TextLayerOracleHash,
    v3014TextLayerCaseCount: $v3014TextLayerCaseCount,
    v3014TextLayerPassed: $v3014TextLayerPassed,
    v3014TextLayerSkipped: $v3014TextLayerSkipped,
    v3014SelectableTextSegmentationCorpusHash: $v3014SelectableTextSegmentationCorpusHash,
    v3014SelectableTextSegmentationOracleHash: $v3014SelectableTextSegmentationOracleHash,
    v3014SelectableTextSegmentationRunnerHash: $v3014SelectableTextSegmentationRunnerHash,
    v3014SelectableTextSegmentationProjectionHash: $v3014SelectableTextSegmentationProjectionHash,
    v3014SelectableTextSegmentationGeneratorHash: $v3014SelectableTextSegmentationGeneratorHash,
    v3014SelectableTextSegmentationFixtureManifestHash: $v3014SelectableTextSegmentationFixtureManifestHash,
    v3014SelectableTextSegmentationFixtureHash: $v3014SelectableTextSegmentationFixtureHash,
    v3014SelectableTextSegmentationProfile: $v3014SelectableTextSegmentationProfile,
    v3014SelectableTextSegmentationCaseCount: $v3014SelectableTextSegmentationCaseCount,
    v3014SelectableTextSegmentationPassed: $v3014SelectableTextSegmentationPassed,
    v3014SelectableTextSegmentationSkipped: $v3014SelectableTextSegmentationSkipped,
    v3014SelectableTextSegmentationPass: $v3014SelectableTextSegmentationPass,
    v3014SelectableTextSegmentationMutationSensitive: $v3014SelectableTextSegmentationMutationSensitive,
    v3014SelectableTextSegmentationSemanticProof: $v3014SelectableTextSegmentationSemanticProof,
    v3014SelectableTextSegmentationPdfjsObservation: $v3014SelectableTextSegmentationPdfjsObservation,
    v3014SelectableTextSegmentationNonclaims: $v3014SelectableTextSegmentationNonclaims,
    v3014SelectableTextSegmentationProductTruth: $v3014SelectableTextSegmentationProductTruth,
    v3014OcrSearchCorpusHash: $v3014OcrSearchCorpusHash,
    v3014OcrSearchOracleHash: $v3014OcrSearchOracleHash,
    v3014OcrSearchProfile: $v3014OcrSearchProfile,
    v3014OcrSearchCaseCount: $v3014OcrSearchCaseCount,
    v3014OcrSearchPassed: $v3014OcrSearchPassed,
    v3014OcrSearchSkipped: $v3014OcrSearchSkipped,
    v3014OcrSearchPass: $v3014OcrSearchPass,
    v3014OcrSearchMutationSensitive: $v3014OcrSearchMutationSensitive,
    v3014OcrSearchResourceProof: $v3014OcrSearchResourceProof,
    v3014OcrSearchNonclaims: $v3014OcrSearchNonclaims,
    v3014OcrSearchProductTruth: $v3014OcrSearchProductTruth,
    v3014CitationChunkCorpusHash: $v3014CitationChunkCorpusHash,
    v3014CitationChunkOracleHash: $v3014CitationChunkOracleHash,
    v3014CitationChunkCaseCount: $v3014CitationChunkCaseCount,
    v3014CitationChunkPassed: $v3014CitationChunkPassed,
    v3014CitationChunkSkipped: $v3014CitationChunkSkipped,
    v3014SemanticHintCorpusHash: $v3014SemanticHintCorpusHash,
    v3014SemanticHintOracleHash: $v3014SemanticHintOracleHash,
    v3014SemanticHintCaseCount: $v3014SemanticHintCaseCount,
    v3014SemanticHintPassed: $v3014SemanticHintPassed,
    v3014SemanticHintSkipped: $v3014SemanticHintSkipped,
    v3014DocumentAstCorpusHash: $v3014DocumentAstCorpusHash,
    v3014DocumentAstOracleHash: $v3014DocumentAstOracleHash,
    v3014DocumentAstCaseCount: $v3014DocumentAstCaseCount,
    v3014DocumentAstPassed: $v3014DocumentAstPassed,
    v3014DocumentAstSkipped: $v3014DocumentAstSkipped,
    v3014DocumentMapCorpusHash: $v3014DocumentMapCorpusHash,
    v3014DocumentMapOracleHash: $v3014DocumentMapOracleHash,
    v3014DocumentMapCaseCount: $v3014DocumentMapCaseCount,
    v3014DocumentMapPassed: $v3014DocumentMapPassed,
    v3014DocumentMapSkipped: $v3014DocumentMapSkipped,
    v3014TrustReportCorpusHash: $v3014TrustReportCorpusHash,
    v3014TrustReportOracleHash: $v3014TrustReportOracleHash,
    v3014TrustReportCaseCount: $v3014TrustReportCaseCount,
    v3014TrustReportPassed: $v3014TrustReportPassed,
    v3014TrustReportSkipped: $v3014TrustReportSkipped,
    v3014SelectableTableCorpusHash: $v3014SelectableTableCorpusHash,
    v3014SelectableTableOracleHash: $v3014SelectableTableOracleHash,
    v3014SelectableTableCaseCount: $v3014SelectableTableCaseCount,
    v3014SelectableTablePassed: $v3014SelectableTablePassed,
    v3014SelectableTableSkipped: $v3014SelectableTableSkipped,
    v3014CaptionLinkCorpusHash: $v3014CaptionLinkCorpusHash,
    v3014CaptionLinkOracleHash: $v3014CaptionLinkOracleHash,
    v3014CaptionLinkCaseCount: $v3014CaptionLinkCaseCount,
    v3014CaptionLinkPassed: $v3014CaptionLinkPassed,
    v3014CaptionLinkSkipped: $v3014CaptionLinkSkipped,
    v3014VisualCandidateCorpusHash: $v3014VisualCandidateCorpusHash,
    v3014VisualCandidateOracleHash: $v3014VisualCandidateOracleHash,
    v3014VisualCandidateCaseCount: $v3014VisualCandidateCaseCount,
    v3014VisualCandidatePassed: $v3014VisualCandidatePassed,
    v3014VisualCandidateSkipped: $v3014VisualCandidateSkipped,
    v3014VisualFusionCorpusHash: $v3014VisualFusionCorpusHash,
    v3014VisualFusionOracleHash: $v3014VisualFusionOracleHash,
    v3014VisualFusionCaseCount: $v3014VisualFusionCaseCount,
    v3014VisualFusionPassed: $v3014VisualFusionPassed,
    v3014VisualFusionSkipped: $v3014VisualFusionSkipped,
    v3014DocumentAstVisualFusionCorpusHash: $v3014DocumentAstVisualFusionCorpusHash,
    v3014DocumentAstVisualFusionOracleHash: $v3014DocumentAstVisualFusionOracleHash,
    v3014DocumentAstVisualFusionCaseCount: $v3014DocumentAstVisualFusionCaseCount,
    v3014DocumentAstVisualFusionPassed: $v3014DocumentAstVisualFusionPassed,
    v3014DocumentAstVisualFusionSkipped: $v3014DocumentAstVisualFusionSkipped,
    v3014ReadOcrCorpusHash: $v3014ReadOcrCorpusHash,
    v3014ReadOcrOracleHash: $v3014ReadOcrOracleHash,
    v3014ReadOcrCaseCount: $v3014ReadOcrCaseCount,
    v3014ReadOcrPassed: $v3014ReadOcrPassed,
    v3014ReadOcrSkipped: $v3014ReadOcrSkipped,
    v3014ReadOcrResidualCorpusHash: $v3014ReadOcrResidualCorpusHash,
    v3014ReadOcrResidualOracleHash: $v3014ReadOcrResidualOracleHash,
    v3014ReadOcrResidualCaseCount: $v3014ReadOcrResidualCaseCount,
    v3014ReadOcrResidualPassed: $v3014ReadOcrResidualPassed,
    v3014ReadOcrResidualSkipped: $v3014ReadOcrResidualSkipped,
    v3014OcrTsvCorpusHash: $v3014OcrTsvCorpusHash,
    v3014OcrTsvOracleHash: $v3014OcrTsvOracleHash,
    v3014OcrTsvCaseCount: $v3014OcrTsvCaseCount,
    v3014OcrTsvPassed: $v3014OcrTsvPassed,
    v3014OcrTsvSkipped: $v3014OcrTsvSkipped,
    v3014OcrTableMergeCorpusHash: $v3014OcrTableMergeCorpusHash,
    v3014OcrTableMergeOracleHash: $v3014OcrTableMergeOracleHash,
    v3014OcrTableMergeCaseCount: $v3014OcrTableMergeCaseCount,
    v3014OcrTableMergePassed: $v3014OcrTableMergePassed,
    v3014OcrTableMergeSkipped: $v3014OcrTableMergeSkipped,
    v3014OcrSearchResidualCorpusHash: $v3014OcrSearchResidualCorpusHash,
    v3014OcrSearchResidualOracleHash: $v3014OcrSearchResidualOracleHash,
    v3014OcrSearchResidualCaseCount: $v3014OcrSearchResidualCaseCount,
    v3014OcrSearchResidualPassed: $v3014OcrSearchResidualPassed,
    v3014OcrSearchResidualSkipped: $v3014OcrSearchResidualSkipped,
    v3014OcrSearchInterleaveCorpusHash: $v3014OcrSearchInterleaveCorpusHash,
    v3014OcrSearchInterleaveOracleHash: $v3014OcrSearchInterleaveOracleHash,
    v3014OcrSearchInterleaveCaseCount: $v3014OcrSearchInterleaveCaseCount,
    v3014OcrSearchInterleavePassed: $v3014OcrSearchInterleavePassed,
    v3014OcrSearchInterleaveSkipped: $v3014OcrSearchInterleaveSkipped,
    v3014UrlSingleFetchCorpusHash: $v3014UrlSingleFetchCorpusHash,
    v3014UrlSingleFetchOracleHash: $v3014UrlSingleFetchOracleHash,
    v3014UrlSingleFetchCaseCount: $v3014UrlSingleFetchCaseCount,
    v3014UrlSingleFetchPassed: $v3014UrlSingleFetchPassed,
    v3014UrlSingleFetchSkipped: $v3014UrlSingleFetchSkipped,
    v3014OcrSearchTsvCorpusHash: $v3014OcrSearchTsvCorpusHash,
    v3014OcrSearchTsvOracleHash: $v3014OcrSearchTsvOracleHash,
    v3014OcrSearchTsvCaseCount: $v3014OcrSearchTsvCaseCount,
    v3014OcrSearchTsvPassed: $v3014OcrSearchTsvPassed,
    v3014OcrSearchTsvSkipped: $v3014OcrSearchTsvSkipped,
    v3014SearchMultiwordGeometryCorpusHash: $v3014SearchMultiwordGeometryCorpusHash,
    v3014SearchMultiwordGeometryOracleHash: $v3014SearchMultiwordGeometryOracleHash,
    v3014SearchMultiwordGeometryCaseCount: $v3014SearchMultiwordGeometryCaseCount,
    v3014SearchMultiwordGeometryPassed: $v3014SearchMultiwordGeometryPassed,
    v3014SearchMultiwordGeometrySkipped: $v3014SearchMultiwordGeometrySkipped,
    v3014FormResidualCorpusHash: $v3014FormResidualCorpusHash,
    v3014FormResidualOracleHash: $v3014FormResidualOracleHash,
    v3014FormResidualCaseCount: $v3014FormResidualCaseCount,
    v3014FormResidualPassed: $v3014FormResidualPassed,
    v3014FormResidualSkipped: $v3014FormResidualSkipped,
    v3014FormRadioGroupCorpusHash: $v3014FormRadioGroupCorpusHash,
    v3014FormRadioGroupOracleHash: $v3014FormRadioGroupOracleHash,
    v3014FormRadioGroupCaseCount: $v3014FormRadioGroupCaseCount,
    v3014FormRadioGroupPassed: $v3014FormRadioGroupPassed,
    v3014FormRadioGroupSkipped: $v3014FormRadioGroupSkipped,
    v3014AttachmentResidualCorpusHash: $v3014AttachmentResidualCorpusHash,
    v3014AttachmentResidualOracleHash: $v3014AttachmentResidualOracleHash,
    v3014AttachmentResidualCaseCount: $v3014AttachmentResidualCaseCount,
    v3014AttachmentResidualPassed: $v3014AttachmentResidualPassed,
    v3014AttachmentResidualSkipped: $v3014AttachmentResidualSkipped,
    v3014MarkinfoResidualCorpusHash: $v3014MarkinfoResidualCorpusHash,
    v3014MarkinfoResidualOracleHash: $v3014MarkinfoResidualOracleHash,
    v3014MarkinfoResidualCaseCount: $v3014MarkinfoResidualCaseCount,
    v3014MarkinfoResidualPassed: $v3014MarkinfoResidualPassed,
    v3014MarkinfoResidualSkipped: $v3014MarkinfoResidualSkipped,
    v3014FormParentChildCorpusHash: $v3014FormParentChildCorpusHash,
    v3014FormParentChildOracleHash: $v3014FormParentChildOracleHash,
    v3014FormParentChildCaseCount: $v3014FormParentChildCaseCount,
    v3014FormParentChildPassed: $v3014FormParentChildPassed,
    v3014FormParentChildSkipped: $v3014FormParentChildSkipped,
    v3014AnnotationResidualCorpusHash: $v3014AnnotationResidualCorpusHash,
    v3014AnnotationResidualOracleHash: $v3014AnnotationResidualOracleHash,
    v3014AnnotationResidualCaseCount: $v3014AnnotationResidualCaseCount,
    v3014AnnotationResidualPassed: $v3014AnnotationResidualPassed,
    v3014AnnotationResidualSkipped: $v3014AnnotationResidualSkipped,
    v3014AnnotationDestResidualCorpusHash: $v3014AnnotationDestResidualCorpusHash,
    v3014AnnotationDestResidualOracleHash: $v3014AnnotationDestResidualOracleHash,
    v3014AnnotationDestResidualCaseCount: $v3014AnnotationDestResidualCaseCount,
    v3014AnnotationDestResidualPassed: $v3014AnnotationDestResidualPassed,
    v3014AnnotationDestResidualSkipped: $v3014AnnotationDestResidualSkipped,
    v3014AnnotationActionDestResidualCorpusHash: $v3014AnnotationActionDestResidualCorpusHash,
    v3014AnnotationActionDestResidualOracleHash: $v3014AnnotationActionDestResidualOracleHash,
    v3014AnnotationActionDestResidualCaseCount: $v3014AnnotationActionDestResidualCaseCount,
    v3014AnnotationActionDestResidualPassed: $v3014AnnotationActionDestResidualPassed,
    v3014AnnotationActionDestResidualSkipped: $v3014AnnotationActionDestResidualSkipped,
    v3014AnnotationActionPrecedenceResidualCorpusHash: $v3014AnnotationActionPrecedenceResidualCorpusHash,
    v3014AnnotationActionPrecedenceResidualOracleHash: $v3014AnnotationActionPrecedenceResidualOracleHash,
    v3014AnnotationActionPrecedenceResidualCaseCount: $v3014AnnotationActionPrecedenceResidualCaseCount,
    v3014AnnotationActionPrecedenceResidualPassed: $v3014AnnotationActionPrecedenceResidualPassed,
    v3014AnnotationActionPrecedenceResidualSkipped: $v3014AnnotationActionPrecedenceResidualSkipped,
    v3014InfoFlagsResidualCorpusHash: $v3014InfoFlagsResidualCorpusHash,
    v3014InfoFlagsResidualOracleHash: $v3014InfoFlagsResidualOracleHash,
    v3014InfoFlagsResidualCaseCount: $v3014InfoFlagsResidualCaseCount,
    v3014InfoFlagsResidualPassed: $v3014InfoFlagsResidualPassed,
    v3014InfoFlagsResidualSkipped: $v3014InfoFlagsResidualSkipped,
    v3014PageGeometryResidualCorpusHash: $v3014PageGeometryResidualCorpusHash,
    v3014PageGeometryResidualOracleHash: $v3014PageGeometryResidualOracleHash,
    v3014PageGeometryResidualCaseCount: $v3014PageGeometryResidualCaseCount,
    v3014PageGeometryResidualPassed: $v3014PageGeometryResidualPassed,
    v3014PageGeometryResidualSkipped: $v3014PageGeometryResidualSkipped,
    v3014PageLabelsResidualCorpusHash: $v3014PageLabelsResidualCorpusHash,
    v3014PageLabelsResidualOracleHash: $v3014PageLabelsResidualOracleHash,
    v3014PageLabelsResidualCaseCount: $v3014PageLabelsResidualCaseCount,
    v3014PageLabelsResidualPassed: $v3014PageLabelsResidualPassed,
    v3014PageLabelsResidualSkipped: $v3014PageLabelsResidualSkipped,
    v3014OutlineResidualCorpusHash: $v3014OutlineResidualCorpusHash,
    v3014OutlineResidualOracleHash: $v3014OutlineResidualOracleHash,
    v3014OutlineResidualCaseCount: $v3014OutlineResidualCaseCount,
    v3014OutlineResidualPassed: $v3014OutlineResidualPassed,
    v3014OutlineResidualSkipped: $v3014OutlineResidualSkipped,
    v3014PermissionsResidualCorpusHash: $v3014PermissionsResidualCorpusHash,
    v3014PermissionsResidualOracleHash: $v3014PermissionsResidualOracleHash,
    v3014PermissionsResidualCaseCount: $v3014PermissionsResidualCaseCount,
    v3014PermissionsResidualPassed: $v3014PermissionsResidualPassed,
    v3014PermissionsResidualSkipped: $v3014PermissionsResidualSkipped,
    v3014MetadataPresenceResidualCorpusHash: $v3014MetadataPresenceResidualCorpusHash,
    v3014MetadataPresenceResidualOracleHash: $v3014MetadataPresenceResidualOracleHash,
    v3014InfoExtrasResidualCorpusHash: $v3014InfoExtrasResidualCorpusHash,
    v3014InfoExtrasResidualOracleHash: $v3014InfoExtrasResidualOracleHash,
    v3014EncryptFilterResidualCorpusHash: $v3014EncryptFilterResidualCorpusHash,
    v3014EncryptFilterResidualOracleHash: $v3014EncryptFilterResidualOracleHash,
    v3014LinearizedResidualCorpusHash: $v3014LinearizedResidualCorpusHash,
    v3014LinearizedResidualOracleHash: $v3014LinearizedResidualOracleHash,
    v3014FormFlagsResidualCorpusHash: $v3014FormFlagsResidualCorpusHash,
    v3014FormFlagsResidualOracleHash: $v3014FormFlagsResidualOracleHash,
    v3014TextAnnotationResidualCorpusHash: $v3014TextAnnotationResidualCorpusHash,
    v3014TextAnnotationResidualOracleHash: $v3014TextAnnotationResidualOracleHash,
    v3014RemoteActionResidualCorpusHash: $v3014RemoteActionResidualCorpusHash,
    v3014RemoteActionResidualOracleHash: $v3014RemoteActionResidualOracleHash,
    v3014PopupAnnotationResidualCorpusHash: $v3014PopupAnnotationResidualCorpusHash,
    v3014PopupAnnotationResidualOracleHash: $v3014PopupAnnotationResidualOracleHash,
    v3014PopupZeroSizeResidualCorpusHash: $v3014PopupZeroSizeResidualCorpusHash,
    v3014PopupZeroSizeResidualOracleHash: $v3014PopupZeroSizeResidualOracleHash,
    v3014PopupGroupIrtResidualCorpusHash: $v3014PopupGroupIrtResidualCorpusHash,
    v3014PopupGroupIrtResidualOracleHash: $v3014PopupGroupIrtResidualOracleHash,
    v3014TextAppearanceResidualCorpusHash: $v3014TextAppearanceResidualCorpusHash,
    v3014TextAppearanceResidualOracleHash: $v3014TextAppearanceResidualOracleHash,
    v3014TextNamedAppearanceResidualCorpusHash: $v3014TextNamedAppearanceResidualCorpusHash,
    v3014TextNamedAppearanceResidualOracleHash: $v3014TextNamedAppearanceResidualOracleHash,
    v3014TextInvertedRectResidualCorpusHash: $v3014TextInvertedRectResidualCorpusHash,
    v3014TextInvertedRectResidualOracleHash: $v3014TextInvertedRectResidualOracleHash,
    v3014RemoteNamedDestResidualCorpusHash: $v3014RemoteNamedDestResidualCorpusHash,
    v3014RemoteNamedDestResidualOracleHash: $v3014RemoteNamedDestResidualOracleHash,
    v3014PageLabelsKidsResidualCorpusHash: $v3014PageLabelsKidsResidualCorpusHash,
    v3014PageLabelsKidsResidualOracleHash: $v3014PageLabelsKidsResidualOracleHash,
    v3014FormButtonArrayResidualCorpusHash: $v3014FormButtonArrayResidualCorpusHash,
    v3014FormButtonArrayResidualOracleHash: $v3014FormButtonArrayResidualOracleHash,
    v3014FormButtonDefaultOffResidualCorpusHash: $v3014FormButtonDefaultOffResidualCorpusHash,
    v3014FormButtonDefaultOffResidualOracleHash: $v3014FormButtonDefaultOffResidualOracleHash,
    v3014FormPushbuttonDefaultNullResidualCorpusHash: $v3014FormPushbuttonDefaultNullResidualCorpusHash,
    v3014FormPushbuttonDefaultNullResidualOracleHash: $v3014FormPushbuttonDefaultNullResidualOracleHash,
    v3014FormCheckboxAsValueResidualCorpusHash: $v3014FormCheckboxAsValueResidualCorpusHash,
    v3014FormCheckboxAsValueResidualOracleHash: $v3014FormCheckboxAsValueResidualOracleHash,
    v3014AttachmentOddNamesResidualCorpusHash: $v3014AttachmentOddNamesResidualCorpusHash,
    v3014AttachmentOddNamesResidualOracleHash: $v3014AttachmentOddNamesResidualOracleHash,
    v3014FormUtf16TextResidualCorpusHash: $v3014FormUtf16TextResidualCorpusHash,
    v3014FormUtf16TextResidualOracleHash: $v3014FormUtf16TextResidualOracleHash,
    v3014Utf16TextResidualCorpusHash: $v3014Utf16TextResidualCorpusHash,
    v3014Utf16TextResidualOracleHash: $v3014Utf16TextResidualOracleHash,
    v3014TextInvalidAsResidualCorpusHash: $v3014TextInvalidAsResidualCorpusHash,
    v3014TextInvalidAsResidualOracleHash: $v3014TextInvalidAsResidualOracleHash,
    v3014LineAnnotationResidualCorpusHash: $v3014LineAnnotationResidualCorpusHash,
    v3014LineAnnotationResidualOracleHash: $v3014LineAnnotationResidualOracleHash,
    v3014PolylinePolygonResidualCorpusHash: $v3014PolylinePolygonResidualCorpusHash,
    v3014PolylinePolygonResidualOracleHash: $v3014PolylinePolygonResidualOracleHash,
    v3014InkAnnotationResidualCorpusHash: $v3014InkAnnotationResidualCorpusHash,
    v3014InkAnnotationResidualOracleHash: $v3014InkAnnotationResidualOracleHash,
    v3014BorderWidthClampResidualCorpusHash: $v3014BorderWidthClampResidualCorpusHash,
    v3014BorderWidthClampResidualOracleHash: $v3014BorderWidthClampResidualOracleHash,
    v3014BorderArrayWidthResidualCorpusHash: $v3014BorderArrayWidthResidualCorpusHash,
    v3014BorderArrayWidthResidualOracleHash: $v3014BorderArrayWidthResidualOracleHash,
    v3014BorderBsPreferenceResidualCorpusHash: $v3014BorderBsPreferenceResidualCorpusHash,
    v3014BorderBsPreferenceResidualOracleHash: $v3014BorderBsPreferenceResidualOracleHash,
    v3014BorderBsNondictResidualCorpusHash: $v3014BorderBsNondictResidualCorpusHash,
    v3014BorderBsNondictResidualOracleHash: $v3014BorderBsNondictResidualOracleHash,
    v3014BorderArrayShortResidualCorpusHash: $v3014BorderArrayShortResidualCorpusHash,
    v3014BorderArrayShortResidualOracleHash: $v3014BorderArrayShortResidualOracleHash,
    v3014BorderBsWrongTypeResidualCorpusHash: $v3014BorderBsWrongTypeResidualCorpusHash,
    v3014BorderBsWrongTypeResidualOracleHash: $v3014BorderBsWrongTypeResidualOracleHash,
    v3014BorderZeroSizeClampBypassResidualCorpusHash: $v3014BorderZeroSizeClampBypassResidualCorpusHash,
    v3014BorderZeroSizeClampBypassResidualOracleHash: $v3014BorderZeroSizeClampBypassResidualOracleHash,
    v3014AnnotationAppearanceBboxResidualCorpusHash: $v3014AnnotationAppearanceBboxResidualCorpusHash,
    v3014AnnotationAppearanceBboxResidualOracleHash: $v3014AnnotationAppearanceBboxResidualOracleHash,
    v3014AnnotationApNonstreamResidualCorpusHash: $v3014AnnotationApNonstreamResidualCorpusHash,
    v3014AnnotationApNonstreamResidualOracleHash: $v3014AnnotationApNonstreamResidualOracleHash,
    v3014AnnotationApNamedStateResidualCorpusHash: $v3014AnnotationApNamedStateResidualCorpusHash,
    v3014AnnotationApNamedStateResidualOracleHash: $v3014AnnotationApNamedStateResidualOracleHash,
    v3014AnnotationApNamedStatePolylineInkResidualCorpusHash: $v3014AnnotationApNamedStatePolylineInkResidualCorpusHash,
    v3014AnnotationApNamedStatePolylineInkResidualOracleHash: $v3014AnnotationApNamedStatePolylineInkResidualOracleHash,
    v3014AnnotationApNamedStateSquareCircleResidualCorpusHash: $v3014AnnotationApNamedStateSquareCircleResidualCorpusHash,
    v3014AnnotationApNamedStateSquareCircleResidualOracleHash: $v3014AnnotationApNamedStateSquareCircleResidualOracleHash,
    v3014AnnotationHighlightQuadpointsResidualCorpusHash: $v3014AnnotationHighlightQuadpointsResidualCorpusHash,
    v3014AnnotationHighlightQuadpointsResidualOracleHash: $v3014AnnotationHighlightQuadpointsResidualOracleHash,
    v3014AnnotationTextMarkupQuadpointsResidualCorpusHash: $v3014AnnotationTextMarkupQuadpointsResidualCorpusHash,
    v3014AnnotationTextMarkupQuadpointsResidualOracleHash: $v3014AnnotationTextMarkupQuadpointsResidualOracleHash,
    v3014AnnotationTextMarkupWithApResidualCorpusHash: $v3014AnnotationTextMarkupWithApResidualCorpusHash,
    v3014AnnotationTextMarkupWithApResidualOracleHash: $v3014AnnotationTextMarkupWithApResidualOracleHash,
    v3014MetadataPresenceResidualCaseCount: $v3014MetadataPresenceResidualCaseCount,
    v3014MetadataPresenceResidualPassed: $v3014MetadataPresenceResidualPassed,
    v3014MetadataPresenceResidualSkipped: $v3014MetadataPresenceResidualSkipped,
    v3014InfoExtrasResidualCaseCount: $v3014InfoExtrasResidualCaseCount,
    v3014InfoExtrasResidualPassed: $v3014InfoExtrasResidualPassed,
    v3014InfoExtrasResidualSkipped: $v3014InfoExtrasResidualSkipped,
    v3014EncryptFilterResidualCaseCount: $v3014EncryptFilterResidualCaseCount,
    v3014EncryptFilterResidualPassed: $v3014EncryptFilterResidualPassed,
    v3014EncryptFilterResidualSkipped: $v3014EncryptFilterResidualSkipped,
    v3014VisualCorpusHash: $v3014VisualCorpusHash,
    v3014VisualOracleHash: $v3014VisualOracleHash,
    v3014VisualCaseCount: $v3014VisualCaseCount,
    v3014VisualPassed: $v3014VisualPassed,
    v3014VisualSkipped: $v3014VisualSkipped,
    harness: "scripts/run-pdf-reader-differential.sh",
    differentialTest: "crates/pdf-reader-mcp-server/tests/pdf_reader_mcp_differential.rs#pdf_reader_mcp_differential_matches_ts_oracle",
    immutableInputOracle: "scripts/check-v3014-input-schema-oracle.ts",
    immutableBehaviorOracle: "scripts/differential/fixtures/v3014-behavior-oracle.json",
    immutableBehaviorDifferential: "scripts/differential/check-v3014-behavior-differential.ts",
    immutableTextLayerOracle: "scripts/differential/fixtures/v3014-text-layer-oracle.json",
    immutableTextLayerDifferential: "scripts/differential/check-v3014-text-layer-differential.ts",
    immutableSelectableTextSegmentationCorpus: "scripts/differential/fixtures/v3014-selectable-text-segmentation-corpus.json",
    immutableSelectableTextSegmentationFixtureManifest: "scripts/differential/fixtures/v3014-selectable-text-segmentation-fixture.json",
    immutableSelectableTextSegmentationFixture: "test/fixtures/differential/v3014-selectable-text-segmentation-v1.pdf",
    immutableSelectableTextSegmentationGenerator: "scripts/differential/generate-v3014-selectable-text-segmentation-fixture.ts",
    immutableSelectableTextSegmentationRunner: "scripts/differential/v3014-selectable-text-segmentation-baseline-runner.ts",
    immutableSelectableTextSegmentationProjection: "scripts/differential/v3014-selectable-text-segmentation-projection.ts",
    immutableSelectableTextSegmentationOracle: "scripts/differential/fixtures/v3014-selectable-text-segmentation-oracle.json",
    immutableSelectableTextSegmentationDifferential: "scripts/differential/check-v3014-selectable-text-segmentation-differential.ts",
    immutableOcrSearchCorpus: "scripts/differential/fixtures/v3014-ocr-search-corpus.json",
    immutableOcrSearchRunner: "scripts/differential/v3014-ocr-search-baseline-runner.ts",
    immutableOcrSearchProjection: "scripts/differential/v3014-ocr-search-projection.ts",
    immutableOcrSearchOracle: "scripts/differential/fixtures/v3014-ocr-search-oracle.json",
    immutableOcrSearchCapture: "scripts/differential/capture-v3014-ocr-search-oracle.ts",
    immutableOcrSearchDifferential: "scripts/differential/check-v3014-ocr-search-differential.ts",
    immutableCitationChunkOracle: "scripts/differential/fixtures/v3014-citation-chunk-oracle.json",
    immutableCitationChunkDifferential: "scripts/differential/check-v3014-citation-chunk-differential.ts",
    immutableSemanticHintOracle: "scripts/differential/fixtures/v3014-semantic-hint-oracle.json",
    immutableSemanticHintDifferential: "scripts/differential/check-v3014-semantic-hint-differential.ts",
    immutableDocumentAstOracle: "scripts/differential/fixtures/v3014-document-ast-oracle.json",
    immutableDocumentAstDifferential: "scripts/differential/check-v3014-document-ast-differential.ts",
    immutableDocumentMapOracle: "scripts/differential/fixtures/v3014-document-map-oracle.json",
    immutableDocumentMapDifferential: "scripts/differential/check-v3014-document-map-differential.ts",
    immutableTrustReportOracle: "scripts/differential/fixtures/v3014-trust-report-oracle.json",
    immutableTrustReportDifferential: "scripts/differential/check-v3014-trust-report-differential.ts",
    immutableSelectableTableOracle: "scripts/differential/fixtures/v3014-selectable-table-oracle.json",
    immutableSelectableTableDifferential: "scripts/differential/check-v3014-selectable-table-differential.ts",
    immutableCaptionLinkOracle: "scripts/differential/fixtures/v3014-caption-link-oracle.json",
    immutableCaptionLinkDifferential: "scripts/differential/check-v3014-caption-link-differential.ts",
    immutableVisualCandidateOracle: "scripts/differential/fixtures/v3014-visual-candidate-oracle.json",
    immutableVisualCandidateDifferential: "scripts/differential/check-v3014-visual-candidate-differential.ts",
    immutableVisualFusionOracle: "scripts/differential/fixtures/v3014-visual-fusion-oracle.json",
    immutableVisualFusionDifferential: "scripts/differential/check-v3014-visual-fusion-differential.ts",
    immutableDocumentAstVisualFusionOracle: "scripts/differential/fixtures/v3014-document-ast-visual-fusion-oracle.json",
    immutableDocumentAstVisualFusionDifferential: "scripts/differential/check-v3014-document-ast-visual-fusion-differential.ts",
    immutableReadOcrOracle: "scripts/differential/fixtures/v3014-read-ocr-oracle.json",
    immutableReadOcrDifferential: "scripts/differential/check-v3014-read-ocr-differential.ts",
    immutableReadOcrResidualOracle: "scripts/differential/fixtures/v3014-read-ocr-residual-oracle.json",
    immutableReadOcrResidualDifferential: "scripts/differential/check-v3014-read-ocr-residual-differential.ts",
    immutableOcrTsvOracle: "scripts/differential/fixtures/v3014-ocr-tsv-oracle.json",
    immutableOcrTsvDifferential: "scripts/differential/check-v3014-ocr-tsv-differential.ts",
    immutableOcrTableMergeOracle: "scripts/differential/fixtures/v3014-ocr-table-merge-oracle.json",
    immutableOcrTableMergeDifferential: "scripts/differential/check-v3014-ocr-table-merge-differential.ts",
    immutableOcrSearchResidualOracle: "scripts/differential/fixtures/v3014-ocr-search-residual-oracle.json",
    immutableOcrSearchResidualDifferential: "scripts/differential/check-v3014-ocr-search-residual-differential.ts",
    immutableOcrSearchInterleaveOracle: "scripts/differential/fixtures/v3014-ocr-search-interleave-oracle.json",
    immutableOcrSearchInterleaveDifferential: "scripts/differential/check-v3014-ocr-search-interleave-differential.ts",
    immutableUrlSingleFetchOracle: "scripts/differential/fixtures/v3014-url-single-fetch-oracle.json",
    immutableUrlSingleFetchDifferential: "scripts/differential/check-v3014-url-single-fetch-differential.ts",
    immutableOcrSearchTsvOracle: "scripts/differential/fixtures/v3014-ocr-search-tsv-oracle.json",
    immutableOcrSearchTsvDifferential: "scripts/differential/check-v3014-ocr-search-tsv-differential.ts",
    immutableSearchMultiwordGeometryOracle: "scripts/differential/fixtures/v3014-search-multiword-geometry-oracle.json",
    immutableSearchMultiwordGeometryDifferential: "scripts/differential/check-v3014-search-multiword-geometry-differential.ts",
    immutableFormResidualOracle: "scripts/differential/fixtures/v3014-form-residual-oracle.json",
    immutableFormResidualDifferential: "scripts/differential/check-v3014-form-residual-differential.ts",
    immutableFormRadioGroupOracle: "scripts/differential/fixtures/v3014-form-radio-group-oracle.json",
    immutableFormRadioGroupDifferential: "scripts/differential/check-v3014-form-radio-group-differential.ts",
    immutableAttachmentResidualOracle: "scripts/differential/fixtures/v3014-attachment-residual-oracle.json",
    immutableAttachmentResidualDifferential: "scripts/differential/check-v3014-attachment-residual-differential.ts",
    immutableMarkinfoResidualOracle: "scripts/differential/fixtures/v3014-markinfo-residual-oracle.json",
    immutableMarkinfoResidualDifferential: "scripts/differential/check-v3014-markinfo-residual-differential.ts",
    immutableFormParentChildOracle: "scripts/differential/fixtures/v3014-form-parent-child-oracle.json",
    immutableFormParentChildDifferential: "scripts/differential/check-v3014-form-parent-child-differential.ts",
    immutableAnnotationResidualOracle: "scripts/differential/fixtures/v3014-annotation-residual-oracle.json",
    immutableAnnotationResidualDifferential: "scripts/differential/check-v3014-annotation-residual-differential.ts",
    immutableAnnotationDestResidualOracle: "scripts/differential/fixtures/v3014-annotation-dest-residual-oracle.json",
    immutableAnnotationDestResidualDifferential: "scripts/differential/check-v3014-annotation-dest-residual-differential.ts",
    immutableAnnotationActionDestResidualOracle: "scripts/differential/fixtures/v3014-annotation-action-dest-residual-oracle.json",
    immutableAnnotationActionDestResidualDifferential: "scripts/differential/check-v3014-annotation-action-dest-residual-differential.ts",
    immutableAnnotationActionPrecedenceResidualOracle: "scripts/differential/fixtures/v3014-annotation-action-precedence-residual-oracle.json",
    immutableAnnotationActionPrecedenceResidualDifferential: "scripts/differential/check-v3014-annotation-action-precedence-residual-differential.ts",
    immutableInfoFlagsResidualOracle: "scripts/differential/fixtures/v3014-info-flags-residual-oracle.json",
    immutableInfoFlagsResidualDifferential: "scripts/differential/check-v3014-info-flags-residual-differential.ts",
    immutablePageGeometryResidualOracle: "scripts/differential/fixtures/v3014-page-geometry-residual-oracle.json",
    immutablePageGeometryResidualDifferential: "scripts/differential/check-v3014-page-geometry-residual-differential.ts",
    immutablePageLabelsResidualOracle: "scripts/differential/fixtures/v3014-page-labels-residual-oracle.json",
    immutablePageLabelsResidualDifferential: "scripts/differential/check-v3014-page-labels-residual-differential.ts",
    immutableOutlineResidualOracle: "scripts/differential/fixtures/v3014-outline-residual-oracle.json",
    immutableOutlineResidualDifferential: "scripts/differential/check-v3014-outline-residual-differential.ts",
    immutablePermissionsResidualOracle: "scripts/differential/fixtures/v3014-permissions-residual-oracle.json",
    immutablePermissionsResidualDifferential: "scripts/differential/check-v3014-permissions-residual-differential.ts",
    immutableMetadataPresenceResidualOracle: "scripts/differential/fixtures/v3014-metadata-presence-residual-oracle.json",
    immutableMetadataPresenceResidualDifferential: "scripts/differential/check-v3014-metadata-presence-residual-differential.ts",
    immutableInfoExtrasResidualOracle: "scripts/differential/fixtures/v3014-info-extras-residual-oracle.json",
    immutableInfoExtrasResidualDifferential: "scripts/differential/check-v3014-info-extras-residual-differential.ts",
    immutableEncryptFilterResidualOracle: "scripts/differential/fixtures/v3014-encrypt-filter-residual-oracle.json",
    immutableEncryptFilterResidualDifferential: "scripts/differential/check-v3014-encrypt-filter-residual-differential.ts",
    immutableLinearizedResidualOracle: "scripts/differential/fixtures/v3014-linearized-residual-oracle.json",
    immutableLinearizedResidualDifferential: "scripts/differential/check-v3014-linearized-residual-differential.ts",
    immutableFormFlagsResidualOracle: "scripts/differential/fixtures/v3014-form-flags-residual-oracle.json",
    immutableFormFlagsResidualDifferential: "scripts/differential/check-v3014-form-flags-residual-differential.ts",
    immutableTextAnnotationResidualOracle: "scripts/differential/fixtures/v3014-text-annotation-residual-oracle.json",
    immutableTextAnnotationResidualDifferential: "scripts/differential/check-v3014-text-annotation-residual-differential.ts",
    immutableRemoteActionResidualOracle: "scripts/differential/fixtures/v3014-remote-action-residual-oracle.json",
    immutableRemoteActionResidualDifferential: "scripts/differential/check-v3014-remote-action-residual-differential.ts",
    immutablePopupAnnotationResidualOracle: "scripts/differential/fixtures/v3014-popup-annotation-residual-oracle.json",
    immutablePopupAnnotationResidualDifferential: "scripts/differential/check-v3014-popup-annotation-residual-differential.ts",
    immutablePopupZeroSizeResidualOracle: "scripts/differential/fixtures/v3014-popup-zero-size-residual-oracle.json",
    immutablePopupZeroSizeResidualDifferential: "scripts/differential/check-v3014-popup-zero-size-residual-differential.ts",
    immutablePopupGroupIrtResidualOracle: "scripts/differential/fixtures/v3014-popup-group-irt-residual-oracle.json",
    immutablePopupGroupIrtResidualDifferential: "scripts/differential/check-v3014-popup-group-irt-residual-differential.ts",
    immutableTextAppearanceResidualOracle: "scripts/differential/fixtures/v3014-text-appearance-residual-oracle.json",
    immutableTextAppearanceResidualDifferential: "scripts/differential/check-v3014-text-appearance-residual-differential.ts",
    immutableTextNamedAppearanceResidualOracle: "scripts/differential/fixtures/v3014-text-named-appearance-residual-oracle.json",
    immutableTextNamedAppearanceResidualDifferential: "scripts/differential/check-v3014-text-named-appearance-residual-differential.ts",
    immutableTextInvertedRectResidualOracle: "scripts/differential/fixtures/v3014-text-inverted-rect-residual-oracle.json",
    immutableTextInvertedRectResidualDifferential: "scripts/differential/check-v3014-text-inverted-rect-residual-differential.ts",
    immutableRemoteNamedDestResidualOracle: "scripts/differential/fixtures/v3014-remote-named-dest-residual-oracle.json",
    immutableRemoteNamedDestResidualDifferential: "scripts/differential/check-v3014-remote-named-dest-residual-differential.ts",
    immutablePageLabelsKidsResidualOracle: "scripts/differential/fixtures/v3014-page-labels-kids-residual-oracle.json",
    immutablePageLabelsKidsResidualDifferential: "scripts/differential/check-v3014-page-labels-kids-residual-differential.ts",
    immutableFormButtonArrayResidualOracle: "scripts/differential/fixtures/v3014-form-button-array-residual-oracle.json",
    immutableFormButtonArrayResidualDifferential: "scripts/differential/check-v3014-form-button-array-residual-differential.ts",
    immutableFormButtonDefaultOffResidualOracle: "scripts/differential/fixtures/v3014-form-button-default-off-residual-oracle.json",
    immutableFormButtonDefaultOffResidualDifferential: "scripts/differential/check-v3014-form-button-default-off-residual-differential.ts",
    immutableFormPushbuttonDefaultNullResidualOracle: "scripts/differential/fixtures/v3014-form-pushbutton-default-null-residual-oracle.json",
    immutableFormPushbuttonDefaultNullResidualDifferential: "scripts/differential/check-v3014-form-pushbutton-default-null-residual-differential.ts",
    immutableFormCheckboxAsValueResidualOracle: "scripts/differential/fixtures/v3014-form-checkbox-as-value-residual-oracle.json",
    immutableFormCheckboxAsValueResidualDifferential: "scripts/differential/check-v3014-form-checkbox-as-value-residual-differential.ts",
    immutableAttachmentOddNamesResidualOracle: "scripts/differential/fixtures/v3014-attachment-odd-names-residual-oracle.json",
    immutableAttachmentOddNamesResidualDifferential: "scripts/differential/check-v3014-attachment-odd-names-residual-differential.ts",
    immutableFormUtf16TextResidualOracle: "scripts/differential/fixtures/v3014-form-utf16-text-residual-oracle.json",
    immutableFormUtf16TextResidualDifferential: "scripts/differential/check-v3014-form-utf16-text-residual-differential.ts",
    immutableUtf16TextResidualOracle: "scripts/differential/fixtures/v3014-utf16-text-residual-oracle.json",
    immutableUtf16TextResidualDifferential: "scripts/differential/check-v3014-utf16-text-residual-differential.ts",
    immutableTextInvalidAsResidualOracle: "scripts/differential/fixtures/v3014-text-invalid-as-residual-oracle.json",
    immutableTextInvalidAsResidualDifferential: "scripts/differential/check-v3014-text-invalid-as-residual-differential.ts",
    immutableLineAnnotationResidualOracle: "scripts/differential/fixtures/v3014-line-annotation-residual-oracle.json",
    immutableLineAnnotationResidualDifferential: "scripts/differential/check-v3014-line-annotation-residual-differential.ts",
    immutablePolylinePolygonResidualOracle: "scripts/differential/fixtures/v3014-polyline-polygon-residual-oracle.json",
    immutablePolylinePolygonResidualDifferential: "scripts/differential/check-v3014-polyline-polygon-residual-differential.ts",
    immutableInkAnnotationResidualOracle: "scripts/differential/fixtures/v3014-ink-annotation-residual-oracle.json",
    immutableInkAnnotationResidualDifferential: "scripts/differential/check-v3014-ink-annotation-residual-differential.ts",
    immutableBorderWidthClampResidualOracle: "scripts/differential/fixtures/v3014-border-width-clamp-residual-oracle.json",
    immutableBorderWidthClampResidualDifferential: "scripts/differential/check-v3014-border-width-clamp-residual-differential.ts",
    immutableBorderArrayWidthResidualOracle: "scripts/differential/fixtures/v3014-border-array-width-residual-oracle.json",
    immutableBorderArrayWidthResidualDifferential: "scripts/differential/check-v3014-border-array-width-residual-differential.ts",
    immutableBorderBsPreferenceResidualOracle: "scripts/differential/fixtures/v3014-border-bs-preference-residual-oracle.json",
    immutableBorderBsPreferenceResidualDifferential: "scripts/differential/check-v3014-border-bs-preference-residual-differential.ts",
    immutableBorderBsNondictResidualOracle: "scripts/differential/fixtures/v3014-border-bs-nondict-residual-oracle.json",
    immutableBorderBsNondictResidualDifferential: "scripts/differential/check-v3014-border-bs-nondict-residual-differential.ts",
    immutableBorderArrayShortResidualOracle: "scripts/differential/fixtures/v3014-border-array-short-residual-oracle.json",
    immutableBorderArrayShortResidualDifferential: "scripts/differential/check-v3014-border-array-short-residual-differential.ts",
    immutableBorderBsWrongTypeResidualOracle: "scripts/differential/fixtures/v3014-border-bs-wrong-type-residual-oracle.json",
    immutableBorderBsWrongTypeResidualDifferential: "scripts/differential/check-v3014-border-bs-wrong-type-residual-differential.ts",
    immutableBorderZeroSizeClampBypassResidualOracle: "scripts/differential/fixtures/v3014-border-zero-size-clamp-bypass-residual-oracle.json",
    immutableBorderZeroSizeClampBypassResidualDifferential: "scripts/differential/check-v3014-border-zero-size-clamp-bypass-residual-differential.ts",
    immutableAnnotationAppearanceBboxResidualOracle: "scripts/differential/fixtures/v3014-annotation-appearance-bbox-residual-oracle.json",
    immutableAnnotationAppearanceBboxResidualDifferential: "scripts/differential/check-v3014-annotation-appearance-bbox-residual-differential.ts",
    immutableAnnotationApNonstreamResidualOracle: "scripts/differential/fixtures/v3014-annotation-ap-nonstream-residual-oracle.json",
    immutableAnnotationApNonstreamResidualDifferential: "scripts/differential/check-v3014-annotation-ap-nonstream-residual-differential.ts",
    immutableAnnotationApNamedStateResidualOracle: "scripts/differential/fixtures/v3014-annotation-ap-named-state-residual-oracle.json",
    immutableAnnotationApNamedStateResidualDifferential: "scripts/differential/check-v3014-annotation-ap-named-state-residual-differential.ts",
    immutableAnnotationApNamedStatePolylineInkResidualOracle: "scripts/differential/fixtures/v3014-annotation-ap-named-state-polyline-ink-residual-oracle.json",
    immutableAnnotationApNamedStatePolylineInkResidualDifferential: "scripts/differential/check-v3014-annotation-ap-named-state-polyline-ink-residual-differential.ts",
    immutableAnnotationApNamedStateSquareCircleResidualOracle: "scripts/differential/fixtures/v3014-annotation-ap-named-state-square-circle-residual-oracle.json",
    immutableAnnotationApNamedStateSquareCircleResidualDifferential: "scripts/differential/check-v3014-annotation-ap-named-state-square-circle-residual-differential.ts",
    immutableAnnotationHighlightQuadpointsResidualOracle: "scripts/differential/fixtures/v3014-annotation-highlight-quadpoints-residual-oracle.json",
    immutableAnnotationHighlightQuadpointsResidualDifferential: "scripts/differential/check-v3014-annotation-highlight-quadpoints-residual-differential.ts",
    immutableAnnotationTextMarkupQuadpointsResidualOracle: "scripts/differential/fixtures/v3014-annotation-text-markup-quadpoints-residual-oracle.json",
    immutableAnnotationTextMarkupQuadpointsResidualDifferential: "scripts/differential/check-v3014-annotation-text-markup-quadpoints-residual-differential.ts",
    immutableAnnotationTextMarkupWithApResidualOracle: "scripts/differential/fixtures/v3014-annotation-text-markup-with-ap-residual-oracle.json",
    immutableAnnotationTextMarkupWithApResidualDifferential: "scripts/differential/check-v3014-annotation-text-markup-with-ap-residual-differential.ts",
    immutableVisualOracle: "scripts/differential/fixtures/v3014-visual-oracle.json",
    immutableVisualDifferential: "scripts/differential/check-v3014-visual-differential.ts",
    liveTextOracle: "scripts/differential/ts-vs-rust-text-oracle.ts",
    structuralConsistencyOracle: "scripts/differential/pdf-reader-mcp-oracle.ts",
    nonClaims: ["full TS 3.0.14 behavioral parity", "text-layer/element/chunk geometry outside the immutable 1-case selectable-text corpus", "citation-chunk semantics outside the immutable 6-case schema/boundary/dependency corpus", "semantic-hint classification outside the immutable 3-case classifier/chunk-propagation corpus, including layout variants not represented by the deterministic fixtures", "raw page_contents payload/presence parity", "document-AST semantics outside the immutable text-only, selectable-table, and exact selectable-table caption-linkage corpora, including image captions, visual enrichment payloads, OCR fusion, general text geometry, and broader layout/semantic variants", "document-map semantics outside the immutable text-first/trust/table/visual-candidate linkage corpora, including OCR, accessibility, arbitrary images, visual enrichment payloads, provider fusion, and arbitrary hostile internal chunk spans", "trust-report semantics outside the immutable redaction/link/table-quality linkage corpora, including broader safety/layout/annotation variants", "within the immutable document-map subset, exact cross-runtime provenance label values, PDF.js-only empty text runs, and run/font/direction/transform/EOL-dependent counter values are schema-validated but not semantic-value claims", "selectable-table detection outside the exact six-case corpus; OCR/visual/ML/general-table parity", "provider-independent visual-candidate selection outside the immutable 11-case corpus", "configured-command visual enrichment payload/Document Map fusion outside the immutable 5-case corpus",
      "read_pdf include_ocr_text_layer outside the immutable 6-case corpus",
      "read_pdf OCR residual outside the immutable 3-case corpus", "visual/provider parity outside the immutable 16-case render/crop/OCR/analyze/read-fusion/table-projection corpus", "Tesseract TSV parity", "analyze_regions HTTP/preset provider parity", "Document Twin semantic parity"],
    retirementGate: "scripts/check-no-ts-stdio-backend.sh (runs only when dropInFor3014=true)"
  }' >"$ARTIFACT"

echo "pdf-reader-mcp-differential: OK (cases=$CASE_COUNT read_pdf=$READ_PDF_CASE_COUNT stdio=$STDIO_PROBE_CASE_COUNT corpus=$FIXTURE_CORPUS_HASH)" | tee -a "$LOG"
echo "verification artifact: $ARTIFACT" | tee -a "$LOG"
