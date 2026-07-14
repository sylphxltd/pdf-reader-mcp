import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const DELETION_GATES = [
  'transport/web-mcp-http:authority_rust',
  'transport/stdio-rust-rmcp:parity_proven',
  'tool/read_pdf:parity_proven',
  'tool/search_pdf:parity_proven',
  'tool/pdf_evidence:parity_proven',
] as const;

describe('TS stdio adapter deletion prep matrix', () => {
  it('npm bin defaults to Rust rmcp (not TS stdio)', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('printf \'%s\\n\' "stdio"');
    expect(bin).toContain('use_ts_transport');
    expect(bin.indexOf('exec node')).toBeGreaterThan(bin.indexOf('resolve_rust_bin'));
  });

  it('TS adapter remains opt-in via PDF_READER_MCP_TRANSPORT=ts', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('PDF_READER_MCP_TRANSPORT:-}" == "ts"');
    expect(readFileSync(path.join(repoRoot, 'src/mcp.ts'), 'utf8')).toContain(
      'StdioServerTransport'
    );
  });

  it('ledger records web-mcp-http as rust_impl under rej-010 (deletion gate still requires authority_rust)', () => {
    const ledger = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/pdf-reader-mcp-migration-ledger.json'), 'utf8')
    ) as {
      capabilities: Array<{ id: string; state: string }>;
    };
    const http = ledger.capabilities.find((cap) => cap.id === 'transport/web-mcp-http');
    expect(http?.state).toBe('rust_impl');
  });

  it('HTTP integration harness exists for web-mcp-http parity proof', () => {
    const integration = readFileSync(
      path.join(repoRoot, 'test/integration/http-transport.test.ts'),
      'utf8'
    );
    expect(integration).toContain('MCP Server HTTP Transport Integration');
    expect(integration).toContain('read_pdf');
    expect(integration).toContain('golden mock parity over HTTP');
    expect(integration).toContain('X-API-Key');
  });

  it('stdio integration harness exists for stdio-rust-rmcp parity proof', () => {
    const integration = readFileSync(
      path.join(repoRoot, 'test/integration/stdio-transport.test.ts'),
      'utf8'
    );
    const stdioGate = readFileSync(
      path.join(repoRoot, 'scripts/check-no-ts-stdio-backend.sh'),
      'utf8'
    );
    expect(integration).toContain('MCP Server stdio Transport Integration');
    expect(integration).toContain('read_pdf');
    expect(integration).toContain('golden mock parity over stdio');
    expect(stdioGate).toContain('rust_impl');
    expect(stdioGate).toContain('ts_only');
  });

  it('deletion readiness script documents fleet gates', () => {
    const script = readFileSync(
      path.join(repoRoot, 'scripts/check-ts-adapter-deletion-ready.sh'),
      'utf8'
    );
    for (const gate of DELETION_GATES) {
      const [capability, state] = gate.split(':');
      expect(script).toContain(`require_ledger_state "${capability}" "${state}"`);
    }
    expect(script).toContain('transport/stdio-ts-adapter');
    expect(script).toContain('src/index.ts');
  });

  it('ledger records stdio-ts-adapter as ts_only pending deletion', () => {
    const ledger = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/pdf-reader-mcp-migration-ledger.json'), 'utf8')
    ) as {
      capabilities: Array<{ id: string; state: string }>;
    };
    const tsAdapter = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-ts-adapter');
    expect(tsAdapter?.state).toBe('ts_only');
  });
});
