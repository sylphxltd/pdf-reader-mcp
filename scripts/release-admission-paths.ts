/**
 * Paths that may change after a reviewed Citra source candidate without
 * changing the executable implementation.
 *
 * A release commit is still required to descend from the reviewed candidate.
 * These paths cover only release metadata, generated evidence, and the native
 * server version stamp emitted by the repository's release-version script.
 */
const ADMISSION_PIN_EXACT = new Set([
  'docs/specs/pure-rust-capability-matrix.json',
]);

const RELEASE_ONLY_EXACT = new Set([
  'CHANGELOG.md',
  'bun.lock',
  'package.json',
  'server.json',
]);

const SERVER_VERSION_ONLY_EXACT = new Set([
  'crates/pdf-reader-mcp-server/src/lib.rs',
]);

const RELEASE_ONLY_PREFIXES = ['.changeset/', 'benchmark-artifacts/'];

const NATIVE_PACKAGE_MANIFEST = /^packages\/citra-[^/]+\/package\.json$/;

const isSafeRelativePath = (relativePath: string): boolean =>
  relativePath.length > 0 &&
  !relativePath.startsWith('/') &&
  !relativePath.split('/').some((segment) => segment === '.' || segment === '..' || segment === '');

/** A metadata/evidence pin that cannot alter the shipped implementation. */
export const isAdmissionPinPath = (relativePath: string): boolean =>
  isSafeRelativePath(relativePath) &&
  (ADMISSION_PIN_EXACT.has(relativePath) || relativePath.startsWith('verification/'));

/** The only Rust source file the release workflow may rewrite, and only its version stamp. */
export const isServerVersionOnlyPath = (relativePath: string): boolean =>
  isSafeRelativePath(relativePath) && SERVER_VERSION_ONLY_EXACT.has(relativePath);

/** Accept only a generated one-line SERVER_VERSION replacement in the release rewrite. */
export const isServerVersionOnlyPatch = (patch: string): boolean => {
  let changedLineCount = 0;
  for (const rawLine of patch.split(/\r?\n/)) {
    if (rawLine.startsWith('--- ') || rawLine.startsWith('+++ ')) continue;
    if (!rawLine.startsWith('+') && !rawLine.startsWith('-')) continue;
    const line = rawLine.slice(1).trim();
    if (!/^pub const SERVER_VERSION: &str = "[^"\r\n]+";$/.test(line)) return false;
    changedLineCount += 1;
  }
  return changedLineCount > 0;
};

/** A file emitted by the version/publish workflow after source review. */
export const isReleaseOnlyPath = (relativePath: string): boolean =>
  isSafeRelativePath(relativePath) &&
  !SERVER_VERSION_ONLY_EXACT.has(relativePath) &&
  (RELEASE_ONLY_EXACT.has(relativePath) ||
    RELEASE_ONLY_PREFIXES.some((prefix) => relativePath.startsWith(prefix)) ||
    NATIVE_PACKAGE_MANIFEST.test(relativePath));

/**
 * A reviewed candidate may be followed only by admission metadata pins or the
 * repository's generated release files. Runtime/source changes require a new
 * review candidate SHA.
 */
export const isPermittedReviewedDescendantPath = (relativePath: string): boolean =>
  isAdmissionPinPath(relativePath) || isReleaseOnlyPath(relativePath);
