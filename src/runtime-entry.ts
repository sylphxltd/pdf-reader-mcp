#!/usr/bin/env node
/**
 * Default package entry for @sylphx/pdf-reader-mcp.
 *
 * Prefers the platform optional pure-Rust MCP server binary when present.
 * Fail-closed when the native package is missing, unless the operator
 * explicitly forces the TypeScript rollback path.
 *
 * Explicit TypeScript rollback:
 *   - export `@sylphx/pdf-reader-mcp/typescript`
 *   - PDF_READER_FORCE_TYPESCRIPT=1
 *   - PDF_READER_ENGINE_MODE=typescript|ts
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  NATIVE_PLATFORM_PACKAGES,
  resolveNativePlatformId,
} from './native/platform-package-map.js';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..');

const resolveNativeBinary = (): string | null => {
  const forced = process.env['PDF_READER_MCP_RUST_BIN'];
  if (forced && existsSync(forced)) return forced;

  const platformId = resolveNativePlatformId();
  if (!platformId) return null;
  const meta = NATIVE_PLATFORM_PACKAGES[platformId];
  const candidates = [
    join(packageRoot, 'node_modules', meta.npmName, 'bin', meta.binaryName),
    join(packageRoot, meta.packageDir, 'bin', meta.binaryName),
    join(packageRoot, 'bin/native', platformId, meta.binaryName),
  ];
  try {
    const pkgJson = require.resolve(`${meta.npmName}/package.json`, {
      paths: [packageRoot, process.cwd()],
    });
    candidates.unshift(join(dirname(pkgJson), 'bin', meta.binaryName));
  } catch {
    // optional dependency not installed
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

const forceTs =
  process.env['PDF_READER_ENGINE_MODE'] === 'typescript' ||
  process.env['PDF_READER_ENGINE_MODE'] === 'ts' ||
  process.env['PDF_READER_FORCE_TYPESCRIPT'] === '1';

const loadTypeScriptRuntime = async (): Promise<void> => {
  const tsEntry = join(here, 'index.js');
  if (!existsSync(tsEntry)) {
    console.error(
      '[pdf-reader-mcp] TypeScript runtime requested, but dist/index.js is not available'
    );
    process.exit(1);
  }
  await import(pathToFileURL(tsEntry).href);
};

if (forceTs) {
  await loadTypeScriptRuntime();
} else {
  const nativeBinary = resolveNativeBinary();
  if (!nativeBinary) {
    const platformId = resolveNativePlatformId();
    const platformLabel = platformId ?? `${process.platform}/${process.arch}`;
    console.error(
      [
        `[pdf-reader-mcp] pure-Rust native binary not found for ${platformLabel}.`,
        'Default entry is fail-closed (no automatic TypeScript fallback).',
        'Install the matching optional native package, or use an explicit TypeScript rollback:',
        '  - node node_modules/@sylphx/pdf-reader-mcp/dist/index.js',
        '  - import/require "@sylphx/pdf-reader-mcp/typescript"',
        '  - PDF_READER_FORCE_TYPESCRIPT=1',
        '  - PDF_READER_ENGINE_MODE=typescript',
      ].join('\n')
    );
    process.exit(1);
  }

  const child = spawn(nativeBinary, process.argv.slice(2), {
    stdio: 'inherit',
    env: {
      ...process.env,
      PDF_READER_ENGINE_MODE: process.env['PDF_READER_ENGINE_MODE'] || 'pure-rust',
      MCP_TRANSPORT: process.env['MCP_TRANSPORT'] || 'stdio',
    },
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}
