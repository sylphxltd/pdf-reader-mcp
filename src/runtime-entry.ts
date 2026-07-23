#!/usr/bin/env node
/**
 * Default package entry for @sylphx/pdf-reader-mcp.
 *
 * Prefers the platform optional pure-Rust MCP server binary when present.
 * Falls back to the TypeScript dist/index.js runtime when the native package
 * is missing (unsupported platform / optional dependency skipped).
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

const nativeBinary = forceTs ? null : resolveNativeBinary();

if (nativeBinary) {
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
} else {
  // TypeScript fallback path.
  const tsEntry = join(here, 'index.js');
  if (!existsSync(tsEntry)) {
    console.error(
      '[pdf-reader-mcp] neither pure-Rust native binary nor TypeScript dist/index.js is available'
    );
    process.exit(1);
  }
  await import(pathToFileURL(tsEntry).href);
}
