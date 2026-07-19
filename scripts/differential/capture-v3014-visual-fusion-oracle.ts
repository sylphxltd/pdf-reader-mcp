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
const corpusPath = join(scriptDir, 'fixtures/v3014-visual-fusion-corpus.json');
const oraclePath = join(scriptDir, 'fixtures/v3014-visual-fusion-oracle.json');
const runnerPath = join(scriptDir, 'v3014-visual-fusion-baseline-runner.ts');
const projectionPath = join(scriptDir, 'v3014-visual-fusion-projection.ts');
const providerPath = join(scriptDir, 'reference-visual-fusion-provider.ts');
const fixturePath = join(fixtureDir, 'v3014-visual-candidate-v1.pdf');
const refresh = process.argv.includes('--refresh');
const sourcePaths = [
  'src/index.ts',
  'src/mcp.ts',
  'src/handlers/readPdf.ts',
  'src/pdf/autoReadPolicy.ts',
  'src/pdf/readCoordinator.ts',
  'src/pdf/visualEnrichment.ts',
  'src/pdf/regionAnalysis.ts',
  'src/pdf/documentMap.ts',
  'src/pdf/documentModel.ts',
  'src/pdf/semanticPatterns.ts',
  'src/pdf/tableExtractor.ts',
  'src/pdf/parser.ts',
  'src/pdf/loader.ts',
  'src/types/pdf/region-analysis.ts',
  'src/types/pdf/regions.ts',
  'src/types/pdf/document-map.ts',
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
const worktree = mkdtempSync(join(tmpdir(), 'pdf-reader-v3014-visual-fusion-'));
try {
  run('git', ['worktree', 'add', '--detach', worktree, commit], repoRoot);
  run('bun', ['install', '--frozen-lockfile'], worktree);
  const detachedRunner = join(worktree, 'v3014-visual-fusion-baseline-runner.ts');
  const detachedProjection = join(worktree, 'v3014-visual-fusion-projection.ts');
  const detachedProvider = join(worktree, 'reference-visual-fusion-provider.ts');
  writeFileSync(detachedRunner, readFileSync(runnerPath));
  writeFileSync(detachedProjection, readFileSync(projectionPath));
  writeFileSync(detachedProvider, readFileSync(providerPath));
  const expectations = JSON.parse(
    run('bun', [detachedRunner, corpusPath, fixtureDir, detachedProvider], worktree, true)
  );
  const relocatedFixtureDir = join(worktree, 'relocated-checkout/test/fixtures/differential');
  mkdirSync(relocatedFixtureDir, { recursive: true });
  copyFileSync(fixturePath, join(relocatedFixtureDir, 'v3014-visual-candidate-v1.pdf'));
  const relocatedExpectations = JSON.parse(
    run('bun', [detachedRunner, corpusPath, relocatedFixtureDir, detachedProvider], worktree, true)
  );
  if (JSON.stringify(relocatedExpectations) !== JSON.stringify(expectations)) {
    throw new Error('visual-fusion projection depends on checkout or fixture-root path');
  }
  const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
    envelope: unknown;
    nonclaims: unknown;
  };
  const oracle = {
    schemaVersion: 1,
    profile: 'pdf_reader_v3014_visual_fusion_oracle',
    baseline: {
      tag: 'v3.0.14',
      commit,
      tree,
      bunLockSha256: sha256(gitBytes('show', `${commit}:bun.lock`)),
      runnerSha256: sha256(readFileSync(runnerPath)),
      projectionSha256: sha256(readFileSync(projectionPath)),
      corpusSha256: sha256(readFileSync(corpusPath)),
      providerSha256: sha256(readFileSync(providerPath)),
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
    console.error(`${existsSync(oraclePath) ? 'refreshed' : 'created'} ${oraclePath}`);
  } else if (JSON.stringify(JSON.parse(readFileSync(oraclePath, 'utf8'))) !== JSON.stringify(oracle)) {
    throw new Error('stored v3.0.14 visual-fusion oracle differs from detached executable baseline');
  } else {
    console.log(
      `v3.0.14 visual-fusion oracle replay: OK (${String(Object.keys(expectations).length)} cases)`
    );
  }
} finally {
  spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: repoRoot, stdio: 'ignore' });
  rmSync(worktree, { recursive: true, force: true });
}
