import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

/**
 * Pure-Rust cutover complete:
 * - Production process: Rust rmcp
 * - Production tool engine: pdf-reader-core only
 * - Parity bridge removed
 */
describe('pure-Rust production default', () => {
  it('npm package bin points at Rust launcher', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
    };
    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./bin/pdf-reader-mcp');
  });

  it('parity bridge is deleted', () => {
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(false);
  });

  it('launcher is pure-Rust only', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('resolve_rust_bin');
    expect(bin).toContain('pdf-reader-mcp-server');
    expect(bin).not.toContain('PDF_READER_ENGINE_MODE=full');
    expect(bin).not.toContain('legacy-engine-runtime');
  });

  it('parity matrix documents pure-Rust as production default', () => {
    const matrix = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/rust-dropin-parity-matrix.json'), 'utf8')
    ) as {
      productionDefault: { engineMode: string; engineImplementation: string };
    };
    expect(matrix.productionDefault.engineMode).toBe('pure-rust');
    expect(matrix.productionDefault.engineImplementation.toLowerCase()).toContain('rust');
  });
});
