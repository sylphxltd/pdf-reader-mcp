#!/usr/bin/env bun

export type NativePlatformId =
  | 'darwin-arm64'
  | 'darwin-x64'
  | 'linux-arm64-gnu'
  | 'linux-x64-gnu'
  | 'win32-x64-msvc';

export const NATIVE_PLATFORM_PACKAGES: Record<
  NativePlatformId,
  {
    npmName: string;
    packageDir: string;
    binaryName: string;
    os: string;
    cpu: string;
  }
> = {
  'darwin-arm64': {
    npmName: '@sylphx/citra-darwin-arm64',
    packageDir: 'packages/citra-darwin-arm64',
    binaryName: 'citra-mcp-server',
    os: 'darwin',
    cpu: 'arm64',
  },
  'darwin-x64': {
    npmName: '@sylphx/citra-darwin-x64',
    packageDir: 'packages/citra-darwin-x64',
    binaryName: 'citra-mcp-server',
    os: 'darwin',
    cpu: 'x64',
  },
  'linux-arm64-gnu': {
    npmName: '@sylphx/citra-linux-arm64-gnu',
    packageDir: 'packages/citra-linux-arm64-gnu',
    binaryName: 'citra-mcp-server',
    os: 'linux',
    cpu: 'arm64',
  },
  'linux-x64-gnu': {
    npmName: '@sylphx/citra-linux-x64-gnu',
    packageDir: 'packages/citra-linux-x64-gnu',
    binaryName: 'citra-mcp-server',
    os: 'linux',
    cpu: 'x64',
  },
  'win32-x64-msvc': {
    npmName: '@sylphx/citra-win32-x64-msvc',
    packageDir: 'packages/citra-win32-x64-msvc',
    binaryName: 'citra-mcp-server.exe',
    os: 'win32',
    cpu: 'x64',
  },
};

export const resolveNativePlatformId = (
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch
): NativePlatformId | null => {
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64';
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64-gnu';
  if (platform === 'linux' && arch === 'x64') return 'linux-x64-gnu';
  if (platform === 'win32' && arch === 'x64') return 'win32-x64-msvc';
  return null;
};

export const nativeBinaryRelativePath = (platformId: NativePlatformId): string => {
  const meta = NATIVE_PLATFORM_PACKAGES[platformId];
  return `bin/native/${platformId}/${meta.binaryName}`;
};

if (import.meta.main) {
  const id = resolveNativePlatformId();
  if (!id) {
    console.error(`unsupported host platform: ${process.platform}/${process.arch}`);
    process.exit(2);
  }
  console.log(
    JSON.stringify(
      {
        platformId: id,
        ...NATIVE_PLATFORM_PACKAGES[id],
        stagedRelativePath: nativeBinaryRelativePath(id),
      },
      null,
      2
    )
  );
}
