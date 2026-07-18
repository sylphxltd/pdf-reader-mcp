import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const readText = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('MCP stdio production default (TypeScript published path)', () => {
  it('default npm path is TypeScript dist/index.js', () => {
    const pkg = JSON.parse(readText('package.json')) as {
      bin?: Record<string, string>;
      exports?: Record<string, string>;
    };
    const bin = readText('bin/pdf-reader-mcp');

    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./dist/index.js');
    expect(pkg.exports?.['.']).toBe('./dist/index.js');
    // Optional wrapper still prefers TS unless pure-rust mode is set.
    expect(bin).toContain('dist/index.js');
    expect(bin).toContain('PDF_READER_ENGINE_MODE');
    expect(bin).not.toContain('PDF_READER_ENGINE_MODE=full');
  });

  it('parity bridge is removed from the pure-Rust server sources', () => {
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
