#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const pdfPath = join(fixtureDir, 'v3014-semantic-hints-v1.pdf');
const manifestPath = join(scriptDir, 'fixtures/v3014-semantic-hint-fixture.json');
const write = process.argv.includes('--write');
const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

function buildPdf(): Buffer {
  const pageStreams = [
    [
      'BT',
      '/F1 10 Tf',
      '1 0 0 1 72 756 Tm',
      '(CONFIDENTIAL) Tj',
      '/F1 12 Tf',
      '1 0 0 1 72 700 Tm',
      '(Chapter 1: Overview) Tj',
      '1 0 0 1 72 672 Tm',
      '(2.3 Methods) Tj',
      '1 0 0 1 72 644 Tm',
      '(IV. Results) Tj',
      '1 0 0 1 72 616 Tm',
      '(Figure 2: Architecture) Tj',
      '1 0 0 1 72 588 Tm',
      '(- First item) Tj',
      '1 0 0 1 72 560 Tm',
      '(Ordinary paragraph.) Tj',
      '/F1 22 Tf',
      '1 0 0 1 72 520 Tm',
      '(Large Title) Tj',
      '/F1 19 Tf',
      '1 0 0 1 72 480 Tm',
      '(Medium Large Title) Tj',
      '/F1 18 Tf',
      '1 0 0 1 72 442 Tm',
      '(Smaller Large Title) Tj',
      '/F1 22 Tf',
      '1 0 0 1 72 402 Tm',
      '(Large sentence.) Tj',
      '/F1 10 Tf',
      '1 0 0 1 72 36 Tm',
      '(Page 1 of 2) Tj',
      'ET',
      '',
    ].join('\n'),
    [
      'BT',
      '/F1 10 Tf',
      '1 0 0 1 72 756 Tm',
      '(Prepared for Sylphx) Tj',
      '/F1 12 Tf',
      '1 0 0 1 72 700 Tm',
      '(Table 3 - Metrics) Tj',
      '1 0 0 1 72 672 Tm',
      '(1. Numbered list item) Tj',
      '1 0 0 1 72 644 Tm',
      '(Another ordinary paragraph.) Tj',
      '1 0 0 1 72 616 Tm',
      '([x] Completed item) Tj',
      '1 0 0 1 72 588 Tm',
      '(Figment 2: Not a caption) Tj',
      '1 0 0 1 72 560 Tm',
      '(-No separating space) Tj',
      '/F1 10 Tf',
      '1 0 0 1 72 36 Tm',
      '(Copyright 2026 Sylphx) Tj',
      '1 0 0 1 180 55 Tm',
      '(Page one of two) Tj',
      'ET',
      '',
    ].join('\n'),
  ];
  const objects = new Map<number, string>([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 /MediaBox [0 0 612 792] >>'],
    [3, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>'],
    [4, `<< /Length ${Buffer.byteLength(pageStreams[0]!, 'latin1')} >>\nstream\n${pageStreams[0]}endstream`],
    [5, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>'],
    [6, `<< /Length ${Buffer.byteLength(pageStreams[1]!, 'latin1')} >>\nstream\n${pageStreams[1]}endstream`],
    [7, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
  ]);
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets = [0];
  let length = chunks[0]!.length;
  for (let id = 1; id <= objects.size; id += 1) {
    offsets[id] = length;
    const chunk = Buffer.from(`${id} 0 obj\n${objects.get(id)}\nendobj\n`, 'latin1');
    chunks.push(chunk);
    length += chunk.length;
  }
  const xrefOffset = length;
  chunks.push(
    Buffer.from(
      [
        `xref\n0 ${objects.size + 1}\n`,
        '0000000000 65535 f \n',
        ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
        `trailer\n<< /Size ${objects.size + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
      ].join(''),
      'ascii'
    )
  );
  return Buffer.concat(chunks);
}

const bytes = buildPdf();
const manifest = {
  schemaVersion: 1,
  generator: relative(repoRoot, fileURLToPath(import.meta.url)),
  fixture: {
    path: relative(repoRoot, pdfPath),
    bytes: bytes.length,
    sha256: sha256(bytes),
  },
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
if (write) {
  mkdirSync(fixtureDir, { recursive: true });
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(pdfPath, bytes);
  writeFileSync(manifestPath, manifestBytes);
  console.error(`wrote ${relative(repoRoot, pdfPath)}`);
  process.exit(0);
}
if (!existsSync(pdfPath) || !readFileSync(pdfPath).equals(bytes)) {
  throw new Error('semantic-hint fixture is stale or missing; run with --write');
}
if (!existsSync(manifestPath) || !readFileSync(manifestPath).equals(manifestBytes)) {
  throw new Error('semantic-hint fixture manifest is stale or missing; run with --write');
}
console.log('v3.0.14 semantic-hint fixture: OK (1)');
