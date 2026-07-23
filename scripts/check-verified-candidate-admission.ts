#!/usr/bin/env bun
/**
 * Evidence-driven release admission for the pure-Rust replacement program.
 *
 * Replaces the hard-coded "exit 1" publish freeze once ADR-0005 capability-first
 * evidence and whole-product review artifacts are present.
 *
 * Modes:
 * - freeze: productTruth.publishFreeze=true → fail closed (no registry publish)
 * - publish-allowed: publishFreeze=false and dropInFor3014=false → allow publish of
 *   non-default pure-Rust progress packages
 * - sole-runtime: publishFreeze=false and dropInFor3014=true → require stronger
 *   package-default pure-Rust evidence
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const failures: string[] = [];

const matrix = JSON.parse(
  readFileSync(join(root, 'docs/specs/pure-rust-capability-matrix.json'), 'utf8')
) as {
  productTruth: {
    publishFreeze: boolean;
    dropInFor3014: boolean;
    pureRustStatus: string;
    admissionBar?: string;
    publishedStable?: string;
    publishedImplementation?: string;
  };
  admissionProgram?: {
    mode?: string;
    publishFreeze?: boolean;
    dropInFor3014?: boolean;
    wholeProductReview?: {
      status?: string;
      candidateSha?: string;
      evidence?: string;
      unfreezeAuthorized?: boolean;
      tsRetirementAuthorized?: boolean;
    };
    unfreezeAuthorized?: boolean;
    soleRuntimeAuthorized?: boolean;
  };
};

const truth = matrix.productTruth;
const admission = matrix.admissionProgram ?? {};
const review = admission.wholeProductReview ?? {};

if (admission.mode !== 'capability-first-semantic-compatibility') {
  failures.push('admissionProgram.mode must be capability-first-semantic-compatibility');
}
if (truth.admissionBar !== 'capability-first-semantic-compatibility') {
  failures.push('productTruth.admissionBar must remain capability-first-semantic-compatibility');
}
if (admission.publishFreeze !== truth.publishFreeze) {
  failures.push('admissionProgram.publishFreeze must match productTruth.publishFreeze');
}
if (admission.dropInFor3014 !== truth.dropInFor3014) {
  failures.push('admissionProgram.dropInFor3014 must match productTruth.dropInFor3014');
}

const requiredFiles = [
  'docs/adr/0005-capability-first-semantic-compatibility.md',
  'docs/specs/capability-first-admission-contract.md',
  'docs/specs/nonclaim-reclassification-ledger.json',
  'docs/specs/agent-task-corpus/baselines/typescript-v3.0.14.local.json',
  'docs/specs/agent-task-corpus/baselines/typescript-v3.0.14.public-url.json',
  'docs/specs/semantic-contracts/semantic-public-url-corpus.json',
  'src/pure-rust.ts',
  'scripts/smoke-native-launcher.ts',
  'scripts/smoke-native-package-resolve.ts',
];
for (const rel of requiredFiles) {
  if (!existsSync(join(root, rel))) failures.push(`missing required evidence file: ${rel}`);
}

if (!review.evidence || !existsSync(join(root, review.evidence))) {
  failures.push('wholeProductReview.evidence artifact missing');
} else {
  const evidence = JSON.parse(readFileSync(join(root, review.evidence), 'utf8')) as {
    outcome?: string;
    unfreezeAuthorized?: boolean;
    tsRetirementAuthorized?: boolean;
    candidate?: { sha?: string };
  };
  if (!String(evidence.outcome ?? '').startsWith('review_pass')) {
    failures.push(`review evidence outcome is not review_pass_*: ${String(evidence.outcome)}`);
  }
  if (review.candidateSha && evidence.candidate?.sha && review.candidateSha !== evidence.candidate.sha) {
    failures.push('review candidateSha does not match evidence artifact');
  }
}

if (truth.publishFreeze === true) {
  // Hard freeze path.
  if (truth.dropInFor3014 !== false) {
    failures.push('dropInFor3014 must be false while publishFreeze=true');
  }
  failures.push(
    'PUBLISH FREEZE active: productTruth.publishFreeze=true blocks registry publish (intentional)'
  );
} else {
  // Publish allowed. Require explicit authorization from admission/review.
  const authorized =
    admission.unfreezeAuthorized === true ||
    review.unfreezeAuthorized === true ||
    review.status === 'review_pass_unfreeze_authorized' ||
    String(review.status ?? '').includes('sole_runtime');
  if (!authorized) {
    failures.push(
      'publishFreeze=false requires admissionProgram.unfreezeAuthorized or review.unfreezeAuthorized'
    );
  }
  if (truth.dropInFor3014 === true) {
    if (truth.pureRustStatus === 'experimental-opt-in') {
      failures.push('dropInFor3014=true cannot remain experimental-opt-in');
    }
    if (!String(truth.pureRustStatus ?? '').includes('default')) {
      failures.push('dropInFor3014=true requires pureRustStatus to indicate default pure-Rust runtime');
    }
    if (admission.soleRuntimeAuthorized !== true && review.tsRetirementAuthorized !== true) {
      failures.push(
        'dropInFor3014=true requires soleRuntimeAuthorized or review.tsRetirementAuthorized'
      );
    }
    // Capability-first: do not require every matrix cell FULL.
    if (!String(truth.publishedImplementation ?? '').toLowerCase().includes('rust')) {
      failures.push(
        'dropInFor3014=true requires productTruth.publishedImplementation to identify pure-Rust'
      );
    }
  }
}

if (failures.length) {
  console.error(failures.map((line) => `[verified-candidate-admission] ${line}`).join('\n'));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      profile: 'verified_candidate_admission',
      pass: true,
      publishFreeze: truth.publishFreeze,
      dropInFor3014: truth.dropInFor3014,
      pureRustStatus: truth.pureRustStatus,
      reviewStatus: review.status ?? null,
      candidateSha: review.candidateSha ?? null,
    },
    null,
    2
  )
);
console.log('[verified-candidate-admission] PASS');
