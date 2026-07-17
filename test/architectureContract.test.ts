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

describe('architecture contract (Rust process + full TS parity engine)', () => {
  it('ships TypeScript handlers and legacy engine runtime for drop-in parity', () => {
    expect(existsSync(path.join(repoRoot, 'src/index.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'src/handlers/readPdf.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'src/legacy-engine-runtime.ts'))).toBe(true);
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(true);
  });

  it('launcher defaults to Rust process with full-parity engine mode', () => {
    const script = readFileSync(binWrapper, 'utf8');
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
    };
    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./bin/pdf-reader-mcp');
    expect(script).toContain('printf \'%s\\n\' "rust"');
    expect(script).toContain('PDF_READER_ENGINE_MODE=full');
    expect(script).toContain('resolve_rust_bin');
    expect(script).toContain('dist/index.js');
  });

  it('parity bridge owns full TypeScript tool execution by default', () => {
    const parity = productionSource('parity_bridge.rs');
    expect(parity).toContain('legacy-engine-runtime.js');
    expect(parity).toContain('EngineMode::Full');
    expect(parity).toContain('invoke_full_ts_tool');
  });

  it('keeps pure-rust tool modules available behind engine mode switch', () => {
    const read = productionSource('read_pdf.rs');
    const search = productionSource('search.rs');
    const evidence = productionSource('pdf_evidence.rs');
    expect(read).toContain('uses_full_parity_engine');
    expect(search).toContain('uses_full_parity_engine');
    expect(evidence).toContain('uses_full_parity_engine');
    expect(read).toContain('read_pdf_pure_rust');
  });

  it('keeps legacy TypeScript engine runtime out of pure-rust helper modules except parity bridge', () => {
    for (const file of ['cli_bridge.rs', 'main.rs']) {
      const production = productionSource(file);
      expect(production).not.toContain('legacy-engine-runtime');
      expect(production).not.toContain('invoke_ts_engine');
    }
  });
});
