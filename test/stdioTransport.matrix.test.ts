import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

describe('MCP stdio transport routing', () => {
  it('published bin is sole-Rust runtime-entry.js', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
      exports?: Record<string, string>;
    };
    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./dist/runtime-entry.js');
    expect(pkg.exports?.['.']).toBe('./dist/runtime-entry.js');
    expect(pkg.exports?.['./typescript']).toBeUndefined();
  });

  it('optional bin wrapper is sole-Rust and does not invoke TypeScript', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('dist/runtime-entry.js');
    expect(bin).not.toContain('dist/index.js');
    expect(bin).toContain('3.0.14');
  });

  it('Rust MCP server still exposes rmcp stdio transport', () => {
    const main = readFileSync(
      path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/main.rs'),
      'utf8'
    );
    expect(main.toLowerCase()).toMatch(/stdio|rmcp/);
  });

  it('parity bridge is gone from production sources', () => {
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(false);
  });
});
