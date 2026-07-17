import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

/**
 * Convergence architecture:
 * - Production process: Rust rmcp
 * - Production tool engine: full TypeScript via parity bridge (drop-in)
 * - Pure-Rust subset: opt-in only until matrix is green
 */
describe('Rust process + full TS parity default', () => {
  it('npm package bin points at Rust launcher', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
      exports?: Record<string, string>;
    };
    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./bin/pdf-reader-mcp');
    expect(pkg.exports?.['.']).toBe('./dist/index.js');
  });

  it('TypeScript tool handlers and parity bridge exist', () => {
    expect(existsSync(path.join(repoRoot, 'src/handlers/readPdf.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'src/legacy-engine-runtime.ts'))).toBe(true);
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(true);
  });

  it('launcher defaults to Rust process and full engine mode', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('printf \'%s\\n\' "rust"');
    expect(bin).toContain('PDF_READER_ENGINE_MODE=full');
    expect(bin).toContain('resolve_rust_bin');
  });

  it('parity matrix documents drop-in bridge and pure-rust exit criteria', () => {
    const matrix = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/rust-dropin-parity-matrix.json'), 'utf8')
    ) as {
      productionDefault: { engineMode: string; engineImplementation: string };
      exitCriteriaForPureRustDefault: string[];
    };
    expect(matrix.productionDefault.engineMode).toBe('full');
    expect(matrix.productionDefault.engineImplementation).toContain('legacy-engine-runtime');
    expect(matrix.exitCriteriaForPureRustDefault.length).toBeGreaterThan(0);
  });
});
