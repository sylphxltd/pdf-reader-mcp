import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, '..');
const distDir = path.join(repoRoot, 'dist');

const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
const workerCandidates = [
  path.join(pdfjsRoot, 'legacy/build/pdf.worker.mjs'),
  path.join(pdfjsRoot, 'legacy/build/pdf.worker.min.mjs'),
  path.join(pdfjsRoot, 'build/pdf.worker.mjs'),
];

fs.mkdirSync(distDir, { recursive: true });

let staged = 0;
for (const source of workerCandidates) {
  if (!fs.existsSync(source)) continue;
  const target = path.join(distDir, path.basename(source));
  fs.copyFileSync(source, target);
  staged += 1;
}

if (staged === 0) {
  console.error('[stage-pdfjs-worker] No pdfjs worker files found under pdfjs-dist');
  process.exit(1);
}

console.log(`[stage-pdfjs-worker] Staged ${staged} pdfjs worker file(s) into dist/`);
