#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const pdfPath = join(fixtureDir, 'v3014-visual-candidate-v1.pdf');
const manifestPath = join(scriptDir, 'fixtures/v3014-visual-candidate-fixtures.json');
const write = process.argv.includes('--write');
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

type Line = { text: string; x: number; y: number; size?: number; matrix?: string };
const escaped = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
const pageStream = (lines: Line[]): string => [
  ...lines.flatMap(({ text, x, y, size = 12, matrix }) => [
    'BT',
    `/F1 ${String(size)} Tf`,
    matrix ?? `1 0 0 1 ${String(x)} ${String(y)} Tm`,
    `(${escaped(text)}) Tj`,
    'ET',
  ]),
  '',
].join('\n');

const table = (top: number, prefix: string): Line[] => [
  { text: `${prefix} A`, x: 72, y: top }, { text: `${prefix} B`, x: 240, y: top - 1 },
  { text: `${prefix} 1`, x: 72, y: top - 24 }, { text: `${prefix} 2`, x: 240, y: top - 25 },
];

function buildPdf(): Buffer {
  const streams = [
    pageStream(table(690, 'Direct')),
    pageStream([
      { text: 'Figure 2: Evidence target above', x: 180, y: 430 },
      { text: 'PLOTTED VISUAL EVIDENCE', x: 170, y: 500 },
    ]),
    pageStream([
      { text: 'Chart 3: Evidence target on the left', x: 330, y: 420 },
      { text: 'LEFT VISUAL EVIDENCE', x: 160, y: 421 },
    ]),
    pageStream([{ text: 'Formula 4: fallback clamp', x: 8, y: 768 }]),
    pageStream([
      { text: 'Table 5: nearby selectable table', x: 72, y: 660 },
      ...table(620, 'Near'),
    ]),
    pageStream([{ text: 'Ordinary paragraph without a visual prefix.', x: 72, y: 700 }]),
    pageStream([
      { text: 'Flat A', x: 72, y: 680, size: 0 }, { text: 'Flat B', x: 240, y: 679, size: 0 },
      { text: 'Flat 1', x: 72, y: 656, size: 0 }, { text: 'Flat 2', x: 240, y: 655, size: 0 },
    ]),
  ];
  const objects = new Map<number, string>();
  const pageIds: number[] = [];
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const fontId = 3 + streams.length * 2;
  streams.forEach((stream, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${String(fontId)} 0 R >> >> /Contents ${String(contentId)} 0 R >>`);
    objects.set(contentId, `<< /Length ${String(Buffer.byteLength(stream, 'latin1'))} >>\nstream\n${stream}endstream`);
  });
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${String(id)} 0 R`).join(' ')}] /Count ${String(pageIds.length)} /MediaBox [0 0 612 792] >>`);
  objects.set(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets = [0];
  let length = chunks[0]!.length;
  for (let id = 1; id <= fontId; id += 1) {
    offsets[id] = length;
    const chunk = Buffer.from(`${String(id)} 0 obj\n${objects.get(id)}\nendobj\n`, 'latin1');
    chunks.push(chunk);
    length += chunk.length;
  }
  const xrefOffset = length;
  chunks.push(Buffer.from([
    `xref\n0 ${String(fontId + 1)}\n`, '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${String(fontId + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`,
  ].join(''), 'ascii'));
  return Buffer.concat(chunks);
}

const bytes = buildPdf();
const manifest = {
  schemaVersion: 1,
  generator: relative(repoRoot, fileURLToPath(import.meta.url)),
  fixtures: [{ path: relative(repoRoot, pdfPath), bytes: bytes.length, sha256: sha256(bytes), pageCount: 7 }],
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
if (write) {
  mkdirSync(fixtureDir, { recursive: true });
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(pdfPath, bytes);
  writeFileSync(manifestPath, manifestBytes);
  console.error(`wrote ${relative(repoRoot, pdfPath)} (7 pages)`);
  process.exit(0);
}
if (!existsSync(pdfPath) || !readFileSync(pdfPath).equals(bytes)) throw new Error('visual-candidate fixture is stale or missing; run with --write');
if (!existsSync(manifestPath) || !readFileSync(manifestPath).equals(manifestBytes)) throw new Error('visual-candidate fixture manifest is stale or missing; run with --write');
console.log('v3.0.14 visual-candidate fixtures: OK (1 PDF, 7 pages)');
