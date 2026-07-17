import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const readText = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('Web MCP HTTP production default (TypeScript drop-in)', () => {
  it('TypeScript MCP entry supports HTTP transport for production drop-in', () => {
    const index = readText('src/index.ts');
    const mcp = readText('src/mcp.ts');

    expect(index).toContain('MCP_TRANSPORT');
    expect(index).toContain('http');
    expect(mcp).toContain('StreamableHTTPServerTransport');
    expect(existsSync(path.join(repoRoot, 'test/integration/http-transport.test.ts'))).toBe(true);
  });

  it('Rust HTTP remains opt-in via engine switch, not production default', () => {
    const bin = readText('bin/pdf-reader-mcp');
    const httpTransport = readText('crates/pdf-reader-mcp-server/src/http_transport.rs');

    expect(bin).toContain('PDF_READER_MCP_ENGINE');
    expect(bin).toContain('resolve_rust_bin');
    expect(httpTransport).toContain('StreamableHttpService');
    expect(httpTransport).toContain('health_check');
  });

  it('migration ledger marks web-mcp-http as rust_impl (not production authority)', () => {
    const ledger = JSON.parse(readText('docs/specs/pdf-reader-mcp-migration-ledger.json')) as {
      capabilities: Array<{ id: string; state: string }>;
    };

    const http = ledger.capabilities.find(
      (capability) => capability.id === 'transport/web-mcp-http'
    );
    expect(http?.state).toBe('rust_impl');
  });
});
