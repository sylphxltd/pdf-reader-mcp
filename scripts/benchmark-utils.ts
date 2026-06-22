import fs from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_FILE_FLAGS = new Set(['--output', '-o']);
const OUTPUT_DIR_FLAGS = new Set(['--output-dir']);
const OUTPUT_DIR_ENV = 'MCP_PDF_BENCHMARK_OUTPUT_DIR';

export interface BenchmarkReport {
  profile: string;
}

interface ResolveBenchmarkOutputPathOptions {
  profile: string;
  argv?: string[];
  env?: Record<string, string | undefined>;
}

const readFlagValue = (argv: string[], flagNames: Set<string>): string | undefined => {
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (flagNames.has(arg)) {
      const value = argv[index + 1];
      return value && !value.startsWith('-') ? value : undefined;
    }

    for (const flagName of flagNames) {
      const prefix = `${flagName}=`;
      if (arg.startsWith(prefix)) {
        return arg.slice(prefix.length);
      }
    }
  }

  return undefined;
};

const sanitizeFileStem = (value: string): string =>
  value
    .trim()
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase();

export const resolveBenchmarkOutputPath = ({
  profile,
  argv = process.argv.slice(2),
  env = process.env,
}: ResolveBenchmarkOutputPathOptions): string | undefined => {
  const outputFile = readFlagValue(argv, OUTPUT_FILE_FLAGS);
  if (outputFile?.trim()) {
    return path.resolve(outputFile);
  }

  const outputDir = readFlagValue(argv, OUTPUT_DIR_FLAGS) ?? env[OUTPUT_DIR_ENV];
  if (!outputDir?.trim()) {
    return undefined;
  }

  const fileStem = sanitizeFileStem(profile) || 'benchmark-report';
  return path.resolve(outputDir, `${fileStem}.json`);
};

export const writeBenchmarkReport = async (
  report: BenchmarkReport,
  options: Omit<ResolveBenchmarkOutputPathOptions, 'profile'> = {}
): Promise<string | undefined> => {
  const outputPath = resolveBenchmarkOutputPath({ ...options, profile: report.profile });
  if (!outputPath) {
    return undefined;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outputPath;
};
