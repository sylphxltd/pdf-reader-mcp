import { beforeAll, describe, expect, it } from 'bun:test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  isRustCliAvailable,
  searchPdfTextViaRustEngine,
  shouldUseRustTextSearchEngine,
} from '../src/engine/rust-text-search.js';
import { defaultSearchPdfOptions, searchPdfSource } from '../src/pdf/search.js';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixturePath = path.resolve('test/fixtures/sample.pdf');

describe('Rust text search core boundary', () => {
  beforeAll(() => {
    execSync('cargo build -q --release', { cwd: repoRoot, stdio: 'pipe', timeout: 180_000 });
  }, 180_000);

  it('defaults to the Rust CLI when it is built', () => {
    expect(isRustCliAvailable()).toBe(true);
    expect(shouldUseRustTextSearchEngine()).toBe(true);
  });

  it('finds literal matches in the sample PDF fixture', () => {
    const response = searchPdfTextViaRustEngine(fixturePath, defaultSearchPdfOptions('Sample PDF'));
    expect(response.ok).toBe(true);
    if (!response.ok) {
      return;
    }

    expect(response.result.route).toBe('rust-text-index');
    expect(response.result.totalMatches).toBeGreaterThan(0);
    expect(response.result.matches[0]?.page).toBeGreaterThan(0);
  });

  it('routes search_pdf through the Rust text index for local files', async () => {
    const result = await searchPdfSource(
      { path: fixturePath },
      defaultSearchPdfOptions('Lorem ipsum')
    );

    expect(result.success).toBe(true);
    expect(result.matches?.length).toBeGreaterThan(0);
    expect(result.matches?.[0]?.provenance.engine).toBe('rust-text-index');
  });

  it('keeps text search logic out of the TypeScript adapter sources', () => {
    const searchSrc = readFileSync(path.join(repoRoot, 'src/pdf/search.ts'), 'utf8');
    const engineSrc = readFileSync(path.join(repoRoot, 'src/engine/rust-text-search.ts'), 'utf8');

    expect(engineSrc).toContain('pdf_text_search');
    expect(searchSrc).toContain('searchPdfTextViaRustEngine');
    expect(searchSrc).not.toMatch(/pdf_extract|find_matches_in_text/i);
  });
});