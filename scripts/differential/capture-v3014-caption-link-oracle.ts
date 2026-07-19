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
const corpusPath = join(scriptDir, 'fixtures/v3014-caption-link-corpus.json');
const oraclePath = join(scriptDir, 'fixtures/v3014-caption-link-oracle.json');
const fixtureManifestPath = join(scriptDir, 'fixtures/v3014-caption-link-fixture.json');
const runnerSource = join(scriptDir, 'v3014-caption-link-baseline-runner.ts');
const projectionSource = join(scriptDir, 'v3014-caption-link-projection.ts');
const generatorPath = join(scriptDir, 'generate-v3014-caption-link-fixture.ts');
const refresh = process.argv.includes('--refresh');
const sourcePaths = [
  'src/pdf/documentAst.ts',
  'src/pdf/documentModel.ts',
  'src/pdf/semanticPatterns.ts',
  'src/pdf/readCoordinator.ts',
  'src/pdf/tableExtractor.ts',
  'src/types/pdf/document-ast.ts',
  'src/types/pdf/content.ts',
  'src/types/pdf/tables.ts',
];
const sha256 = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
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

run('bun', ['scripts/differential/generate-v3014-caption-link-fixture.ts'], repoRoot);
const commit = run('git', ['rev-list', '-n', '1', 'v3.0.14'], repoRoot, true).trim();
const tree = run('git', ['rev-parse', `${commit}^{tree}`], repoRoot, true).trim();
const worktree = mkdtempSync(join(tmpdir(), 'pdf-reader-v3014-caption-link-'));
try {
  run('git', ['worktree', 'add', '--detach', worktree, commit], repoRoot);
  run('bun', ['install', '--frozen-lockfile'], worktree);
  const runner = join(worktree, 'v3014-caption-link-baseline-runner.ts');
  const projection = join(worktree, 'v3014-caption-link-projection.ts');
  const baseProjection = join(worktree, 'v3014-document-ast-projection.ts');
  writeFileSync(runner, readFileSync(runnerSource));
  writeFileSync(projection, readFileSync(projectionSource));
  writeFileSync(baseProjection, readFileSync(join(scriptDir, 'v3014-document-ast-projection.ts')));
  const stdout = run('bun', [runner, corpusPath, fixtureDir], worktree, true);
  const expectations = JSON.parse(stdout) as Record<string, unknown>;
  const manifest = JSON.parse(readFileSync(fixtureManifestPath, 'utf8')) as {
    fixture: { sha256: string };
  };
  const oracle = {
    schemaVersion: 1,
    profile: 'pdf_reader_v3014_caption_link_oracle',
    baseline: {
      tag: 'v3.0.14',
      commit,
      tree,
      bunLockSha256: sha256(gitBytes('show', `${commit}:bun.lock`)),
      runnerSha256: sha256(readFileSync(runnerSource)),
      projectionSha256: sha256(readFileSync(projectionSource)),
      generatorSha256: sha256(readFileSync(generatorPath)),
      corpusSha256: sha256(readFileSync(corpusPath)),
      fixtureManifestSha256: sha256(readFileSync(fixtureManifestPath)),
      fixtureSha256: manifest.fixture.sha256,
      entrypointSha256: Object.fromEntries(
        sourcePaths.map((path) => [path, sha256(gitBytes('show', `${commit}:${path}`))])
      ),
    },
    expectations,
  };
  if (refresh) {
    writeFileSync(oraclePath, `${JSON.stringify(oracle, null, 2)}\n`);
    console.error(`refreshed ${oraclePath}`);
  } else {
    const stored = JSON.parse(readFileSync(oraclePath, 'utf8'));
    if (JSON.stringify(stored) !== JSON.stringify(oracle)) {
      throw new Error('stored v3.0.14 caption-link oracle differs from executable baseline');
    }
    console.log(`v3.0.14 caption-link oracle replay: OK (${String(Object.keys(expectations).length)} cases)`);
  }
} finally {
  spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: repoRoot, stdio: 'ignore' });
  rmSync(worktree, { recursive: true, force: true });
}
