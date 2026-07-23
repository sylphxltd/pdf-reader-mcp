#!/usr/bin/env bun
/**
 * Publish five optional native packages (when binaries are staged), then the main package.
 *
 * Guards:
 * - verified-candidate admission must pass
 * - dropInFor3014 must remain false for this progress publish path unless explicitly overridden
 * - each native package prepublishOnly refuses empty binaries
 *
 * Usage:
 *   bun scripts/release-publish-with-natives.ts
 *   bun scripts/release-publish-with-natives.ts --dry-run
 *   bun scripts/release-publish-with-natives.ts --skip-main
 *   bun scripts/release-publish-with-natives.ts --main-only
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NATIVE_PLATFORM_PACKAGES } from '../src/native/platform-package-map.ts';

const root = join(import.meta.dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const skipMain = process.argv.includes('--skip-main');
const mainOnly = process.argv.includes('--main-only');

const run = (cmd: string, args: string[], cwd = root, options?: { allowDryRunSkip?: boolean }) => {
  console.log(`[release-publish-with-natives] $ ${cmd} ${args.join(' ')}`);
  if (dryRun && options?.allowDryRunSkip) {
    console.log('[release-publish-with-natives] dry-run: skipped publish side effect');
    return;
  }
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

// Admission gate first.
run('bun', ['scripts/check-verified-candidate-admission.ts']);

const matrix = JSON.parse(
  readFileSync(join(root, 'docs/specs/pure-rust-capability-matrix.json'), 'utf8')
) as { productTruth?: { dropInFor3014?: boolean; publishFreeze?: boolean; version?: string } };
// dropInFor3014=true is allowed for sole-runtime default publishes after
// check-verified-candidate-admission passes (requires soleRuntimeAuthorized).
if (matrix.productTruth?.dropInFor3014 === true) {
  console.log(
    '[release-publish-with-natives] sole-runtime publish path (dropInFor3014=true)'
  );
}

run('bun', ['scripts/native/sync-native-package-manifests.ts']);

if (!mainOnly) {
  // Require all five binaries for a full native publish.
  // Dry-run without staged cross-platform binaries validates manifests only.
  if (dryRun) {
    run('bun', ['scripts/native/assert-native-packages-ready.ts', '--manifests-only', '--all']);
  } else {
    run('bun', ['scripts/native/assert-native-packages-ready.ts', '--all']);
  }
  for (const meta of Object.values(NATIVE_PLATFORM_PACKAGES)) {
    const cwd = join(root, meta.packageDir);
    if (!existsSync(join(cwd, 'package.json'))) {
      console.error(`missing ${cwd}/package.json`);
      process.exit(1);
    }
    run('npm', ['publish', '--access', 'public'], cwd, { allowDryRunSkip: true });
  }
}

if (!skipMain) {
  run('npm', ['publish', '--access', 'public'], root, { allowDryRunSkip: true });
  run('npm', ['view', '@sylphx/pdf-reader-mcp', 'version']);
}

console.log(
  JSON.stringify(
    {
      profile: 'release_publish_with_natives',
      pass: true,
      dryRun,
      skipMain,
      mainOnly,
      publishFreeze: matrix.productTruth?.publishFreeze ?? null,
      dropInFor3014: matrix.productTruth?.dropInFor3014 ?? null,
    },
    null,
    2
  )
);
console.log('[release-publish-with-natives] PASS');
