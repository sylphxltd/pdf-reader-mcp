#!/usr/bin/env bash
# Pre-deletion gate for transport/stdio-ts-adapter (src/index.ts).
# Fails until web-mcp-http + stdio-rust-rmcp + all three V3 tools are parity_proven.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LEDGER="$ROOT/docs/specs/pdf-reader-mcp-migration-ledger.json"

require_ledger_state() {
	local capability="$1"
	local expected="$2"
	node - "$LEDGER" "$capability" "$expected" <<'NODE'
const [ledgerPath, capability, expected] = process.argv.slice(2);
const ledger = JSON.parse(require("node:fs").readFileSync(ledgerPath, "utf8"));
const entry = ledger.capabilities.find((cap) => cap.id === capability);
if (!entry) {
  console.error(`[check-ts-adapter-deletion-ready] missing capability ${capability}`);
  process.exit(1);
}
if (entry.state !== expected) {
  console.error(
    `[check-ts-adapter-deletion-ready] ${capability} is ${entry.state}; expected ${expected}`
  );
  process.exit(1);
}
NODE
}

echo "[check-ts-adapter-deletion-ready] verifying fleet gates in ${LEDGER}"

require_ledger_state "transport/web-mcp-http" "authority_rust"
require_ledger_state "transport/stdio-rust-rmcp" "parity_proven"
require_ledger_state "tool/read_pdf" "parity_proven"
require_ledger_state "tool/search_pdf" "parity_proven"
require_ledger_state "tool/pdf_evidence" "parity_proven"

if [[ ! -f "$ROOT/src/index.ts" ]]; then
	echo "[check-ts-adapter-deletion-ready] src/index.ts already removed; mark transport/stdio-ts-adapter ts_deleted" >&2
	exit 1
fi

if ! grep -q 'PDF_READER_MCP_TRANSPORT:-}" == "ts"' "$ROOT/bin/pdf-reader-mcp"; then
	echo "[check-ts-adapter-deletion-ready] bin must keep explicit TS opt-in until deletion slice" >&2
	exit 1
fi

echo "[check-ts-adapter-deletion-ready] PASS — safe to open transport/stdio-ts-adapter deletion PR"
echo "Next slice: delete src/index.ts + dist/index.js, remove use_ts_transport branch, mark transport/stdio-ts-adapter ts_deleted"