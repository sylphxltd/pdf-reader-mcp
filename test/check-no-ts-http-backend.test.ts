import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const readText = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('Web MCP HTTP Rust authority gate', () => {
  it('check-no-ts-http-backend gate script exists and enforces Rust HTTP authority', () => {
    const script = readText('scripts/check-no-ts-http-backend.sh');

    expect(script).toContain('check-no-ts-http-backend');
    expect(script).toContain('resolve_rust_bin');
    expect(script).toContain('MCP_TRANSPORT=http');
    expect(script).toContain('StreamableHttpService');
    expect(script).toContain('check-ts-adapter-deletion-ready.sh');
    expect(existsSync(path.join(repoRoot, 'test/integration/http-transport.test.ts'))).toBe(true);
  });

  it('npm bin routes HTTP to Rust rmcp before TS stdio opt-in', () => {
    const bin = readText('bin/pdf-reader-mcp');
    const httpTransport = readText('crates/pdf-reader-mcp-server/src/http_transport.rs');

    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('MCP_TRANSPORT=http');
    expect(bin).toContain('transport="$(resolve_transport)"');
    expect(bin.indexOf('[[ "$transport" == "http" ]]')).toBeLessThan(
      bin.indexOf('if use_ts_transport')
    );
    expect(httpTransport).toContain('StreamableHttpService');
    expect(httpTransport).toContain('health_check');
  });

  it('migration ledger marks transport/web-mcp-http as rust_impl under rej-010 promotion freeze', () => {
    const ledger = JSON.parse(
      readText('docs/specs/pdf-reader-mcp-migration-ledger.json')
    ) as {
      capabilities: Array<{ id: string; state: string }>;
    };

    const http = ledger.capabilities.find((capability) => capability.id === 'transport/web-mcp-http');
    expect(http?.state).toBe('rust_impl');
  });
});