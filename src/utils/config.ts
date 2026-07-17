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

const hextetsToIpv4 = (hi: number, lo: number): string =>
  `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;

const parseHextetParts = (parts: readonly string[]): number[] | null => {
  if (parts.length !== 8) return null;
  const hextets = parts.map((h) => Number.parseInt(h || '0', 16));
  return hextets.every((h) => !Number.isNaN(h) && h >= 0 && h <= 0xffff) ? hextets : null;
};

/** Mixed notation: trailing IPv4 dotted-quad → two hextets. null = invalid. */
const replaceIpv4TailWithHextets = (s: string): string | null => {
  const v4Tail = s.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (!v4Tail) return s;
  const dotted = v4Tail[1];
  if (dotted === undefined) return null;
  const octets = dotted.split('.').map((x) => Number.parseInt(x, 10));
  const a = octets[0];
  const b = octets[1];
  const c = octets[2];
  const d = octets[3];
  if (
    octets.length !== 4 ||
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined ||
    octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)
  ) {
    return null;
  }
  const hi = ((a << 8) | b).toString(16);
  const lo = ((c << 8) | d).toString(16);
  return `${s.slice(0, -dotted.length)}${hi}:${lo}`;
};

const expandCompressedIpv6 = (s: string): number[] | null => {
  if (s.indexOf('::') !== s.lastIndexOf('::')) return null;
  const [leftRaw, rightRaw] = s.split('::');
  const left = leftRaw === undefined || leftRaw === '' ? [] : leftRaw.split(':');
  const right = rightRaw === undefined || rightRaw === '' ? [] : rightRaw.split(':');
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  return parseHextetParts([...left, ...Array.from({ length: missing }, () => '0'), ...right]);
};

/**
 * Expand an IPv6 literal to eight 16-bit hextets.
 * Handles `::` compression, zone indices, and dotted-quad IPv4 tails
 * (`::ffff:127.0.0.1`). Returns null when the input is not a parseable IPv6
 * address — callers treat that as non-public (deny).
 */
const expandIpv6Hextets = (ip: string): number[] | null => {
  let s = ip.toLowerCase();
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);

  const normalized = replaceIpv4TailWithHextets(s);
  if (normalized === null) return null;
  if (normalized.includes('::')) return expandCompressedIpv6(normalized);
  return parseHextetParts(normalized.split(':'));
};

type Hextet8 = readonly [number, number, number, number, number, number, number, number];

const asHextet8 = (hextets: readonly number[]): Hextet8 | null => {
  if (hextets.length !== 8) return null;
  const h0 = hextets[0];
  const h1 = hextets[1];
  const h2 = hextets[2];
  const h3 = hextets[3];
  const h4 = hextets[4];
  const h5 = hextets[5];
  const h6 = hextets[6];
  const h7 = hextets[7];
  if (
    h0 === undefined ||
    h1 === undefined ||
    h2 === undefined ||
    h3 === undefined ||
    h4 === undefined ||
    h5 === undefined ||
    h6 === undefined ||
    h7 === undefined
  ) {
    return null;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7];
};

/** Prefixes that are always non-public (no embedded-v4 extraction needed). */
const IPV6_ALWAYS_PRIVATE: ReadonlyArray<(h: Hextet8) => boolean> = [
  // unspecified :: and loopback ::1
  ([h0, h1, h2, h3, h4, h5, h6, h7]) =>
    h0 === 0 &&
    h1 === 0 &&
    h2 === 0 &&
    h3 === 0 &&
    h4 === 0 &&
    h5 === 0 &&
    h6 === 0 &&
    (h7 === 0 || h7 === 1),
  // unique local fc00::/7
  ([h0]) => (h0 & 0xfe00) === 0xfc00,
  // link-local fe80::/10
  ([h0]) => (h0 & 0xffc0) === 0xfe80,
  // multicast ff00::/8
  ([h0]) => (h0 & 0xff00) === 0xff00,
  // NAT64 local-use 64:ff9b:1::/48 (RFC 8215) — block whole prefix
  ([h0, h1, h2]) => h0 === 0x64 && h1 === 0xff9b && h2 === 1,
  // Teredo 2001:0000::/32 (RFC 4380)
  ([h0, h1]) => h0 === 0x2001 && h1 === 0,
  // documentation 2001:db8::/32
  ([h0, h1]) => h0 === 0x2001 && h1 === 0xdb8,
  // discard-only 100::/64
  ([h0, h1, h2, h3]) => h0 === 0x100 && h1 === 0 && h2 === 0 && h3 === 0,
];

/**
 * Transition / mapped forms that embed an IPv4 address. When matched, the
 * embedded v4 is re-checked with {@link isPrivateIpv4}.
 */
const IPV6_EMBEDDED_V4: ReadonlyArray<{
  match: (h: Hextet8) => boolean;
  extract: (h: Hextet8) => readonly [number, number];
}> = [
  // IPv4-mapped ::ffff:0:0/96
  {
    match: ([h0, h1, h2, h3, h4, h5]) =>
      h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0xffff,
    extract: ([, , , , , , h6, h7]) => [h6, h7],
  },
  // Deprecated IPv4-compatible ::/96 (non-unspecified / non-loopback already handled)
  {
    match: ([h0, h1, h2, h3, h4, h5]) =>
      h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0,
    extract: ([, , , , , , h6, h7]) => [h6, h7],
  },
  // NAT64 well-known 64:ff9b::/96 (RFC 6052)
  {
    match: ([h0, h1, h2, h3, h4, h5]) =>
      h0 === 0x64 && h1 === 0xff9b && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0,
    extract: ([, , , , , , h6, h7]) => [h6, h7],
  },
  // 6to4 2002::/16 (RFC 3056) — IPv4 in bits 16–47
  {
    match: ([h0]) => h0 === 0x2002,
    extract: ([, h1, h2]) => [h1, h2],
  },
];

/**
 * IPv6 SSRF denylist. Covers ULA / link-local / multicast, IPv4-mapped, and
 * IPv6 transition mechanisms that embed IPv4 (NAT64, 6to4, Teredo) so private
 * IPv4 targets cannot be reached by re-encoding them as IPv6 literals.
 *
 * See GHSA-f3xw-ff5r-rj7c.
 */
const isPrivateIpv6 = (ip: string): boolean => {
  const expanded = expandIpv6Hextets(ip);
  if (expanded === null) return true; // unparseable → deny closed
  const h = asHextet8(expanded);
  if (h === null) return true;
  if (IPV6_ALWAYS_PRIVATE.some((pred) => pred(h))) return true;
  for (const rule of IPV6_EMBEDDED_V4) {
    if (rule.match(h)) {
      const [hi, lo] = rule.extract(h);
      return isPrivateIpv4(hextetsToIpv4(hi, lo));
    }
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
