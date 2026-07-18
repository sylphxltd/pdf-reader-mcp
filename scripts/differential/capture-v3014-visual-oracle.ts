#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const corpusPath = join(scriptDir, 'fixtures/v3014-visual-corpus.json');
const oraclePath = join(scriptDir, 'fixtures/v3014-visual-oracle.json');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const runnerSource = join(scriptDir, 'v3014-visual-baseline-runner.ts');
const providerPath = join(scriptDir, 'reference-ocr-provider.ts');
const regionProviderPath = join(scriptDir, 'reference-region-analysis-provider.ts');
const refresh = process.argv.includes('--refresh');
const oracle = JSON.parse(readFileSync(oraclePath, 'utf8')) as {
  baseline: { tag: string; commit: string };
  expectations: Record<string, unknown>;
};

function run(command: string, args: string[], cwd: string, capture = false): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
  return result.stdout ?? '';
}

run('bun', ['scripts/differential/generate-v3014-visual-fixtures.ts'], repoRoot);
const resolved = run('git', ['rev-list', '-n', '1', oracle.baseline.tag], repoRoot, true).trim();
if (resolved !== oracle.baseline.commit) {
  throw new Error(`${oracle.baseline.tag} moved: expected ${oracle.baseline.commit}, got ${resolved}`);
}

const worktree = mkdtempSync(join(tmpdir(), 'pdf-reader-v3014-visual-oracle-'));
try {
  run('git', ['worktree', 'add', '--detach', worktree, oracle.baseline.commit], repoRoot);
  run('bun', ['install', '--frozen-lockfile'], worktree);
  const runner = join(worktree, 'v3014-visual-baseline-runner.ts');
  writeFileSync(runner, readFileSync(runnerSource));
  const stdout = run(
    'bun',
    [runner, corpusPath, fixtureDir, providerPath, regionProviderPath],
    worktree,
    true
  );
  const expectations = JSON.parse(stdout) as Record<string, unknown>;
  if (refresh) {
    writeFileSync(oraclePath, `${JSON.stringify({ ...oracle, expectations }, null, 2)}\n`);
    console.error(`refreshed ${oraclePath}`);
  } else if (JSON.stringify(expectations) !== JSON.stringify(oracle.expectations)) {
    throw new Error('stored v3.0.14 visual oracle differs from replayed baseline');
  } else {
    console.log(`v3.0.14 visual oracle replay: OK (${Object.keys(expectations).length} cases)`);
  }
} finally {
  spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: repoRoot, stdio: 'ignore' });
  rmSync(worktree, { recursive: true, force: true });
}
