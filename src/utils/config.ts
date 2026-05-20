// Security configuration for filesystem and HTTP access.
//
// Resolves runtime restrictions from CLI flags (process.argv) and environment
// variables. Designed for opt-in tightening: if nothing is configured, the
// server preserves its historical permissive behavior. Operators can lock the
// server down to a specific directory and disable HTTP entirely without code
// changes — important when running outside a sandbox (issue #274).
//
// Recognized configuration:
//   --allow-dir=<path>           (repeatable)   restrict reads to listed dirs
//   --allow-host=<host>          (repeatable)   restrict URL fetches to hosts
//   --no-http                                   disable URL sources entirely
//   --allow-private-ips                         allow URLs that resolve to
//                                               private/loopback/link-local IPs
//   MCP_PDF_ALLOWED_DIRS         path1:path2    (':' or ',' separated)
//   MCP_PDF_ALLOWED_HOSTS        host1,host2    (',' separated)
//   MCP_PDF_ALLOW_HTTP           "false" | "0"  disable URL sources
//   MCP_PDF_ALLOW_PRIVATE_IPS    "true" | "1"   allow private/loopback IPs
//
// Resolution rules:
//   - allowedDirs === null  → no filesystem restriction (default)
//   - allowedDirs === []    → empty list explicitly configured (blocks all)
//   - allowedHosts === null → no host restriction (default, when http allowed)
//   - allowHttp === false   → URL sources rejected before any network call
//   - allowPrivateIps       → false by default; SSRF guard rejects URLs that
//                             resolve to RFC1918, loopback, link-local, etc.

import dns from 'node:dns';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export interface SecurityConfig {
  /** Allowlisted directories (absolute, canonicalized). null = unrestricted. */
  allowedDirs: readonly string[] | null;
  /** Allow URL sources at all. */
  allowHttp: boolean;
  /** Allowlisted URL hosts (lowercased). null = any host (when allowHttp). */
  allowedHosts: readonly string[] | null;
  /** Allow URLs that resolve to private/loopback/link-local IPs. */
  allowPrivateIps: boolean;
}

const splitList = (value: string, separators: RegExp): string[] =>
  value
    .split(separators)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

/**
 * Canonicalize a path so the allowlist comparison sees the real target. Walks
 * up to the deepest existing ancestor when the path does not exist yet, so a
 * symlinked ancestor cannot mask the eventual real location.
 */
const canonicalizeDir = (p: string): string => {
  try {
    return fs.realpathSync(p);
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err.code === 'ENOENT' || err.code === 'ENOTDIR')
    ) {
      const parent = path.dirname(p);
      if (parent === p) return p;
      return path.join(canonicalizeDir(parent), path.basename(p));
    }
    throw err;
  }
};

const parseDirs = (values: string[]): string[] =>
  values.map((dir) => canonicalizeDir(path.resolve(path.normalize(dir))));

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  return fallback;
};

interface CliFlags {
  dirs: string[];
  hosts: string[];
  noHttp: boolean;
  allowPrivateIps: boolean;
}

const parseCliFlags = (argv: readonly string[]): CliFlags => {
  const dirs: string[] = [];
  const hosts: string[] = [];
  let noHttp = false;
  let allowPrivateIps = false;

  for (const arg of argv) {
    if (arg.startsWith('--allow-dir=')) {
      dirs.push(arg.slice('--allow-dir='.length));
    } else if (arg.startsWith('--allow-host=')) {
      hosts.push(arg.slice('--allow-host='.length).toLowerCase());
    } else if (arg === '--no-http') {
      noHttp = true;
    } else if (arg === '--allow-private-ips') {
      allowPrivateIps = true;
    }
  }

  return { dirs, hosts, noHttp, allowPrivateIps };
};

const envList = (
  raw: string | undefined,
  separators: RegExp,
  transform: (value: string) => string = (v) => v
): string[] => (raw ? splitList(raw, separators).map(transform) : []);

/**
 * Read a fresh security configuration from CLI args + env. Pure: callers can
 * pass in their own argv/env (used in tests) or rely on process defaults.
 */
export const readSecurityConfig = (
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): SecurityConfig => {
  const cli = parseCliFlags(argv);
  const envDirs = envList(env['MCP_PDF_ALLOWED_DIRS'], /[:,]/);
  const envHosts = envList(env['MCP_PDF_ALLOWED_HOSTS'], /,/, (h) => h.toLowerCase());

  const mergedDirs = [...cli.dirs, ...envDirs];
  const mergedHosts = [...cli.hosts, ...envHosts];

  return {
    allowedDirs: mergedDirs.length > 0 ? parseDirs(mergedDirs) : null,
    allowHttp: cli.noHttp ? false : parseBool(env['MCP_PDF_ALLOW_HTTP'], true),
    allowedHosts: mergedHosts.length > 0 ? mergedHosts : null,
    allowPrivateIps: cli.allowPrivateIps || parseBool(env['MCP_PDF_ALLOW_PRIVATE_IPS'], false),
  };
};

let cached: SecurityConfig | null = null;

/**
 * Cached singleton config — read once at first access, reused thereafter.
 */
export const getSecurityConfig = (): SecurityConfig => {
  if (cached === null) {
    cached = readSecurityConfig();
  }
  return cached;
};

/** Reset the cached singleton. Intended for tests only. */
export const __resetSecurityConfigForTests = (): void => {
  cached = null;
};

/**
 * Returns true when `absPath` lies inside one of the allowed directories.
 * Uses `path.relative` for robust containment that handles symlinks-as-paths
 * and trailing slashes correctly. The relative path must not escape (no
 * leading `..`) and must not be absolute.
 */
export const isPathAllowed = (absPath: string, allowedDirs: readonly string[] | null): boolean => {
  if (allowedDirs === null) return true;
  if (allowedDirs.length === 0) return false;

  const normalized = path.resolve(absPath);
  return allowedDirs.some((dir) => {
    const rel = path.relative(dir, normalized);
    if (rel === '') return true;
    if (rel.startsWith('..')) return false;
    if (path.isAbsolute(rel)) return false;
    return true;
  });
};

/**
 * Returns true when `urlString` resolves to a permitted http(s) URL given the
 * configured policy. Non-http(s) URLs (file:, data:, ftp:, etc.) are always
 * rejected — the loader treats `source.url` as a network resource.
 *
 * This is the cheap sync gate; SSRF protection against private IPs is layered
 * on top via {@link assertUrlNotPrivate} which performs DNS resolution.
 */
export const isUrlAllowed = (urlString: string, config: SecurityConfig): boolean => {
  if (!config.allowHttp) return false;

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  if (config.allowedHosts === null) return true;
  return config.allowedHosts.includes(parsed.hostname.toLowerCase());
};

// IPv4 private/loopback/link-local/multicast/reserved ranges that an SSRF
// guard should refuse to fetch from. Encoded as a table of predicates over
// `[a, b]` (the first two octets) to keep the dispatch readable.
const PRIVATE_IPV4_PREDICATES: ReadonlyArray<(a: number, b: number) => boolean> = [
  (a) => a === 10, // RFC1918 10.0.0.0/8
  (a, b) => a === 172 && b >= 16 && b <= 31, // RFC1918 172.16.0.0/12
  (a, b) => a === 192 && b === 168, // RFC1918 192.168.0.0/16
  (a) => a === 127, // loopback 127.0.0.0/8
  (a, b) => a === 169 && b === 254, // link-local 169.254.0.0/16
  (a) => a === 0, // 0.0.0.0/8 "this network"
  (a, b) => a === 100 && b >= 64 && b <= 127, // CGNAT 100.64.0.0/10
  (a) => a >= 224, // multicast + reserved 224.0.0.0+
];

const isPrivateIpv4 = (ip: string): boolean => {
  const parts = ip.split('.').map((s) => Number.parseInt(s, 10));
  const a = parts[0];
  const b = parts[1];
  if (a === undefined || b === undefined) return true;
  return PRIVATE_IPV4_PREDICATES.some((pred) => pred(a, b));
};

const isPrivateIpv6 = (ip: string): boolean => {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
  if (lower.startsWith('fe80')) return true; // link-local fe80::/10
  if (lower.startsWith('ff')) return true; // multicast
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — extract the embedded v4 and recurse.
    const tail = lower.slice('::ffff:'.length);
    if (net.isIPv4(tail)) return isPrivateIpv4(tail);
  }
  return false;
};

/**
 * Returns true when `ip` is a private, loopback, link-local, multicast, or
 * otherwise non-public address. Conservative: any address that is not clearly
 * a routable public IP returns true (denied). Used by the SSRF guard
 * (SSS-07) to keep URL fetches off the local network and metadata endpoints.
 */
export const isPrivateIp = (ip: string): boolean => {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true; // unrecognized → deny
};

/**
 * Throws if `hostname` resolves to any non-public IP (SSS-07). Caller should
 * skip this when {@link SecurityConfig.allowPrivateIps} is true. DNS lookups
 * are made with `{ all: true }` so the check covers every A/AAAA record, not
 * just the first one the resolver returns.
 */
export const assertUrlNotPrivate = async (hostname: string): Promise<void> => {
  // If the hostname is already a literal IP, check it directly without DNS.
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`URL host '${hostname}' resolves to a non-public address (SSRF protection).`);
    }
    return;
  }

  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch {
    throw new Error(`URL host '${hostname}' could not be resolved.`);
  }

  if (addresses.length === 0) {
    throw new Error(`URL host '${hostname}' resolved to no addresses.`);
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(`URL host '${hostname}' resolves to a non-public address (SSRF protection).`);
    }
  }
};
