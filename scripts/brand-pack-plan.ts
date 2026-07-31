#!/usr/bin/env bun
/**
 * Brand pack plan — validates brand publish readiness without npm auth.
 * Does not publish. Prints the dual-package plan for this product repo.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name?: string;
  version?: string;
  bin?: Record<string, string>;
  exports?: Record<string, unknown>;
};
const server = existsSync(join(root, 'server.json'))
  ? (JSON.parse(readFileSync(join(root, 'server.json'), 'utf8')) as { title?: string })
  : {};

const brandBins = Object.keys(pkg.bin ?? {}).filter((b) => !b.includes('reader') && !b.includes('mcp'));
const plan = {
  repoRoot: root,
  transitionalName: pkg.name,
  version: pkg.version,
  brandBins,
  marketplaceTitle: server.title,
  hasSkill: existsSync(join(root, 'skills')),
  brandPublishDoc: existsSync(join(root, 'docs/BRAND_PUBLISH.md')),
  npmAuthRequiredForLivePublish: true,
  steps: [
    'Build/test/release-gate green on tip',
    `Publish transitional package ${pkg.name} via existing release train`,
    'Optional: pack with package.json name overridden to brand id from docs/BRAND_PUBLISH.md',
    'Registry readback proof for both names if dual-published',
  ],
  ok: Boolean(pkg.name && pkg.version && server.title && existsSync(join(root, 'docs/BRAND_PUBLISH.md'))),
};
console.log(JSON.stringify(plan, null, 2));
process.exit(plan.ok ? 0 : 1);
