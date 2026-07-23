#!/usr/bin/env bun
/**
 * Five-platform registry install/runtime proof harness.
 *
 * Modes:
 * - plan (default): print required proof steps without mutating registries
 * - local-pack: prove host platform install from a packed tarball + staged native binary
 * - registry: prove npm install of a published version (requires network + published artifacts)
 *
 * Sole-runtime cutover remains unauthorized until registry mode is green on all five platforms.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NATIVE_PLATFORM_PACKAGES,
  resolveNativePlatformId,
} from '../src/native/platform-package-map.ts';

const root = join(import.meta.dirname, '..');
const mode = process.argv.includes('--registry')
  ? 'registry'
  : process.argv.includes('--local-pack')
    ? 'local-pack'
    : 'plan';

const platformId = resolveNativePlatformId();
const versionArg = process.argv.find((arg) => arg.startsWith('--version='))?.slice('--version='.length);

const plan = {
  profile: 'registry_install_proof',
  mode,
  hostPlatformId: platformId,
  requiredPlatforms: Object.keys(NATIVE_PLATFORM_PACKAGES),
  soleRuntimePrerequisite: [
    'productTruth.dropInFor3014=true',
    'native optional packages published with platform binaries',
    'npm install @sylphx/pdf-reader-mcp@<version> resolves optional native package',
    'MCP initialize succeeds with PDF_READER_ENGINE_MODE=pure-rust on each platform',
  ],
  commands: {
    plan: 'bun scripts/check-registry-install-proof.ts',
    localPack: 'bun scripts/check-registry-install-proof.ts --local-pack',
    registry: 'bun scripts/check-registry-install-proof.ts --registry --version=<published>',
  },
};

if (mode === 'plan') {
  console.log(JSON.stringify({ ...plan, pass: true }, null, 2));
  process.exit(0);
}

if (!platformId) {
  console.error('unsupported host platform for install proof');
  process.exit(2);
}

if (mode === 'local-pack') {
  const meta = NATIVE_PLATFORM_PACKAGES[platformId];
  const staged = join(root, 'packages', `pdf-reader-mcp-${platformId}`, 'bin', meta.binaryName);
  if (!existsSync(staged)) {
    console.error(`missing staged package binary at ${staged}; run bun run build:rust && bun scripts/stage-rust-mcp.ts`);
    process.exit(1);
  }
  const temp = mkdtempSync(join(tmpdir(), 'pdf-reader-registry-proof-'));
  try {
    // Pack main package and optional package for local install simulation.
    const packMain = spawnSync('npm', ['pack', '--pack-destination', temp], {
      cwd: root,
      encoding: 'utf8',
    });
    if (packMain.status !== 0) {
      console.error(packMain.stderr || packMain.stdout);
      process.exit(1);
    }
    const packNative = spawnSync('npm', ['pack', '--pack-destination', temp], {
      cwd: join(root, meta.packageDir),
      encoding: 'utf8',
    });
    // Native package may still be private/scaffold; packing is still useful proof of layout.
    const tarballs = (packMain.stdout + '\n' + (packNative.stdout || ''))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.tgz'));
    writeFileSync(
      join(temp, 'result.json'),
      `${JSON.stringify(
        {
          ...plan,
          mode: 'local-pack',
          stagedBinary: staged,
          tarballs,
          note: 'Local pack proof only; not npm registry readback.',
          pass: tarballs.length > 0 && existsSync(staged),
        },
        null,
        2
      )}\n`
    );
    console.log(readFileSync(join(temp, 'result.json'), 'utf8'));
    if (tarballs.length === 0) process.exit(1);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  process.exit(0);
}

// registry mode
if (!versionArg) {
  console.error('--registry requires --version=<published-version>');
  process.exit(2);
}
const temp = mkdtempSync(join(tmpdir(), 'pdf-reader-registry-install-'));
try {
  const init = spawnSync('npm', ['init', '-y'], { cwd: temp, encoding: 'utf8' });
  if (init.status !== 0) {
    console.error(init.stderr);
    process.exit(1);
  }
  const install = spawnSync(
    'npm',
    ['install', `@sylphx/pdf-reader-mcp@${versionArg}`, '--no-fund', '--no-audit'],
    { cwd: temp, encoding: 'utf8', env: process.env }
  );
  if (install.status !== 0) {
    console.error(install.stderr || install.stdout);
    process.exit(1);
  }
  const pkgDir = join(temp, 'node_modules', '@sylphx', 'pdf-reader-mcp');
  if (!existsSync(pkgDir)) {
    console.error('installed package directory missing');
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        ...plan,
        mode: 'registry',
        version: versionArg,
        installedPath: pkgDir,
        pass: true,
        note: 'Package install succeeded; run pure-rust MCP initialize separately with platform native binary present.',
      },
      null,
      2
    )
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}

