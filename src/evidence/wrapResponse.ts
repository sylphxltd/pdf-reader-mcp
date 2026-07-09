import type { ContentBlock } from '@modelcontextprotocol/sdk/types.js';
import { type ToolHandlerResult, text } from '../mcp.js';
import { attachPdfToolEvidence, type PdfSourceRef, resolvePrimarySourceHash } from './envelope.js';

const textFromContentBlock = (block: unknown): string | undefined => {
  if (typeof block !== 'object' || block === null) {
    return undefined;
  }
  const candidate = block as ContentBlock;
  return candidate.type === 'text' && typeof candidate.text === 'string'
    ? candidate.text
    : undefined;
};

const extractJsonText = (result: ToolHandlerResult): string | undefined => {
  if (Array.isArray(result)) {
    return textFromContentBlock(result[0]);
  }

  if (
    typeof result === 'object' &&
    result !== null &&
    'content' in result &&
    Array.isArray(result.content)
  ) {
    return textFromContentBlock(result.content[0]);
  }

  return textFromContentBlock(result);
};

const buildAttachInput = (input: {
  tool: 'read_pdf' | 'search_pdf' | 'pdf_evidence';
  operation?: string | undefined;
  sources: PdfSourceRef[];
  payload: Record<string, unknown>;
  sourceHash?: string | undefined;
  warnings?: string[] | undefined;
  route?: string | undefined;
}) => ({
  tool: input.tool,
  sources: input.sources,
  payload: input.payload,
  ...(input.operation !== undefined ? { operation: input.operation } : {}),
  ...(input.sourceHash !== undefined ? { sourceHash: input.sourceHash } : {}),
  ...(input.warnings !== undefined ? { warnings: input.warnings } : {}),
  ...(input.route !== undefined ? { route: input.route } : {}),
});

export async function wrapPdfEvidenceResponse(input: {
  tool: 'read_pdf' | 'search_pdf' | 'pdf_evidence';
  operation?: string;
  sources: PdfSourceRef[];
  response: ToolHandlerResult;
  route?: string;
  warnings?: string[];
}): Promise<ToolHandlerResult> {
  const jsonText = extractJsonText(input.response);
  if (!jsonText) {
    return input.response;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return input.response;
  }

  const sourceHash = await resolvePrimarySourceHash(input.sources);
  const wrapped = attachPdfToolEvidence(
    buildAttachInput({
      tool: input.tool,
      operation: input.operation,
      sources: input.sources,
      payload,
      sourceHash,
      warnings: input.warnings,
      route: input.route,
    })
  );
  const wrappedText = text(JSON.stringify(wrapped, null, 2));

  if (Array.isArray(input.response)) {
    return [wrappedText, ...input.response.slice(1)];
  }

  if (
    typeof input.response === 'object' &&
    input.response !== null &&
    'content' in input.response &&
    Array.isArray(input.response.content)
  ) {
    return {
      ...input.response,
      content: [wrappedText, ...input.response.content.slice(1)],
    };
  }

  return wrappedText;
}
