#!/usr/bin/env node

import { createRequire } from 'node:module';
import { formatDoctorReport, runDoctor } from './doctor.js';
import { pdfEvidence } from './handlers/pdfEvidence.js';
import { readPdf } from './handlers/readPdf.js';
import { searchPdf } from './handlers/searchPdf.js';
import { createServer, stdio } from './mcp.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

const server = createServer({
  name: 'pdf-reader-mcp',
  version: packageJson.version,
  instructions:
    'V3 PDF intelligence MCP server. Use read_pdf first with auto=true for smart Agent Document Twin extraction, search_pdf for cheap literal evidence retrieval, and pdf_evidence for focused inspect, render, crop, OCR, or visual-region evidence operations.',
  tools: {
    read_pdf: readPdf,
    search_pdf: searchPdf,
    pdf_evidence: pdfEvidence,
  },
  transport: stdio(),
});

async function main(): Promise<void> {
  if (process.argv[2] === 'doctor') {
    const report = await runDoctor(packageJson.version);
    console.log(formatDoctorReport(report));
    process.exit(report.status === 'unavailable' ? 1 : 0);
  }

  await server.start();

  if (process.env['DEBUG_MCP']) {
    console.error('[PDF Reader MCP] Server running on stdio');
    console.error('[PDF Reader MCP] Project root:', process.cwd());
  }
}

main().catch((error: unknown) => {
  console.error('[PDF Reader MCP] Server error:', error);
  process.exit(1);
});
