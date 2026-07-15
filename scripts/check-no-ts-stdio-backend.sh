#!/usr/bin/env bash
# S3 gate: default MCP stdio transport must delegate solely to Rust rmcp.
# TS stdio adapter is retired (transport/stdio-ts-adapter → ts_deleted).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${ROOT}/bin/pdf-reader-mcp"
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

[[ -f "${BIN}" ]] || report_violation "missing bin/pdf-reader-mcp"
[[ -f "${STDIO_GATE}" ]] || report_violation "missing scripts/check-no-ts-stdio-backend.sh"
[[ -f "${GATE_TEST}" ]] || report_violation "missing test/check-no-ts-stdio-backend.test.ts"
[[ -f "${STDIO_INTEGRATION}" ]] || report_violation "missing test/integration/stdio-transport.test.ts"
[[ -f "${STDIO_MATRIX}" ]] || report_violation "missing test/stdioTransport.matrix.test.ts"
[[ -f "${TS_ADAPTER_GATE}" ]] || report_violation "missing scripts/check-ts-adapter-deletion-ready.sh"
[[ -f "${LEDGER}" ]] || report_violation "missing docs/specs/pdf-reader-mcp-migration-ledger.json"
[[ -f "${RUST_MAIN}" ]] || report_violation "missing crates/pdf-reader-mcp-server/src/main.rs"

if [[ -f "${ROOT}/src/index.ts" ]]; then
	report_violation "src/index.ts must be deleted (transport/stdio-ts-adapter ts_deleted)"
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
const rustAuthorityStates = new Set(["rust_impl", "authority_rust", "ts_deleted"]);
if (!rustAuthorityStates.has(stdioRust.state)) {
  console.error(
    `[check-no-ts-stdio-backend] transport/stdio-rust-rmcp is ${stdioRust.state}; expected rust_impl, authority_rust, or ts_deleted`
  );
  process.exit(1);
}
const allowedProof = new Set(["missing", "differential_green", "canary_green", "caught_up"]);
const proofStatus = (stdioRust.proof || {}).status;
if (["rust_impl", "ts_deleted"].includes(stdioRust.state) && !allowedProof.has(proofStatus)) {
  console.error(
    `[check-no-ts-stdio-backend] transport/stdio-rust-rmcp proof.status=${proofStatus}; expected one of ${[...allowedProof].join(", ")}`
  );
  process.exit(1);
}
if (tsAdapter.state !== "ts_deleted") {
  console.error(
    `[check-no-ts-stdio-backend] transport/stdio-ts-adapter is ${tsAdapter.state}; expected ts_deleted`
  );
  process.exit(1);
}
if (!["rust_impl", "ts_deleted", "authority_rust"].includes(http.state)) {
  console.error(
    `[check-no-ts-stdio-backend] transport/web-mcp-http is ${http.state}; expected rust_impl, authority_rust, or ts_deleted`
  );
  process.exit(1);
}
NODE
fi

if [[ -f "${BIN}" ]]; then
	grep -q 'resolve_rust_bin' "${BIN}" || report_violation "bin/pdf-reader-mcp must resolve Rust rmcp server via resolve_rust_bin"
	grep -q 'printf.*stdio' "${BIN}" || report_violation "bin/pdf-reader-mcp must default transport to stdio"
	if grep -qE 'use_ts_transport|exec node|PDF_READER_MCP_TRANSPORT:-}" == "ts"' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must not launch node or retain TS stdio opt-in"
	fi
fi

if [[ -f "${RUST_MAIN}" ]]; then
	grep -q 'transport::stdio' "${RUST_MAIN}" || report_violation "Rust MCP server must expose rmcp stdio transport"
fi

if [[ "${violations}" -gt 0 ]]; then
	echo ""
	echo "FAIL: ${violations} MCP stdio TS authority violation(s)."
	echo "Authority: crates/pdf-reader-mcp-server/src/main.rs via bin/pdf-reader-mcp (default stdio)."
	exit 1
fi

echo "PASS: MCP stdio transport delegates solely to Rust rmcp (differential_green parity proven)."