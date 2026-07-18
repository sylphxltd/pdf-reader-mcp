#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "../..");
const fixturePath = join(
  repoRoot,
  "test/fixtures/differential/v3014-structure-v1.pdf"
);
const manifestPath = join(scriptDir, "fixtures/v3014-structure-fixtures.json");
const write = process.argv.includes("--write");
const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

function pdf(): Buffer {
  const stream =
    "/P <</MCID 0>> BDC\nBT\n/F1 12 Tf\n72 720 Td\n(Tagged heading) Tj\nET\nEMC\n";
  const objects = new Map<number, string>([
    [
      1,
      "<< /Type /Catalog /Pages 2 0 R /StructTreeRoot 10 0 R /MarkInfo << /Marked true /Suspects false >> >>",
    ],
    [
      2,
      "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 /MediaBox [0 0 612 792] >>",
    ],
    [
      3,
      "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 8 0 R >> >> /Contents 4 0 R /StructParents 0 /Annots [7 0 R] >>",
    ],
    [
      4,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    ],
    [5, "<< /Type /Page /Parent 2 0 R /Resources << >> /Contents 6 0 R >>"],
    [6, "<< /Length 0 >>\nstream\n\nendstream"],
    [
      7,
      "<< /Type /Annot /Subtype /Link /Rect [72 680 200 700] /StructParent 1 /A << /S /URI /URI (https://example.com/tagged) >> >>",
    ],
    [8, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"],
    [
      9,
      "<< /Title (Tagged Structure Oracle) /Creator (structure-fixture-v1) >>",
    ],
    [
      10,
      "<< /Type /StructTreeRoot /K [11 0 R 12 0 R] /ParentTree 13 0 R /RoleMap << /CustomHeading /H1 >> >>",
    ],
    [
      11,
      "<< /Type /StructElem /S /CustomHeading /P 10 0 R /Pg 3 0 R /K 0 /Alt (must not leak) /Lang (en-GB) >>",
    ],
    [
      12,
      "<< /Type /StructElem /S /Figure /P 10 0 R /Pg 3 0 R /K 14 0 R /Alt (figure secret) >>",
    ],
    [13, "<< /Nums [0 [11 0 R 12 0 R] 1 12 0 R] >>"],
    [14, "<< /Type /OBJR /Pg 3 0 R /Obj 7 0 R >>"],
  ]);
  const chunks: Buffer[] = [
    Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "latin1"),
  ];
  const offsets = [0];
  let length = chunks[0]!.length;
  for (let id = 1; id <= objects.size; id++) {
    offsets[id] = length;
    const chunk = Buffer.from(
      `${id} 0 obj\n${objects.get(id)}\nendobj\n`,
      "latin1"
    );
    chunks.push(chunk);
    length += chunk.length;
  }
  const xrefOffset = length;
  chunks.push(
    Buffer.from(
      [
        `xref\n0 ${objects.size + 1}\n`,
        "0000000000 65535 f \n",
        ...offsets
          .slice(1)
          .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
        `trailer\n<< /Size ${
          objects.size + 1
        } /Root 1 0 R /Info 9 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
      ].join(""),
      "ascii"
    )
  );
  return Buffer.concat(chunks);
}

const bytes = pdf();
const manifest = {
  schemaVersion: 1,
  generator: relative(repoRoot, fileURLToPath(import.meta.url)),
  generatorSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
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
  process.exit(0);
}
if (
  !existsSync(fixturePath) ||
  !readFileSync(fixturePath).equals(bytes) ||
  !existsSync(manifestPath) ||
  !readFileSync(manifestPath).equals(manifestBytes)
) {
  throw new Error("structure fixtures are stale; run with --write");
}
console.log("v3.0.14 structure fixtures: OK (1)");
