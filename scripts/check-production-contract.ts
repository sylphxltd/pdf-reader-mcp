/**
 * Fail-closed gate for star-project production readiness.
 * Runs the production-path contract suite only (full parity engine).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const result = spawnSync(
  'bun',
  ['test', 'test/production/productionPath.contract.test.ts', '--timeout=600000'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      // Never allow pure-rust to satisfy this gate.
      PDF_READER_ENGINE_MODE: 'full',
      PDF_READER_PURE_RUST: '',
    },
  }
);

if (result.status !== 0) {
  console.error('[check-production-contract] FAILED — production-path contract is not green');
  process.exit(result.status ?? 1);
}

console.log('[check-production-contract] PASS — production-path public contract is green');
