#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
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
const corpusPath = join(scriptDir, 'fixtures/v3014-text-annotation-residual-corpus.json');
const oraclePath = join(scriptDir, 'fixtures/v3014-text-annotation-residual-oracle.json');
const runnerPath = join(scriptDir, 'v3014-text-annotation-residual-baseline-runner.ts');
const projectionPath = join(scriptDir, 'v3014-text-annotation-residual-projection.ts');
const textNoApFixture = join(fixtureDir, 'v3014-annotation-text-noap-v1.pdf');
const freeTextFixture = join(fixtureDir, 'v3014-annotation-freetext-v1.pdf');
const refresh = process.argv.includes('--refresh');
const sourcePaths = [
  'src/index.ts',
  'src/mcp.ts',
  'src/handlers/readPdf.ts',
  'src/pdf/readCoordinator.ts',
  'src/pdf/extractor.ts',
  'src/pdf/loader.ts',
  'src/pdf/parser.ts',
  'src/types/pdf/document-structure.ts',
  'src/types/pdf/source.ts',
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
const worktree = mkdtempSync(join(tmpdir(), 'pdf-reader-v3014-text-annotation-'));
try {
  run('git', ['worktree', 'add', '--detach', worktree, commit], repoRoot);
  run('bun', ['install', '--frozen-lockfile'], worktree);
  writeFileSync(join(worktree, 'v3014-text-annotation-residual-baseline-runner.ts'), readFileSync(runnerPath));
  writeFileSync(join(worktree, 'v3014-text-annotation-residual-projection.ts'), readFileSync(projectionPath));
  const expectations = JSON.parse(
    run('bun', [join(worktree, 'v3014-text-annotation-residual-baseline-runner.ts'), corpusPath, fixtureDir], worktree, true)
  );
  const relocated = mkdtempSync(join(tmpdir(), 'pdf-reader-text-annotation-relocated-'));
  try {
    writeFileSync(join(relocated, 'v3014-annotation-text-noap-v1.pdf'), readFileSync(textNoApFixture));
    writeFileSync(join(relocated, 'v3014-annotation-freetext-v1.pdf'), readFileSync(freeTextFixture));
    const relocatedExpectations = JSON.parse(
      run('bun', [join(worktree, 'v3014-text-annotation-residual-baseline-runner.ts'), corpusPath, relocated], worktree, true)
    );
    if (JSON.stringify(relocatedExpectations) !== JSON.stringify(expectations)) {
      throw new Error('text annotation residual projection depends on checkout or fixture-root path');
    }
  } finally {
    rmSync(relocated, { recursive: true, force: true });
  }
  const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as { envelope: unknown; nonclaims: unknown };
  const oracle = {
    schemaVersion: 1,
    profile: 'pdf_reader_v3014_text_annotation_residual_oracle',
    baseline: {
      tag: 'v3.0.14',
      commit,
      tree,
      bunLockSha256: sha256(gitBytes('show', `${commit}:bun.lock`)),
      runnerSha256: sha256(readFileSync(runnerPath)),
      projectionSha256: sha256(readFileSync(projectionPath)),
      corpusSha256: sha256(readFileSync(corpusPath)),
      fixtureSha256: {
        'v3014-annotation-text-noap-v1.pdf': sha256(readFileSync(textNoApFixture)),
        'v3014-annotation-freetext-v1.pdf': sha256(readFileSync(freeTextFixture))
      },
      pathPortabilityProof: true,
      envelope: corpus.envelope,
      nonclaims: corpus.nonclaims,
      entrypointSha256: Object.fromEntries(
        sourcePaths.map((path) => [path, sha256(gitBytes('show', `${commit}:${path}`))])
      ),
    },
    expectations,
  };
  mkdirSync(dirname(oraclePath), { recursive: true });
  if (refresh || !existsSync(oraclePath)) {
    writeFileSync(oraclePath, `${JSON.stringify(oracle, null, 2)}\n`);
    console.error(`wrote ${oraclePath}`);
  } else if (JSON.stringify(JSON.parse(readFileSync(oraclePath, 'utf8'))) !== JSON.stringify(oracle)) {
    throw new Error('stored v3.0.14 text annotation residual oracle differs from detached baseline');
  } else {
    console.log('v3.0.14 text annotation residual oracle matches detached executable baseline');
  }
} finally {
  run('git', ['worktree', 'remove', '--force', worktree], repoRoot);
  rmSync(worktree, { recursive: true, force: true });
}
