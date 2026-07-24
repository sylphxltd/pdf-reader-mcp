#!/usr/bin/env bun
/**
 * Same-host TS 3.0.14 vs Rust A/B suite over representative fixture classes.
 *
 * Emits suite status:
 * - failed
 * - measured_draft_not_admissible
 * - admissible_pass (all required classes fixture_pass + material advantage + no regression)
 *
 * Marketing claims still require independent review authorization.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../..');
const outDir = join(root, 'benchmark-artifacts/same-host-ab');
mkdirSync(outDir, { recursive: true });

type FixtureSpec = {
  class: string;
  path: string;
  required: boolean;
};

const fixtures: FixtureSpec[] = [
  { class: 'small_text', path: join(root, 'test/fixtures/sample.pdf'), required: true },
  {
    class: 'structured',
    path: join(root, 'test/fixtures/differential/v3014-structure-v1.pdf'),
    required: true,
  },
  {
    class: 'table_heavy',
    path: join(root, 'test/fixtures/differential/v3014-selectable-table-v1.pdf'),
    required: true,
  },
  {
    class: 'geometry_edge',
    path: join(root, 'test/fixtures/differential/v3014-page-geometry-inverted-mediabox-v1.pdf'),
    required: true,
  },
  {
    class: 'metadata_structured',
    path: join(root, 'test/fixtures/differential/v3014-info-collection-present-v1.pdf'),
    required: true,
  },
  {
    class: 'text_segmentation',
    path: join(root, 'test/fixtures/differential/v3014-selectable-text-segmentation-v1.pdf'),
    required: true,
  },
  {
    class: 'behavior_baseline',
    path: join(root, 'test/fixtures/differential/v3014-behavior-v1.pdf'),
    required: true,
  },
  {
    class: 'hostile_table_bound',
    path: join(root, 'test/fixtures/differential/v3014-selectable-table-hostile-4097-v1.pdf'),
    required: true,
  },
].filter((f) => existsSync(f.path));

const warmIters = process.env['MCP_PDF_PERF_WARM_ITERS'] || '7';
const results: Array<Record<string, unknown>> = [];

for (const fixture of fixtures) {
  const env = {
    ...process.env,
    MCP_PDF_PERF_FIXTURE: fixture.path,
    MCP_PDF_PERF_FIXTURE_CLASS: fixture.class,
    MCP_PDF_PERF_WARM_ITERS: warmIters,
    MCP_PDF_PERF_OUTPUT_DIR: join(outDir, 'per-fixture'),
  };
  mkdirSync(env.MCP_PDF_PERF_OUTPUT_DIR, { recursive: true });
  const run = spawnSync('bun', ['scripts/perf/same-host-ts-rust-ab.ts'], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  const reportPath = join(env.MCP_PDF_PERF_OUTPUT_DIR, 'same-host-ab-report.json');
  let report: Record<string, unknown> | null = null;
  if (existsSync(reportPath)) {
    report = JSON.parse(readFileSync(reportPath, 'utf8')) as Record<string, unknown>;
    const safe = fixture.path.split('/').pop() || 'fixture';
    copyFileSync(reportPath, join(outDir, `report-${safe}.json`));
  }
  results.push({
    class: fixture.class,
    required: fixture.required,
    fixture: fixture.path,
    exitCode: run.status,
    status: report?.status ?? null,
    summary: report?.summary ?? null,
    packageSizeBytes: report?.packageSizeBytes ?? null,
    memory: report?.memory ?? null,
    blockers: report?.blockers ?? [run.stderr || run.stdout || `exit ${run.status}`],
    candidateSha: report?.candidateSha ?? null,
  });
}

const required = results.filter((r) => r.required);
const requiredPass = required.filter((r) => r.status === 'fixture_pass' || r.status === 'admissible_pass');
const anyFailed = results.some((r) => r.status === 'failed' || r.exitCode !== 0);

const speedups = required
  .map((r) => (r.summary as { warmMedianSpeedupTsOverRust?: number | null } | null)?.warmMedianSpeedupTsOverRust)
  .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
const minSpeedup = speedups.length ? Math.min(...speedups) : null;
const medianSpeedup = speedups.length
  ? [...speedups].sort((a, b) => a - b)[Math.floor(speedups.length / 2)] ?? null
  : null;

const missingClasses = [
  'small_text',
  'structured',
  'table_heavy',
  'geometry_edge',
  'metadata_structured',
  'text_segmentation',
  'behavior_baseline',
  'hostile_table_bound',
].filter((c) => !results.some((r) => r.class === c));

// Suite-level admission: every required class fixture_pass, material min speedup, no failed semantic gates.
const suiteBlockers: string[] = [];
if (anyFailed) suiteBlockers.push('one or more fixture runs failed');
if (missingClasses.length) suiteBlockers.push(`missing fixture classes: ${missingClasses.join(', ')}`);
if (requiredPass.length !== required.length) {
  suiteBlockers.push(
    `required fixture_pass ${requiredPass.length}/${required.length}; need all required classes`
  );
}
if (minSpeedup === null || minSpeedup < 1.5) {
  suiteBlockers.push(`min warm median speedup across required fixtures ${minSpeedup ?? 'n/a'} < 1.5`);
}

let status: 'failed' | 'measured_draft_not_admissible' | 'admissible_pass' = 'measured_draft_not_admissible';
if (anyFailed) status = 'failed';
else if (suiteBlockers.length === 0) status = 'admissible_pass';
else status = 'measured_draft_not_admissible';

const suite = {
  profile: 'same_host_ts_rust_ab_suite',
  status,
  generatedAt: new Date().toISOString(),
  candidateSha: results.find((r) => r.candidateSha)?.candidateSha ?? null,
  historicalBaseline: '@sylphx/pdf-reader-mcp@3.0.14',
  warmIterations: Number(warmIters),
  fixtureCount: fixtures.length,
  requiredFixtureCount: required.length,
  requiredFixturePassCount: requiredPass.length,
  aggregate: {
    minWarmMedianSpeedup: minSpeedup,
    medianWarmMedianSpeedup: medianSpeedup,
    requiredClasses: required.map((r) => r.class),
    passedClasses: requiredPass.map((r) => r.class),
  },
  results,
  blockers: suiteBlockers,
  claimPolicy:
    'Suite admissible_pass is necessary but not sufficient for marketing claims. Independent review must set performanceClaimsAuthorized=true and publish an honest report derived from these raw samples.',
};

writeFileSync(join(outDir, 'same-host-ab-suite.json'), `${JSON.stringify(suite, null, 2)}\n`);
// Also write verification-friendly copy path used by docs
writeFileSync(
  join(root, 'verification/pdf-reader-same-host-ab-suite-draft.json'),
  `${JSON.stringify(suite, null, 2)}\n`
);
console.log(JSON.stringify(suite, null, 2));
if (status === 'failed') process.exit(1);
if (process.argv.includes('--require-admissible') && status !== 'admissible_pass') process.exit(2);
