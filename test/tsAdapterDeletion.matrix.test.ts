import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

/**
 * Product truth after 3.2.1 corrective packaging:
 * - Default entry: pure-Rust native via dist/runtime-entry.js, fail-closed if missing
 * - TypeScript: explicit rollback only (./typescript or force flags)
 * - Parity bridge remains deleted
 */
describe('published pure-Rust default with explicit TypeScript rollback', () => {
  it('npm package bin prefers pure-Rust runtime-entry with TypeScript export retained', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
      exports?: Record<string, string>;
      version?: string;
    };
    expect(pkg.bin?.['pdf-reader-mcp']).toBe('./dist/runtime-entry.js');
    expect(pkg.exports?.['.']).toBe('./dist/runtime-entry.js');
    expect(pkg.exports?.['./typescript']).toBe('./dist/index.js');
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  });

  it('runtime-entry is fail-closed without automatic TypeScript fallback', () => {
    const source = readFileSync(path.join(repoRoot, 'src/runtime-entry.ts'), 'utf8');
    expect(source).toContain('fail-closed');
    expect(source).toContain('PDF_READER_FORCE_TYPESCRIPT');
    expect(source).toContain('no automatic TypeScript fallback');
    expect(source).not.toContain('Falls back to the TypeScript');
    expect(source).not.toContain('// TypeScript fallback path.');
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

  it('honest capability matrix documents fail-closed pure-Rust default', () => {
    const matrix = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/pure-rust-capability-matrix.json'), 'utf8')
    ) as {
      productTruth: {
        dropInFor3014: boolean;
        pureRustStatus: string;
        publishedStable: string;
        publishedImplementation?: string;
        soleRuntimeDefault?: boolean;
        automaticTypescriptFallback?: boolean;
        typescriptFallback?: string | boolean;
      };
    };
    expect(matrix.productTruth.dropInFor3014).toBe(true);
    expect(matrix.productTruth.soleRuntimeDefault).toBe(true);
    expect(matrix.productTruth.automaticTypescriptFallback).toBe(false);
    expect(matrix.productTruth.typescriptFallback).toBe('explicit-only');
    expect(matrix.productTruth.pureRustStatus).toContain('default');
    expect(matrix.productTruth.pureRustStatus).toContain('fail-closed');
    expect(matrix.productTruth.publishedStable).toMatch(/@sylphx\/pdf-reader-mcp@\d+\.\d+\.\d+/);
    expect(String(matrix.productTruth.publishedImplementation ?? '')).toMatch(
      /pure-Rust|fail-closed/i
    );
  });
});
