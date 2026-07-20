#!/usr/bin/env bun

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const [pdfPath, counterPath, portArg = '0'] = process.argv.slice(2);
if (!pdfPath || !counterPath) {
  throw new Error('usage: url-single-fetch-fixture-server <pdf> <counter.json> [port]');
}

const pdf = readFileSync(pdfPath);
const name = basename(pdfPath);
let hits = 0;
const writeCounter = () => {
  writeFileSync(
    counterPath,
    `${JSON.stringify({ hits, path: `/${name}`, bytes: pdf.length }, null, 2)}\n`
  );
};
writeCounter();

const server = createServer((req, res) => {
  const url = req.url ?? '/';
  if (url === `/${name}` || url.startsWith(`/${name}?`)) {
    hits += 1;
    writeCounter();
    res.writeHead(200, {
      'content-type': 'application/pdf',
      'content-length': String(pdf.length),
      connection: 'close',
    });
    res.end(pdf);
    return;
  }
  if (url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(Number(portArg), '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('failed to bind');
  process.stdout.write(`${JSON.stringify({ port: address.port, path: `/${name}` })}\n`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
