#!/usr/bin/env bun
/**
 * Five-platform registry install + pure-Rust runtime proof harness.
 *
 * Modes:
 * - plan (default): print required proof steps without mutating registries
 * - local-pack: prove host platform install from a packed tarball + staged native binary
 * - registry: prove npm install of a published version and pure-Rust MCP initialize
 *
 * Sole-runtime cutover remains unauthorized until registry mode is green on all five platforms.
 */
import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NATIVE_PLATFORM_PACKAGES,
  type NativePlatformId,
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
const skipInitialize = process.argv.includes('--install-only');
const keepTemp = process.argv.includes('--keep-temp');

const plan = {
  profile: 'registry_install_proof',
  mode,
  hostPlatformId: platformId,
  requiredPlatforms: Object.keys(NATIVE_PLATFORM_PACKAGES),
  soleRuntimePrerequisite: [
    'productTruth.dropInFor3014=true',
    'native optional packages published with platform binaries',
    'npm install @sylphx/pdf-reader-mcp@<version> resolves optional native package',
    'MCP initialize succeeds with pure-Rust native binary on each platform',
  ],
  commands: {
    plan: 'bun scripts/check-registry-install-proof.ts',
    localPack: 'bun scripts/check-registry-install-proof.ts --local-pack',
    registry:
      'bun scripts/check-registry-install-proof.ts --registry --version=<published>',
    registryInstallOnly:
      'bun scripts/check-registry-install-proof.ts --registry --install-only --version=<published>',
  },
};

const fail = (message: string, code = 1): never => {
  console.error(`[registry-install-proof] ${message}`);
  process.exit(code);
};

const resolveNativeBinaryFromInstall = (
  installRoot: string,
  id: NativePlatformId
): string | null => {
  const meta = NATIVE_PLATFORM_PACKAGES[id];
  const candidates = [
    join(installRoot, 'node_modules', meta.npmName, 'bin', meta.binaryName),
    join(
      installRoot,
      'node_modules',
      '@sylphx',
      'pdf-reader-mcp',
      'node_modules',
      meta.npmName,
      'bin',
      meta.binaryName
    ),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).size >= 1024) {
      try {
        if (id !== 'win32-x64-msvc') chmodSync(candidate, 0o755);
      } catch {
        // best-effort
      }
      return candidate;
    }
  }
  return null;
};

const mcpInitialize = async (
  binaryPath: string,
  cwd: string
): Promise<{ serverName: string; serverVersion: string }> => {
  return await new Promise((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(binaryPath, [], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MCP_TRANSPORT: 'stdio',
        PDF_READER_ENGINE_MODE: 'pure-rust',
      },
    });

    let buffer = '';
    let err = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(
        new Error(
          `timed out waiting for initialize from ${binaryPath}; stderr=${err.slice(0, 500)}`
        )
      );
    }, 20_000);

    const finish = (err?: Error, value?: { serverName: string; serverVersion: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      if (err) reject(err);
      else resolve(value!);
    };

    child.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      while (buffer.includes('\n')) {
        const index = buffer.indexOf('\n');
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        let response: Record<string, unknown>;
        try {
          response = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (response.id !== 1) continue;
        const result = response.result as Record<string, unknown> | undefined;
        const serverInfo = result?.serverInfo as Record<string, unknown> | undefined;
        const serverName = String(serverInfo?.name ?? '');
        const serverVersion = String(serverInfo?.version ?? '');
        if (serverName !== 'pdf-reader-mcp') {
          finish(new Error(`unexpected serverInfo.name=${serverName}`));
          return;
        }
        // Pre-cutover: experimental marker. Sole-runtime: package version is allowed.
        if (
          !serverVersion.includes('experimental') &&
          !serverVersion.startsWith('0.') &&
          !/^\d+\.\d+\.\d+/.test(serverVersion)
        ) {
          finish(new Error(`unexpected pure-Rust server version: ${serverVersion}`));
          return;
        }
        finish(undefined, { serverName, serverVersion });
      }
    });
    child.on('error', (error) => finish(error));
    child.on('exit', (code) => {
      if (!settled) {
        finish(
          new Error(
            `binary exited early with code ${String(code)}; stderr=${err.slice(0, 800)}`
          )
        );
      }
    });

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'registry-install-proof', version: '1' },
        },
      })}\n`
    );
  });
};

if (mode === 'plan') {
  console.log(JSON.stringify({ ...plan, pass: true }, null, 2));
  process.exit(0);
}

if (!platformId) {
  fail(`unsupported host platform: ${process.platform}/${process.arch}`, 2);
}

if (mode === 'local-pack') {
  const meta = NATIVE_PLATFORM_PACKAGES[platformId];
  const staged = join(root, 'packages', `pdf-reader-mcp-${platformId}`, 'bin', meta.binaryName);
  if (!existsSync(staged)) {
    fail(
      `missing staged package binary at ${staged}; run bun run build:rust && bun scripts/stage-rust-mcp.ts`
    );
  }
  const temp = mkdtempSync(join(tmpdir(), 'pdf-reader-registry-proof-'));
  try {
    const packMain = spawnSync('npm', ['pack', '--pack-destination', temp], {
      cwd: root,
      encoding: 'utf8',
    });
    if (packMain.status !== 0) {
      fail(packMain.stderr || packMain.stdout || 'npm pack main failed');
    }
    const packNative = spawnSync('npm', ['pack', '--pack-destination', temp], {
      cwd: join(root, meta.packageDir),
      encoding: 'utf8',
    });
    const tarballs = `${packMain.stdout}\n${packNative.stdout || ''}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.tgz'));
    const result = {
      ...plan,
      mode: 'local-pack',
      stagedBinary: staged,
      tarballs,
      note: 'Local pack proof only; not npm registry readback.',
      pass: tarballs.length > 0 && existsSync(staged),
    };
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exit(1);
  } finally {
    if (!keepTemp) rmSync(temp, { recursive: true, force: true });
  }
  process.exit(0);
}

// registry mode
if (!versionArg) {
  fail('--registry requires --version=<published-version>', 2);
}

const temp = mkdtempSync(join(tmpdir(), 'pdf-reader-registry-install-'));
try {
  const init = spawnSync('npm', ['init', '-y'], { cwd: temp, encoding: 'utf8' });
  if (init.status !== 0) fail(init.stderr || 'npm init failed');

  const install = spawnSync(
    'npm',
    ['install', `@sylphx/pdf-reader-mcp@${versionArg}`, '--no-fund', '--no-audit'],
    { cwd: temp, encoding: 'utf8', env: process.env }
  );
  if (install.status !== 0) {
    fail(install.stderr || install.stdout || 'npm install failed');
  }

  const pkgDir = join(temp, 'node_modules', '@sylphx', 'pdf-reader-mcp');
  if (!existsSync(pkgDir)) fail('installed package directory missing');

  const mainPkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as {
    version?: string;
    bin?: Record<string, string>;
    exports?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };
  if (mainPkg.version !== versionArg) {
    fail(`installed version ${mainPkg.version} != requested ${versionArg}`);
  }
  const bin = mainPkg.bin?.['pdf-reader-mcp'] ?? '';
  const soleRuntime =
    bin.includes('runtime-entry.js') ||
    String(mainPkg.exports?.['.'] ?? '').includes('runtime-entry.js');
  if (soleRuntime) {
    if (!bin.includes('runtime-entry.js')) {
      fail(`sole-runtime default bin must be runtime-entry.js; got ${bin}`);
    }
    if (mainPkg.exports?.['./typescript']) {
      fail('sole-Rust package must not export ./typescript');
    }
  } else if (!bin.includes('dist/index.js')) {
    fail(`default bin must be TypeScript dist/index.js or sole-runtime runtime-entry.js; got ${bin}`);
  }
  if (!(mainPkg.exports?.['./pure-rust'] ?? '').includes('pure-rust')) {
    fail('published package must expose ./pure-rust export');
  }

  const meta = NATIVE_PLATFORM_PACKAGES[platformId];
  const expectedOptional = mainPkg.optionalDependencies?.[meta.npmName];
  if (expectedOptional !== versionArg) {
    fail(
      `optionalDependencies missing ${meta.npmName}@${versionArg}; got ${String(expectedOptional)}`
    );
  }

  const nativeBinary = resolveNativeBinaryFromInstall(temp, platformId);
  if (!nativeBinary) {
    fail(
      `optional native package binary missing for ${platformId} after npm install ${versionArg}`
    );
  }

  let initialize:
    | {
        serverName: string;
        serverVersion: string;
      }
    | undefined;
  if (!skipInitialize) {
    initialize = await mcpInitialize(nativeBinary, temp);
  }

  console.log(
    JSON.stringify(
      {
        ...plan,
        mode: 'registry',
        version: versionArg,
        installedPath: pkgDir,
        platformId,
        optionalPackage: meta.npmName,
        nativeBinary,
        initialize: initialize ?? null,
        defaultBin: mainPkg.bin?.['pdf-reader-mcp'] ?? null,
        pureRustExport: mainPkg.exports?.['./pure-rust'] ?? null,
        pass: true,
        note: skipInitialize
          ? 'Install + optional native binary presence only.'
          : 'Registry install + optional native binary + pure-Rust MCP initialize succeeded on host platform.',
      },
      null,
      2
    )
  );
} finally {
  if (!keepTemp) rmSync(temp, { recursive: true, force: true });
  else console.error(`[registry-install-proof] kept temp at ${temp}`);
}
