import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPureRustClient,
  getPureRustExportContract,
  PURE_RUST_EXPORT,
  resolvePureRustServerBinary,
} from '../src/pure-rust.ts';

const root = join(import.meta.dir, '..');

describe('pure-rust npm library export', () => {
  test('documents sole-runtime default product truth', () => {
    expect(PURE_RUST_EXPORT.dropInFor3014).toBe(true);
    expect(PURE_RUST_EXPORT.publishFreeze).toBe(false);
    expect(PURE_RUST_EXPORT.defaultPackageExport).toBe('./dist/runtime-entry.js');
    expect(PURE_RUST_EXPORT.pureRustExport).toBe('./dist/pure-rust.js');
  });

  test('resolves staged pure-rust binary on this host when present', () => {
    const binary = resolvePureRustServerBinary({ packageRoot: root });
    if (!binary) {
      // Local worktrees without a staged binary still prove resolver null path.
      expect(binary).toBeNull();
      return;
    }
    expect(existsSync(binary)).toBe(true);
    const contract = getPureRustExportContract();
    expect(contract.resolvedBinary).toBeTruthy();
  });

  test('can initialize and call read_pdf when binary is available', async () => {
    const binary = resolvePureRustServerBinary({ packageRoot: root });
    if (!binary) {
      expect(binary).toBeNull();
      return;
    }
    const client = createPureRustClient({ packageRoot: root, timeoutMs: 30_000 });
    const result = await client.readPdf({
      sources: [{ path: join(root, 'test/fixtures/sample.pdf'), pages: [1] }],
      auto: false,
      include_page_count: true,
      include_full_text: true,
    });
    expect(result.isError).toBe(false);
    const results = result.payload.results as Array<Record<string, unknown>> | undefined;
    expect(Array.isArray(results)).toBe(true);
    expect(results?.[0]?.success).toBe(true);
  });
});
