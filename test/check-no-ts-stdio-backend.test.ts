import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const readText = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('MCP stdio production default (TypeScript drop-in)', () => {
  it('default npm path is the full TypeScript MCP surface', () => {
    const pkg = JSON.parse(readText('package.json')) as {
      bin?: Record<string, string>;
    };
    const bin = readText('bin/pdf-reader-mcp');

    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./dist/index.js');
    expect(existsSync(path.join(repoRoot, 'src/index.ts'))).toBe(true);
    expect(bin).toContain('dist/index.js');
    expect(bin).toContain('exec node');
    expect(bin).toContain('printf \'%s\\n\' "ts"');
  });

  it('Rust rmcp remains available only as explicit opt-in', () => {
    const bin = readText('bin/pdf-reader-mcp');
    const rustMain = readText('crates/pdf-reader-mcp-server/src/main.rs');

    expect(bin).toContain('PDF_READER_MCP_ENGINE');
    expect(bin).toContain('resolve_rust_bin');
    expect(rustMain).toContain('transport::stdio');
  });

  it('stdio integration harness remains present for both engines', () => {
    const integration = readText('test/integration/stdio-transport.test.ts');

    expect(integration).toContain('MCP Server stdio Transport Integration');
    expect(integration).toContain('read_pdf');
    expect(integration).toContain('search_pdf');
    expect(integration).toContain('pdf_evidence');
  });
});
