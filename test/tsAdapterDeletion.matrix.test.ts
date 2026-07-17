import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

/**
 * 3.0.15 prematurely published an incomplete Rust MCP cutover.
 * Production default is restored to the full TypeScript surface (3.0.14 drop-in).
 * Rust remains opt-in via PDF_READER_MCP_ENGINE=rust and is NOT drop-in until
 * pure-Rust capability parity is proven.
 */
describe('TS MCP production default (drop-in restoration)', () => {
  it('npm package bin points at full TypeScript MCP entry', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
      exports?: Record<string, string>;
    };
    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./dist/index.js');
    expect(pkg.exports?.['.']).toBe('./dist/index.js');
  });

  it('TS MCP adapter sources are present', () => {
    expect(existsSync(path.join(repoRoot, 'src/index.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'src/mcp.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'src/handlers/readPdf.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'src/handlers/searchPdf.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'src/handlers/pdfEvidence.ts'))).toBe(true);
  });

  it('launcher defaults to TypeScript and only opts into incomplete Rust', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('dist/index.js');
    expect(bin).toContain('exec node');
    expect(bin).toContain('printf \'%s\\n\' "ts"');
    expect(bin).toContain('PDF_READER_MCP_ENGINE');
    expect(bin).toContain('resolve_rust_bin');
  });

  it('ledger records production TS default after incomplete rust cutover rollback', () => {
    const ledger = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/pdf-reader-mcp-migration-ledger.json'), 'utf8')
    ) as {
      capabilities: Array<{ id: string; state: string }>;
      summary: { ts_only: number; ts_deleted: number; notes?: string };
      rollbackNote?: string;
    };
    const tsAdapter = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-ts-adapter');
    expect(tsAdapter?.state).toBe('ts_only');
    expect(ledger.summary.ts_only).toBeGreaterThan(0);
    expect(ledger.rollbackNote ?? ledger.summary.notes ?? '').toMatch(/drop-in|3\.0\.15|rollback/i);
  });
});
