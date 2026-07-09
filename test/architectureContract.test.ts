import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const mcpServerSrc = path.join(repoRoot, 'crates/pdf-reader-mcp-server/src');
const binWrapper = path.join(repoRoot, 'bin/pdf-reader-mcp');

const productionSource = (file: string): string => {
  const source = readFileSync(path.join(mcpServerSrc, file), 'utf8');
  return source.split('#[cfg(test)]')[0] ?? source;
};

describe('architecture contract (Rust core + Rust rmcp MCP)', () => {
  it('does not ship a TypeScript engine-invoke bridge', () => {
    expect(existsSync(path.join(repoRoot, 'src/engine-invoke.ts'))).toBe(false);
  });

  it('defaults the published bin wrapper to the staged rmcp server binary', () => {
    const script = readFileSync(binWrapper, 'utf8');
    expect(script).toContain('pdf-reader-mcp-server');
    expect(script).toContain('resolve_rust_bin');
    expect(script).toContain('use_ts_transport');
  });

  it('routes read_pdf through Rust core module instead of cli_bridge legacy path', () => {
    const lib = readFileSync(path.join(mcpServerSrc, 'lib.rs'), 'utf8');
    const production = lib.split('#[cfg(test)]')[0] ?? lib;
    expect(production).toContain('read_pdf::read_pdf');
    expect(production).not.toContain('cli_bridge::invoke_cli_tool("read_pdf"');
    expect(production).toContain('pdf_evidence::pdf_evidence');
    expect(production).not.toContain('cli_bridge::invoke_cli_tool("pdf_evidence"');
  });

  it('keeps cli_bridge available only for optional legacy search fallback', () => {
    const bridge = productionSource('cli_bridge.rs');
    expect(bridge).toContain('pdf-reader-cli');
    expect(bridge).not.toContain('invoke_ts_engine');
    expect(bridge).not.toContain('legacy-engine-runtime');
    expect(bridge).not.toContain('dist/index.js');
  });

  it('keeps legacy TypeScript engine runtime out of rmcp server production sources', () => {
    for (const file of ['lib.rs', 'main.rs', 'cli_bridge.rs', 'search.rs']) {
      const production = productionSource(file);
      expect(production).not.toContain('legacy-engine-runtime');
      expect(production).not.toContain('invoke_ts_engine');
      expect(production).not.toContain('engine-invoke');
    }
  });
});