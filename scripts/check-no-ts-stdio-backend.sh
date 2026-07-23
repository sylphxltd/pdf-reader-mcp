#!/usr/bin/env bash
# Default MCP stdio transport authority gate.
# Sole-runtime: prefer pure-Rust native binary via dist/runtime-entry.js.
# TypeScript may remain as explicit fallback (./typescript, force flags).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="${ROOT}/package.json"
MATRIX="${ROOT}/docs/specs/pure-rust-capability-matrix.json"
RUST_MAIN="${ROOT}/crates/pdf-reader-mcp-server/src/main.rs"
RUNTIME_ENTRY="${ROOT}/src/runtime-entry.ts"
TS_ENTRY="${ROOT}/src/index.ts"

violations=0
report_violation() {
  echo "VIOLATION: $*"
  violations=$((violations + 1))
}

echo "=== check-no-ts-stdio-backend $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

[[ -f "${PKG}" ]] || report_violation "missing package.json"
[[ -f "${MATRIX}" ]] || report_violation "missing pure-rust capability matrix"
[[ -f "${RUST_MAIN}" ]] || report_violation "missing Rust MCP server main"

DROP_IN="$(jq -r '.productTruth.dropInFor3014' "${MATRIX}")"
SOLE="$(jq -r '.productTruth.soleRuntimeDefault // false' "${MATRIX}")"
BIN_PATH="$(jq -r '.bin["pdf-reader-mcp"]' "${PKG}")"
EXPORT_DOT="$(jq -r '.exports["."]' "${PKG}")"
EXPORT_TS="$(jq -r '.exports["./typescript"] // empty' "${PKG}")"

if [[ "${DROP_IN}" == "true" || "${SOLE}" == "true" ]]; then
  [[ "${BIN_PATH}" == "./dist/runtime-entry.js" ]] || report_violation "default bin must be ./dist/runtime-entry.js for sole-runtime"
  [[ "${EXPORT_DOT}" == "./dist/runtime-entry.js" ]] || report_violation "exports['.'] must be ./dist/runtime-entry.js for sole-runtime"
  [[ -f "${RUNTIME_ENTRY}" ]] || report_violation "missing src/runtime-entry.ts"
  [[ "${EXPORT_TS}" == "./dist/index.js" ]] || report_violation "exports['./typescript'] must keep TypeScript fallback at ./dist/index.js"
  [[ -f "${TS_ENTRY}" ]] || report_violation "TypeScript fallback src/index.ts must remain present for fallback export"
  grep -q 'resolveNativeBinary\|NATIVE_PLATFORM_PACKAGES' "${RUNTIME_ENTRY}" || report_violation "runtime-entry must resolve native pure-Rust binary"
  grep -q 'index.js' "${RUNTIME_ENTRY}" || report_violation "runtime-entry must fall back to TypeScript index.js"
else
  # Pre-cutover: TypeScript remains default; pure-Rust opt-in.
  [[ "${BIN_PATH}" == "./dist/index.js" ]] || report_violation "pre-cutover default bin must remain ./dist/index.js"
  [[ -f "${TS_ENTRY}" ]] || report_violation "pre-cutover TypeScript entry src/index.ts must exist"
fi

grep -q 'transport::stdio' "${RUST_MAIN}" || report_violation "Rust MCP server must expose rmcp stdio transport"

if [[ "${violations}" -gt 0 ]]; then
  echo ""
  echo "FAIL: ${violations} MCP stdio authority violation(s)."
  exit 1
fi

echo "PASS: MCP stdio authority gate (sole-runtime pure-Rust default with TypeScript fallback allowed)."
