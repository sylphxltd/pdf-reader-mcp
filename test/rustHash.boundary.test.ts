import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { hashLocalFile } from '../src/evidence/envelope.js';
import {
  hashLocalFileViaRustEngine,
  resolveRustCliBinary,
  shouldUseRustHashEngine,
} from '../src/engine/rust-hash.js';

const fixturePath = path.resolve('test/fixtures/sample.pdf');

describe('Rust hash core boundary', () => {
  it('has a built pdf-reader-cli binary for boundary tests', () => {
    const binary = resolveRustCliBinary();
    expect(binary).not.toBe('pdf-reader-cli');
  });

  it('returns the same SHA-256 as the TypeScript fallback for a fixture PDF', async () => {
    process.env['PDF_READER_USE_RUST_HASH'] = '1';
    expect(shouldUseRustHashEngine()).toBe(true);

    const bytes = await readFile(fixturePath);
    const expected = createHash('sha256').update(bytes).digest('hex');
    const rustHash = hashLocalFileViaRustEngine(fixturePath);
    const tsHash = await hashLocalFile(fixturePath);

    expect(rustHash).toBe(expected);
    expect(tsHash).toBe(expected);

    delete process.env['PDF_READER_USE_RUST_HASH'];
  });
});