#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const pdfPath = join(repoRoot, 'test/fixtures/differential/v3014-lowercase-index-v1.pdf');
const manifestPath = join(scriptDir, 'fixtures/v3014-lowercase-index-fixture.json');
const write = process.argv.includes('--write');
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const glyphs = new Map<string, number>();
const cid = (character: string): number => {
  const found = glyphs.get(character);
  if (found !== undefined) return found;
  const next = glyphs.size + 1;
  glyphs.set(character, next);
  return next;
};
const encoded = (text: string): string => [...text].map((character) => cid(character).toString(16).padStart(4, '0')).join('');
const unicodeHex = (character: string): string => character.codePointAt(0)!.toString(16).padStart(4, '0');

const text = 'AAİXZZ ASCII word ASCIIish';
const stream = `BT\n/F1 12 Tf\n72 720 Td\n<${encoded(text)}> Tj\nET\n`;
const mappings = [...glyphs.entries()].map(([character, value]) => `<${value.toString(16).padStart(4, '0')}> <${unicodeHex(character)}>`).join('\n');
const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /LowercaseIndex def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${glyphs.size} beginbfchar\n${mappings}\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
const objects = new Map<number, string>([
  [1, '<< /Type /Catalog /Pages 2 0 R >>'],
  [2, '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 /MediaBox [0 0 612 792] >>'],
  [3, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>'],
  [4, `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`],
  [5, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>'],
  [6, '<< /Length 0 >>\nstream\n\nendstream'],
  [7, '<< /Type /Font /Subtype /Type0 /BaseFont /LowercaseIndex /Encoding /Identity-H /DescendantFonts [8 0 R] /ToUnicode 10 0 R >>'],
  [8, '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /LowercaseIndex /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 9 0 R /DW 600 >>'],
  [9, '<< /Type /FontDescriptor /FontName /LowercaseIndex /Flags 32 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>'],
  [10, `<< /Length ${Buffer.byteLength(cmap, 'ascii')} >>\nstream\n${cmap}\nendstream`],
]);
const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
const offsets = [0];
let length = chunks[0]!.length;
for (let id = 1; id <= objects.size; id += 1) {
  offsets[id] = length;
  const chunk = Buffer.from(`${id} 0 obj\n${objects.get(id)}\nendobj\n`, 'ascii');
  chunks.push(chunk); length += chunk.length;
}
const xrefOffset = length;
chunks.push(Buffer.from([`xref\n0 ${objects.size + 1}\n`, '0000000000 65535 f \n', ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`), `trailer\n<< /Size ${objects.size + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`].join(''), 'ascii'));
const bytes = Buffer.concat(chunks);
const manifest = { schemaVersion: 1, generator: relative(repoRoot, fileURLToPath(import.meta.url)), fixture: { path: relative(repoRoot, pdfPath), bytes: bytes.length, sha256: sha256(bytes), pageCount: 2 } };
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
if (write) {
  mkdirSync(dirname(pdfPath), { recursive: true }); mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(pdfPath, bytes); writeFileSync(manifestPath, manifestBytes);
  console.error(`wrote ${relative(repoRoot, pdfPath)} and manifest`); process.exit(0);
}
if (!existsSync(pdfPath) || !readFileSync(pdfPath).equals(bytes) || !existsSync(manifestPath) || !readFileSync(manifestPath).equals(manifestBytes)) throw new Error('lowercase-index fixture is stale or missing; run with --write');
console.log('v3.0.14 lowercase-index fixture: OK (2 pages)');
