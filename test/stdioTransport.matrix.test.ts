import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

describe('MCP stdio transport routing', () => {
  it('bin wrapper defaults to Rust process with full-parity engine', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('printf \'%s\\n\' "rust"');
    expect(bin).toContain('PDF_READER_ENGINE_MODE=full');
    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('dist/index.js');
  });

  it('Rust MCP server still exposes rmcp stdio transport', () => {
    const mainRs = readFileSync(
      path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/main.rs'),
      'utf8'
    );
    expect(mainRs).toContain('transport::stdio');
    expect(mainRs).toContain('http_transport::transport_from_env');
  });

  it('parity bridge is the production tool engine', () => {
    const parity = readFileSync(
      path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'),
      'utf8'
    );
    expect(parity).toContain('EngineMode::Full');
    expect(parity).toContain('legacy-engine-runtime.js');
  });
});
