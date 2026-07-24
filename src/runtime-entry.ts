#!/usr/bin/env node
/**
 * Sole-Rust production package entry for @sylphx/pdf-reader-mcp.
 *
 * Launches the platform optional pure-Rust MCP server binary only.
 * There is no TypeScript PDF processing fallback in the production package.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

if (
  process.env['PDF_READER_FORCE_TYPESCRIPT'] === '1' ||
  process.env['PDF_READER_ENGINE_MODE'] === 'typescript' ||
  process.env['PDF_READER_ENGINE_MODE'] === 'ts'
) {
  console.error(
    [
      '[pdf-reader-mcp] TypeScript production runtime has been removed from this package.',
      'Use the immutable historical LKG @sylphx/pdf-reader-mcp@3.0.14 for TypeScript rollback,',
      'or install/run the pure-Rust native binary for this package version.',
    ].join('\n')
  );
  process.exit(2);
}

const nativeBinary = resolveNativeBinary();
if (!nativeBinary) {
  const platformId = resolveNativePlatformId();
  const platformLabel = platformId ?? `${process.platform}/${process.arch}`;
  console.error(
    [
      `[pdf-reader-mcp] pure-Rust native binary not found for ${platformLabel}.`,
      'This package is sole-Rust: there is no bundled TypeScript PDF runtime.',
      'Install the matching optional native package for your platform, or set PDF_READER_MCP_RUST_BIN.',
      'Historical TypeScript LKG remains available only as @sylphx/pdf-reader-mcp@3.0.14 (external pin).',
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
