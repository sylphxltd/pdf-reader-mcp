#!/usr/bin/env bun
/**
 * Run same-host A/B over a small representative fixture set.
 * Emits a suite summary; does not authorize marketing claims.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../..');
const outDir = join(root, 'benchmark-artifacts/same-host-ab');
mkdirSync(outDir, { recursive: true });

const fixtures = [
  join(root, 'test/fixtures/sample.pdf'),
  join(root, 'test/fixtures/differential/v3014-behavior-v1.pdf'),
  join(root, 'test/fixtures/differential/v3014-page-geometry-inverted-mediabox-v1.pdf'),
  join(root, 'test/fixtures/differential/v3014-info-collection-present-v1.pdf'),
].filter((f) => existsSync(f));

const results: unknown[] = [];
for (const fixture of fixtures) {
  const env = {
    ...process.env,
    MCP_PDF_PERF_FIXTURE: fixture,
    MCP_PDF_PERF_WARM_ITERS: process.env['MCP_PDF_PERF_WARM_ITERS'] || '3',
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
    report = JSON.parse(require('node:fs').readFileSync(reportPath, 'utf8')) as Record<
      string,
      unknown
    >;
    // stash per fixture
    const safe = fixture.split('/').pop() || 'fixture';
    require('node:fs').copyFileSync(reportPath, join(outDir, `report-${safe}.json`));
  }
  results.push({
    fixture,
    exitCode: run.status,
    status: report?.status ?? null,
    summary: report?.summary ?? null,
    blockers: report?.blockers ?? [run.stderr || run.stdout],
  });
}

const suite = {
  profile: 'same_host_ts_rust_ab_suite',
  status: results.every((r) => (r as { status?: string }).status && (r as { status?: string }).status !== 'failed')
    ? 'measured_draft_not_admissible'
    : 'failed',
  generatedAt: new Date().toISOString(),
  fixtureCount: fixtures.length,
  results,
  claimPolicy:
    'Suite draft only. admissible_pass requires broader corpus, memory/startup/package metrics, and independent review.',
};
writeFileSync(join(outDir, 'same-host-ab-suite.json'), `${JSON.stringify(suite, null, 2)}\n`);
console.log(JSON.stringify(suite, null, 2));
if (suite.status === 'failed') process.exit(1);
