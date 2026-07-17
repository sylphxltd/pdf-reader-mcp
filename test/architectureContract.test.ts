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

describe('architecture contract (TS production default + Rust opt-in)', () => {
  it('ships the full TypeScript MCP adapter as production default', () => {
    expect(existsSync(path.join(repoRoot, 'src/index.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'src/mcp.ts'))).toBe(true);
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
    };
    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./dist/index.js');
  });

  it('launcher defaults to TypeScript and keeps Rust as opt-in only', () => {
    const script = readFileSync(binWrapper, 'utf8');
    expect(script).toContain('dist/index.js');
    expect(script).toContain('exec node');
    expect(script).toContain('PDF_READER_MCP_ENGINE');
    expect(script).toContain('resolve_rust_bin');
    expect(script).toContain('pdf-reader-mcp-server');
  });

  it('routes Rust opt-in read_pdf through Rust core module instead of cli_bridge legacy path', () => {
    const lib = readFileSync(path.join(mcpServerSrc, 'lib.rs'), 'utf8');
    const production = lib.split('#[cfg(test)]')[0] ?? lib;
    expect(production).toContain('read_pdf::read_pdf');
    expect(production).not.toContain('cli_bridge::invoke_cli_tool("read_pdf"');
    expect(production).toContain('pdf_evidence::pdf_evidence');
    expect(production).not.toContain('cli_bridge::invoke_cli_tool("pdf_evidence"');
  });

  it('keeps cli_bridge available only for optional legacy search fallback on Rust path', () => {
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
