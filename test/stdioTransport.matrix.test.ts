import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

describe('MCP stdio transport routing', () => {
  it('published bin is TypeScript dist/index.js', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
    };
    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./dist/index.js');
  });

  it('optional bin wrapper defaults to TypeScript; pure-Rust is opt-in', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('dist/index.js');
    expect(bin).toContain('PDF_READER_ENGINE_MODE');
    expect(bin).toContain('resolve_rust_bin');
    expect(bin).not.toContain('PDF_READER_ENGINE_MODE=full');
  });

  it('Rust MCP server still exposes rmcp stdio transport', () => {
    const mainRs = readFileSync(
      path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/main.rs'),
      'utf8'
    );
    expect(mainRs).toContain('transport::stdio');
    expect(mainRs).toContain('http_transport::transport_from_env');
  });

  it('parity bridge is gone from production sources', () => {
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(false);
  });
});
