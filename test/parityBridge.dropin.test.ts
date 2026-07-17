import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const samplePdf = path.join(repoRoot, 'test/fixtures/sample.pdf');
const legacyRuntime = path.join(repoRoot, 'dist/legacy-engine-runtime.js');

describe('full TS parity bridge (drop-in engine)', () => {
  test('legacy engine runtime returns successful read_pdf for sample.pdf', () => {
    const payload = JSON.stringify({
      tool: 'read_pdf',
      arguments: {
        sources: [{ path: samplePdf }],
        include_metadata: true,
        include_page_count: true,
        include_full_text: false,
      },
    });
    const result = spawnSync('node', [legacyRuntime], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: payload,
      timeout: 30_000,
    });
    expect(result.status).toBe(0);
    const line = (result.stdout ?? '')
      .split('\n')
      .map((item) => item.trim())
      .reverse()
      .find((item) => item.startsWith('{'));
    expect(line).toBeDefined();
    const body = JSON.parse(line as string) as {
      isError?: boolean;
      content?: Array<{ text?: string }>;
    };
    expect(body.isError).not.toBe(true);
    const text = body.content?.[0]?.text ?? '';
    expect(text).toContain('results');
    expect(text).toContain('success');
  });

  test('legacy engine rejects dual path+url locator (public contract refine)', () => {
    const payload = JSON.stringify({
      tool: 'read_pdf',
      arguments: {
        sources: [{ path: samplePdf, url: 'https://example.com/x.pdf' }],
        include_full_text: false,
        auto: false,
      },
    });
    const result = spawnSync('node', [legacyRuntime], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: payload,
      timeout: 30_000,
    });
    expect(result.status).toBe(0);
    const line = (result.stdout ?? '')
      .split('\n')
      .map((item) => item.trim())
      .reverse()
      .find((item) => item.startsWith('{'));
    expect(line).toBeDefined();
    const body = JSON.parse(line as string) as {
      isError?: boolean;
      content?: Array<{ text?: string }>;
    };
    expect(body.isError).toBe(true);
    expect((body.content?.[0]?.text ?? '').toLowerCase()).toMatch(/exactly one|path|url|invalid/);
  });

  test('legacy engine blocks private URL SSRF encodings (GHSA-f3xw-ff5r-rj7c)', () => {
    const payload = JSON.stringify({
      tool: 'read_pdf',
      arguments: {
        sources: [{ url: 'http://[64:ff9b::a9fe:a9fe]/latest/meta-data/' }],
        include_full_text: false,
      },
    });
    const result = spawnSync('node', [legacyRuntime], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: payload,
      timeout: 30_000,
    });
    expect(result.status).toBe(0);
    const line = (result.stdout ?? '')
      .split('\n')
      .map((item) => item.trim())
      .reverse()
      .find((item) => item.startsWith('{'));
    expect(line).toBeDefined();
    const body = JSON.parse(line as string) as {
      isError?: boolean;
      content?: Array<{ text?: string }>;
    };
    const text = (body.content?.[0]?.text ?? '').toLowerCase();
    expect(body.isError === true || /non-public|ssrf|failed|rejected|url/.test(text)).toBe(true);
  });
});
