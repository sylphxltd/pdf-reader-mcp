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

describe('architecture contract (pure-Rust MCP)', () => {
  it('ships pure-Rust tool modules without parity bridge', () => {
    expect(existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/read_pdf.rs'))).toBe(
      true
    );
    expect(existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/search.rs'))).toBe(
      true
    );
    expect(existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/pdf_evidence.rs'))).toBe(
      true
    );
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(false);
  });

  it('launcher is pure-Rust only', () => {
    const script = readFileSync(binWrapper, 'utf8');
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
    };
    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./bin/pdf-reader-mcp');
    expect(script).toContain('resolve_rust_bin');
    expect(script).toContain('pdf-reader-mcp-server');
    expect(script).not.toContain('PDF_READER_ENGINE_MODE=full');
    expect(script).not.toContain('dist/index.js');
    expect(script).not.toContain('legacy-engine-runtime');
  });

  it('tool modules call pdf-reader-core directly', () => {
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

  it('keeps legacy TypeScript engine runtime out of production Rust modules', () => {
    for (const file of ['cli_bridge.rs', 'main.rs', 'read_pdf.rs', 'search.rs', 'pdf_evidence.rs']) {
      const production = productionSource(file);
      expect(production).not.toContain('legacy-engine-runtime');
      expect(production).not.toContain('invoke_ts_engine');
      expect(production).not.toContain('invoke_full_ts_tool');
    }
  });
});
