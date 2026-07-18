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

describe('architecture contract (published TS + experimental pure-Rust)', () => {
  it('published package points at TypeScript dist/index.js', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
      exports?: Record<string, string>;
      version?: string;
    };
    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./dist/index.js');
    expect(pkg.exports?.['.']).toBe('./dist/index.js');
    expect(pkg.version).toBe('3.0.14');
  });

  it('pure-Rust tool modules exist without parity bridge', () => {
    expect(existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/read_pdf.rs'))).toBe(
      true
    );
    expect(existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/search.rs'))).toBe(
      true
    );
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/pdf_evidence.rs'))
    ).toBe(true);
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(false);
  });

  it('optional launcher defaults to TypeScript and pure-Rust is opt-in', () => {
    const script = readFileSync(binWrapper, 'utf8');
    expect(script).toContain('dist/index.js');
    expect(script).toContain('PDF_READER_ENGINE_MODE');
    expect(script).toContain('resolve_rust_bin');
    expect(script).not.toContain('PDF_READER_ENGINE_MODE=full');
  });

  it('pure-Rust tool modules call pdf-reader-core directly', () => {
    const read = productionSource('read_pdf.rs');
    const search = productionSource('search.rs');
    const evidence = productionSource('pdf_evidence.rs');
    expect(read).toContain('read_pdf_from_value');
    expect(search).toContain('search_pdf_from_value');
    expect(evidence).toContain('extract_page_texts');
    expect(read).not.toContain('parity_bridge');
    expect(search).not.toContain('parity_bridge');
    expect(evidence).not.toContain('parity_bridge');
  });

  it('keeps legacy invoke paths out of pure-Rust modules', () => {
    for (const file of [
      'cli_bridge.rs',
      'main.rs',
      'read_pdf.rs',
      'search.rs',
      'pdf_evidence.rs',
    ]) {
      const production = productionSource(file);
      expect(production).not.toContain('invoke_ts_engine');
      expect(production).not.toContain('invoke_full_ts_tool');
    }
  });
});
