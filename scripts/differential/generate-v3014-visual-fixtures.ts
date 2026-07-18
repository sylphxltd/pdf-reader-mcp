#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixturePath = join(repoRoot, 'test/fixtures/differential/v3014-visual-v1.pdf');
const manifestPath = join(scriptDir, 'fixtures/v3014-visual-fixtures.json');
const write = process.argv.includes('--write');

const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

function buildPdf(): Buffer {
  const streams = [
    [
      '1 0 0 rg 0 0 60 40 re f',
      '0 1 0 rg 60 0 60 40 re f',
      '0 0 1 rg 0 40 60 40 re f',
      '1 1 0 rg 60 40 60 40 re f',
    ].join('\n'),
    '0 0.8 0.8 rg 0 0 80 120 re f',
    ['1 0 1 rg 0 0 60 80 re f', '0 0 0 rg 60 0 60 80 re f'].join('\n'),
  ].map((stream) => `${stream}\n`);

  const objects = new Map<number, string>([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>'],
    [
      3,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 80] /Resources << >> /Contents 4 0 R >>',
    ],
    [4, `<< /Length ${Buffer.byteLength(streams[0]!, 'ascii')} >>\nstream\n${streams[0]}endstream`],
    [
      5,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 80 120] /Resources << >> /Contents 6 0 R >>',
    ],
    [6, `<< /Length ${Buffer.byteLength(streams[1]!, 'ascii')} >>\nstream\n${streams[1]}endstream`],
    [
      7,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 80] /Rotate 90 /Resources << >> /Contents 8 0 R >>',
    ],
    [8, `<< /Length ${Buffer.byteLength(streams[2]!, 'ascii')} >>\nstream\n${streams[2]}endstream`],
    [
      9,
      '<< /Title (Visual Parity Corpus V1) /Creator (fixture-generator-v1) /Producer (fixture-generator-v1) >>',
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
  chunks.push(
    Buffer.from(
      [
        `xref\n0 ${objects.size + 1}\n`,
        '0000000000 65535 f \n',
        ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
        `trailer\n<< /Size ${objects.size + 1} /Root 1 0 R /Info 9 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
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
  fixtures: [
    {
      path: relative(repoRoot, fixturePath),
      bytes: bytes.length,
      sha256: sha256(bytes),
    },
  ],
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

if (write) {
  mkdirSync(dirname(fixturePath), { recursive: true });
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(fixturePath, bytes);
  writeFileSync(manifestPath, manifestBytes);
  console.error(`wrote ${relative(repoRoot, fixturePath)} and manifest`);
  process.exit(0);
}

const stale =
  !existsSync(fixturePath) ||
  !readFileSync(fixturePath).equals(bytes) ||
  !existsSync(manifestPath) ||
  !readFileSync(manifestPath).equals(manifestBytes);
if (stale) throw new Error('visual fixture is stale or missing; run with --write');
console.log(`v3.0.14 visual fixture: OK (${bytes.length} bytes)`);
