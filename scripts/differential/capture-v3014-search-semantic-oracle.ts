#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const corpusPath = join(scriptDir, 'fixtures/v3014-search-semantic-corpus.json');
const oraclePath = join(scriptDir, 'fixtures/v3014-search-semantic-oracle.json');
const manifestPath = join(scriptDir, 'fixtures/v3014-search-semantic-fixture.json');
const runnerPath = join(scriptDir, 'v3014-search-semantic-baseline-runner.ts');
const projectionPath = join(scriptDir, 'v3014-search-semantic-projection.ts');
const generatorPath = join(scriptDir, 'generate-v3014-search-semantic-fixture.ts');
const refresh = process.argv.includes('--refresh');
const sourcePaths = ['src/handlers/searchPdf.ts', 'src/pdf/search.ts', 'src/pdf/parser.ts', 'src/pdf/extractor.ts', 'src/pdf/loader.ts'];
const sha256 = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const run = (command: string, args: string[], cwd: string, capture = false): string => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', maxBuffer: 100 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
  return result.stdout ?? '';
};
const gitBytes = (...args: string[]): Buffer => {
  const result = spawnSync('git', args, { cwd: repoRoot });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return result.stdout;
};

run('bun', ['scripts/differential/generate-v3014-search-semantic-fixture.ts'], repoRoot);
const commit = run('git', ['rev-list', '-n', '1', 'v3.0.14'], repoRoot, true).trim();
if (commit !== '92651c79c6ce8d10dfa3c76332176c26f222bd78') throw new Error('v3.0.14 commit identity changed');
const tree = run('git', ['rev-parse', `${commit}^{tree}`], repoRoot, true).trim();
const worktree = mkdtempSync(join(tmpdir(), 'pdf-reader-v3014-search-semantic-'));
try {
  run('git', ['worktree', 'add', '--detach', worktree, commit], repoRoot);
  run('bun', ['install', '--frozen-lockfile'], worktree);
  const runner = join(worktree, 'v3014-search-semantic-baseline-runner.ts');
  const projection = join(worktree, 'v3014-search-semantic-projection.ts');
  writeFileSync(runner, readFileSync(runnerPath));
  writeFileSync(projection, readFileSync(projectionPath));
  const expectations = JSON.parse(run('bun', [runner, corpusPath, fixtureDir], worktree, true));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { fixture: { sha256: string }; reusedFixture: { sha256: string } };
  const oracle = {
    schemaVersion: 1,
    profile: 'pdf_reader_v3014_search_semantic_oracle',
    baseline: {
      tag: 'v3.0.14', commit, tree,
      bunLockSha256: sha256(gitBytes('show', `${commit}:bun.lock`)),
      runnerSha256: sha256(readFileSync(runnerPath)),
      projectionSha256: sha256(readFileSync(projectionPath)),
      generatorSha256: sha256(readFileSync(generatorPath)),
      corpusSha256: sha256(readFileSync(corpusPath)),
      fixtureManifestSha256: sha256(readFileSync(manifestPath)),
      fixtureSha256: manifest.fixture.sha256,
      reusedFixtureSha256: manifest.reusedFixture.sha256,
      entrypointSha256: Object.fromEntries(sourcePaths.map((path) => [path, sha256(gitBytes('show', `${commit}:${path}`))])),
    },
    expectations,
  };
  if (refresh) {
    writeFileSync(oraclePath, `${JSON.stringify(oracle, null, 2)}\n`);
    console.error(`refreshed ${oraclePath}`);
  } else if (JSON.stringify(JSON.parse(readFileSync(oraclePath, 'utf8'))) !== JSON.stringify(oracle)) {
    throw new Error('stored v3.0.14 search-semantic oracle differs from executable baseline');
  } else {
    console.log(`v3.0.14 search-semantic oracle replay: OK (${String(Object.keys(expectations).length)} cases)`);
  }
} finally {
  spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: repoRoot, stdio: 'ignore' });
  rmSync(worktree, { recursive: true, force: true });
}
