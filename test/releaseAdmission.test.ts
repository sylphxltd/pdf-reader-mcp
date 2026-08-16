import { describe, expect, test } from 'bun:test';
import {
  isAdmissionPinPath,
  isPermittedReviewedDescendantPath,
  isReleaseOnlyPath,
} from '../scripts/release-admission-paths.ts';

describe('Citra release admission', () => {
  test('permits only metadata pins and generated release descendants', () => {
    expect(isAdmissionPinPath('docs/specs/pure-rust-capability-matrix.json')).toBe(true);
    expect(isAdmissionPinPath('verification/review.json')).toBe(true);
    expect(isReleaseOnlyPath('.changeset/secure-citra-parser.md')).toBe(true);
    expect(isReleaseOnlyPath('benchmark-artifacts/pdf_sota_release_gate.json')).toBe(true);
    expect(isReleaseOnlyPath('packages/citra-linux-x64-gnu/package.json')).toBe(true);
    expect(isReleaseOnlyPath('crates/pdf-reader-mcp-server/src/lib.rs')).toBe(true);
    expect(isPermittedReviewedDescendantPath('package.json')).toBe(true);

    for (const path of [
      'src/runtime-entry.ts',
      'src/native/platform-package-map.ts',
      'crates/pdf-reader-core/src/source_access.rs',
      'scripts/check-verified-candidate-admission.ts',
      'docs/specs/capability-first-admission-contract.md',
      'dist/pure-rust.js',
      '.github/workflows/publish-npm.yml',
      'Dockerfile',
    ]) {
      expect(isPermittedReviewedDescendantPath(path)).toBe(false);
    }
  });
  test('rejects path traversal rather than treating it as release metadata', () => {
    for (const path of [
      'verification/../src/runtime-entry.ts',
      '/verification/review.json',
      '.changeset//release.md',
    ]) {
      expect(isPermittedReviewedDescendantPath(path)).toBe(false);
    }
  });
});
