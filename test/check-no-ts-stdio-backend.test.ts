import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const readText = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('MCP stdio production default (pure-Rust)', () => {
  it('default npm path launches Rust rmcp process only', () => {
    const pkg = JSON.parse(readText('package.json')) as {
      bin?: Record<string, string>;
    };
    const bin = readText('bin/pdf-reader-mcp');

    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./bin/pdf-reader-mcp');
    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('pdf-reader-mcp-server');
    expect(bin).not.toContain('PDF_READER_ENGINE_MODE=full');
    expect(bin).not.toContain('dist/index.js');
    expect(bin).not.toContain('legacy-engine-runtime');
  });

  it('parity bridge is removed from the production path', () => {
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(false);
  });

  it('stdio integration harness remains present', () => {
    const integration = readText('test/integration/stdio-transport.test.ts');
    expect(integration).toContain('MCP Server stdio Transport Integration');
    expect(integration).toContain('read_pdf');
  });
});
