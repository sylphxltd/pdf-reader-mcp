#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const corpusPath = join(scriptDir, 'fixtures/v3014-trust-report-corpus.json');
const oraclePath = join(scriptDir, 'fixtures/v3014-trust-report-oracle.json');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const runnerSource = join(scriptDir, 'v3014-trust-report-baseline-runner.ts');
const projectionSource = join(scriptDir, 'v3014-trust-report-projection.ts');
const refresh = process.argv.includes('--refresh');
const oracle = JSON.parse(readFileSync(oraclePath, 'utf8')) as {
  baseline: { commit: string };
  expectations: Record<string, unknown>;
};

function run(command: string, args: string[], cwd: string, capture = false): string {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
  return result.stdout ?? '';
}

const worktree = mkdtempSync(join(tmpdir(), 'pdf-reader-v3014-trust-report-'));
try {
  run('git', ['worktree', 'add', '--detach', worktree, oracle.baseline.commit], repoRoot);
  run('bun', ['install', '--frozen-lockfile'], worktree);
  const runner = join(worktree, 'v3014-trust-report-baseline-runner.ts');
  const projection = join(worktree, 'v3014-trust-report-projection.ts');
  writeFileSync(runner, readFileSync(runnerSource));
  writeFileSync(projection, readFileSync(projectionSource));
  const output = run('bun', [runner, corpusPath, fixtureDir], worktree, true);
  const expectations = JSON.parse(output) as Record<string, unknown>;
  if (refresh) {
    const updated = { ...oracle, expectations };
    writeFileSync(oraclePath, `${JSON.stringify(updated, null, 2)}\n`);
    console.log(`refreshed ${oraclePath}`);
  } else if (JSON.stringify(expectations) !== JSON.stringify(oracle.expectations)) {
    throw new Error('frozen v3.0.14 trust-report oracle mismatch; use --refresh only for intentional re-capture');
  } else {
    console.log(`v3.0.14 trust-report oracle replay: OK (${Object.keys(expectations).length} cases)`);
  }
} finally {
  spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: repoRoot, stdio: 'ignore' });
  rmSync(worktree, { recursive: true, force: true });
}
