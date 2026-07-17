import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

describe('MCP stdio transport routing', () => {
  it('bin wrapper defaults to full TypeScript MCP and opts into Rust only explicitly', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('dist/index.js');
    expect(bin).toContain('exec node');
    expect(bin).toContain('printf \'%s\\n\' "ts"');
    expect(bin).toContain('PDF_READER_MCP_ENGINE');
    expect(bin).toContain('resolve_rust_bin');
  });

  it('Rust MCP server still exposes rmcp stdio transport for opt-in engine', () => {
    const mainRs = readFileSync(
      path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/main.rs'),
      'utf8'
    );
    expect(mainRs).toContain('transport::stdio');
    expect(mainRs).toContain('http_transport::transport_from_env');
  });

  it('migration ledger records TS production default after incomplete rust cutover rollback', () => {
    const ledger = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/pdf-reader-mcp-migration-ledger.json'), 'utf8')
    ) as {
      capabilities: Array<{ id: string; state: string }>;
      rollbackNote?: string;
    };
    const tsAdapter = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-ts-adapter');
    const stdioRust = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-rust-rmcp');
    expect(tsAdapter?.state).toBe('ts_only');
    expect(stdioRust?.state).toBe('rust_impl');
    expect(ledger.rollbackNote ?? '').toMatch(/drop-in|3\.0\.15|rollback/i);
  });
});
