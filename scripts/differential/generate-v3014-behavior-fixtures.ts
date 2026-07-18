#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const manifestPath = join(scriptDir, 'fixtures/v3014-behavior-fixtures.json');
const pdfPath = join(fixtureDir, 'v3014-behavior-v1.pdf');
const malformedPath = join(fixtureDir, 'v3014-malformed-v1.pdf');
const write = process.argv.includes('--write');

const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

function buildPdf(): Buffer {
  const pageStreams = [
    ['PAGE_ONE_ALPHA', 'Needle at start. cat catalog CAT.'],
    ['PAGE_TWO_BETA', 'prefix Needle suffix', 'Caf\\351 r\\351sum\\351'],
    ['PAGE_THREE_GAMMA', 'needle tail NEEDLE'],
  ].map(
    (lines) =>
      `BT\n/F1 12 Tf\n72 720 Td\n${lines
        .map((line, index) => `${index === 0 ? '' : '0 -18 Td\n'}(${line}) Tj`)
        .join('\n')}\nET\n`
  );

  const objects = new Map<number, string>([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>'],
    [
      3,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 4 0 R >>',
    ],
    [4, `<< /Length ${Buffer.byteLength(pageStreams[0]!, 'latin1')} >>\nstream\n${pageStreams[0]}endstream`],
    [
      5,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 6 0 R >>',
    ],
    [6, `<< /Length ${Buffer.byteLength(pageStreams[1]!, 'latin1')} >>\nstream\n${pageStreams[1]}endstream`],
    [
      7,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 8 0 R >>',
    ],
    [8, `<< /Length ${Buffer.byteLength(pageStreams[2]!, 'latin1')} >>\nstream\n${pageStreams[2]}endstream`],
    [9, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
    [
      10,
      '<< /Title (Parity Corpus V1) /Author (Sylphx Oracle) /Subject (TS 3.0.14 behavioral contract) /Keywords (parity multipage search) /Creator (fixture-generator-v1) /Producer (fixture-generator-v1) >>',
    ],
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
  const xref = [
    `xref\n0 ${objects.size + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.size + 1} /Root 1 0 R /Info 10 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join('');
  chunks.push(Buffer.from(xref, 'ascii'));
  return Buffer.concat(chunks);
}

const files = [
  { path: pdfPath, bytes: buildPdf() },
  { path: malformedPath, bytes: Buffer.from('%PDF-1.4\n%not-a-valid-pdf-structure\n') },
];
const manifest = {
  schemaVersion: 1,
  generator: relative(repoRoot, fileURLToPath(import.meta.url)),
  fixtures: files.map(({ path, bytes }) => ({
    path: relative(repoRoot, path),
    bytes: bytes.length,
    sha256: sha256(bytes),
  })),
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

if (write) {
  mkdirSync(fixtureDir, { recursive: true });
  mkdirSync(dirname(manifestPath), { recursive: true });
  for (const file of files) writeFileSync(file.path, file.bytes);
  writeFileSync(manifestPath, manifestBytes);
  console.error(`wrote ${files.length} fixtures and ${relative(repoRoot, manifestPath)}`);
  process.exit(0);
}

const mismatches: string[] = [];
for (const file of files) {
  if (!existsSync(file.path) || !readFileSync(file.path).equals(file.bytes)) {
    mismatches.push(relative(repoRoot, file.path));
  }
}
if (!existsSync(manifestPath) || !readFileSync(manifestPath).equals(manifestBytes)) {
  mismatches.push(relative(repoRoot, manifestPath));
}
if (mismatches.length > 0) {
  throw new Error(`behavior fixtures are stale or missing: ${mismatches.join(', ')}; run with --write`);
}
console.log(`v3.0.14 behavior fixtures: OK (${files.length})`);
