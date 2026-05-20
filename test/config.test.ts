import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetSecurityConfigForTests,
  assertUrlNotPrivate,
  isPathAllowed,
  isPrivateIp,
  isUrlAllowed,
  readSecurityConfig,
} from '../src/utils/config.js';
import { ErrorCode, PdfError } from '../src/utils/errors.js';
import { resolvePath } from '../src/utils/pathUtils.js';

// On macOS `/tmp` is a symlink to `/private/tmp`; the config parser now
// realpaths allowlisted dirs so the comparison against canonicalized user
// paths in resolvePath aligns. Tests compute the expected canonical form
// the same way so they work on any platform.
const canonicalize = (p: string): string => {
  try {
    return fs.realpathSync(p);
  } catch {
    const parent = path.dirname(p);
    if (parent === p) return p;
    return path.join(canonicalize(parent), path.basename(p));
  }
};
const canonical = (p: string): string => canonicalize(path.resolve(p));

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
    expect(cfg.allowPrivateIps).toBe(false);
  });

  it('parses --allow-dir flags into canonical absolute paths', () => {
    const cfg = readSecurityConfig(['--allow-dir=/tmp/a', '--allow-dir=/tmp/b'], {});
    expect(cfg.allowedDirs).toEqual([canonical('/tmp/a'), canonical('/tmp/b')]);
  });

  it('parses MCP_PDF_ALLOWED_DIRS with colon and comma separators', () => {
    const cfg = readSecurityConfig([], { MCP_PDF_ALLOWED_DIRS: '/tmp/a:/tmp/b,/tmp/c' });
    expect(cfg.allowedDirs).toEqual([canonical('/tmp/a'), canonical('/tmp/b'), canonical('/tmp/c')]);
  });

  it('enables private-IP fetches via --allow-private-ips', () => {
    const cfg = readSecurityConfig(['--allow-private-ips'], {});
    expect(cfg.allowPrivateIps).toBe(true);
  });

  it('enables private-IP fetches via MCP_PDF_ALLOW_PRIVATE_IPS', () => {
    expect(readSecurityConfig([], { MCP_PDF_ALLOW_PRIVATE_IPS: 'true' }).allowPrivateIps).toBe(true);
    expect(readSecurityConfig([], { MCP_PDF_ALLOW_PRIVATE_IPS: '1' }).allowPrivateIps).toBe(true);
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
  const baseCfg = {
    allowHttp: true,
    allowedDirs: null,
    allowedHosts: null,
    allowPrivateIps: false,
  } as const;

  it('rejects all URLs when allowHttp is false', () => {
    expect(isUrlAllowed('https://example.com/file.pdf', { ...baseCfg, allowHttp: false })).toBe(false);
  });

  it('allows http(s) URLs when allowHttp and no host restriction', () => {
    expect(isUrlAllowed('https://example.com/file.pdf', baseCfg)).toBe(true);
    expect(isUrlAllowed('http://example.com/file.pdf', baseCfg)).toBe(true);
  });

  it('rejects non-http schemes regardless of policy', () => {
    expect(isUrlAllowed('file:///etc/passwd', baseCfg)).toBe(false);
    expect(isUrlAllowed('ftp://example.com/x.pdf', baseCfg)).toBe(false);
    expect(isUrlAllowed('data:application/pdf;base64,abc', baseCfg)).toBe(false);
  });

  it('enforces allowed hosts list (case-insensitive)', () => {
    const cfg = { ...baseCfg, allowedHosts: ['cdn.example.com'] } as const;
    expect(isUrlAllowed('https://CDN.example.com/x.pdf', cfg)).toBe(true);
    expect(isUrlAllowed('https://evil.com/x.pdf', cfg)).toBe(false);
  });

  it('returns false for malformed URLs', () => {
    expect(isUrlAllowed('not a url', baseCfg)).toBe(false);
  });
});

describe('isPrivateIp (SSS-07 SSRF guard)', () => {
  it('flags RFC1918 IPv4 ranges as private', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('172.16.0.5')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
  });

  it('flags loopback, link-local, multicast, CGNAT, and reserved as private', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true); // cloud metadata
    expect(isPrivateIp('0.0.0.0')).toBe(true);
    expect(isPrivateIp('100.64.0.1')).toBe(true); // CGNAT
    expect(isPrivateIp('224.0.0.1')).toBe(true); // multicast
  });

  it('accepts public IPv4 addresses', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('203.0.113.5')).toBe(false);
  });

  it('flags loopback and link-local IPv6 as private', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true); // unique local
    expect(isPrivateIp('fd12::1')).toBe(true);
    expect(isPrivateIp('ff02::1')).toBe(true); // multicast
  });

  it('unwraps IPv4-mapped IPv6 addresses', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
  });

  it('denies addresses that are not recognized as IPv4 or IPv6', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true);
  });
});

describe('assertUrlNotPrivate (SSS-07 SSRF guard)', () => {
  it('throws for literal private IPv4 hostnames without DNS', async () => {
    await expect(assertUrlNotPrivate('169.254.169.254')).rejects.toThrow(/non-public/);
    await expect(assertUrlNotPrivate('127.0.0.1')).rejects.toThrow(/non-public/);
  });

  it('throws for literal private IPv6 hostnames without DNS', async () => {
    await expect(assertUrlNotPrivate('::1')).rejects.toThrow(/non-public/);
  });

  it('resolves successfully for literal public IPs', async () => {
    await expect(assertUrlNotPrivate('8.8.8.8')).resolves.toBeUndefined();
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
    const allowed = canonical('/tmp/sandbox-allowed');
    process.env['MCP_PDF_ALLOWED_DIRS'] = allowed;
    __resetSecurityConfigForTests();

    const target = path.join(allowed, 'doc.pdf');
    expect(resolvePath(target)).toBe(target);
  });

  it('rejects a symlink inside an allowed dir that points outside (SSS-03)', () => {
    const sandbox = fs.mkdtempSync(path.join(canonical('/tmp'), 'sandbox-'));
    const outsideDir = fs.mkdtempSync(path.join(canonical('/tmp'), 'outside-'));
    const outsideFile = path.join(outsideDir, 'secret.txt');
    fs.writeFileSync(outsideFile, 'secret');
    const escapeLink = path.join(sandbox, 'escape');
    fs.symlinkSync(outsideFile, escapeLink);

    process.env['MCP_PDF_ALLOWED_DIRS'] = sandbox;
    __resetSecurityConfigForTests();

    try {
      expect(() => resolvePath(escapeLink)).toThrow(PdfError);
      expect(() => resolvePath(escapeLink)).toThrow(/Access denied/);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});
