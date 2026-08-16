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
  'crates/pdf-reader-mcp-server/src/lib.rs',
  'package.json',
  'server.json',
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

/** A file emitted by the version/publish workflow after source review. */
export const isReleaseOnlyPath = (relativePath: string): boolean =>
  isSafeRelativePath(relativePath) &&
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
