#!/usr/bin/env bash
# Rust-First gate: Web MCP HTTP transport must not retain a parallel TS HTTP backend.
# TS stdio adapter remains opt-in (transport/stdio-ts-adapter) until deletion slice.
# Forbidden: HTTP bin path via node; Streamable HTTP in src/index.ts when bin routes http.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${ROOT}/bin/pdf-reader-mcp"
TS_ENTRY="${ROOT}/src/index.ts"
HTTP_TRANSPORT="${ROOT}/crates/pdf-reader-mcp-server/src/http_transport.rs"
GATE_TEST="${ROOT}/test/check-no-ts-http-backend.test.ts"
TS_ADAPTER_GATE="${ROOT}/scripts/check-ts-adapter-deletion-ready.sh"
LEDGER="${ROOT}/docs/specs/pdf-reader-mcp-migration-ledger.json"

violations=0

report_violation() {
	echo "VIOLATION: $*"
	violations=$((violations + 1))
}

echo "=== check-no-ts-http-backend $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [[ ! -f "${BIN}" ]]; then
	report_violation "missing bin/pdf-reader-mcp"
fi

if [[ ! -f "${HTTP_TRANSPORT}" ]]; then
	report_violation "missing crates/pdf-reader-mcp-server/src/http_transport.rs"
fi

if [[ ! -f "${GATE_TEST}" ]]; then
	report_violation "missing test/check-no-ts-http-backend.test.ts"
fi

if [[ ! -f "${TS_ADAPTER_GATE}" ]]; then
	report_violation "missing scripts/check-ts-adapter-deletion-ready.sh"
fi

if [[ ! -f "${LEDGER}" ]]; then
	report_violation "missing docs/specs/pdf-reader-mcp-migration-ledger.json"
fi

if [[ -f "${LEDGER}" ]]; then
	node - "${LEDGER}" <<'NODE'
const [ledgerPath] = process.argv.slice(2);
const ledger = JSON.parse(require("node:fs").readFileSync(ledgerPath, "utf8"));
const entry = ledger.capabilities.find((cap) => cap.id === "transport/web-mcp-http");
if (!entry) {
  console.error("[check-no-ts-http-backend] missing capability transport/web-mcp-http");
  process.exit(1);
}
if (entry.state !== "rust_impl") {
  console.error(
    `[check-no-ts-http-backend] transport/web-mcp-http is ${entry.state}; expected rust_impl (rej-010 promotion freeze)`
  );
  process.exit(1);
}
NODE
fi

if [[ -f "${BIN}" ]]; then
	if ! grep -q 'resolve_rust_bin' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must resolve Rust rmcp server via resolve_rust_bin"
	fi

	if ! grep -q 'MCP_TRANSPORT=http' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must route MCP_TRANSPORT=http to Rust"
	fi

	if ! grep -q 'transport="$(resolve_transport)"' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must resolve transport before TS stdio opt-in"
	fi

	if ! grep -q '\[\[ "$transport" == "http" \]\]' "${BIN}"; then
		report_violation "bin/pdf-reader-mcp must branch on http transport before use_ts_transport"
	fi
fi

if [[ -f "${TS_ENTRY}" ]]; then
	if grep -qE 'StreamableHTTP|streamableHttp|http_transport|MCP_HTTP' "${TS_ENTRY}"; then
		report_violation "src/index.ts must not implement Streamable HTTP transport"
	fi
fi

if [[ -f "${HTTP_TRANSPORT}" ]]; then
	if ! grep -q 'StreamableHttpService' "${HTTP_TRANSPORT}"; then
		report_violation "Rust http_transport.rs must expose StreamableHttpService"
	fi

	if ! grep -q 'health_check' "${HTTP_TRANSPORT}"; then
		report_violation "Rust http_transport.rs must expose /mcp/health"
	fi
fi

if [[ "${violations}" -gt 0 ]]; then
	echo ""
	echo "FAIL: ${violations} Web MCP HTTP TS authority violation(s)."
	echo "Authority: crates/pdf-reader-mcp-server/src/http_transport.rs via bin/pdf-reader-mcp."
	exit 1
fi

echo "PASS: Web MCP HTTP transport delegates solely to Rust rmcp (no parallel TS HTTP backend)."