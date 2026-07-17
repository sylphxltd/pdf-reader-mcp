import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const source = path.join(repoRoot, 'target/release/pdf-reader-mcp-server');
const targetDir = path.join(repoRoot, 'bin/native');
const target = path.join(targetDir, 'pdf-reader-mcp-server');

if (!fs.existsSync(source)) {
  console.error(
    `[stage-rust-mcp] Missing release binary at ${source}. Run: bun run build:rust`
  );
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

// Copy via a temp path + atomic rename so staging succeeds even when an older
// binary is still executing (Linux ETXTBSY on in-place overwrite).
const tmp = path.join(targetDir, `.pdf-reader-mcp-server.${process.pid}.tmp`);
try {
  fs.copyFileSync(source, tmp);
  fs.chmodSync(tmp, 0o755);
  fs.renameSync(tmp, target);
} catch (err) {
  try {
    fs.unlinkSync(tmp);
  } catch {
    // best-effort cleanup
  }
  throw err;
}

console.log(`[stage-rust-mcp] Staged ${target}`);
