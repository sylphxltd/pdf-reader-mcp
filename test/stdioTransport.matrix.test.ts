import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

describe('MCP stdio transport routing', () => {
  it('bin wrapper defaults to Rust rmcp stdio server without TS opt-in', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('resolve_transport');
    expect(bin).toContain('printf \'%s\\n\' "stdio"');
    expect(bin).not.toContain('use_ts_transport');
    expect(bin).not.toContain('PDF_READER_MCP_TRANSPORT:-}" == "ts"');
  });

  it('Rust MCP server exposes rmcp stdio transport', () => {
    const mainRs = readFileSync(
      path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/main.rs'),
      'utf8'
    );
    expect(mainRs).toContain('transport::stdio');
    expect(mainRs).toContain('http_transport::transport_from_env');
  });

  it('check-no-ts-stdio-backend gate enforces Rust-only stdio authority', () => {
    const script = readFileSync(
      path.join(repoRoot, 'scripts/check-no-ts-stdio-backend.sh'),
      'utf8'
    );
    expect(script).toContain('ts_deleted');
    expect(script).toContain('differential_green');
    expect(
      readFileSync(path.join(repoRoot, 'test/check-no-ts-stdio-backend.test.ts'), 'utf8')
    ).toContain('ts_deleted');
  });

  it('migration ledger marks transport/stdio-rust-rmcp as ts_deleted with differential harness', () => {
    const ledger = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/pdf-reader-mcp-migration-ledger.json'), 'utf8')
    ) as {
      capabilities: Array<{ id: string; state: string; differentialTest?: string }>;
    };
    const stdioRust = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-rust-rmcp');
    expect(stdioRust?.state).toBe('ts_deleted');
    expect(stdioRust?.differentialTest).toContain('run-pdf-reader-differential.sh');
  });
});
