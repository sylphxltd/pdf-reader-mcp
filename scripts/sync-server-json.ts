import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const server = JSON.parse(readFileSync('server.json', 'utf8')) as {
  version: string;
  packages: Array<{ version: string }>;
};

server.version = pkg.version;
server.packages[0].version = pkg.version;

writeFileSync('server.json', `${JSON.stringify(server, null, 2)}\n`);

// Keep the Rust MCP server initialize version aligned with package.json.
const rustServerLib = 'crates/pdf-reader-mcp-server/src/lib.rs';
const rustSource = readFileSync(rustServerLib, 'utf8');
const nextRust = rustSource.replace(
  /pub const SERVER_VERSION: &str = "[^"]+";/,
  `pub const SERVER_VERSION: &str = "${pkg.version}";`
);
if (nextRust === rustSource && !rustSource.includes(`"${pkg.version}"`)) {
  throw new Error(
    `Failed to sync SERVER_VERSION in ${rustServerLib} to package version ${pkg.version}`
  );
}
if (nextRust !== rustSource) {
  writeFileSync(rustServerLib, nextRust);
}
