import path from 'node:path';
import { getSecurityConfig, isPathAllowed } from './config.js';
import { ErrorCode, PdfError } from './errors.js';

// Use the server's current working directory as the project root.
// This relies on the process launching the server to set the CWD correctly.
export const PROJECT_ROOT = process.cwd();

/**
 * Resolves a user-provided path, accepting both absolute and relative paths.
 * Relative paths are resolved against the current working directory (PROJECT_ROOT).
 *
 * When the operator has configured filesystem allowlists (via --allow-dir or
 * MCP_PDF_ALLOWED_DIRS), the resolved path must lie inside one of them — this
 * is the access-control mechanism for issue #274. Without configuration the
 * server preserves its historical permissive behavior.
 *
 * @param userPath The path provided by the user (absolute or relative).
 * @returns The resolved absolute path.
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

  const { allowedDirs } = getSecurityConfig();
  if (!isPathAllowed(resolved, allowedDirs)) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      `Access denied: path '${userPath}' is outside the allowed directories.`
    );
  }

  return resolved;
};
