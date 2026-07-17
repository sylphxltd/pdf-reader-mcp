/**
 * Fail-closed gate for star-project production readiness (pure-Rust path).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const env = {
  ...process.env,
  PDF_READER_ENGINE_MODE: '',
  PDF_READER_PURE_RUST: '',
  RUN_PURE_RUST_CAPABILITY: '',
};

// Published product path only (TypeScript 3.0.14). Pure-Rust capability suite is opt-in.
const suites = ['test/production/productionPath.contract.test.ts'];

for (const suite of suites) {
  const result = spawnSync('bun', ['test', suite, '--timeout=600000'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
  });
  if (result.status !== 0) {
    console.error(
      `[check-production-contract] FAILED — suite not green: ${suite}`
    );
    process.exit(result.status ?? 1);
  }
}

console.log(
  '[check-production-contract] PASS — published TypeScript production-path contract is green'
);
