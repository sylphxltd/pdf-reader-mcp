import fs from 'node:fs';
import path from 'node:path';
import { getSecurityConfig, isPathAllowed } from './config.js';
import { ErrorCode, PdfError } from './errors.js';

// Use the server's current working directory as the project root.
// This relies on the process launching the server to set the CWD correctly.
export const PROJECT_ROOT = process.cwd();

/**
 * Canonicalize symlinks in `p` so the allowlist check sees the real target,
 * not a link that escapes the sandbox. When `p` does not exist yet, walk up
 * to the deepest existing ancestor, realpath that, and re-attach the missing
 * tail — this stops an attacker from hiding the escape behind a symlinked
 * ancestor directory while still allowing reads of paths that the caller
 * expects to fail later with ENOENT.
 */
const canonicalize = (p: string): string => {
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
      return path.join(canonicalize(parent), path.basename(p));
    }
    throw err;
  }
};

/**
 * Resolves a user-provided path, accepting both absolute and relative paths.
 * Relative paths are resolved against the current working directory (PROJECT_ROOT).
 *
 * Symlinks are canonicalized via `fs.realpathSync` before the allowlist check
 * so a link inside an allowed directory cannot point outside it (SSS-03).
 *
 * When the operator has configured filesystem allowlists (via --allow-dir or
 * MCP_PDF_ALLOWED_DIRS), the resolved path must lie inside one of them — this
 * is the access-control mechanism for issue #274. Without configuration the
 * server preserves its historical permissive behavior.
 *
 * @param userPath The path provided by the user (absolute or relative).
 * @returns The canonical absolute path.
 * @throws {PdfError} If path is invalid or access is denied.
 */
export const resolvePath = (userPath: string): string => {
  if (typeof userPath !== 'string') {
    throw new PdfError(ErrorCode.InvalidParams, 'Path must be a string.');
  }

  const normalizedUserPath = path.normalize(userPath);

  // Resolve the path (absolute paths stay as-is, relative paths resolve against PROJECT_ROOT)
  const resolved = path.isAbsolute(normalizedUserPath)
    ? normalizedUserPath
    : path.resolve(PROJECT_ROOT, normalizedUserPath);

  const canonical = canonicalize(resolved);

  const { allowedDirs } = getSecurityConfig();
  if (!isPathAllowed(canonical, allowedDirs)) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      `Access denied: path '${userPath}' is outside the allowed directories.`
    );
  }

  return canonical;
};
