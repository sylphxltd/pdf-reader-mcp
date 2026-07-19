#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const manifestPath = join(scriptDir, 'fixtures/v3014-raster-image-fixtures.json');
const write = process.argv.includes('--write');
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

type PdfObject = string | Buffer;

function stream(dictionary: string, bytes: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${String(bytes.length)} >>\nstream\n`, 'ascii'),
    bytes,
    Buffer.from('\nendstream', 'ascii'),
  ]);
}

function pdf(objects: Map<number, PdfObject>, root = 1): Buffer {
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets = [0];
  let length = chunks[0]!.length;
  const maxId = Math.max(...objects.keys());
  for (let id = 1; id <= maxId; id += 1) {
    const body = objects.get(id);
    if (body === undefined) throw new Error(`missing PDF object ${String(id)}`);
    offsets[id] = length;
    const chunk = Buffer.concat([
      Buffer.from(`${String(id)} 0 obj\n`, 'ascii'),
      typeof body === 'string' ? Buffer.from(body, 'latin1') : body,
      Buffer.from('\nendobj\n', 'ascii'),
    ]);
    chunks.push(chunk);
    length += chunk.length;
  }
  const xrefOffset = length;
  chunks.push(Buffer.from([
    `xref\n0 ${String(maxId + 1)}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${String(maxId + 1)} /Root ${String(root)} 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`,
  ].join(''), 'ascii'));
  return Buffer.concat(chunks);
}

const grayPixels = Buffer.from([0, 85, 170, 255]);
const rgbPixels = Buffer.from([
  255, 0, 0, 0, 255, 0,
  0, 0, 255, 255, 255, 255,
]);
const page1 = Buffer.from('q\n20 0 0 20 72 700 cm\n/G Do\nQ\n', 'ascii');
const page2 = Buffer.from('BT\n/F1 12 Tf\n72 730 Td\n(Mixed image page) Tj\nET\nq\n24 0 0 24 72 680 cm\n/R Do\nQ\n', 'ascii');
const page3 = Buffer.from('q\n16 0 0 16 72 700 cm\n/R Do\nQ\nq\n16 0 0 16 120 650 cm\n/R Do\nQ\n', 'ascii');
const page4 = Buffer.from('BT\n/F1 12 Tf\n72 720 Td\n(Image free page) Tj\nET\n', 'ascii');

const common = pdf(new Map<number, PdfObject>([
  [1, '<< /Type /Catalog /Pages 2 0 R >>'],
  [2, '<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R 9 0 R] /Count 4 /MediaBox [0 0 612 792] >>'],
  [3, '<< /Type /Page /Parent 2 0 R /Resources << /XObject << /G 11 0 R >> >> /Contents 4 0 R >>'],
  [4, stream('', page1)],
  [5, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 13 0 R >> /XObject << /R 12 0 R >> >> /Contents 6 0 R >>'],
  [6, stream('', page2)],
  [7, '<< /Type /Page /Parent 2 0 R /Resources << /XObject << /R 12 0 R >> >> /Contents 8 0 R >>'],
  [8, stream('', page3)],
  [9, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 13 0 R >> >> /Contents 10 0 R >>'],
  [10, stream('', page4)],
  [11, stream('/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8', grayPixels)],
  [12, stream('/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8', rgbPixels)],
  [13, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
]));

const shadowPaint = Buffer.from('q\n20 0 0 20 72 700 cm\n/AncestorOnly Do\nQ\n', 'ascii');
const inheritedPaint = Buffer.from('q\n20 0 0 20 72 700 cm\n/AncestorOnly Do\nQ\n', 'ascii');
const decodedPaint = Buffer.from('q\n20 0 0 20 72 700 cm\n/Decoded Do\nQ\n', 'ascii');
const shadowed = pdf(new Map<number, PdfObject>([
  [1, '<< /Type /Catalog /Pages 2 0 R >>'],
  [2, '<< /Type /Pages /Kids [3 0 R 7 0 R 9 0 R 12 0 R] /Count 4 /MediaBox [0 0 612 792] /Resources << /XObject << /AncestorOnly 5 0 R >> >> >>'],
  [3, '<< /Type /Page /Parent 2 0 R /Resources << /XObject << /DirectOnly 6 0 R >> >> /Contents 4 0 R >>'],
  [4, stream('', shadowPaint)],
  [5, stream('/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8', rgbPixels)],
  [6, stream('/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8', grayPixels)],
  [7, '<< /Type /Page /Parent 2 0 R /Contents 8 0 R >>'],
  [8, stream('', inheritedPaint)],
  [9, '<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Decoded 11 0 R >> >> /Contents 10 0 R >>'],
  [10, stream('', decodedPaint)],
  [11, stream('/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Decode [1 0]', Buffer.from([0]))],
  [12, '<< /Type /Page /Parent 2 0 R /Resources << /ProcSet [/PDF] >> /Contents 13 0 R >>'],
  [13, stream('', inheritedPaint)],
]));

const unsupportedPaint = Buffer.from('q\n20 0 0 20 72 700 cm\n/BAD Do\nQ\n', 'ascii');
const unsupported = pdf(new Map<number, PdfObject>([
  [1, '<< /Type /Catalog /Pages 2 0 R >>'],
  [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 612 792] >>'],
  [3, '<< /Type /Page /Parent 2 0 R /Resources << /XObject << /BAD 5 0 R >> >> /Contents 4 0 R >>'],
  [4, stream('', unsupportedPaint)],
  [5, stream('/Type /XObject /Subtype /Image /Width 0 /Height 2 /ColorSpace /UnsupportedRasterSpace /BitsPerComponent 8', Buffer.alloc(0))],
]));

const generated = [
  { path: join(fixtureDir, 'v3014-raster-images-v1.pdf'), bytes: common, pageCount: 4 },
  { path: join(fixtureDir, 'v3014-raster-images-unsupported-v1.pdf'), bytes: unsupported, pageCount: 1 },
  { path: join(fixtureDir, 'v3014-raster-images-shadowed-v1.pdf'), bytes: shadowed, pageCount: 4 },
].map((fixture) => ({
  path: relative(repoRoot, fixture.path),
  bytes: fixture.bytes.length,
  sha256: sha256(fixture.bytes),
  pageCount: fixture.pageCount,
  content: fixture.bytes,
}));
const manifest = {
  schemaVersion: 1,
  generator: relative(repoRoot, fileURLToPath(import.meta.url)),
  fixtures: generated.map(({ content: _content, ...fixture }) => fixture),
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

if (write) {
  mkdirSync(fixtureDir, { recursive: true });
  mkdirSync(dirname(manifestPath), { recursive: true });
  for (const fixture of generated) writeFileSync(join(repoRoot, fixture.path), fixture.content);
  writeFileSync(manifestPath, manifestBytes);
  console.error(`wrote ${String(generated.length)} raster-image fixtures and manifest`);
  process.exit(0);
}
for (const fixture of generated) {
  const path = join(repoRoot, fixture.path);
  if (!existsSync(path) || !readFileSync(path).equals(fixture.content)) {
    throw new Error(`raster-image fixture is stale or missing: ${fixture.path}; run with --write`);
  }
}
if (!existsSync(manifestPath) || !readFileSync(manifestPath).equals(manifestBytes)) {
  throw new Error('raster-image fixture manifest is stale or missing; run with --write');
}
console.log('v3.0.14 raster-image fixtures: OK (3 PDFs, 9 pages)');
