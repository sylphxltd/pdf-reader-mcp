import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const readText = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('Web MCP HTTP (Rust process + full TS parity)', () => {
  it('TypeScript handlers remain available for full tool surface', () => {
    expect(existsSync(path.join(repoRoot, 'src/handlers/pdfEvidence.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'src/legacy-engine-runtime.ts'))).toBe(true);
  });

  it('Rust HTTP transport remains wired for production process', () => {
    const bin = readText('bin/pdf-reader-mcp');
    const httpTransport = readText('crates/pdf-reader-mcp-server/src/http_transport.rs');

    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('MCP_TRANSPORT=http');
    expect(httpTransport).toContain('StreamableHttpService');
    expect(httpTransport).toContain('health_check');
  });

  it('parity bridge provides drop-in tool behavior on HTTP process', () => {
    const parity = readText('crates/pdf-reader-mcp-server/src/parity_bridge.rs');
    expect(parity).toContain('invoke_full_ts_tool');
    expect(parity).toContain('EngineMode::Full');
  });
});
