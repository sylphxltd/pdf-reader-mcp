import { image, text, tool, toolError } from '@sylphx/mcp-server-sdk';
import {
  DEFAULT_MAX_RENDER_PAGES,
  DEFAULT_MAX_RENDER_PIXELS,
  DEFAULT_RENDER_SCALE,
  renderPdfSourcePages,
} from '../pdf/renderer.js';
import { renderPageArgsSchema } from '../schemas/renderPage.js';
import type {
  PdfPageRenderData,
  PdfPageRenderSourceResult,
  PdfPageRenderSummary,
  PdfSource,
  RenderPageOptions,
} from '../types/pdf.js';
import { PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RenderPage');

interface RenderSourceOutput {
  result: PdfPageRenderSourceResult;
  pages: PdfPageRenderData[];
}

const buildRenderOptions = (input: {
  scale?: number | undefined;
  max_pages?: number | undefined;
  max_pixels_per_page?: number | undefined;
  include_image?: boolean | undefined;
}): RenderPageOptions => ({
  scale: input.scale ?? DEFAULT_RENDER_SCALE,
  max_pages: input.max_pages ?? DEFAULT_MAX_RENDER_PAGES,
  max_pixels_per_page: input.max_pixels_per_page ?? DEFAULT_MAX_RENDER_PIXELS,
  include_image: input.include_image ?? true,
});

const summarizeRenderedPage = (
  page: PdfPageRenderData,
  imageContentIndex: number | undefined
): PdfPageRenderSummary => {
  const { data: _data, ...summary } = page;
  return {
    ...summary,
    ...(imageContentIndex !== undefined ? { image_content_index: imageContentIndex } : {}),
  };
};

const renderSourceForTool = async (
  source: PdfSource,
  options: RenderPageOptions
): Promise<RenderSourceOutput> => {
  const sourceDescription = source.path ?? source.url ?? 'unknown source';

  try {
    const rendered = await renderPdfSourcePages(source, options);
    return {
      result: {
        source: rendered.source,
        success: true,
        num_pages: rendered.numPages,
        rendered_pages: [],
        ...(rendered.warnings.length > 0 ? { warnings: rendered.warnings } : {}),
      },
      pages: rendered.pages,
    };
  } catch (error: unknown) {
    let errorMessage: string;
    if (error instanceof PdfError) {
      errorMessage = error.message;
    } else {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error('Unexpected error rendering PDF source', {
        sourceDescription,
        error: detail,
      });
      errorMessage = `Failed to render PDF pages from ${sourceDescription}.`;
    }

    return {
      result: {
        source: sourceDescription,
        success: false,
        error: errorMessage,
      },
      pages: [],
    };
  }
};

const attachRenderSummaries = (
  outputs: RenderSourceOutput[],
  includeImage: boolean
): PdfPageRenderSourceResult[] => {
  let nextImageContentIndex = 1;

  return outputs.map(({ result, pages }) => {
    if (!result.success) return result;

    return {
      ...result,
      rendered_pages: pages.map((page) => {
        const imageContentIndex = includeImage ? nextImageContentIndex++ : undefined;
        return summarizeRenderedPage(page, imageContentIndex);
      }),
    };
  });
};

const buildRenderContent = (
  outputs: RenderSourceOutput[],
  results: PdfPageRenderSourceResult[],
  options: RenderPageOptions
): Array<ReturnType<typeof text> | ReturnType<typeof image>> => {
  const content: Array<ReturnType<typeof text> | ReturnType<typeof image>> = [
    text(
      JSON.stringify(
        {
          profile: 'page_render_evidence',
          render_options: options,
          results,
        },
        null,
        2
      )
    ),
  ];

  if (!options.include_image) return content;

  for (const output of outputs) {
    if (!output.result.success) continue;
    for (const page of output.pages) {
      content.push(image(page.data, page.mime_type));
    }
  }

  return content;
};

export const renderPage = tool()
  .description(
    'Renders selected PDF pages as bounded PNG evidence images for visual grounding, OCR routing, and page-level inspection.'
  )
  .input(renderPageArgsSchema)
  .handler(async ({ input }) => {
    const options = buildRenderOptions(input);
    const outputs: RenderSourceOutput[] = [];

    for (const source of input.sources) {
      outputs.push(await renderSourceForTool(source, options));
    }

    const results = attachRenderSummaries(outputs, options.include_image);

    if (results.every((result) => !result.success)) {
      const errorMessages = results.map((result) => result.error).join('; ');
      return toolError(`All PDF sources failed to render: ${errorMessages}`);
    }

    return buildRenderContent(outputs, results, options);
  });
