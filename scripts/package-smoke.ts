import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type SmokeStatus = 'passed' | 'failed';

interface PackageSmokeCheck {
  id: string;
  status: SmokeStatus;
  message: string;
  evidence?: Record<string, unknown> | undefined;
}

export interface PackageSmokeReport {
  profile: 'pdf_package_smoke';
  generated_at: string;
  status: SmokeStatus;
  tarball_file?: string | undefined;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  checks: PackageSmokeCheck[];
}

type JsonRecord = Record<string, unknown>;

const addCheck = (
  checks: PackageSmokeCheck[],
  id: string,
  pass: boolean,
  message: string,
  evidence?: Record<string, unknown>
) => {
  checks.push({
    id,
    status: pass ? 'passed' : 'failed',
    message,
    evidence,
  });
};

const summarizeChecks = (checks: PackageSmokeCheck[]): PackageSmokeReport['summary'] => ({
  total: checks.length,
  passed: checks.filter((check) => check.status === 'passed').length,
  failed: checks.filter((check) => check.status === 'failed').length,
});

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const readJson = async (filePath: string): Promise<JsonRecord | undefined> => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
};

const readTextPrefix = async (filePath: string, byteLength = 128): Promise<string | undefined> => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw.slice(0, byteLength);
  } catch {
    return undefined;
  }
};

const summarizePublicCorpusManifest = (
  manifest: JsonRecord | undefined
): { total_cases: number; url_cases_with_metadata: number } => {
  const cases = Array.isArray(manifest?.cases) ? manifest.cases : [];
  const urlCasesWithMetadata = cases.filter(
    (entry) =>
      isRecord(entry) &&
      isNonEmptyString(entry.url) &&
      isNonEmptyString(entry.sha256) &&
      isNonEmptyString(entry.source_label) &&
      isNonEmptyString(entry.source_homepage) &&
      isNonEmptyString(entry.source_rights) &&
      isNonEmptyString(entry.source_retrieved_at)
  ).length;

  return {
    total_cases: cases.length,
    url_cases_with_metadata: urlCasesWithMetadata,
  };
};

export const findPackedTarballPath = async (
  packOutput: string,
  destinationDir: string
): Promise<string | undefined> => {
  const outputPath = packOutput
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.endsWith('.tgz') && path.isAbsolute(line));

  if (outputPath && (await fileExists(outputPath))) {
    return outputPath;
  }

  const entries = fs.readdirSync(destinationDir);
  const tarballs = entries.filter((entry) => entry.endsWith('.tgz')).sort();
  const fallback = tarballs.at(-1);
  return fallback ? path.join(destinationDir, fallback) : undefined;
};

export const validateExtractedPackage = async (
  packageDir: string
): Promise<PackageSmokeCheck[]> => {
  const checks: PackageSmokeCheck[] = [];
  const packageJsonPath = path.join(packageDir, 'package.json');
  const packageJson = await readJson(packageJsonPath);
  const distIndexPath = path.join(packageDir, 'dist', 'index.js');
  const publicCorpusManifestPath = path.join(packageDir, 'corpus', 'public-url-corpus.json');
  const distIndexPrefix = await readTextPrefix(distIndexPath);
  const publicCorpusManifest = await readJson(publicCorpusManifestPath);
  const publicCorpusSummary = summarizePublicCorpusManifest(publicCorpusManifest);
  const bin = isRecord(packageJson?.bin) ? packageJson.bin : undefined;
  const exportsField = isRecord(packageJson?.exports) ? packageJson.exports : undefined;

  addCheck(checks, 'package-json:present', packageJson !== undefined, 'package.json exists and is valid JSON', {
    path: 'package/package.json',
    name: packageJson?.name,
    version: packageJson?.version,
  });
  addCheck(
    checks,
    'runtime:dist-index',
    await fileExists(distIndexPath),
    'published package contains dist/index.js',
    { path: 'package/dist/index.js' }
  );
  addCheck(
    checks,
    'runtime:shebang',
    distIndexPrefix?.startsWith('#!/usr/bin/env node') === true,
    'dist/index.js keeps the executable Node shebang'
  );
  addCheck(
    checks,
    'corpus:public-url-manifest',
    await fileExists(publicCorpusManifestPath),
    'published package includes the opt-in public URL corpus manifest',
    { path: 'package/corpus/public-url-corpus.json' }
  );
  addCheck(
    checks,
    'corpus:public-url-manifest-shape',
    publicCorpusSummary.total_cases > 0 &&
      publicCorpusSummary.total_cases === publicCorpusSummary.url_cases_with_metadata,
    'public URL corpus manifest contains URL cases with source metadata and SHA256 values',
    publicCorpusSummary
  );
  addCheck(
    checks,
    'package-json:bin',
    bin?.['pdf-reader-mcp'] === './dist/index.js',
    'package bin points to the published runtime artifact',
    { actual: bin?.['pdf-reader-mcp'] }
  );
  addCheck(
    checks,
    'package-json:exports',
    exportsField?.['.'] === './dist/index.js',
    'package export points to the published runtime artifact',
    { actual: exportsField?.['.'] }
  );

  const files = Array.isArray(packageJson?.files) ? packageJson.files : [];
  addCheck(
    checks,
    'package-json:files',
    (files.includes('dist/') || files.includes('dist')) &&
      (files.includes('corpus/') || files.includes('corpus')),
    'package files allowlist includes dist and corpus',
    { files }
  );

  return checks;
};

const listTarballEntries = async (tarballPath: string): Promise<string[]> => {
  const { stdout } = await execFileAsync('tar', ['-tzf', tarballPath], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const buildPackageSmokeReport = async (cwd = process.cwd()): Promise<PackageSmokeReport> => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-reader-package-smoke-'));
  const checks: PackageSmokeCheck[] = [];
  let tarballPath: string | undefined;

  try {
    const { stdout } = await execFileAsync('bun', ['pm', 'pack', '--destination', tempDir], {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
    tarballPath = await findPackedTarballPath(stdout, tempDir);
    addCheck(checks, 'pack:tarball-created', tarballPath !== undefined, 'bun pack produced a tarball', {
      tarball_file: tarballPath ? path.basename(tarballPath) : undefined,
    });

    if (!tarballPath) {
      const summary = summarizeChecks(checks);
      return {
        profile: 'pdf_package_smoke',
        generated_at: new Date().toISOString(),
        status: 'failed',
        summary,
        checks,
      };
    }

    const tarballEntries = await listTarballEntries(tarballPath);
    addCheck(
      checks,
      'tarball:dist-index',
      tarballEntries.includes('package/dist/index.js'),
      'tarball includes package/dist/index.js',
      { entries: tarballEntries }
    );
    addCheck(
      checks,
      'tarball:package-json',
      tarballEntries.includes('package/package.json'),
      'tarball includes package/package.json'
    );
    addCheck(
      checks,
      'tarball:readme-license',
      tarballEntries.includes('package/README.md') && tarballEntries.includes('package/LICENSE'),
      'tarball includes README and LICENSE'
    );
    addCheck(
      checks,
      'tarball:public-url-corpus',
      tarballEntries.includes('package/corpus/public-url-corpus.json'),
      'tarball includes public URL corpus manifest'
    );

    const extractDir = path.join(tempDir, 'extract');
    fs.mkdirSync(extractDir, { recursive: true });
    await execFileAsync('tar', ['-xzf', tarballPath, '-C', extractDir], {
      maxBuffer: 10 * 1024 * 1024,
    });
    checks.push(...(await validateExtractedPackage(path.join(extractDir, 'package'))));
  } catch (error) {
    addCheck(checks, 'pack:command', false, 'package smoke command failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const summary = summarizeChecks(checks);
  return {
    profile: 'pdf_package_smoke',
    generated_at: new Date().toISOString(),
    status: summary.failed === 0 ? 'passed' : 'failed',
    tarball_file: tarballPath ? path.basename(tarballPath) : undefined,
    summary,
    checks,
  };
};

export const main = async () => {
  const report = await buildPackageSmokeReport();
  console.log(JSON.stringify(report, null, 2));
  if (report.status === 'failed') {
    process.exitCode = 1;
  }
};

if (import.meta.main) {
  await main();
}
