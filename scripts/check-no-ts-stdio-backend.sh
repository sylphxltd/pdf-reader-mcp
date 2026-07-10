#!/usr/bin/env bash
# Rust-First gate (S3 prep): default MCP stdio transport must delegate to Rust rmcp.
# TS stdio adapter remains opt-in (transport/stdio-ts-adapter) until deletion slice.
# Forbidden: default bin stdio path via node; parallel TS stdio as shipped default.
# Ledger ts_deleted flip blocked until PR merge + prod smoke (rej-001).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${ROOT}/bin/pdf-reader-mcp"
TS_ENTRY="${ROOT}/src/index.ts"
RUST_MAIN="${ROOT}/crates/pdf-reader-mcp-server/src/main.rs"
STDIO_GATE="${ROOT}/scripts/check-no-ts-stdio-backend.sh"
GATE_TEST="${ROOT}/test/check-no-ts-stdio-backend.test.ts"
STDIO_INTEGRATION="${ROOT}/test/integration/stdio-transport.test.ts"
STDIO_MATRIX="${ROOT}/test/stdioTransport.matrix.test.ts"
TS_ADAPTER_GATE="${ROOT}/scripts/check-ts-adapter-deletion-ready.sh"
LEDGER="${ROOT}/docs/specs/pdf-reader-mcp-migration-ledger.json"

violations=0

report_violation() {
	echo "VIOLATION: $*"
	violations=$((violations + 1))
}

echo "=== check-no-ts-stdio-backend $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [[ ! -f "${BIN}" ]]; then
	report_violation "missing bin/pdf-reader-mcp"
fi

if [[ ! -f "${STDIO_GATE}" ]]; then
	report_violation "missing scripts/check-no-ts-stdio-backend.sh"
fi

if [[ ! -f "${GATE_TEST}" ]]; then
	report_violation "missing test/check-no-ts-stdio-backend.test.ts"
fi

if [[ ! -f "${STDIO_INTEGRATION}" ]]; then
	report_violation "missing test/integration/stdio-transport.test.ts"
fi

if [[ ! -f "${STDIO_MATRIX}" ]]; then
	report_violation "missing test/stdioTransport.matrix.test.ts"
fi

if [[ ! -f "${TS_ADAPTER_GATE}" ]]; then
	report_violation "missing scripts/check-ts-adapter-deletion-ready.sh"
fi

if [[ ! -f "${LEDGER}" ]]; then
	report_violation "missing docs/specs/pdf-reader-mcp-migration-ledger.json"
fi

if [[ ! -f "${RUST_MAIN}" ]]; then
	report_violation "missing crates/pdf-reader-mcp-server/src/main.rs"
fi

if [[ ! -f "${TS_ENTRY}" ]]; then
	report_violation "src/index.ts must remain until transport/stdio-ts-adapter deletion PR merges"
fi

if [[ -f "${LEDGER}" ]]; then
	node - "${LEDGER}" <<'NODE'
const [ledgerPath] = process.argv.slice(2);
const ledger = JSON.parse(require("node:fs").readFileSync(ledgerPath, "utf8"));
const stdioRust = ledger.capabilities.find((cap) => cap.id === "transport/stdio-rust-rmcp");
const tsAdapter = ledger.capabilities.find((cap) => cap.id === "transport/stdio-ts-adapter");
const http = ledger.capabilities.find((cap) => cap.id === "transport/web-mcp-http");
if (!stdioRust) {
  console.error("[check-no-ts-stdio-backend] missing capability transport/stdio-rust-rmcp");
  process.exit(1);
}
if (!tsAdapter) {
  console.error("[check-no-ts-stdio-backend] missing capability transport/stdio-ts-adapter");
  process.exit(1);
}
if (!http) {
  console.error("[check-no-ts-stdio-backend] missing capability transport/web-mcp-http");
  process.exit(1);
}
if (stdioRust.state !== "rust_impl") {
  console.error(
    `[check-no-ts-stdio-backend] transport/stdio-rust-rmcp is ${stdioRust.state}; expected rust_impl (rej-010 promotion freeze)`
  );
  process.exit(1);
}
if (!stdioRust.differentialTest) {
  console.error(
    "[check-no-ts-stdio-backend] transport/stdio-rust-rmcp missing differentialTest (rej-010 harness)"
  );
  process.exit(1);
}
if (tsAdapter.state !== "ts_only") {
  console.error(
    `[check-no-ts-stdio-backend] transport/stdio-ts-adapter is ${tsAdapter.state}; expected ts_only (ts_deleted blocked per rej-001)`
  );
  process.exit(1);
}
if (http.state !== "rust_impl") {
  console.error(
    `[check-no-ts-stdio-backend] transport/web-mcp-http is ${http.state}; expected rust_impl (rej-010 promotion freeze)`
  );
  process.exit(1);
}
NODE
fi

if [[ -f "${BIN}" ]]; then
	if ! grep -q 'resolve_rust_bin' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must resolve Rust rmcp server via resolve_rust_bin"
	fi

	if ! grep -q 'printf.*stdio' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must default transport to stdio"
	fi

	if ! grep -q 'use_ts_transport' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must retain explicit TS stdio opt-in until deletion slice"
	fi

	if ! grep -q 'PDF_READER_MCP_TRANSPORT:-}" == "ts"' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must gate TS stdio behind PDF_READER_MCP_TRANSPORT=ts"
	fi

	if ! grep -q 'transport="$(resolve_transport)"' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must resolve transport before TS stdio opt-in"
	fi

	if ! grep -q '\[\[ "$transport" == "http" \]\]' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must branch on http transport before use_ts_transport"
	fi

	# Default stdio path must exec Rust before node TS adapter.
	if ! awk '
		/resolve_rust_bin/ { saw_rust = 1 }
		/use_ts_transport/ { saw_ts = 1 }
		/exec node/ {
			if (!saw_rust || !saw_ts) {
				exit 1
			}
		}
		END {
			if (!saw_rust || !saw_ts) {
				exit 1
			}
		}
	' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must define resolve_rust_bin and use_ts_transport before exec node"
	fi
fi

if [[ -f "${RUST_MAIN}" ]]; then
	if ! grep -q 'transport::stdio' "${RUST_MAIN}"; then
		report_violation "Rust MCP server must expose rmcp stdio transport"
	fi
fi

if [[ "${violations}" -gt 0 ]]; then
	echo ""
	echo "FAIL: ${violations} MCP stdio default-path TS authority violation(s)."
	echo "Authority: crates/pdf-reader-mcp-server/src/main.rs via bin/pdf-reader-mcp (default stdio)."
	echo "TS adapter remains opt-in until deletion PR merge + prod smoke (rej-001)."
	exit 1
fi

echo "PASS: Default MCP stdio transport delegates to Rust rmcp (TS adapter opt-in only)."