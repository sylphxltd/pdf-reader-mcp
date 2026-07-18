#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const pdfPath = join(fixtureDir, 'v3014-document-ast-v1.pdf');
const manifestPath = join(scriptDir, 'fixtures/v3014-document-ast-fixture.json');
const write = process.argv.includes('--write');
const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

function pageStream(lines: Array<{ text: string; size: number; x?: number; y: number }>): string {
  return [
    'BT',
    ...lines.flatMap(({ text, size, x = 72, y }) => [
      `/F1 ${String(size)} Tf`,
      `1 0 0 1 ${String(x)} ${String(y)} Tm`,
      `(${text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')}) Tj`,
    ]),
    'ET',
    '',
  ].join('\n');
}

function buildPdf(): Buffer {
  const streams = [
    pageStream([
      { text: 'Chapter 1: Foundations', size: 18, y: 720 },
      { text: 'Opening paragraph.', size: 12, y: 684 },
      { text: '1.1 Details', size: 15, y: 640 },
      { text: 'Detailed paragraph.', size: 12, y: 604 },
      { text: '- First detail', size: 12, y: 572 },
    ]),
    pageStream([
      { text: 'Continuation on page two.', size: 12, y: 720 },
      { text: '1.1.1 Deep Dive', size: 14, y: 676 },
      { text: 'Deep paragraph.', size: 12, y: 640 },
      { text: '- Second detail', size: 12, y: 608 },
    ]),
    pageStream([
      { text: 'Continuation on page three.', size: 12, y: 720 },
      { text: 'Chapter 2: Conclusions', size: 18, y: 676 },
      { text: 'Closing paragraph.', size: 12, y: 640 },
    ]),
    pageStream([
      { text: 'Standalone paragraph.', size: 12, y: 720 },
      { text: 'Another plain sentence.', size: 12, y: 684 },
    ]),
  ];
  const objects = new Map<number, string>([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R 9 0 R] /Count 4 /MediaBox [0 0 612 792] >>'],
    [3, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 11 0 R >> >> /Contents 4 0 R >>'],
    [4, `<< /Length ${Buffer.byteLength(streams[0]!, 'latin1')} >>\nstream\n${streams[0]}endstream`],
    [5, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 11 0 R >> >> /Contents 6 0 R >>'],
    [6, `<< /Length ${Buffer.byteLength(streams[1]!, 'latin1')} >>\nstream\n${streams[1]}endstream`],
    [7, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 11 0 R >> >> /Contents 8 0 R >>'],
    [8, `<< /Length ${Buffer.byteLength(streams[2]!, 'latin1')} >>\nstream\n${streams[2]}endstream`],
    [9, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 11 0 R >> >> /Contents 10 0 R >>'],
    [10, `<< /Length ${Buffer.byteLength(streams[3]!, 'latin1')} >>\nstream\n${streams[3]}endstream`],
    [11, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
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
  throw new Error('document-AST fixture is stale or missing; run with --write');
}
if (!existsSync(manifestPath) || !readFileSync(manifestPath).equals(manifestBytes)) {
  throw new Error('document-AST fixture manifest is stale or missing; run with --write');
}
console.log('v3.0.14 document-AST fixture: OK (1)');
