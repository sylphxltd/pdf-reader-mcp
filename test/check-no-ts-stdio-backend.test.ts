import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const readText = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('MCP stdio Rust default-path gate (S3 deletion prep)', () => {
  it('check-no-ts-stdio-backend gate script exists and enforces Rust stdio default authority', () => {
    const script = readText('scripts/check-no-ts-stdio-backend.sh');

    expect(script).toContain('check-no-ts-stdio-backend');
    expect(script).toContain('resolve_rust_bin');
    expect(script).toContain('transport::stdio');
    expect(script).toContain('transport/stdio-rust-rmcp');
    expect(script).toContain('rust_impl');
    expect(script).toContain('differentialTest');
    expect(script).toContain('transport/stdio-ts-adapter');
    expect(script).toContain('ts_only');
    expect(script).toContain('rej-001');
    expect(script).toContain('check-ts-adapter-deletion-ready.sh');
    expect(existsSync(path.join(repoRoot, 'test/integration/stdio-transport.test.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'test/stdioTransport.matrix.test.ts'))).toBe(true);
  });

  it('npm bin routes default stdio to Rust rmcp while retaining TS opt-in', () => {
    const bin = readText('bin/pdf-reader-mcp');
    const rustMain = readText('crates/pdf-reader-mcp-server/src/main.rs');

    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('resolve_transport');
    expect(bin).toContain('printf \'%s\\n\' "stdio"');
    expect(bin).toContain('use_ts_transport');
    expect(bin).toContain('PDF_READER_MCP_TRANSPORT:-}" == "ts"');
    expect(bin.indexOf('resolve_rust_bin')).toBeLessThan(bin.indexOf('use_ts_transport'));
    expect(rustMain).toContain('transport::stdio');
    expect(existsSync(path.join(repoRoot, 'src/index.ts'))).toBe(true);
  });

  it('migration ledger marks transport/stdio-rust-rmcp as rust_impl with differential harness and stdio-ts-adapter as ts_only', () => {
    const ledger = JSON.parse(
      readText('docs/specs/pdf-reader-mcp-migration-ledger.json')
    ) as {
      capabilities: Array<{ id: string; state: string; differentialTest?: string }>;
    };

    const stdioRust = ledger.capabilities.find(
      (capability) => capability.id === 'transport/stdio-rust-rmcp'
    );
    const tsAdapter = ledger.capabilities.find(
      (capability) => capability.id === 'transport/stdio-ts-adapter'
    );
    expect(stdioRust?.state).toBe('rust_impl');
    expect(stdioRust?.differentialTest).toContain('pdf_reader_mcp_differential');
    expect(tsAdapter?.state).toBe('ts_only');
  });

  it('stdio integration harness proves read_pdf golden mock parity over default stdio', () => {
    const integration = readText('test/integration/stdio-transport.test.ts');

    expect(integration).toContain('MCP Server stdio Transport Integration');
    expect(integration).toContain('read_pdf');
    expect(integration).toContain('golden mock parity over stdio');
    expect(integration).toContain('search_pdf');
    expect(integration).toContain('pdf_evidence');
  });
});