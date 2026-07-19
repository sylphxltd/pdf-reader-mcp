#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "../..");
const corpusPath = join(
  scriptDir,
  "fixtures/v3014-selectable-table-corpus.json"
);
const oraclePath = join(
  scriptDir,
  "fixtures/v3014-selectable-table-oracle.json"
);
const fixtureManifestPath = join(
  scriptDir,
  "fixtures/v3014-selectable-table-fixture.json"
);
const localRunner = join(
  scriptDir,
  "v3014-selectable-table-baseline-runner.ts"
);
const localProjection = join(scriptDir, "v3014-selectable-table-projection.ts");
const localGenerator = join(
  scriptDir,
  "generate-v3014-selectable-table-fixture.ts"
);
const oracle = JSON.parse(readFileSync(oraclePath, "utf8")) as Record<
  string,
  unknown
>;
const baseline = oracle.baseline as Record<string, unknown>;
const sha = (x: Uint8Array | string): string =>
  createHash("sha256").update(x).digest("hex");
const run = (cmd: string, args: string[], cwd: string): string => {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 120 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || `${cmd} failed`);
  return r.stdout.trim();
};
const gitBytes = (...args: string[]): Buffer => {
  const r = spawnSync("git", args, { cwd: repoRoot });
  if (r.status !== 0) throw new Error(r.stderr.toString());
  return r.stdout;
};
if (
  run("git", ["rev-list", "-n", "1", String(baseline.tag)], repoRoot) !==
  baseline.commit
)
  throw new Error("baseline tag moved");
if (
  run("git", ["rev-parse", `${String(baseline.commit)}^{tree}`], repoRoot) !==
  baseline.tree
)
  throw new Error("baseline tree moved");
const scratch = mkdtempSync(join(tmpdir(), "pdf-reader-table-baseline-"));
const wt = join(scratch, "worktree");
try {
  run(
    "git",
    ["worktree", "add", "--detach", wt, String(baseline.commit)],
    repoRoot
  );
  run("bun", ["install", "--frozen-lockfile"], wt);
  const runner = join(wt, "v3014-selectable-table-baseline-runner.ts");
  const projection = join(wt, "v3014-selectable-table-projection.ts");
  writeFileSync(runner, readFileSync(localRunner));
  writeFileSync(projection, readFileSync(localProjection));
  const expectations = JSON.parse(
    run(
      "bun",
      [runner, corpusPath, join(repoRoot, "test/fixtures/differential")],
      wt
    )
  );
  const refresh = process.argv.includes("--refresh");
  if (refresh) {
    const entrypoints = [
      "src/pdf/tableExtractor.ts",
      "src/pdf/readCoordinator.ts",
      "src/pdf/documentModel.ts",
      "src/pdf/renderer.ts",
      "src/pdf/documentAst.ts",
      "src/pdf/documentMap.ts",
      "src/pdf/trustReport.ts",
      "src/handlers/readPdf.ts",
      "src/types/pdf.ts",
    ];
    const manifest = JSON.parse(readFileSync(fixtureManifestPath, "utf8")) as {
      fixture: { sha256: string };
      hostileFixture: { sha256: string };
    };
    Object.assign(baseline, {
      bunLockSha256: sha(
        gitBytes("show", `${String(baseline.commit)}:bun.lock`)
      ),
      runnerSha256: sha(readFileSync(localRunner)),
      projectionSha256: sha(readFileSync(localProjection)),
      generatorSha256: sha(readFileSync(localGenerator)),
      corpusSha256: sha(readFileSync(corpusPath)),
      fixtureManifestSha256: sha(readFileSync(fixtureManifestPath)),
      fixtureSha256: manifest.fixture.sha256,
      hostileFixtureSha256: manifest.hostileFixture.sha256,
      entrypointSha256: Object.fromEntries(
        entrypoints.map((p) => [
          p,
          sha(gitBytes("show", `${String(baseline.commit)}:${p}`)),
        ])
      ),
    });
    oracle.expectations = expectations;
    writeFileSync(oraclePath, `${JSON.stringify(oracle, null, 2)}\n`);
    console.error(`refreshed ${oraclePath}`);
  } else if (
    JSON.stringify(expectations) !== JSON.stringify(oracle.expectations)
  )
    throw new Error(
      "stored v3.0.14 selectable-table oracle differs from executable baseline"
    );
  else
    console.log(
      `v3.0.14 selectable-table oracle replay: OK (${
        Object.keys(expectations).length
      } cases)`
    );
} finally {
  spawnSync("git", ["worktree", "remove", "--force", wt], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  rmSync(scratch, { recursive: true, force: true });
}
