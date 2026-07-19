#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const pdfPath = join(fixtureDir, 'v3014-selectable-text-segmentation-v1.pdf');
const manifestPath = join(scriptDir, 'fixtures/v3014-selectable-text-segmentation-fixture.json');
const write = process.argv.includes('--write');
const sha256 = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');

const glyphs = new Map<string, number>();
const cid = (character: string): number => {
  const existing = glyphs.get(character);
  if (existing !== undefined) return existing;
  const next = glyphs.size + 1;
  glyphs.set(character, next);
  return next;
};
const encoded = (text: string): string =>
  [...text].map((character) => cid(character).toString(16).padStart(4, '0')).join('');
const show = (text: string, x: number, y: number, font = 'F3', size = 1): string =>
  `/Span << /MCID 0 >> BDC\nBT\n/${font} ${String(size)} Tf\n1 0 0 1 ${String(x)} ${String(y)} Tm\n<${encoded(text)}> Tj\nET\nEMC`;
const showGap = (text: string, x: number, y: number, font: 'F1' | 'F2'): string =>
  `/Span << /MCID 0 >> BDC\nBT\n/${font} 1000 Tf\n1 0 0 0.001 ${String(x)} ${String(y)} Tm\n<${encoded(text)}> Tj\nET\nEMC`;

function buildPdf(): Buffer {
  const streams = [
    [show('C', 74, 720), show('A', 72, 720), show('B', 73, 720)].join('\n'),
    [showGap('GAP', 72, 700, 'F1'), showGap('JOIN', 123, 700, 'F2')].join('\n'),
    [showGap('GAP', 72, 700, 'F1'), showGap('JOIN', 123.001, 700, 'F2')].join('\n'),
    [show('Y', 72, 700), show('JOIN', 73, 699.5)].join('\n'),
    [show('Y', 72, 700), show('JOIN', 73, 699.499)].join('\n'),
  ].map((stream) => `${stream}\n`);
  const mappings = [...glyphs.entries()]
    .map(([character, value]) => `<${value.toString(16).padStart(4, '0')}> <${character.codePointAt(0)!.toString(16).padStart(4, '0')}>`)
    .join('\n');
  const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /SelectableSegmentation def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${glyphs.size} beginbfchar\n${mappings}\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
  const objects = new Map<number, string>();
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, '<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R 9 0 R 11 0 R] /Count 5 /MediaBox [0 0 612 792] >>');
  for (let index = 0; index < streams.length; index += 1) {
    const pageId = 3 + index * 2;
    const streamId = pageId + 1;
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 13 0 R /F2 17 0 R /F3 20 0 R >> >> /Contents ${String(streamId)} 0 R >>`);
    objects.set(streamId, `<< /Length ${Buffer.byteLength(streams[index]!, 'ascii')} >>\nstream\n${streams[index]}endstream`);
  }
  objects.set(13, '<< /Type /Font /Subtype /Type0 /BaseFont /SelectableSegmentation /Encoding /Identity-H /DescendantFonts [14 0 R] /ToUnicode 16 0 R >>');
  objects.set(14, '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /SelectableSegmentation /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 15 0 R /DW 1 >>');
  objects.set(15, '<< /Type /FontDescriptor /FontName /SelectableSegmentation /Flags 32 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>');
  objects.set(16, `<< /Length ${Buffer.byteLength(cmap, 'ascii')} >>\nstream\n${cmap}\nendstream`);
  objects.set(17, '<< /Type /Font /Subtype /Type0 /BaseFont /SelectableSegmentationTwo /Encoding /Identity-H /DescendantFonts [18 0 R] /ToUnicode 16 0 R >>');
  objects.set(18, '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /SelectableSegmentationTwo /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 19 0 R /DW 1 >>');
  objects.set(19, '<< /Type /FontDescriptor /FontName /SelectableSegmentationTwo /Flags 32 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>');
  objects.set(20, '<< /Type /Font /Subtype /Type0 /BaseFont /SelectableSegmentationStandard /Encoding /Identity-H /DescendantFonts [21 0 R] /ToUnicode 16 0 R >>');
  objects.set(21, '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /SelectableSegmentationStandard /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 22 0 R /DW 1000 >>');
  objects.set(22, '<< /Type /FontDescriptor /FontName /SelectableSegmentationStandard /Flags 32 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>');
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets = [0];
  let length = chunks[0]!.length;
  for (let id = 1; id <= 22; id += 1) {
    offsets[id] = length;
    const chunk = Buffer.from(`${String(id)} 0 obj\n${objects.get(id)}\nendobj\n`, 'ascii');
    chunks.push(chunk);
    length += chunk.length;
  }
  const xrefOffset = length;
  chunks.push(Buffer.from([
    'xref\n0 23\n', '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size 23 /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`,
  ].join(''), 'ascii'));
  return Buffer.concat(chunks);
}

const bytes = buildPdf();
const manifest = {
  schemaVersion: 1,
  generator: relative(repoRoot, fileURLToPath(import.meta.url)),
  fixture: { path: relative(repoRoot, pdfPath), bytes: bytes.length, sha256: sha256(bytes), pageCount: 5 },
  primitiveContract: { standardFontSize: 1, standardGlyphWidth: 1000, gapFontSize: 1000, gapGlyphWidth: 1, gapVerticalScale: 0.001, gapAccepted: 48, gapRejected: 48.001, roundedYAccepted: 699.5, roundedYRejected: 699.499 },
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
if (write) {
  mkdirSync(fixtureDir, { recursive: true });
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(pdfPath, bytes);
  writeFileSync(manifestPath, manifestBytes);
  console.error(`wrote ${relative(repoRoot, pdfPath)} and manifest`);
  process.exit(0);
}
if (!existsSync(pdfPath) || !readFileSync(pdfPath).equals(bytes) || !existsSync(manifestPath) || !readFileSync(manifestPath).equals(manifestBytes)) {
  throw new Error('selectable-text-segmentation fixture is stale or missing; run with --write');
}
console.log('v3.0.14 selectable-text-segmentation fixture: OK (5 pages)');
