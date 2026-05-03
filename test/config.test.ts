import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { __resetSecurityConfigForTests, isPathAllowed, isUrlAllowed, readSecurityConfig } from '../src/utils/config.js';
import { ErrorCode, PdfError } from '../src/utils/errors.js';
import { resolvePath } from '../src/utils/pathUtils.js';

// Snapshot env vars touched by this suite so afterEach can restore them
// cleanly. Assigning `undefined` to a process.env key actually stringifies
// to "undefined" — `delete` is the only way to truly unset, so we suppress
// the lint rule for those three lines.
const ENV_KEYS = ['MCP_PDF_ALLOWED_DIRS', 'MCP_PDF_ALLOW_HTTP', 'MCP_PDF_ALLOWED_HOSTS'] as const;
const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) originalEnv[key] = process.env[key];

afterEach(() => {
  __resetSecurityConfigForTests();
  for (const key of ENV_KEYS) {
    const original = originalEnv[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

describe('readSecurityConfig', () => {
  it('defaults to fully permissive when nothing is configured', () => {
    const cfg = readSecurityConfig([], {});
    expect(cfg.allowedDirs).toBeNull();
    expect(cfg.allowHttp).toBe(true);
    expect(cfg.allowedHosts).toBeNull();
  });

  it('parses --allow-dir flags into absolute paths', () => {
    const cfg = readSecurityConfig(['--allow-dir=/tmp/a', '--allow-dir=/tmp/b'], {});
    expect(cfg.allowedDirs).toEqual([path.resolve('/tmp/a'), path.resolve('/tmp/b')]);
  });

  it('parses MCP_PDF_ALLOWED_DIRS with colon and comma separators', () => {
    const cfg = readSecurityConfig([], { MCP_PDF_ALLOWED_DIRS: '/tmp/a:/tmp/b,/tmp/c' });
    expect(cfg.allowedDirs).toEqual([path.resolve('/tmp/a'), path.resolve('/tmp/b'), path.resolve('/tmp/c')]);
  });

  it('disables HTTP via --no-http', () => {
    const cfg = readSecurityConfig(['--no-http'], {});
    expect(cfg.allowHttp).toBe(false);
  });

  it('disables HTTP via MCP_PDF_ALLOW_HTTP=false', () => {
    expect(readSecurityConfig([], { MCP_PDF_ALLOW_HTTP: 'false' }).allowHttp).toBe(false);
    expect(readSecurityConfig([], { MCP_PDF_ALLOW_HTTP: '0' }).allowHttp).toBe(false);
    expect(readSecurityConfig([], { MCP_PDF_ALLOW_HTTP: 'no' }).allowHttp).toBe(false);
  });

  it('parses allowed hosts from CLI and env, lowercased', () => {
    const cfg = readSecurityConfig(['--allow-host=Example.COM'], {
      MCP_PDF_ALLOWED_HOSTS: 'cdn.test.io, files.example.org',
    });
    expect(cfg.allowedHosts).toEqual(['example.com', 'cdn.test.io', 'files.example.org']);
  });

  it('--no-http overrides MCP_PDF_ALLOW_HTTP=true', () => {
    const cfg = readSecurityConfig(['--no-http'], { MCP_PDF_ALLOW_HTTP: 'true' });
    expect(cfg.allowHttp).toBe(false);
  });
});

describe('isPathAllowed', () => {
  it('returns true when allowedDirs is null', () => {
    expect(isPathAllowed('/etc/passwd', null)).toBe(true);
  });

  it('rejects everything when allowedDirs is empty', () => {
    expect(isPathAllowed('/anything', [])).toBe(false);
  });

  it('allows paths inside an allowed directory', () => {
    const dir = path.resolve('/tmp/sandbox');
    expect(isPathAllowed(path.join(dir, 'doc.pdf'), [dir])).toBe(true);
    expect(isPathAllowed(path.join(dir, 'sub/doc.pdf'), [dir])).toBe(true);
    expect(isPathAllowed(dir, [dir])).toBe(true);
  });

  it('rejects paths outside allowed directories', () => {
    const dir = path.resolve('/tmp/sandbox');
    expect(isPathAllowed('/etc/passwd', [dir])).toBe(false);
    expect(isPathAllowed(path.resolve('/tmp/sandbox-evil/doc.pdf'), [dir])).toBe(false);
    expect(isPathAllowed(path.join(dir, '..', 'escape.pdf'), [dir])).toBe(false);
  });

  it('rejects path traversal attempts that resolve outside', () => {
    const dir = path.resolve('/tmp/sandbox');
    const traversal = path.join(dir, 'sub', '..', '..', 'evil.pdf');
    expect(isPathAllowed(traversal, [dir])).toBe(false);
  });
});

describe('isUrlAllowed', () => {
  it('rejects all URLs when allowHttp is false', () => {
    const cfg = { allowHttp: false, allowedDirs: null, allowedHosts: null } as const;
    expect(isUrlAllowed('https://example.com/file.pdf', cfg)).toBe(false);
  });

  it('allows http(s) URLs when allowHttp and no host restriction', () => {
    const cfg = { allowHttp: true, allowedDirs: null, allowedHosts: null } as const;
    expect(isUrlAllowed('https://example.com/file.pdf', cfg)).toBe(true);
    expect(isUrlAllowed('http://example.com/file.pdf', cfg)).toBe(true);
  });

  it('rejects non-http schemes regardless of policy', () => {
    const cfg = { allowHttp: true, allowedDirs: null, allowedHosts: null } as const;
    expect(isUrlAllowed('file:///etc/passwd', cfg)).toBe(false);
    expect(isUrlAllowed('ftp://example.com/x.pdf', cfg)).toBe(false);
    expect(isUrlAllowed('data:application/pdf;base64,abc', cfg)).toBe(false);
  });

  it('enforces allowed hosts list (case-insensitive)', () => {
    const cfg = {
      allowHttp: true,
      allowedDirs: null,
      allowedHosts: ['cdn.example.com'],
    } as const;
    expect(isUrlAllowed('https://CDN.example.com/x.pdf', cfg)).toBe(true);
    expect(isUrlAllowed('https://evil.com/x.pdf', cfg)).toBe(false);
  });

  it('returns false for malformed URLs', () => {
    const cfg = { allowHttp: true, allowedDirs: null, allowedHosts: null } as const;
    expect(isUrlAllowed('not a url', cfg)).toBe(false);
  });
});

describe('resolvePath integration with security config', () => {
  it('rejects paths outside allowlisted directories', () => {
    process.env['MCP_PDF_ALLOWED_DIRS'] = path.resolve('/tmp/sandbox-allowed');
    __resetSecurityConfigForTests();

    expect(() => resolvePath('/etc/passwd')).toThrow(PdfError);
    try {
      resolvePath('/etc/passwd');
    } catch (e) {
      expect((e as PdfError).code).toBe(ErrorCode.InvalidRequest);
      expect((e as PdfError).message).toContain('Access denied');
    }
  });

  it('allows paths inside an allowlisted directory', () => {
    const allowed = path.resolve('/tmp/sandbox-allowed');
    process.env['MCP_PDF_ALLOWED_DIRS'] = allowed;
    __resetSecurityConfigForTests();

    const target = path.join(allowed, 'doc.pdf');
    expect(resolvePath(target)).toBe(target);
  });
});
