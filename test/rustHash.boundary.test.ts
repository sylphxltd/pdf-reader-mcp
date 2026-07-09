import { beforeAll, describe, expect, it } from 'bun:test';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { hashLocalFile } from '../src/evidence/envelope.js';
import {
  hashLocalFileViaRustEngine,
  isRustCliAvailable,
  resolveRustCliBinary,
  shouldUseRustHashEngine,
} from '../src/engine/rust-hash.js';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixturePath = path.resolve('test/fixtures/sample.pdf');

describe('Rust hash core boundary', () => {
  beforeAll(() => {
    execSync('cargo build -q --release', { cwd: repoRoot, stdio: 'pipe', timeout: 180_000 });
  }, 180_000);

  it('has a built pdf-reader-cli binary for boundary tests', () => {
    const binary = resolveRustCliBinary();
    expect(binary).not.toBe('pdf-reader-cli');
  });

  it('defaults to the Rust CLI when it is built', () => {
    expect(isRustCliAvailable()).toBe(true);
    expect(shouldUseRustHashEngine()).toBe(true);
  });

  it('returns the same SHA-256 as the TypeScript fallback for a fixture PDF', async () => {
    const bytes = await readFile(fixturePath);
    const expected = createHash('sha256').update(bytes).digest('hex');
    const rustHash = hashLocalFileViaRustEngine(fixturePath);
    const envelopeHash = await hashLocalFile(fixturePath);

    expect(rustHash).toBe(expected);
    expect(envelopeHash).toBe(expected);
  });
});