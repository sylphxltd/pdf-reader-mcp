import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export type Confidence = 'deterministic' | 'derived' | 'inferred' | 'unknown';

export interface PdfToolEvidence {
  subject: string;
  source: string;
  sourceHash?: string;
  freshness: {
    indexedAt: string;
    stale: boolean;
  };
  locator: {
    path?: string;
    url?: string;
    tool: string;
    operation?: string;
  };
  route: {
    extraction: string;
    tool: string;
    operation?: string;
  };
  confidence: Confidence;
  warnings: string[];
  nextActions: string[];
}

export type PdfSourceRef = {
  path?: string | undefined;
  url?: string | undefined;
};

export async function hashLocalFile(path: string): Promise<string | undefined> {
  try {
    const bytes = await readFile(path);
    return createHash('sha256').update(bytes).digest('hex');
  } catch {
    return undefined;
  }
}

export async function resolvePrimarySourceHash(
  sources: PdfSourceRef[]
): Promise<string | undefined> {
  const firstPath = sources.find((source) => source.path)?.path;
  if (!firstPath) {
    return undefined;
  }
  return hashLocalFile(firstPath);
}

const primarySourceLabel = (sources: PdfSourceRef[]): string => {
  const first = sources[0];
  return first?.path ?? first?.url ?? 'unknown';
};

export function buildPdfToolEvidence(input: {
  tool: 'read_pdf' | 'search_pdf' | 'pdf_evidence';
  operation?: string;
  sources: PdfSourceRef[];
  sourceHash?: string;
  warnings?: string[];
  route?: string;
}): PdfToolEvidence {
  const source = primarySourceLabel(input.sources);
  const locator: PdfToolEvidence['locator'] = {
    tool: input.tool,
    ...(input.sources[0]?.path !== undefined ? { path: input.sources[0].path } : {}),
    ...(input.sources[0]?.url !== undefined ? { url: input.sources[0].url } : {}),
    ...(input.operation !== undefined ? { operation: input.operation } : {}),
  };

  return {
    subject: source,
    source,
    ...(input.sourceHash !== undefined ? { sourceHash: input.sourceHash } : {}),
    freshness: {
      indexedAt: new Date().toISOString(),
      stale: false,
    },
    locator,
    route: {
      extraction: input.route ?? 'pdfjs-native-v3',
      tool: input.tool,
      ...(input.operation !== undefined ? { operation: input.operation } : {}),
    },
    confidence: 'deterministic',
    warnings: input.warnings ?? [],
    nextActions: [
      'Use search_pdf for literal retrieval with page and bbox locators',
      'Use pdf_evidence for inspect, render, crop, OCR, or visual-region follow-up',
    ],
  };
}

export function attachPdfToolEvidence<T extends Record<string, unknown>>(input: {
  tool: 'read_pdf' | 'search_pdf' | 'pdf_evidence';
  operation?: string;
  sources: PdfSourceRef[];
  payload: T;
  sourceHash?: string;
  warnings?: string[];
  route?: string;
}): T & { evidence: PdfToolEvidence } {
  return {
    evidence: buildPdfToolEvidence(input),
    ...input.payload,
  };
}