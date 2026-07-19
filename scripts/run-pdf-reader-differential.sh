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
    immutableVisualOracle: "scripts/differential/fixtures/v3014-visual-oracle.json",
    immutableVisualDifferential: "scripts/differential/check-v3014-visual-differential.ts",
    liveTextOracle: "scripts/differential/ts-vs-rust-text-oracle.ts",
    structuralConsistencyOracle: "scripts/differential/pdf-reader-mcp-oracle.ts",
    nonClaims: ["full TS 3.0.14 behavioral parity", "text-layer/element/chunk geometry outside the immutable 1-case selectable-text corpus", "citation-chunk semantics outside the immutable 6-case schema/boundary/dependency corpus", "semantic-hint classification outside the immutable 3-case classifier/chunk-propagation corpus, including layout variants not represented by the deterministic fixtures", "raw page_contents payload/presence parity", "document-AST semantics outside the immutable text-only, selectable-table, and exact selectable-table caption-linkage corpora, including image captions, visual enrichment payloads, OCR fusion, general text geometry, and broader layout/semantic variants", "document-map semantics outside the immutable text-first/trust/table/visual-candidate linkage corpora, including OCR, accessibility, arbitrary images, visual enrichment payloads, provider fusion, and arbitrary hostile internal chunk spans", "trust-report semantics outside the immutable redaction/link/table-quality linkage corpora, including broader safety/layout/annotation variants", "within the immutable document-map subset, exact cross-runtime provenance label values, PDF.js-only empty text runs, and run/font/direction/transform/EOL-dependent counter values are schema-validated but not semantic-value claims", "selectable-table detection outside the exact six-case corpus; OCR/visual/ML/general-table parity", "provider-independent visual-candidate selection outside the immutable 11-case corpus", "configured-command visual enrichment payload/Document Map fusion outside the immutable 5-case corpus",
      "read_pdf include_ocr_text_layer outside the immutable 6-case corpus", "visual/provider parity outside the immutable 16-case render/crop/OCR/analyze/read-fusion/table-projection corpus", "Tesseract TSV parity", "analyze_regions HTTP/preset provider parity", "Document Twin semantic parity"],
    retirementGate: "scripts/check-no-ts-stdio-backend.sh (runs only when dropInFor3014=true)"
  }' >"$ARTIFACT"

echo "pdf-reader-mcp-differential: OK (cases=$CASE_COUNT read_pdf=$READ_PDF_CASE_COUNT stdio=$STDIO_PROBE_CASE_COUNT corpus=$FIXTURE_CORPUS_HASH)" | tee -a "$LOG"
echo "verification artifact: $ARTIFACT" | tee -a "$LOG"
