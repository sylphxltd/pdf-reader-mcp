#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const pdfPath = join(fixtureDir, 'v3014-caption-link-v1.pdf');
const manifestPath = join(scriptDir, 'fixtures/v3014-caption-link-fixture.json');
const write = process.argv.includes('--write');
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

type Text = { value: string; x: number; y: number; size?: number; font?: 1 | 2 | 3 };
const pageStream = (items: Text[]): string =>
  [
    ...items.flatMap(({ value, x, y, size = 10, font = 1 }) => [
      'BT',
      `/F${String(font)} ${String(size)} Tf`,
      `1 0 0 1 ${String(x)} ${String(y)} Tm`,
      `(${value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')}) Tj`,
      'ET',
    ]),
    '',
  ].join('\n');

const grid = (left: number, top: number): Text[] => [
  { value: 'Metric', x: left, y: top },
  { value: 'Value', x: left + 178, y: top - 1, font: 2 },
  { value: 'Region', x: left + 348, y: top - 2, font: 3 },
  { value: 'Alpha', x: left, y: top - 30 },
  { value: '10', x: left + 178, y: top - 31, font: 2 },
  { value: 'North', x: left + 348, y: top - 32, font: 3 },
  { value: 'Beta', x: left, y: top - 60 },
  { value: '20', x: left + 178, y: top - 61, font: 2 },
  { value: 'South', x: left + 348, y: top - 62, font: 3 },
];
// Each page isolates one TS caption-link decision while retaining a real
// public read_pdf -> table extraction -> semantic element -> AST dependency path.
const pages: Text[][] = [
  // 1: caption below the table.
  [...grid(180, 560), { value: 'Table 1: Below relation', x: 180, y: 465 }],
  // 2: caption above the table.
  [{ value: 'Table 2: Above relation', x: 180, y: 625 }, ...grid(180, 570)],
  // 3: caption left of the table with vertical overlap.
  [...grid(180, 560), { value: 'Table 3: Left', x: 72, y: 515 }],
  // 4: caption right of the table with vertical overlap.
  [...grid(72, 560), { value: 'Table 4: Right', x: 520, y: 515 }],
  // 5: caption inside the table's aggregate box.
  [...grid(180, 560), { value: 'Table 5: Overlap', x: 205, y: 525 }],
  // 6: semantic kind mismatch must not link to a selectable table.
  [...grid(180, 560), { value: 'Figure 6: Not a table', x: 180, y: 465 }],
  // 7: two captions target one table; reverse caption_ids remain ordered and unique.
  [
    ...grid(180, 560),
    { value: 'Table 7a: First caption', x: 180, y: 465 },
    { value: 'Table 7b: Second caption', x: 180, y: 445 },
  ],
  // 8/9: exact vertical gap boundary. PDF text boxes make the element-level
  // gap values executable-oracle facts, checked by the differential projection.
  [...grid(180, 560), { value: 'Table 8: Gap boundary accepted', x: 180, y: 392 }],
  [...grid(180, 560), { value: 'Table 9: Gap boundary rejected', x: 180, y: 391 }],
  // 10/11: horizontal-overlap boundary pair for vertical caption placement.
  [...grid(180, 560), { value: 'Table: Overlap boundary', x: 92, y: 465 }],
  [...grid(180, 560), { value: 'Table: Overlap boundary', x: 91.9, y: 465 }],
];

function buildPdf(): Buffer {
  const objects = new Map<number, string>();
  const pageIds = pages.map((_, index) => 3 + index * 2);
  const fontId = 3 + pages.length * 2;
  const lastObjectId = fontId + 2;
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${String(id)} 0 R`).join(' ')}] /Count ${String(pages.length)} /MediaBox [0 0 612 792] >>`
  );
  pages.forEach((items, index) => {
    const pageId = pageIds[index]!;
    const contentId = pageId + 1;
    const body = pageStream(items);
    objects.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${String(fontId)} 0 R /F2 ${String(fontId + 1)} 0 R /F3 ${String(fontId + 2)} 0 R >> >> /Contents ${String(contentId)} 0 R >>`
    );
    objects.set(contentId, `<< /Length ${String(Buffer.byteLength(body, 'latin1'))} >>\nstream\n${body}endstream`);
  });
  objects.set(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.set(fontId + 1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.set(fontId + 2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets = [0];
  let length = chunks[0]!.length;
  for (let id = 1; id <= lastObjectId; id += 1) {
    offsets[id] = length;
    const chunk = Buffer.from(`${String(id)} 0 obj\n${objects.get(id)}\nendobj\n`, 'latin1');
    chunks.push(chunk);
    length += chunk.length;
  }
  const xref = length;
  chunks.push(
    Buffer.from(
      [
        `xref\n0 ${String(lastObjectId + 1)}\n`,
        '0000000000 65535 f \n',
        ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
        `trailer\n<< /Size ${String(lastObjectId + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`,
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
    pageCount: pages.length,
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
  throw new Error('caption-link fixture is stale or missing; run with --write');
}
if (!existsSync(manifestPath) || !readFileSync(manifestPath).equals(manifestBytes)) {
  throw new Error('caption-link fixture manifest is stale or missing; run with --write');
}
console.log('v3.0.14 caption-link fixture: OK (11 pages)');
