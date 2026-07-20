#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const corpusPath = join(scriptDir, 'fixtures/v3014-search-multiword-geometry-corpus.json');
const oraclePath = join(scriptDir, 'fixtures/v3014-search-multiword-geometry-oracle.json');
const runnerPath = join(scriptDir, 'v3014-search-multiword-geometry-baseline-runner.ts');
const projectionPath = join(scriptDir, 'v3014-search-multiword-geometry-projection.ts');
const fixturePath = join(fixtureDir, 'v3014-behavior-v1.pdf');
const refresh = process.argv.includes('--refresh');
const sourcePaths = [
  'src/index.ts',
  'src/mcp.ts',
  'src/handlers/searchPdf.ts',
  'src/pdf/search.ts',
  'src/pdf/extractor.ts',
  'src/pdf/parser.ts',
  'src/pdf/loader.ts',
  'src/types/pdf/search.ts',
  'src/types/pdf/source.ts',
  'src/utils/geometry.ts',
];

const sha256 = (value: Uint8Array | string): string =>
  createHash('sha256').update(value).digest('hex');
const run = (command: string, args: string[], cwd: string, capture = false): string => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    maxBuffer: 100 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
  return result.stdout ?? '';
};
const gitBytes = (...args: string[]): Buffer => {
  const result = spawnSync('git', args, { cwd: repoRoot });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return result.stdout;
};

const commit = run('git', ['rev-list', '-n', '1', 'v3.0.14'], repoRoot, true).trim();
if (commit !== '92651c79c6ce8d10dfa3c76332176c26f222bd78') {
  throw new Error('v3.0.14 commit identity changed');
}
const tree = run('git', ['rev-parse', `${commit}^{tree}`], repoRoot, true).trim();
const worktree = mkdtempSync(join(tmpdir(), 'pdf-reader-v3014-search-multiword-geometry-'));
try {
  run('git', ['worktree', 'add', '--detach', worktree, commit], repoRoot);
  run('bun', ['install', '--frozen-lockfile'], worktree);
  writeFileSync(join(worktree, 'v3014-search-multiword-geometry-baseline-runner.ts'), readFileSync(runnerPath));
  writeFileSync(join(worktree, 'v3014-search-multiword-geometry-projection.ts'), readFileSync(projectionPath));
  const expectations = JSON.parse(
    run(
      'bun',
      [
        join(worktree, 'v3014-search-multiword-geometry-baseline-runner.ts'),
        corpusPath,
        fixtureDir,
      ],
      worktree,
      true
    )
  );
  const relocatedFixtureDir = join(worktree, 'relocated-checkout/test/fixtures/differential');
  mkdirSync(relocatedFixtureDir, { recursive: true });
  copyFileSync(fixturePath, join(relocatedFixtureDir, 'v3014-behavior-v1.pdf'));
  const relocatedExpectations = JSON.parse(
    run(
      'bun',
      [
        join(worktree, 'v3014-search-multiword-geometry-baseline-runner.ts'),
        corpusPath,
        relocatedFixtureDir,
      ],
      worktree,
      true
    )
  );
  if (JSON.stringify(relocatedExpectations) !== JSON.stringify(expectations)) {
    throw new Error('multiword geometry projection depends on checkout or fixture-root path');
  }
  const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
    envelope: unknown;
    nonclaims: unknown;
  };
  const oracle = {
    schemaVersion: 1,
    profile: 'pdf_reader_v3014_search_multiword_geometry_oracle',
    baseline: {
      tag: 'v3.0.14',
      commit,
      tree,
      bunLockSha256: sha256(gitBytes('show', `${commit}:bun.lock`)),
      runnerSha256: sha256(readFileSync(runnerPath)),
      projectionSha256: sha256(readFileSync(projectionPath)),
      corpusSha256: sha256(readFileSync(corpusPath)),
      fixtureSha256: sha256(readFileSync(fixturePath)),
      pathPortabilityProof: true,
      envelope: corpus.envelope,
      nonclaims: corpus.nonclaims,
      entrypointSha256: Object.fromEntries(
        sourcePaths.map((path) => [path, sha256(gitBytes('show', `${commit}:${path}`))])
      ),
    },
    expectations,
  };
  if (refresh || !existsSync(oraclePath)) {
    writeFileSync(oraclePath, `${JSON.stringify(oracle, null, 2)}\n`);
    console.error(`wrote ${oraclePath}`);
  } else if (
    JSON.stringify(JSON.parse(readFileSync(oraclePath, 'utf8'))) !== JSON.stringify(oracle)
  ) {
    throw new Error('stored v3.0.14 multiword geometry oracle differs from detached baseline');
  } else {
    console.log('v3.0.14 multiword geometry oracle matches detached executable baseline');
  }
} finally {
  run('git', ['worktree', 'remove', '--force', worktree], repoRoot);
  rmSync(worktree, { recursive: true, force: true });
}
