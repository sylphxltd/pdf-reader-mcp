import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const readText = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('MCP stdio production default (Rust process + full TS parity)', () => {
  it('default npm path launches Rust rmcp process', () => {
    const pkg = JSON.parse(readText('package.json')) as {
      bin?: Record<string, string>;
    };
    const bin = readText('bin/pdf-reader-mcp');

    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./bin/pdf-reader-mcp');
    expect(bin).toContain('printf \'%s\\n\' "rust"');
    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('PDF_READER_ENGINE_MODE=full');
  });

  it('full TypeScript tool engine remains available via parity bridge', () => {
    const parity = readText('crates/pdf-reader-mcp-server/src/parity_bridge.rs');
    expect(parity).toContain('legacy-engine-runtime.js');
    expect(parity).toContain('invoke_full_ts_tool');
    expect(existsSync(path.join(repoRoot, 'src/legacy-engine-runtime.ts'))).toBe(true);
  });

  it('stdio integration harness remains present', () => {
    const integration = readText('test/integration/stdio-transport.test.ts');
    expect(integration).toContain('MCP Server stdio Transport Integration');
    expect(integration).toContain('read_pdf');
  });
});
