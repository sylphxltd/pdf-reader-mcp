#!/usr/bin/env bun
/** Freeze-safe pure-Rust npm library export contract checks. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const failures: string[] = [];

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  exports?: Record<string, string>;
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
};
const matrix = JSON.parse(
  readFileSync(join(root, 'docs/specs/pure-rust-capability-matrix.json'), 'utf8')
) as {
  productTruth?: { dropInFor3014?: boolean; publishFreeze?: boolean };
  claimedForDifferential?: string[];
  explicitlyNotClaimed?: string[];
};

if (pkg.bin?.['pdf-reader-mcp'] !== './dist/index.js') {
  failures.push('default bin must remain TypeScript dist/index.js while freeze is enabled');
}
if (pkg.exports?.['.'] !== './dist/index.js') {
  failures.push('default exports["."] must remain TypeScript dist/index.js while freeze is enabled');
}
if (pkg.exports?.['./pure-rust'] !== './dist/pure-rust.js') {
  failures.push('exports["./pure-rust"] must point at dist/pure-rust.js');
}
if (!existsSync(join(root, 'src/pure-rust.ts'))) {
  failures.push('src/pure-rust.ts missing');
}
if (!existsSync(join(root, 'src/native/platform-package-map.ts'))) {
  failures.push('src/native/platform-package-map.ts missing');
}
if (!(pkg.scripts?.build ?? '').includes('src/pure-rust.ts')) {
  failures.push('build script must compile src/pure-rust.ts');
}
if (matrix.productTruth?.dropInFor3014 !== false || matrix.productTruth?.publishFreeze !== true) {
  failures.push('productTruth must keep dropInFor3014=false and publishFreeze=true');
}
if (
  !matrix.claimedForDifferential?.some((entry) =>
    entry.includes('pure-Rust npm library export')
  )
) {
  failures.push('matrix must claim pure-Rust npm library export contract honestly');
}

// Built artifact should exist after local build; if missing, attempt is optional for pure check of sources
if (!existsSync(join(root, 'dist/pure-rust.js'))) {
  failures.push('dist/pure-rust.js missing; run bun run build');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('[check-pure-rust-exports] PASS pure-Rust library export contract (freeze preserved)');
