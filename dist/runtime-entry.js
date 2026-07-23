#!/usr/bin/env node

// src/runtime-entry.ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// src/native/platform-package-map.ts
var NATIVE_PLATFORM_PACKAGES = {
  "darwin-arm64": {
    npmName: "@sylphx/pdf-reader-mcp-darwin-arm64",
    packageDir: "packages/pdf-reader-mcp-darwin-arm64",
    binaryName: "pdf-reader-mcp-server",
    os: "darwin",
    cpu: "arm64"
  },
  "darwin-x64": {
    npmName: "@sylphx/pdf-reader-mcp-darwin-x64",
    packageDir: "packages/pdf-reader-mcp-darwin-x64",
    binaryName: "pdf-reader-mcp-server",
    os: "darwin",
    cpu: "x64"
  },
  "linux-arm64-gnu": {
    npmName: "@sylphx/pdf-reader-mcp-linux-arm64-gnu",
    packageDir: "packages/pdf-reader-mcp-linux-arm64-gnu",
    binaryName: "pdf-reader-mcp-server",
    os: "linux",
    cpu: "arm64"
  },
  "linux-x64-gnu": {
    npmName: "@sylphx/pdf-reader-mcp-linux-x64-gnu",
    packageDir: "packages/pdf-reader-mcp-linux-x64-gnu",
    binaryName: "pdf-reader-mcp-server",
    os: "linux",
    cpu: "x64"
  },
  "win32-x64-msvc": {
    npmName: "@sylphx/pdf-reader-mcp-win32-x64-msvc",
    packageDir: "packages/pdf-reader-mcp-win32-x64-msvc",
    binaryName: "pdf-reader-mcp-server.exe",
    os: "win32",
    cpu: "x64"
  }
};
var resolveNativePlatformId = (platform = process.platform, arch = process.arch) => {
  if (platform === "darwin" && arch === "arm64")
    return "darwin-arm64";
  if (platform === "darwin" && arch === "x64")
    return "darwin-x64";
  if (platform === "linux" && arch === "arm64")
    return "linux-arm64-gnu";
  if (platform === "linux" && arch === "x64")
    return "linux-x64-gnu";
  if (platform === "win32" && arch === "x64")
    return "win32-x64-msvc";
  return null;
};
if (false) {}

// src/runtime-entry.ts
var require2 = createRequire(import.meta.url);
var here = dirname(fileURLToPath(import.meta.url));
var packageRoot = join(here, "..");
var resolveNativeBinary = () => {
  const forced = process.env["PDF_READER_MCP_RUST_BIN"];
  if (forced && existsSync(forced))
    return forced;
  const platformId = resolveNativePlatformId();
  if (!platformId)
    return null;
  const meta = NATIVE_PLATFORM_PACKAGES[platformId];
  const candidates = [
    join(packageRoot, "node_modules", meta.npmName, "bin", meta.binaryName),
    join(packageRoot, meta.packageDir, "bin", meta.binaryName),
    join(packageRoot, "bin/native", platformId, meta.binaryName)
  ];
  try {
    const pkgJson = require2.resolve(`${meta.npmName}/package.json`, {
      paths: [packageRoot, process.cwd()]
    });
    candidates.unshift(join(dirname(pkgJson), "bin", meta.binaryName));
  } catch {}
  for (const candidate of candidates) {
    if (existsSync(candidate))
      return candidate;
  }
  return null;
};
var forceTs = process.env["PDF_READER_ENGINE_MODE"] === "typescript" || process.env["PDF_READER_ENGINE_MODE"] === "ts" || process.env["PDF_READER_FORCE_TYPESCRIPT"] === "1";
var loadTypeScriptRuntime = async () => {
  const tsEntry = join(here, "index.js");
  if (!existsSync(tsEntry)) {
    console.error("[pdf-reader-mcp] TypeScript runtime requested, but dist/index.js is not available");
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
    console.error([
      `[pdf-reader-mcp] pure-Rust native binary not found for ${platformLabel}.`,
      "Default entry is fail-closed (no automatic TypeScript fallback).",
      "Install the matching optional native package, or use an explicit TypeScript rollback:",
      "  - node node_modules/@sylphx/pdf-reader-mcp/dist/index.js",
      '  - import/require "@sylphx/pdf-reader-mcp/typescript"',
      "  - PDF_READER_FORCE_TYPESCRIPT=1",
      "  - PDF_READER_ENGINE_MODE=typescript"
    ].join(`
`));
    process.exit(1);
  }
  const child = spawn(nativeBinary, process.argv.slice(2), {
    stdio: "inherit",
    env: {
      ...process.env,
      PDF_READER_ENGINE_MODE: process.env["PDF_READER_ENGINE_MODE"] || "pure-rust",
      MCP_TRANSPORT: process.env["MCP_TRANSPORT"] || "stdio"
    }
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}
