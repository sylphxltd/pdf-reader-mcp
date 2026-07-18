#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { PNG } from 'pngjs';
import { pdfEvidence } from './src/handlers/pdfEvidence.ts';

type Content = { type: string; text?: string; data?: string; mimeType?: string };
type ToolResult = { content: Content[]; isError?: boolean };

const [corpusPath, fixtureDir, providerPath, regionProviderPath] = process.argv.slice(2);
if (!corpusPath || !fixtureDir || !providerPath || !regionProviderPath) {
  throw new Error('usage: runner <corpus.json> <fixture-dir> <ocr-provider.ts> <region-provider.ts>');
}
process.env['MCP_PDF_OCR_COMMAND'] = process.execPath;
process.env['MCP_PDF_OCR_ARGS_JSON'] = JSON.stringify([
  providerPath,
  '{input}',
  '{page}',
  '{languages}',
]);
process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'] = JSON.stringify([
  regionProviderPath,
  '{input}',
  '{page}',
  '{region_id}',
  '{evidence_id}',
  '{languages}',
]);
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  cases: Array<{ id: string; input: Record<string, unknown> }>;
};

function materialize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(materialize);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key === 'fixture' ? 'path' : key] =
        key === 'fixture' && typeof entry === 'string' ? join(fixtureDir, entry) : materialize(entry);
    }
    return output;
  }
  return value;
}

function normalizeResult(raw: unknown): ToolResult {
  if (Array.isArray(raw)) return { content: raw as Content[] };
  if (raw && typeof raw === 'object' && 'content' in raw) return raw as ToolResult;
  return { content: [raw as Content] };
}

function errorCategory(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('right > left') || lower.includes('top > bottom')) {
    return 'invalid_bounding_box';
  }
  if (lower.includes('not found') || lower.includes('no such file')) return 'file_not_found';
  return 'unknown_error';
}

function imageFacts(content: Content): Record<string, unknown> {
  const bytes = Buffer.from(content.data ?? '', 'base64');
  const png = PNG.sync.read(bytes);
  const sample = (x: number, y: number): number[] => {
    const offset = (y * png.width + x) * 4;
    return Array.from(png.data.subarray(offset, offset + 4));
  };
  return {
    mime_type: content.mimeType,
    raw_base64: !(content.data ?? '').startsWith('data:'),
    png_signature: bytes.subarray(0, 8).equals(Buffer.from('\x89PNG\r\n\x1a\n', 'binary')),
    width: png.width,
    height: png.height,
    byte_length: bytes.length,
    samples: [
      sample(Math.floor(png.width / 4), Math.floor(png.height / 4)),
      sample(Math.floor((png.width * 3) / 4), Math.floor(png.height / 4)),
      sample(Math.floor(png.width / 4), Math.floor((png.height * 3) / 4)),
      sample(Math.floor((png.width * 3) / 4), Math.floor((png.height * 3) / 4)),
    ],
  };
}

function canonicalize(result: ToolResult): Record<string, unknown> {
  if (result.isError) {
    const message = result.content[0]?.text ?? '';
    return { outcome: 'error', category: errorCategory(message) };
  }
  const payload = JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
  const imageBlocks = result.content.filter((content) => content.type === 'image');
  const images = imageBlocks.map(imageFacts);
  const results = ((payload.results ?? []) as Array<Record<string, unknown>>).map((source) => {
    if (!source.success) {
      return {
        source: basename(String(source.source ?? '')),
        success: false,
        category: errorCategory(String(source.error ?? '')),
      };
    }
    const output: Record<string, unknown> = {
      source: basename(String(source.source ?? '')),
      success: true,
      num_pages: source.num_pages,
      warnings: source.warnings ?? [],
    };
    if (Array.isArray(source.rendered_pages)) {
      output.rendered_pages = source.rendered_pages.map((page: Record<string, unknown>) => {
        const index = page.image_content_index as number | undefined;
        const image = index === undefined ? undefined : images[index - 1];
        return {
          page: page.page,
          evidence_id: page.evidence_id,
          width: page.width,
          height: page.height,
          scale: page.scale,
          pixel_count: page.pixel_count,
          format: page.format,
          mime_type: page.mime_type,
          rotation: page.rotation,
          provenance_source: (page.provenance as Record<string, unknown>)?.source,
          image_content_index: index ?? null,
          inline_data_absent: !('data' in page),
          image: image
            ? {
                ...image,
                byte_length_consistent: image.byte_length === page.byte_length,
                byte_length: undefined,
              }
            : null,
        };
      });
    }
    if (Array.isArray(source.regions)) {
      output.regions = source.regions.map((region: Record<string, unknown>) => {
        const index = region.image_content_index as number | undefined;
        const image = index === undefined ? undefined : images[index - 1];
        const provenance = region.provenance as Record<string, unknown>;
        return {
          region_id: region.region_id,
          page: region.page,
          evidence_id: region.evidence_id,
          source_bounding_box: region.source_bounding_box,
          crop_pixels: region.crop_pixels,
          scale: region.scale,
          format: region.format,
          mime_type: region.mime_type,
          provenance_source: provenance?.source,
          page_render_evidence_id: provenance?.page_render_evidence_id,
          image_content_index: index ?? null,
          inline_data_absent: !('data' in region),
          image: image
            ? {
                ...image,
                byte_length_consistent: image.byte_length === region.byte_length,
                byte_length: undefined,
              }
            : null,
        };
      });
    }
    if (Array.isArray(source.ocr_pages)) {
      output.ocr_pages = source.ocr_pages.map((page: Record<string, unknown>) => ({
        page: page.page,
        text: page.text,
        confidence: page.confidence ?? null,
        language: page.language ?? null,
        words: page.words ?? [],
        provider: page.provider,
        source_render_evidence_id: page.source_render_evidence_id,
        source_render_scale: page.source_render_scale,
        source_render_width: page.source_render_width,
        source_render_height: page.source_render_height,
        warnings: page.warnings ?? [],
        provenance: page.provenance,
      }));
    }
    if (Array.isArray(source.region_analyses)) {
      output.region_analyses = source.region_analyses.map((region: Record<string, unknown>) => ({
        region_id: region.region_id,
        page: region.page,
        kind: region.kind,
        description: region.description ?? null,
        text: region.text ?? null,
        markdown: region.markdown ?? null,
        confidence: region.confidence ?? null,
        table: region.table ?? null,
        formula: region.formula ?? null,
        chart: region.chart ?? null,
        warnings: region.warnings ?? [],
        provider: region.provider,
        source_crop_evidence_id: region.source_crop_evidence_id,
        source_bounding_box: region.source_bounding_box,
        crop_pixels: region.crop_pixels,
        scale: region.scale,
        provenance: region.provenance,
      }));
    }
    return output;
  });
  return {
    outcome: 'success',
    profile: payload.profile,
    options:
      payload.render_options ??
      payload.crop_options ??
      payload.ocr_options ??
      payload.analysis_options,
    content_count: result.content.length,
    results,
  };
}

const observations: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const input = materialize(entry.input) as never;
  const raw = await pdfEvidence.handler({ input, ctx: {} });
  observations[entry.id] = canonicalize(normalizeResult(raw));
}
console.log(JSON.stringify(observations));
