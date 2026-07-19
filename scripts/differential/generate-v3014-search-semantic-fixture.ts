#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const pdfPath = join(fixtureDir, 'v3014-search-semantic-v1.pdf');
const manifestPath = join(scriptDir, 'fixtures/v3014-search-semantic-fixture.json');
const write = process.argv.includes('--write');
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const glyphs = new Map<string, number>();
const cid = (character: string): number => {
  const current = glyphs.get(character);
  if (current !== undefined) return current;
  const next = glyphs.size + 1;
  glyphs.set(character, next);
  return next;
};
const encoded = (text: string): string =>
  [...text].map((character) => cid(character).toString(16).padStart(4, '0')).join('');
const unicodeHex = (character: string): string => {
  const code = character.codePointAt(0)!;
  if (code <= 0xffff) return code.toString(16).padStart(4, '0');
  const adjusted = code - 0x10000;
  return `${(0xd800 + (adjusted >> 10)).toString(16)}${(0xdc00 + (adjusted & 0x3ff)).toString(16)}`;
};

function buildPdf(): Buffer {
  const pageLines = [
    ['START résumé END', 'Café résumé'],
    ['AA😀résuméZZ', 'Café résumé'],
    ['TAIL résumé FINISH'],
  ];
  const streams = pageLines.map((lines) =>
    `BT\n/F1 12 Tf\n72 720 Td\n${lines.map((line, index) => `${index === 0 ? '' : '0 -18 Td\n'}<${encoded(line)}> Tj`).join('\n')}\nET\n`
  );
  const mappings = [...glyphs.entries()]
    .map(([character, value]) => `<${value.toString(16).padStart(4, '0')}> <${unicodeHex(character)}>`)
    .join('\n');
  const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /SearchSemantic def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${glyphs.size} beginbfchar\n${mappings}\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
  const objects = new Map<number, string>([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 /MediaBox [0 0 612 792] >>'],
    [3, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 9 0 R >> >> /Contents 4 0 R >>'],
    [4, `<< /Length ${Buffer.byteLength(streams[0]!, 'ascii')} >>\nstream\n${streams[0]}endstream`],
    [5, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 9 0 R >> >> /Contents 6 0 R >>'],
    [6, `<< /Length ${Buffer.byteLength(streams[1]!, 'ascii')} >>\nstream\n${streams[1]}endstream`],
    [7, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 9 0 R >> >> /Contents 8 0 R >>'],
    [8, `<< /Length ${Buffer.byteLength(streams[2]!, 'ascii')} >>\nstream\n${streams[2]}endstream`],
    [9, '<< /Type /Font /Subtype /Type0 /BaseFont /SearchSemantic /Encoding /Identity-H /DescendantFonts [10 0 R] /ToUnicode 12 0 R >>'],
    [10, '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /SearchSemantic /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 11 0 R /DW 600 >>'],
    [11, '<< /Type /FontDescriptor /FontName /SearchSemantic /Flags 32 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>'],
    [12, `<< /Length ${Buffer.byteLength(cmap, 'ascii')} >>\nstream\n${cmap}\nendstream`],
  ]);
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets = [0];
  let length = chunks[0]!.length;
  for (let id = 1; id <= objects.size; id += 1) {
    offsets[id] = length;
    const chunk = Buffer.from(`${id} 0 obj\n${objects.get(id)}\nendobj\n`, 'ascii');
    chunks.push(chunk);
    length += chunk.length;
  }
  const xrefOffset = length;
  chunks.push(Buffer.from([
    `xref\n0 ${objects.size + 1}\n`, '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.size + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join(''), 'ascii'));
  return Buffer.concat(chunks);
}

const bytes = buildPdf();
const manifest = {
  schemaVersion: 1,
  generator: relative(repoRoot, fileURLToPath(import.meta.url)),
  fixture: { path: relative(repoRoot, pdfPath), bytes: bytes.length, sha256: sha256(bytes), pageCount: 3 },
  reusedFixture: {
    path: 'test/fixtures/differential/v3014-behavior-v1.pdf',
    sha256: sha256(readFileSync(join(fixtureDir, 'v3014-behavior-v1.pdf'))),
  },
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
const stale = !existsSync(pdfPath) || !readFileSync(pdfPath).equals(bytes) ||
  !existsSync(manifestPath) || !readFileSync(manifestPath).equals(manifestBytes);
if (stale) throw new Error('search-semantic fixture is stale or missing; run with --write');
console.log('v3.0.14 search-semantic fixture: OK (3 pages)');
