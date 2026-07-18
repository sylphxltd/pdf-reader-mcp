#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "../..");
const fixtureDir = join(repoRoot, "test/fixtures/differential");
const corpusPath = join(scriptDir, "fixtures/v3014-structure-corpus.json");
const oraclePath = join(scriptDir, "fixtures/v3014-structure-oracle.json");
const manifestPath = join(scriptDir, "fixtures/v3014-structure-fixtures.json");
const cli = join(repoRoot, "target/release/pdf-reader-cli");
const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
const oracle = JSON.parse(readFileSync(oraclePath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const sha = (v: Uint8Array) => createHash("sha256").update(v).digest("hex");
const git = (...args: string[]) => {
  const r = spawnSync("git", args, { cwd: repoRoot });
  if (r.status !== 0) throw new Error(String(r.stderr));
  return r.stdout;
};
if (
  git("rev-list", "-n", "1", oracle.baseline.tag).toString().trim() !==
  oracle.baseline.commit
)
  throw new Error("baseline moved");
if (
  git("rev-parse", `${oracle.baseline.commit}^{tree}`).toString().trim() !==
  oracle.baseline.tree
)
  throw new Error("baseline tree mismatch");
if (
  sha(git("show", `${oracle.baseline.commit}:bun.lock`)) !==
  oracle.baseline.bunLockSha256
)
  throw new Error("lock mismatch");
for (const [path, digest] of Object.entries(oracle.baseline.entrypointSha256)) {
  if (sha(git("show", `${oracle.baseline.commit}:${path}`)) !== digest)
    throw new Error(`entrypoint mismatch ${path}`);
}
for (const fixture of manifest.fixtures) {
  const bytes = readFileSync(join(repoRoot, fixture.path));
  if (bytes.length !== fixture.bytes || sha(bytes) !== fixture.sha256)
    throw new Error(`fixture mismatch ${fixture.path}`);
}
if (
  sha(readFileSync(join(repoRoot, manifest.generator))) !==
  manifest.generatorSha256
)
  throw new Error("generator mismatch");
if (corpus.cases.length !== 5)
  throw new Error("structure corpus must contain 5 cases");
const materialize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(materialize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key === "fixture" ? "path" : key,
        key === "fixture"
          ? join(fixtureDir, String(entry))
          : materialize(entry),
      ])
    );
  return value;
};
const canonical = (data: any) => ({
  num_pages: data.num_pages,
  structure_trees: data.structure_trees ?? null,
  accessibility_report: data.accessibility_report ?? null,
  private_surface_absence: {
    annotations: data.annotations === undefined,
    form_fields: data.form_fields === undefined,
    permissions: data.permissions === undefined,
    mark_info: data.mark_info === undefined,
    outline: data.outline === undefined,
  },
  accessibility_map: data.document_map
    ? {
        pages: data.document_map.pages.map((page: any) => ({
          page: page.page,
          accessibility_report_page_index: page.accessibility_report_page_index,
          accessibility_issue_indexes: page.accessibility_issue_indexes,
          accessibility_high_issue_indexes:
            page.accessibility_high_issue_indexes,
          accessibility_medium_issue_indexes:
            page.accessibility_medium_issue_indexes,
          accessibility_low_issue_indexes: page.accessibility_low_issue_indexes,
          accessibility_grade: page.accessibility_grade,
          accessibility_score: page.accessibility_score,
          accessibility_issue_count: page.accessibility_issue_count,
        })),
        routing: {
          accessibility_review_pages:
            data.document_map.routing.accessibility_review_pages,
          accessibility_high_issue_pages:
            data.document_map.routing.accessibility_high_issue_pages,
          accessibility_medium_issue_pages:
            data.document_map.routing.accessibility_medium_issue_pages,
          accessibility_low_issue_pages:
            data.document_map.routing.accessibility_low_issue_pages,
        },
        summary: data.document_map.summary,
      }
    : null,
});
const actual: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const r = spawnSync(cli, [], {
    cwd: repoRoot,
    encoding: "utf8",
    input: JSON.stringify({
      tool: "read_pdf",
      input: materialize(entry.input),
    }),
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout)
    throw new Error(`Rust CLI failed ${entry.id}: ${r.stderr}`);
  const envelope = JSON.parse(r.stdout);
  const payload = JSON.parse(envelope.result.content[0].text);
  actual[entry.id] = canonical(payload.results[0].data);
}
const sort = (value: any): any =>
  Array.isArray(value)
    ? value.map(sort)
    : value && typeof value === "object"
    ? Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, sort(entry)])
      )
    : value;
const expected = JSON.stringify(sort(oracle.expectations));
const observed = JSON.stringify(sort(actual));
const pass = expected === observed;
const result = {
  schemaVersion: 1,
  profile: "pdf_reader_v3014_structure_result",
  candidateSha: git("rev-parse", "HEAD").toString().trim(),
  caseCount: corpus.cases.length,
  passed: pass ? corpus.cases.length : 0,
  skipped: 0,
  pass,
  failures: pass ? [] : [{ expected: oracle.expectations, actual }],
};
console.log(JSON.stringify(result, null, 2));
if (!pass) process.exit(1);
