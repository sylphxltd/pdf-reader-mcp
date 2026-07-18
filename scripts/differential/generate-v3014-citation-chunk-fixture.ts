#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const pdfPath = join(fixtureDir, 'v3014-citation-chunk-v1.pdf');
const manifestPath = join(scriptDir, 'fixtures/v3014-citation-chunk-fixture.json');
const write = process.argv.includes('--write');
const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

function buildPdf(): Buffer {
  const sizeItems = Array.from({ length: 24 }, () => 'a'.repeat(80));
  const pageStreams = [
    `BT\n/F1 18 Tf\n72 720 Td\n(Chapter 1: Intro) Tj\n/F1 12 Tf\n0 -24 Td\n(Body paragraph.) Tj\n0 -24 Td\n(A | B) Tj\n0 -18 Td\n(1 | 2) Tj\nET\n`,
    `BT\n/F1 8 Tf\n36 720 Td\n${sizeItems
      .map((line, index) => `${index === 0 ? '' : '0 -12 Td\n'}(${line}) Tj`)
      .join('\n')}\nET\n`,
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
  throw new Error('citation-chunk fixture is stale or missing; run with --write');
}
if (!existsSync(manifestPath) || !readFileSync(manifestPath).equals(manifestBytes)) {
  throw new Error('citation-chunk fixture manifest is stale or missing; run with --write');
}
console.log('v3.0.14 citation-chunk fixture: OK (1)');
