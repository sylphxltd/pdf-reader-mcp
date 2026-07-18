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
BEHAVIOR_SPEC_HASH="$(sha256sum "$REPO_ROOT/scripts/differential/fixtures/pdf-reader-mcp-corpus.json" "$REPO_ROOT/test/fixtures/read-pdf-golden.json" 2>/dev/null | awk '{print $1}' | sha256sum | awk '{print $1}' || echo missing)"
FIXTURE_CORPUS_HASH="$(jq -r '.fixtureCorpusHash' "$ORACLE_JSON")"
GOLDEN_FIXTURE_HASH="$(jq -r '.goldenFixtureHash' "$ORACLE_JSON")"
CASE_COUNT="$(jq '.cases | length' "$ORACLE_JSON")"
READ_PDF_CASE_COUNT="$(jq '[.cases[] | select(.domain == "readPdfTool")] | length' "$ORACLE_JSON")"
STDIO_PROBE_CASE_COUNT="$(jq '[.cases[] | select(.domain == "stdioProbe")] | length' "$ORACLE_JSON")"
TOOL_ROUTE_CASE_COUNT="$(jq '[.cases[] | select(.domain == "toolRouteContract")] | length' "$ORACLE_JSON")"

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
  --arg sliceFilter "$SLICE_FILTER" \
  --arg slice "$ARTIFACT_SLICE" \
  --argjson caseCount "$CASE_COUNT" \
  --argjson readPdfCaseCount "$READ_PDF_CASE_COUNT" \
  --argjson stdioProbeCaseCount "$STDIO_PROBE_CASE_COUNT" \
  --argjson toolRouteCaseCount "$TOOL_ROUTE_CASE_COUNT" \
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
    caseCount: $caseCount,
    readPdfCaseCount: $readPdfCaseCount,
    stdioProbeCaseCount: $stdioProbeCaseCount,
    toolRouteCaseCount: $toolRouteCaseCount,
    harness: "scripts/run-pdf-reader-differential.sh",
    differentialTest: "crates/pdf-reader-mcp-server/tests/pdf_reader_mcp_differential.rs#pdf_reader_mcp_differential_matches_ts_oracle",
    immutableInputOracle: "scripts/check-v3014-input-schema-oracle.ts",
    liveTextOracle: "scripts/differential/ts-vs-rust-text-oracle.ts",
    structuralConsistencyOracle: "scripts/differential/pdf-reader-mcp-oracle.ts",
    nonClaims: ["full TS 3.0.14 behavioral parity", "visual parity", "Document Twin semantic parity"],
    retirementGate: "scripts/check-no-ts-stdio-backend.sh (runs only when dropInFor3014=true)"
  }' >"$ARTIFACT"

echo "pdf-reader-mcp-differential: OK (cases=$CASE_COUNT read_pdf=$READ_PDF_CASE_COUNT stdio=$STDIO_PROBE_CASE_COUNT corpus=$FIXTURE_CORPUS_HASH)" | tee -a "$LOG"
echo "verification artifact: $ARTIFACT" | tee -a "$LOG"
