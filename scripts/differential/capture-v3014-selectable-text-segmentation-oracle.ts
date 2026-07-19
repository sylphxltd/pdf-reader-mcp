#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const corpusPath = join(scriptDir, 'fixtures/v3014-selectable-text-segmentation-corpus.json');
const oraclePath = join(scriptDir, 'fixtures/v3014-selectable-text-segmentation-oracle.json');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const runnerSource = join(scriptDir, 'v3014-selectable-text-segmentation-baseline-runner.ts');
const projectionSource = join(scriptDir, 'v3014-selectable-text-segmentation-projection.ts');
const refresh = process.argv.includes('--refresh');
const existing = JSON.parse(readFileSync(oraclePath, 'utf8')) as { baseline: { commit: string }; expectations: Record<string, unknown> };

const run = (command: string, args: string[], cwd: string, capture = false): string => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, PDF_READER_ENGINE_MODE: '', PDF_READER_USE_RUST_TEXT_SEARCH: '' }, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
  return result.stdout ?? '';
};
const worktree = mkdtempSync(join(tmpdir(), 'pdf-reader-v3014-selectable-segmentation-'));
try {
  run('git', ['worktree', 'add', '--detach', worktree, existing.baseline.commit], repoRoot);
  run('bun', ['install', '--frozen-lockfile'], worktree);
  const runner = join(worktree, 'v3014-selectable-text-segmentation-baseline-runner.ts');
  const projection = join(worktree, 'v3014-selectable-text-segmentation-projection.ts');
  writeFileSync(runner, readFileSync(runnerSource));
  writeFileSync(projection, readFileSync(projectionSource));
  const expectations = JSON.parse(run('bun', [runner, corpusPath, fixtureDir], worktree, true)) as Record<string, unknown>;
  if (refresh) {
    writeFileSync(oraclePath, `${JSON.stringify({ ...existing, expectations }, null, 2)}\n`);
    console.error(`refreshed ${oraclePath}`);
  } else if (JSON.stringify(expectations) !== JSON.stringify(existing.expectations)) {
    throw new Error('stored v3.0.14 selectable-text-segmentation oracle differs from executable baseline');
  } else {
    console.log(`v3.0.14 selectable-text-segmentation oracle replay: OK (${String(Object.keys(expectations).length)} cases)`);
  }
} finally {
  spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: repoRoot, stdio: 'ignore' });
  rmSync(worktree, { recursive: true, force: true });
}
