import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

describe('web MCP HTTP transport routing', () => {
  it('TypeScript production entry supports MCP_TRANSPORT=http', () => {
    const index = readFileSync(path.join(repoRoot, 'src/index.ts'), 'utf8');
    expect(index).toContain('MCP_TRANSPORT');
    expect(index).toContain('http');
    expect(index).toContain('createTransport');
  });

  it('Rust MCP server exposes streamable HTTP for opt-in engine', () => {
    const httpTransport = readFileSync(
      path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/http_transport.rs'),
      'utf8'
    );
    const mainRs = readFileSync(
      path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/main.rs'),
      'utf8'
    );
    expect(httpTransport).toContain('StreamableHttpService');
    expect(httpTransport).toContain('health_check');
    expect(mainRs).toContain('http_transport::serve_http');
  });

  it('launcher keeps Rust engine opt-in only', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('PDF_READER_MCP_ENGINE');
    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('printf \'%s\\n\' "ts"');
  });
});
