#!/usr/bin/env bun
/** Validate agent-task corpus scaffold for ADR-0005 quality parity. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const manifestPath = join(root, 'docs/specs/agent-task-corpus/manifest.json');
const failures: string[] = [];

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  schemaVersion: number;
  authority?: string;
  calibration?: { inventedNumericThresholdsForbidden?: boolean };
  fixtures?: Record<string, string>;
  taskFiles?: string[];
  baselineArtifact?: string;
};

if (manifest.schemaVersion !== 1) failures.push('manifest schemaVersion must be 1');
if (manifest.authority !== 'ADR-0005') failures.push('manifest authority must be ADR-0005');
if (manifest.calibration?.inventedNumericThresholdsForbidden !== true) {
  failures.push('manifest must forbid invented numeric thresholds');
}
for (const [name, fixture] of Object.entries(manifest.fixtures ?? {})) {
  if (!existsSync(join(root, fixture))) failures.push(`fixture missing for ${name}: ${fixture}`);
}

const taskFiles = manifest.taskFiles ?? [];
if (taskFiles.length < 4) failures.push('manifest must reference at least four tasks');
if (manifest.baselineArtifact) {
  const baselinePath = join(root, 'docs/specs/agent-task-corpus', manifest.baselineArtifact);
  if (!existsSync(baselinePath)) {
    failures.push(`baselineArtifact missing: ${manifest.baselineArtifact}`);
  }
}

const ids = new Set<string>();
const contractIds = new Set<string>();
for (const rel of taskFiles) {
  const path = join(root, 'docs/specs/agent-task-corpus', rel);
  if (!existsSync(path)) {
    failures.push(`task file missing: ${rel}`);
    continue;
  }
  const task = JSON.parse(readFileSync(path, 'utf8')) as {
    id?: string;
    tool?: string;
    fixture?: string;
    input?: unknown;
    acceptance?: Record<string, unknown>;
    contractIds?: string[];
  };
  if (!task.id) failures.push(`${rel} missing id`);
  if (task.id && ids.has(task.id)) failures.push(`duplicate task id ${task.id}`);
  if (task.id) ids.add(task.id);
  if (!['read_pdf', 'search_pdf', 'pdf_evidence'].includes(String(task.tool))) {
    failures.push(`${rel} has invalid tool`);
  }
  if (!task.fixture || !existsSync(join(root, task.fixture))) {
    failures.push(`${rel} fixture missing`);
  }
  if (!task.input || typeof task.input !== 'object') failures.push(`${rel} input must be object`);
  if (!task.acceptance || typeof task.acceptance !== 'object') {
    failures.push(`${rel} acceptance must be object`);
  }
  if (!Array.isArray(task.contractIds) || task.contractIds.length === 0) {
    failures.push(`${rel} must link contractIds`);
  }
  for (const id of task.contractIds ?? []) contractIds.add(id);
}

for (const id of contractIds) {
  const contractPath = join(root, 'docs/specs/semantic-contracts', `${id}.json`);
  if (!existsSync(contractPath)) failures.push(`task corpus links missing contract: ${id}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`[check-agent-task-corpus] PASS ${taskFiles.length} tasks under ADR-0005`);
