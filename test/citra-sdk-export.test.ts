import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Citra } from '../src/sdk.ts';

const root = join(import.meta.dir, '..');

describe('Citra SDK export', () => {
  test('exports Citra class and create factory', () => {
    expect(typeof Citra).toBe('function');
    expect(typeof Citra.create).toBe('function');
  });

  test('package.json exports brand SDK surface and citra bin only', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      name?: string;
      exports?: Record<string, string>;
      bin?: Record<string, string>;
      files?: string[];
    };
    expect(pkg.name).toBe('@sylphx/citra');
    expect(pkg.exports?.['./sdk']).toBe('./dist/sdk.js');
    // Brand-sole: no transitional ./citra alias export.
    expect(pkg.exports?.['./citra']).toBeUndefined();
    expect(pkg.bin?.citra).toBeTruthy();
    expect(pkg.bin?.['pdf-reader-mcp']).toBeUndefined();
    expect(Object.keys(pkg.bin ?? {})).toEqual(['citra']);
    expect(pkg.files ?? []).toContain('dist/sdk.js');
  });

  test('dist/sdk.js exists after package build', () => {
    const sdkDist = join(root, 'dist/sdk.js');
    // ensure source always available
    expect(existsSync(join(root, 'src/sdk.ts'))).toBe(true);
    if (existsSync(join(root, 'dist/pure-rust.js'))) {
      expect(existsSync(sdkDist)).toBe(true);
    }
  });
});

test('marketplace server.json brands as Citra', () => {
  const server = JSON.parse(readFileSync(join(root, 'server.json'), 'utf8')) as {
    title?: string;
  };
  expect(server.title).toBe('Citra');
});
