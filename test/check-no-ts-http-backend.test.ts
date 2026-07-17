import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const readText = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('Web MCP HTTP (pure-Rust)', () => {
  it('parity bridge is not present', () => {
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(false);
  });

  it('Rust HTTP transport remains wired for production process', () => {
    const bin = readText('bin/pdf-reader-mcp');
    const httpTransport = readText('crates/pdf-reader-mcp-server/src/http_transport.rs');

    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('MCP_TRANSPORT=http');
    expect(httpTransport).toContain('StreamableHttpService');
    expect(httpTransport).toContain('health_check');
  });

  it('HTTP process uses pure-Rust tool modules', () => {
    const read = readText('crates/pdf-reader-mcp-server/src/read_pdf.rs');
    expect(read).toContain('read_pdf_from_value');
    expect(read).not.toContain('parity_bridge');
  });
});
