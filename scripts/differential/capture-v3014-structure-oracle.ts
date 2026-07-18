#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "../..");
const oraclePath = join(scriptDir, "fixtures/v3014-structure-oracle.json");
const corpusPath = join(scriptDir, "fixtures/v3014-structure-corpus.json");
const fixtureDir = join(repoRoot, "test/fixtures/differential");
const normalizerOracle = JSON.parse(
  readFileSync(
    join(scriptDir, "fixtures/v3014-structure-normalizer-oracle.json"),
    "utf8"
  )
);
const oracle = JSON.parse(readFileSync(oraclePath, "utf8"));
const refresh = process.argv.includes("--refresh");
const run = (cmd: string, args: string[], cwd: string, capture = false) => {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.status !== 0) throw new Error(`${cmd} failed`);
  return result.stdout ?? "";
};
const resolved = run(
  "git",
  ["rev-list", "-n", "1", oracle.baseline.tag],
  repoRoot,
  true
).trim();
if (resolved !== oracle.baseline.commit) throw new Error("baseline moved");
const worktree = mkdtempSync(join(tmpdir(), "pdf-reader-v3014-structure-"));
try {
  run("git", ["worktree", "add", "--detach", worktree, resolved], repoRoot);
  run("bun", ["install", "--frozen-lockfile"], worktree);
  const runner = join(worktree, "v3014-structure-baseline-runner.ts");
  writeFileSync(
    runner,
    readFileSync(join(scriptDir, "v3014-structure-baseline-runner.ts"))
  );
  const expectations = JSON.parse(
    run("bun", [runner, corpusPath, fixtureDir], worktree, true)
  );
  const normalizerRunner = join(
    worktree,
    "v3014-structure-normalizer-baseline-runner.ts"
  );
  writeFileSync(
    normalizerRunner,
    readFileSync(
      join(scriptDir, "v3014-structure-normalizer-baseline-runner.ts")
    )
  );
  const normalized = JSON.parse(run("bun", [normalizerRunner], worktree, true));
  if (JSON.stringify(normalized) !== JSON.stringify(normalizerOracle.expected))
    throw new Error("stored structure normalizer oracle differs");
  if (refresh) {
    writeFileSync(
      oraclePath,
      `${JSON.stringify({ ...oracle, expectations }, null, 2)}\n`
    );
  } else if (
    JSON.stringify(expectations) !== JSON.stringify(oracle.expectations)
  ) {
    throw new Error("stored structure oracle differs");
  } else
    console.log(
      `v3.0.14 structure oracle replay: OK (${
        Object.keys(expectations).length
      } cases + normalizer)`
    );
} finally {
  spawnSync("git", ["worktree", "remove", "--force", worktree], {
    cwd: repoRoot,
  });
  rmSync(worktree, { recursive: true, force: true });
}
