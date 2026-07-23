#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const matrix = JSON.parse(
  readFileSync('docs/specs/pure-rust-capability-matrix.json', 'utf8')
) as {
  productTruth?: { dropInFor3014?: boolean; pureRustStatus?: string };
};
const server = JSON.parse(readFileSync('server.json', 'utf8')) as {
  version: string;
  packages: Array<{ version: string }>;
};

// MCP registry metadata tracks the npm package version.
server.version = pkg.version;
server.packages[0].version = pkg.version;
writeFileSync('server.json', `${JSON.stringify(server, null, 2)}\n`);

// Pure-Rust MCP initialize version must remain experimental-tagged until sole-runtime
// cutover (dropInFor3014=true). Publishing progress packages must not advertise the
// npm package line as the pure-Rust server version.
const dropIn = matrix.productTruth?.dropInFor3014 === true;
const rustServerVersion = dropIn
  ? pkg.version
  : pkg.version.endsWith('-pure-rust-experimental')
    ? pkg.version
    : `${pkg.version}-pure-rust-experimental`;

const rustServerLib = 'crates/pdf-reader-mcp-server/src/lib.rs';
const rustSource = readFileSync(rustServerLib, 'utf8');
const nextRust = rustSource.replace(
  /pub const SERVER_VERSION: &str = "[^"]+";/,
  `pub const SERVER_VERSION: &str = "${rustServerVersion}";`
);
if (nextRust === rustSource && !rustSource.includes(`"${rustServerVersion}"`)) {
  throw new Error(
    `Failed to sync SERVER_VERSION in ${rustServerLib} to ${rustServerVersion}`
  );
}
if (nextRust !== rustSource) {
  writeFileSync(rustServerLib, nextRust);
}

console.log(
  JSON.stringify(
    {
      profile: 'sync_server_json',
      packageVersion: pkg.version,
      serverJsonVersion: server.version,
      rustServerVersion,
      dropInFor3014: dropIn,
      pass: true,
    },
    null,
    2
  )
);
