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
//   MCP_PDF_ALLOWED_DIRS         path1:path2    (':' or ',' separated)
//   MCP_PDF_ALLOWED_HOSTS        host1,host2    (',' separated)
//   MCP_PDF_ALLOW_HTTP           "false" | "0"  disable URL sources
//
// Resolution rules:
//   - allowedDirs === null  → no filesystem restriction (default)
//   - allowedDirs === []    → empty list explicitly configured (blocks all)
//   - allowedHosts === null → no host restriction (default, when http allowed)
//   - allowHttp === false   → URL sources rejected before any network call

import path from 'node:path';

export interface SecurityConfig {
  /** Allowlisted directories (absolute, normalized). null = unrestricted. */
  allowedDirs: readonly string[] | null;
  /** Allow URL sources at all. */
  allowHttp: boolean;
  /** Allowlisted URL hosts (lowercased). null = any host (when allowHttp). */
  allowedHosts: readonly string[] | null;
}

const splitList = (value: string, separators: RegExp): string[] =>
  value
    .split(separators)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const parseDirs = (values: string[]): string[] =>
  values.map((dir) => path.resolve(path.normalize(dir)));

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
}

const parseCliFlags = (argv: readonly string[]): CliFlags => {
  const dirs: string[] = [];
  const hosts: string[] = [];
  let noHttp = false;

  for (const arg of argv) {
    if (arg.startsWith('--allow-dir=')) {
      dirs.push(arg.slice('--allow-dir='.length));
    } else if (arg.startsWith('--allow-host=')) {
      hosts.push(arg.slice('--allow-host='.length).toLowerCase());
    } else if (arg === '--no-http') {
      noHttp = true;
    }
  }

  return { dirs, hosts, noHttp };
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
