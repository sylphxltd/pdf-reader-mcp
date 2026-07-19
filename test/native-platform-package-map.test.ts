import { describe, expect, test } from 'bun:test';
import {
  NATIVE_PLATFORM_PACKAGES,
  nativeBinaryRelativePath,
  resolveNativePlatformId,
} from '../scripts/native/platform-package-map.ts';

describe('native platform package map', () => {
  test('maps the five release platforms exactly', () => {
    expect(Object.keys(NATIVE_PLATFORM_PACKAGES).sort()).toEqual([
      'darwin-arm64',
      'darwin-x64',
      'linux-arm64-gnu',
      'linux-x64-gnu',
      'win32-x64-msvc',
    ]);
  });

  test('resolves host triples used by the optional package design', () => {
    expect(resolveNativePlatformId('darwin', 'arm64')).toBe('darwin-arm64');
    expect(resolveNativePlatformId('darwin', 'x64')).toBe('darwin-x64');
    expect(resolveNativePlatformId('linux', 'arm64')).toBe('linux-arm64-gnu');
    expect(resolveNativePlatformId('linux', 'x64')).toBe('linux-x64-gnu');
    expect(resolveNativePlatformId('win32', 'x64')).toBe('win32-x64-msvc');
    expect(resolveNativePlatformId('freebsd', 'x64')).toBeNull();
  });

  test('uses platform-scoped staged binary paths', () => {
    expect(nativeBinaryRelativePath('linux-x64-gnu')).toBe(
      'bin/native/linux-x64-gnu/pdf-reader-mcp-server'
    );
    expect(nativeBinaryRelativePath('win32-x64-msvc')).toBe(
      'bin/native/win32-x64-msvc/pdf-reader-mcp-server.exe'
    );
  });
});
