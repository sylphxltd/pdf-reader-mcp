import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

/**
 * Product truth after recovery:
 * - Published path: TypeScript dist/index.js (3.0.14)
 * - Pure-Rust: experimental opt-in only
 * - Parity bridge remains deleted (no dual production default)
 */
describe('published TypeScript production default', () => {
  it('npm package bin points at TypeScript dist/index.js', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
      exports?: Record<string, string>;
      version?: string;
    };
    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./dist/index.js');
    expect(pkg.exports?.['.']).toBe('./dist/index.js');
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  });

  it('parity bridge is deleted', () => {
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(false);
  });

  it('optional pure-Rust launcher is opt-in only', () => {
    const bin = readFileSync(path.join(repoRoot, 'bin/pdf-reader-mcp'), 'utf8');
    expect(bin).toContain('PDF_READER_ENGINE_MODE');
    expect(bin).toContain('dist/index.js');
    expect(bin).not.toContain('PDF_READER_ENGINE_MODE=full');
  });

  it('honest capability matrix documents experimental pure-Rust', () => {
    const matrix = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/pure-rust-capability-matrix.json'), 'utf8')
    ) as {
      productTruth: {
        dropInFor3014: boolean;
        pureRustStatus: string;
        publishedStable: string;
        publishedImplementation?: string;
      };
    };
    expect(matrix.productTruth.dropInFor3014).toBe(false);
    expect(matrix.productTruth.pureRustStatus).toBe('experimental-opt-in');
    // May be 3.0.14 LKG or a later Stage B progress package (e.g. 3.1.3) that still defaults to TS.
    expect(matrix.productTruth.publishedStable).toMatch(/@sylphx\/pdf-reader-mcp@\d+\.\d+\.\d+/);
    expect(String(matrix.productTruth.publishedImplementation ?? 'TypeScript')).toMatch(
      /TypeScript/i
    );
  });
});
