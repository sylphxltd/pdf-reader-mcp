#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "../..");
const fixtureDir = join(repoRoot, "test/fixtures/differential");
const pdfPath = join(fixtureDir, "v3014-selectable-table-v1.pdf");
const hostilePdfPath = join(
  fixtureDir,
  "v3014-selectable-table-hostile-4097-v1.pdf"
);
const admittedPdfPath = join(
  fixtureDir,
  "v3014-selectable-table-admitted-4096-v1.pdf"
);
const manifestPath = join(
  scriptDir,
  "fixtures/v3014-selectable-table-fixture.json"
);
const write = process.argv.includes("--write");
const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

type Cell = { text: string; x: number; y: number; size?: number };
const stream = (cells: Cell[]): string =>
  [
    ...cells.flatMap(({ text, x, y, size = 11 }) => [
      "BT",
      `/F${x === 250 ? 2 : x === 420 ? 3 : 1} ${size} Tf`,
      `1 0 0 1 ${x} ${y} Tm`,
      `(${text
        .replaceAll("\\", "\\\\")
        .replaceAll("(", "\\(")
        .replaceAll(")", "\\)")}) Tj`,
      "ET",
    ]),
    "",
  ].join("\n");

function buildPdf(): Buffer {
  const pages: Cell[][] = [
    [
      { text: "Metric", x: 72, y: 140 },
      { text: "Value", x: 250, y: 139 },
      { text: "Region", x: 420, y: 138 },
      { text: "Revenue", x: 72, y: 110 },
      { text: "120", x: 250, y: 109 },
      { text: "North", x: 420, y: 108 },
      { text: "Cost", x: 72, y: 80 },
      { text: "80", x: 250, y: 79 },
    ],
    [
      { text: "Metric", x: 72, y: 720 },
      { text: "Value", x: 250, y: 719 },
      { text: "Region", x: 420, y: 718 },
      { text: "Profit", x: 72, y: 690 },
      { text: "40", x: 250, y: 689 },
      { text: "North", x: 420, y: 688 },
      { text: "Margin", x: 72, y: 660 },
      { text: "33", x: 250, y: 659 },
      { text: "Percent & \"rate's\"", x: 420, y: 658 },
    ],
    [{ text: "Narrative evidence without a grid.", x: 72, y: 720 }],
  ];
  const objects = new Map<number, string>();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    2,
    "<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 /MediaBox [0 0 612 792] >>"
  );
  pages.forEach((cells, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const body = stream(cells);
    objects.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 9 0 R /F2 10 0 R /F3 11 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    objects.set(
      contentId,
      `<< /Length ${Buffer.byteLength(
        body,
        "latin1"
      )} >>\nstream\n${body}endstream`
    );
  });
  objects.set(
    9,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );
  objects.set(
    10,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );
  objects.set(
    11,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );
  const chunks: Buffer[] = [
    Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1"),
  ];
  const offsets = [0];
  let length = chunks[0]!.length;
  for (let id = 1; id <= 11; id += 1) {
    offsets[id] = length;
    const chunk = Buffer.from(
      `${id} 0 obj\n${objects.get(id)}\nendobj\n`,
      "latin1"
    );
    chunks.push(chunk);
    length += chunk.length;
  }
  const xref = length;
  chunks.push(
    Buffer.from(
      [
        "xref\n0 12\n",
        "0000000000 65535 f \n",
        ...offsets
          .slice(1)
          .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
        `trailer\n<< /Size 12 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
      ].join(""),
      "ascii"
    )
  );
  return Buffer.concat(chunks);
}

function buildGridPdf(itemCount: number): Buffer {
  const cells = Array.from({ length: itemCount }, (_, index) => ({
    text: `g${index}`,
    x: index % 2 === 0 ? 72 : 320,
    y: 780 - index * 0.15,
    size: 8,
  }));
  const body = stream(cells);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 612 792] >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(
      body,
      "latin1"
    )} >>\nstream\n${body}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  const chunks: Buffer[] = [
    Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1"),
  ];
  const offsets = [0];
  let length = chunks[0]!.length;
  objects.forEach((object, index) => {
    offsets[index + 1] = length;
    const chunk = Buffer.from(
      `${index + 1} 0 obj\n${object}\nendobj\n`,
      "latin1"
    );
    chunks.push(chunk);
    length += chunk.length;
  });
  const xref = length;
  chunks.push(
    Buffer.from(
      [
        "xref\n0 6\n",
        "0000000000 65535 f \n",
        ...offsets
          .slice(1)
          .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
        `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
      ].join(""),
      "ascii"
    )
  );
  return Buffer.concat(chunks);
}

const bytes = buildPdf();
const admittedBytes = buildGridPdf(4096);
const hostileBytes = buildGridPdf(4097);
const manifest = {
  schemaVersion: 1,
  generator: relative(repoRoot, fileURLToPath(import.meta.url)),
  fixture: {
    path: relative(repoRoot, pdfPath),
    bytes: bytes.length,
    sha256: sha256(bytes),
  },
  admittedFixture: {
    path: relative(repoRoot, admittedPdfPath),
    bytes: admittedBytes.length,
    sha256: sha256(admittedBytes),
    itemCount: 4096,
  },
  hostileFixture: {
    path: relative(repoRoot, hostilePdfPath),
    bytes: hostileBytes.length,
    sha256: sha256(hostileBytes),
    itemCount: 4097,
  },
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
if (write) {
  mkdirSync(fixtureDir, { recursive: true });
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(pdfPath, bytes);
  writeFileSync(admittedPdfPath, admittedBytes);
  writeFileSync(hostilePdfPath, hostileBytes);
  writeFileSync(manifestPath, manifestBytes);
  console.error(`wrote ${relative(repoRoot, pdfPath)}`);
  process.exit(0);
}
if (!existsSync(pdfPath) || !readFileSync(pdfPath).equals(bytes))
  throw new Error(
    "selectable-table fixture is stale or missing; run with --write"
  );
if (
  !existsSync(admittedPdfPath) ||
  !readFileSync(admittedPdfPath).equals(admittedBytes)
)
  throw new Error(
    "selectable-table admitted fixture is stale or missing; run with --write"
  );
if (
  !existsSync(hostilePdfPath) ||
  !readFileSync(hostilePdfPath).equals(hostileBytes)
)
  throw new Error(
    "selectable-table hostile fixture is stale or missing; run with --write"
  );
if (
  !existsSync(manifestPath) ||
  !readFileSync(manifestPath).equals(manifestBytes)
)
  throw new Error(
    "selectable-table manifest is stale or missing; run with --write"
  );
console.log("v3.0.14 selectable-table fixture: OK (1)");
