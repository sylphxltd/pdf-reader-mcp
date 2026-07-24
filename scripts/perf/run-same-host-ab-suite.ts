#!/usr/bin/env bun
/**
 * Same-host TS 3.0.14 vs Rust A/B suite (rebuilt contract).
 *
 * Formal suite admissible_pass requires:
 * - all required fixture classes present
 * - each class fixture_pass under persistent_warm mode
 * - min warm median speedup >= 1.5 across required classes (persistent_warm)
 * - no failed runs
 *
 * startup_inclusive results are recorded diagnostically and must not alone
 * authorize product-wide steady-state claims.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../..');
const outDir = join(root, 'benchmark-artifacts/same-host-ab');
mkdirSync(outDir, { recursive: true });

type FixtureSpec = {
  class: string;
  path: string;
  task: string;
  required: boolean;
};

const fixtures: FixtureSpec[] = [
  {
    class: 'small_text',
    path: join(root, 'test/fixtures/sample.pdf'),
    task: 'read_pdf_full_text',
    required: true,
  },
  {
    class: 'structured',
    path: join(root, 'test/fixtures/differential/v3014-structure-v1.pdf'),
    task: 'read_pdf_structure',
    required: true,
  },
  {
    class: 'table_heavy',
    path: join(root, 'test/fixtures/differential/v3014-selectable-table-v1.pdf'),
    task: 'read_pdf_tables',
    required: true,
  },
  {
    class: 'geometry_edge',
    path: join(root, 'test/fixtures/differential/v3014-page-geometry-inverted-mediabox-v1.pdf'),
    task: 'read_pdf_geometry',
    required: true,
  },
  {
    class: 'metadata_structured',
    path: join(root, 'test/fixtures/differential/v3014-info-collection-present-v1.pdf'),
    task: 'read_pdf_full_text',
    required: true,
  },
  {
    class: 'text_segmentation',
    path: join(root, 'test/fixtures/differential/v3014-selectable-text-segmentation-v1.pdf'),
    task: 'read_pdf_full_text',
    required: true,
  },
  {
    class: 'behavior_baseline',
    path: join(root, 'test/fixtures/differential/v3014-behavior-v1.pdf'),
    task: 'read_pdf_full_text',
    required: true,
  },
  {
    class: 'hostile_table_bound',
    path: join(root, 'test/fixtures/differential/v3014-selectable-table-hostile-4097-v1.pdf'),
    task: 'read_pdf_tables',
    required: true,
  },
].filter((f) => existsSync(f.path));

const warmIters = process.env['MCP_PDF_PERF_WARM_ITERS'] || '9';
const rustFromRegistry = process.env['MCP_PDF_PERF_RUST_FROM_REGISTRY'] || '0';
const results: Array<Record<string, unknown>> = [];

for (const fixture of fixtures) {
  const env = {
    ...process.env,
    MCP_PDF_PERF_FIXTURE: fixture.path,
    MCP_PDF_PERF_FIXTURE_CLASS: fixture.class,
    MCP_PDF_PERF_TASK: fixture.task,
    MCP_PDF_PERF_MODE: 'both',
    MCP_PDF_PERF_WARM_ITERS: warmIters,
    MCP_PDF_PERF_RUST_FROM_REGISTRY: rustFromRegistry,
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
    const rawDir = report.rawDir as string | undefined;
    if (rawDir && existsSync(join(root, rawDir))) {
      // keep raw under verification/perf/raw already
    }
  }
  const summary = (report?.summary || {}) as Record<string, any>;
  const persistent = summary.persistent_warm || null;
  const startup = summary.startup_inclusive || null;
  results.push({
    class: fixture.class,
    task: fixture.task,
    required: fixture.required,
    fixture: fixture.path,
    exitCode: run.status,
    status: report?.status ?? null,
    modeStatuses: report?.modeStatuses ?? null,
    persistentWarm: persistent,
    startupInclusive: startup,
    semantic: report?.semantic ?? null,
    rawDir: report?.rawDir ?? null,
    runId: report?.runId ?? null,
    blockers: report?.blockers ?? [run.stderr || run.stdout || `exit ${run.status}`],
    candidateSha: report?.candidateSha ?? null,
    binaries: report?.binaries ?? null,
    host: report?.host ?? null,
  });
}

const required = results.filter((r) => r.required);
const requiredPass = required.filter((r) => {
  const ms = r.modeStatuses as Record<string, string> | null;
  return ms?.persistent_warm === 'fixture_pass' || r.status === 'fixture_pass';
});
const anyFailed = results.some((r) => r.status === 'failed' || r.exitCode !== 0);

const speedups = required
  .map((r) => (r.persistentWarm as { warmMedianSpeedupTsOverRust?: number | null } | null)?.warmMedianSpeedupTsOverRust)
  .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
const minSpeedup = speedups.length ? Math.min(...speedups) : null;
const medianSpeedup = speedups.length
  ? [...speedups].sort((a, b) => a - b)[Math.floor(speedups.length / 2)] ?? null
  : null;

const requiredClasses = [
  'small_text',
  'structured',
  'table_heavy',
  'geometry_edge',
  'metadata_structured',
  'text_segmentation',
  'behavior_baseline',
  'hostile_table_bound',
];
const missingClasses = requiredClasses.filter((c) => !results.some((r) => r.class === c));

const suiteBlockers: string[] = [];
if (anyFailed) suiteBlockers.push('one or more fixture runs failed');
if (missingClasses.length) suiteBlockers.push(`missing fixture classes: ${missingClasses.join(', ')}`);
if (requiredPass.length !== required.length) {
  suiteBlockers.push(
    `required persistent_warm fixture_pass ${requiredPass.length}/${required.length}`
  );
}
if (minSpeedup === null || minSpeedup < 1.5) {
  suiteBlockers.push(`min persistent_warm speedup ${minSpeedup ?? 'n/a'} < 1.5`);
}

let status: 'failed' | 'measured_draft_not_admissible' | 'admissible_pass' =
  'measured_draft_not_admissible';
if (anyFailed) status = 'failed';
else if (suiteBlockers.length === 0) status = 'admissible_pass';

const suite = {
  profile: 'same_host_ts_rust_ab_suite_v2',
  status,
  generatedAt: new Date().toISOString(),
  candidateSha: results.find((r) => r.candidateSha)?.candidateSha ?? null,
  historicalBaseline: '@sylphx/pdf-reader-mcp@3.0.14',
  warmIterations: Number(warmIters),
  rustFromRegistry: rustFromRegistry === '1',
  fixtureCount: fixtures.length,
  requiredFixtureCount: required.length,
  requiredFixturePassCount: requiredPass.length,
  aggregate: {
    minPersistentWarmMedianSpeedup: minSpeedup,
    medianPersistentWarmMedianSpeedup: medianSpeedup,
    requiredClasses,
    passedClasses: requiredPass.map((r) => r.class),
  },
  results,
  blockers: suiteBlockers,
  claimPolicy:
    'Suite admissible_pass requires persistent_warm fixture_pass on all required classes. startup_inclusive numbers are diagnostic only and must be labeled spawn+initialize+task. Marketing still needs independent performanceClaimsAuthorized=true.',
};

writeFileSync(join(outDir, 'same-host-ab-suite.json'), `${JSON.stringify(suite, null, 2)}\n`);
writeFileSync(
  join(root, 'verification/pdf-reader-same-host-ab-suite-draft.json'),
  `${JSON.stringify(suite, null, 2)}\n`
);
// durable suite snapshot under verification/perf
const suiteSnapDir = join(root, 'verification/perf');
mkdirSync(suiteSnapDir, { recursive: true });
writeFileSync(join(suiteSnapDir, 'latest-suite.json'), `${JSON.stringify(suite, null, 2)}\n`);

console.log(JSON.stringify(suite, null, 2));
if (status === 'failed') process.exit(1);
if (process.argv.includes('--require-admissible') && status !== 'admissible_pass') process.exit(2);
