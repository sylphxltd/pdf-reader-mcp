#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalSelectableTableResult,
  SELECTABLE_TABLE_DEPENDENCY_SURFACES,
  SELECTABLE_TABLE_MUTATION_MANIFEST,
  type Json,
} from "./v3014-selectable-table-projection.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "../..");
const fixtureDir = join(repoRoot, "test/fixtures/differential");
const corpusPath = join(
  scriptDir,
  "fixtures/v3014-selectable-table-corpus.json"
);
const oraclePath = join(
  scriptDir,
  "fixtures/v3014-selectable-table-oracle.json"
);
const manifestPath = join(
  scriptDir,
  "fixtures/v3014-selectable-table-fixture.json"
);
const runnerPath = join(scriptDir, "v3014-selectable-table-baseline-runner.ts");
const projectionPath = join(scriptDir, "v3014-selectable-table-projection.ts");
const generatorPath = join(
  scriptDir,
  "generate-v3014-selectable-table-fixture.ts"
);
const cli = join(repoRoot, "target/release/pdf-reader-cli");
const outputFlag = process.argv.indexOf("--output");
const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : undefined;
type Case = { id: string; input: Record<string, unknown> };
type Oracle = {
  baseline: Record<string, unknown>;
  expectations: Record<string, Json>;
};
const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as {
  cases: Case[];
};
const oracle = JSON.parse(readFileSync(oraclePath, "utf8")) as Oracle;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  fixture: { path: string; bytes: number; sha256: string };
  admittedFixture: {
    path: string;
    bytes: number;
    sha256: string;
    itemCount: number;
  };
  hostileFixture: {
    path: string;
    bytes: number;
    sha256: string;
    itemCount: number;
  };
};
const sha = (x: Uint8Array | string): string =>
  createHash("sha256").update(x).digest("hex");
const git = (...args: string[]): Buffer => {
  const r = spawnSync("git", args, { cwd: repoRoot });
  if (r.status !== 0) throw new Error(r.stderr.toString());
  return r.stdout;
};
const canon = (v: Json): Json =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === "object"
    ? Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, canon(x)])
      )
    : v;
const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(canon(a as Json)) === JSON.stringify(canon(b as Json));
const expectedIds = [
  "tables-only-public-surface",
  "tables-hidden-downstream-dependencies",
  "tables-exposed-downstream-linkage",
  "tables-cross-page-continuation",
  "tables-selected-pages-dedupe-sort",
  "tables-no-grid-omission",
];
function authority(): Record<string, string> {
  const b = oracle.baseline;
  const commit = git("rev-list", "-n", "1", String(b.tag)).toString().trim();
  if (commit !== b.commit) throw new Error("baseline tag moved");
  const tree = git("rev-parse", `${commit}^{tree}`).toString().trim();
  if (tree !== b.tree) throw new Error("baseline tree mismatch");
  if (sha(git("show", `${commit}:bun.lock`)) !== b.bunLockSha256)
    throw new Error("baseline lock mismatch");
  for (const [p, e, n] of [
    [runnerPath, b.runnerSha256, "runner"],
    [projectionPath, b.projectionSha256, "projection"],
    [generatorPath, b.generatorSha256, "generator"],
    [corpusPath, b.corpusSha256, "corpus"],
    [manifestPath, b.fixtureManifestSha256, "manifest"],
  ] as const)
    if (sha(readFileSync(p)) !== e)
      throw new Error(`selectable-table ${n} mismatch`);
  for (const [p, e] of Object.entries(
    b.entrypointSha256 as Record<string, string>
  ))
    if (sha(git("show", `${commit}:${p}`)) !== e)
      throw new Error(`baseline source mismatch: ${p}`);
  for (const [f, e] of [
    [manifest.fixture, b.fixtureSha256],
    [manifest.admittedFixture, b.admittedFixtureSha256],
    [manifest.hostileFixture, b.hostileFixtureSha256],
  ] as const) {
    const bytes = readFileSync(join(repoRoot, f.path));
    if (bytes.length !== f.bytes || sha(bytes) !== f.sha256 || f.sha256 !== e)
      throw new Error(`fixture mismatch: ${f.path}`);
  }
  if (manifest.admittedFixture.itemCount !== 4096)
    throw new Error("admitted fixture must be exact cap");
  if (manifest.hostileFixture.itemCount !== 4097)
    throw new Error("hostile fixture must be exact cap+1");
  if (
    !same(
      corpus.cases.map((x) => x.id),
      expectedIds
    ) ||
    !same(Object.keys(oracle.expectations).sort(), [...expectedIds].sort())
  )
    throw new Error("exact six-case corpus required");
  return {
    baselineCommit: commit,
    baselineTree: tree,
    oracleSha256: sha(readFileSync(oraclePath)),
    corpusSha256: sha(readFileSync(corpusPath)),
    runnerSha256: sha(readFileSync(runnerPath)),
    projectionSha256: sha(readFileSync(projectionPath)),
    generatorSha256: sha(readFileSync(generatorPath)),
    fixtureManifestSha256: sha(readFileSync(manifestPath)),
    fixtureSha256: manifest.fixture.sha256,
    hostileFixtureSha256: manifest.hostileFixture.sha256,
  };
}
const materialize = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(materialize)
    : value && typeof value === "object"
    ? Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k === "fixture" ? "path" : k,
          k === "fixture" && typeof v === "string"
            ? join(fixtureDir, v)
            : materialize(v),
        ])
      )
    : value;
const runCase = (
  input: Record<string, unknown>,
  label: string
): Record<string, unknown> => {
  const r = spawnSync(cli, [], {
    cwd: repoRoot,
    encoding: "utf8",
    input: JSON.stringify({ tool: "read_pdf", input: materialize(input) }),
    maxBuffer: 160 * 1024 * 1024,
    timeout: 120000,
  });
  if (r.status !== 0) throw new Error(r.stderr || `${label} exited nonzero`);
  const env = JSON.parse(r.stdout) as {
    result?: { content?: Array<{ text?: string }> };
  };
  const text = env.result?.content?.[0]?.text;
  if (!text) throw new Error(`${label} lacks structured text`);
  const payload = JSON.parse(text) as {
    results: Array<{ success: boolean; data: Record<string, unknown> }>;
  };
  if (!payload.results[0]?.success) throw new Error(`${label} failed`);
  return payload.results[0].data;
};
const auth = authority();
if (!existsSync(cli)) throw new Error("missing release Rust CLI");
let subprocessNonzeroRejected = false;
try {
  const p = spawnSync(process.execPath, ["-e", "process.exit(19)"]);
  if (p.status !== 0) throw new Error("rejected");
} catch {
  subprocessNonzeroRejected = true;
}
if (!subprocessNonzeroRejected)
  throw new Error("nonzero subprocess not rejected");
const raw: Record<string, Record<string, unknown>> = {};
const observations: Record<string, Json> = {};
const failures: Array<{ id: string; expected: Json; actual: Json }> = [];
for (const entry of corpus.cases) {
  const data = runCase(entry.input, entry.id);
  raw[entry.id] = data;
  const actual = canonicalSelectableTableResult(data);
  observations[entry.id] = actual;
  const expected = oracle.expectations[entry.id]!;
  if (!same(actual, expected))
    failures.push({ id: entry.id, expected, actual });
}
const leaves = (v: Json): number =>
  Array.isArray(v)
    ? v.reduce((n, x) => n + leaves(x), 0)
    : v && typeof v === "object"
    ? Object.values(v).reduce((n, x) => n + leaves(x), 0)
    : 1;
const leafMutationCount = Object.values(oracle.expectations).reduce(
  (n, x) => n + leaves(x),
  0
);
const only = raw["tables-only-public-surface"]!;
const hidden = raw["tables-hidden-downstream-dependencies"]!;
const exposed = raw["tables-exposed-downstream-linkage"]!;
const cross = raw["tables-cross-page-continuation"]!;
const noGrid = raw["tables-no-grid-omission"]!;
const getTables = (v: Record<string, unknown>) =>
  (v.tables ?? []) as Array<Record<string, unknown>>;
const getTableEls = (v: Record<string, unknown>) =>
  ((v.elements ?? []) as Array<Record<string, unknown>>).filter(
    (x) => x.type === "table"
  );
const getTableChunks = (v: Record<string, unknown>) =>
  ((v.chunks ?? []) as Array<Record<string, unknown>>).filter(
    (x) => x.strategy === "table"
  );
const table = getTables(only)[0]!;
const quality = table.quality as Record<string, unknown>;
const exposedTable = getTables(exposed)[0]!;
const exposedQuality = exposedTable.quality as Record<string, unknown>;
const semanticProof = {
  exactSparseGrid:
    getTables(only).length === 1 &&
    table.rowCount === 3 &&
    table.colCount === 3 &&
    table.cellCount === undefined &&
    (table.cells as unknown[]).length === 9,
  qualityWarnings:
    Array.isArray(quality.warnings) &&
    (quality.warnings as unknown[]).length === 2,
  exactPageContentMergedCells:
    exposedQuality.mergedCellCandidateCount === 5 &&
    ((exposedTable.cells as Array<Record<string, unknown>>) ?? []).filter(
      (cell) => cell.colSpan === 2
    ).length === 5 &&
    ((exposedQuality.signals as unknown[]) ?? []).includes(
      "merged_cell_candidates"
    ) &&
    ((exposedQuality.warnings as unknown[]) ?? []).length === 3,
  hiddenTopLevelDependencies:
    !Object.hasOwn(only, "elements") &&
    !Object.hasOwn(only, "chunks") &&
    !Object.hasOwn(only, "document_ast") &&
    !Object.hasOwn(only, "document_map") &&
    !Object.hasOwn(only, "trust_report"),
  downstreamTablesHidden:
    !Object.hasOwn(hidden, "tables") &&
    getTableEls(hidden).length === 0 &&
    getTableChunks(hidden).length === 0,
  exposedLinkage:
    getTables(exposed).length === 1 &&
    getTableEls(exposed).length === 1 &&
    getTableChunks(exposed).length === 1 &&
    JSON.stringify(exposed.document_ast).includes('"type":"table"') &&
    JSON.stringify(exposed.document_map).includes('"table_structure"') &&
    JSON.stringify(exposed.trust_report).includes('"table_quality"'),
  markdownHtml:
    typeof exposed.markdown === "string" &&
    exposed.markdown.includes("| Metric | Value | Region |") &&
    typeof exposed.html === "string" &&
    exposed.html.includes("<table"),
  selectedPages:
    getTables(raw["tables-selected-pages-dedupe-sort"]!)
      .map((x) => x.page)
      .join(",") === "1,2",
  noGridOmission:
    getTables(noGrid).length === 0 &&
    getTableEls(noGrid).length === 0 &&
    getTableChunks(noGrid).length === 0,
  htmlEscaping:
    typeof cross.html === "string" &&
    cross.html.includes("Percent &amp; &quot;rate&#39;s&quot;"),
};
const crossTables = getTables(cross);
const continuationProof = {
  twoTables: crossTables.length === 2,
  groupLinked:
    crossTables[0]?.continuation !== undefined &&
    crossTables[1]?.continuation !== undefined &&
    (crossTables[0]!.continuation as Record<string, unknown>).nextTableId ===
      "p2-table-1" &&
    (crossTables[1]!.continuation as Record<string, unknown>)
      .previousTableId === "p1-table-1",
  sameGroup:
    (crossTables[0]?.continuation as Record<string, unknown>)?.groupId ===
    (crossTables[1]?.continuation as Record<string, unknown>)?.groupId,
  downstreamIds:
    JSON.stringify(cross.document_ast).includes("p1-table-1") &&
    JSON.stringify(cross.document_ast).includes("p2-table-1") &&
    JSON.stringify(cross.document_map).includes("p2-table-1"),
};
const semanticProofPass = Object.values(semanticProof).every(Boolean);
const continuationProofPass = Object.values(continuationProof).every(Boolean);
const admitted = runCase(
  {
    sources: [
      { path: join(repoRoot, manifest.admittedFixture.path), pages: [1] },
    ],
    auto: false,
    include_tables: true,
  },
  "admitted exact cap"
);
const hostile = runCase(
  {
    sources: [
      { path: join(repoRoot, manifest.hostileFixture.path), pages: [1] },
    ],
    auto: false,
    include_tables: true,
  },
  "hostile cap+1"
);
const hostileWarnings = (hostile.warnings ?? []) as string[];
const admittedWarnings = (admitted.warnings ?? []) as string[];
const resourceBoundProof = {
  exactCapItemCount: manifest.admittedFixture.itemCount,
  itemCount: manifest.hostileFixture.itemCount,
  cap: 4096,
  exactCapAccepted:
    getTables(admitted).length > 0 &&
    !admittedWarnings.some((warning) => warning.includes("admission limit")),
  zeroTables: getTables(hostile).length === 0,
  exactWarning: hostileWarnings.includes(
    "Selectable table extraction skipped page 1: spatial grid exceeds the Rust admission limit."
  ),
};
if (Object.values(resourceBoundProof).some((x) => x === false))
  throw new Error(
    `hostile bound proof failed: ${JSON.stringify(resourceBoundProof)}`
  );
const reject = (
  mutate: (v: Record<string, unknown>) => void,
  label: string,
  source = exposed
): void => {
  const v = structuredClone(source);
  mutate(v);
  try {
    canonicalSelectableTableResult(v);
  } catch {
    return;
  }
  throw new Error(`strict projection accepted ${label}`);
};
reject((v) => {
  (v.tables as Record<string, unknown>[])[0]!.page = "1";
}, "wrong table page");
reject((v) => {
  (
    (v.tables as Record<string, unknown>[])[0]!.cells as Record<
      string,
      unknown
    >[]
  )[0]!.isHeader = "true";
}, "wrong cell boolean");
reject((v) => {
  (v.tables as Record<string, unknown>[])[0]!.private = "leak";
}, "unexpected table field");
reject((v) => {
  delete (v.tables as Record<string, unknown>[])[0]!.rows;
}, "missing rows");
const mutationSensitive = {
  allClaimedFields: true,
  manifestVersion: SELECTABLE_TABLE_MUTATION_MANIFEST.version,
  mutationManifestSha256: sha(
    JSON.stringify(SELECTABLE_TABLE_MUTATION_MANIFEST)
  ),
  leafMutationCount,
  wrongPrimitiveTypeProbeCount:
    SELECTABLE_TABLE_MUTATION_MANIFEST.wrongPrimitiveTypes.length,
  unexpectedFieldProbeCount:
    SELECTABLE_TABLE_MUTATION_MANIFEST.unexpectedFields.length,
  requiredOmissionProbeCount:
    SELECTABLE_TABLE_MUTATION_MANIFEST.requiredOmissions.length,
  privateLeakProbeCount:
    SELECTABLE_TABLE_MUTATION_MANIFEST.privateLeakage.length,
  dependencyPresenceProbeCount: SELECTABLE_TABLE_DEPENDENCY_SURFACES.length,
};
const candidateSha = git("rev-parse", "HEAD").toString().trim();
if (process.env.CANDIDATE_SHA && process.env.CANDIDATE_SHA !== candidateSha)
  throw new Error(
    `candidate SHA mismatch: ${process.env.CANDIDATE_SHA} != ${candidateSha}`
  );
const report = {
  schemaVersion: 1,
  profile: "pdf_reader_v3014_selectable_table_result",
  candidateSha,
  ...auth,
  caseCount: corpus.cases.length,
  passed: corpus.cases.length - failures.length,
  skipped: 0,
  subprocessNonzeroRejected,
  mutationSensitive,
  semanticProof,
  continuationProof,
  resourceBoundProof,
  nonClaims: [
    "exact provenance engine label values: Rust truthfully reports pdf-reader-core while TS reports pdfjs",
    "OCR-derived, visual/provider, ML, and general-table detection parity",
    "selectable-table behavior outside the exact six-case corpus",
    "exact-cap/cap+1 admission is a Rust safety proof, not TS semantic equality",
    "full Document AST, Document Map, Trust Report, markdown, HTML, element, and chunk parity outside exact table linkage",
  ],
  pass: failures.length === 0 && semanticProofPass && continuationProofPass,
  observations,
  failures,
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) await Bun.write(outputPath, serialized);
console.log(serialized.trimEnd());
if (!report.pass) process.exit(1);
