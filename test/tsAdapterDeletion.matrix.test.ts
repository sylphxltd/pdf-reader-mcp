import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

describe('TS stdio adapter deletion matrix (tick036 admission)', () => {
  it('npm bin routes exclusively to Rust rmcp', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('resolve_transport');
    expect(bin).not.toContain('use_ts_transport');
    expect(bin).not.toContain('PDF_READER_MCP_TRANSPORT:-}" == "ts"');
    expect(bin).not.toContain('exec node');
    expect(bin).not.toContain('dist/index.js');
  });

  it('TS stdio adapter sources are deleted', () => {
    expect(existsSync(path.join(repoRoot, 'src/index.ts'))).toBe(false);
    expect(existsSync(path.join(repoRoot, 'dist/index.js'))).toBe(false);
  });

  it('HTTP integration harness exists for web-mcp-http authority proof', () => {
    const integration = readFileSync(
      path.join(repoRoot, 'test/integration/http-transport.test.ts'),
      'utf8'
    );
    expect(integration).toContain('MCP Server HTTP Transport Integration');
    expect(integration).toContain('read_pdf');
    expect(integration).toContain('golden mock parity over HTTP');
    expect(integration).toContain('X-API-Key');
  });

  it('deletion gate script enforces ts_deleted ledger state', () => {
    const script = readFileSync(
      path.join(repoRoot, 'scripts/check-ts-adapter-deletion-ready.sh'),
      'utf8'
    );
    expect(script).toContain('require_ledger_state "transport/stdio-ts-adapter" "ts_deleted"');
    expect(script).toContain('src/index.ts must be deleted');
    expect(script).toContain('use_ts_transport');
  });

  it('ledger records stdio-ts-adapter as ts_deleted', () => {
    const ledger = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/pdf-reader-mcp-migration-ledger.json'), 'utf8')
    ) as {
      capabilities: Array<{ id: string; state: string }>;
      summary: { ts_deleted: number; ts_only: number; completion_progress: number };
    };
    const tsAdapter = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-ts-adapter');
    expect(tsAdapter?.state).toBe('ts_deleted');
    expect(ledger.summary.ts_deleted).toBe(6);
    expect(ledger.summary.ts_only).toBe(0);
    expect(ledger.summary.completion_progress).toBe(1.0);
  });

  it('ledger records transport/stdio-rust-rmcp as ts_deleted (tick036 admission)', () => {
    const ledger = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/pdf-reader-mcp-migration-ledger.json'), 'utf8')
    ) as {
      capabilities: Array<{ id: string; state: string; proof?: { status: string } }>;
      summary: { ts_deleted: number; completion_progress: number; authority_progress: number };
    };
    const admittedProof = new Set(['missing', 'differential_green', 'canary_green', 'caught_up']);
    const stdioRust = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-rust-rmcp');
    expect(stdioRust?.state).toBe('ts_deleted');
    expect(admittedProof.has(stdioRust?.proof?.status ?? '')).toBe(true);
    expect(ledger.summary.ts_deleted).toBe(6);
    expect(ledger.summary.completion_progress).toBe(1.0);
    expect(ledger.summary.authority_progress).toBe(1.0);
  });

  it('ledger records all three MCP tools as ts_deleted (tick036 admission)', () => {
    const ledger = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/pdf-reader-mcp-migration-ledger.json'), 'utf8')
    ) as {
      capabilities: Array<{ id: string; state: string }>;
      summary: { ts_deleted: number };
    };
    for (const toolId of ['tool/read_pdf', 'tool/search_pdf', 'tool/pdf_evidence']) {
      const tool = ledger.capabilities.find((cap) => cap.id === toolId);
      expect(tool?.state).toBe('ts_deleted');
    }
    expect(ledger.summary.ts_deleted).toBe(6);
  });
});
