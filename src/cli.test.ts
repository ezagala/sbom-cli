import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));
const fixture = fileURLToPath(new URL("../fixtures/juice-shop-14.1.1.cdx.json", import.meta.url));

function tempPath(name: string): string {
  return join(mkdtempSync(join(tmpdir(), "sbom-cli-")), name);
}

function run(...args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("ingest stores the fixture in the given database and prints a summary", () => {
  const db = tempPath("sbom.db");
  const { status, stdout } = run("ingest", fixture, "--db", db);
  assert.equal(status, 0);
  assert.equal(stdout.trim(), "Ingested juice-shop 14.1.1: 1101 components, 6 with a suspect license");
  assert.equal(existsSync(db), true);
});

test("ingest refuses a file that is not CycloneDX", () => {
  const spdx = tempPath("spdx.json");
  writeFileSync(spdx, JSON.stringify({ spdxVersion: "SPDX-3.0" }));
  const { status, stderr } = run("ingest", spdx, "--db", tempPath("sbom.db"));
  assert.equal(status, 1);
  assert.equal(stderr.trim(), "The file is not a CycloneDX 1.x SBOM.");
});

test("ingest without a file is refused", () => {
  const { status, stderr } = run("ingest");
  assert.equal(status, 1);
  assert.match(stderr, /sbom-file/);
});

test("ingest with a missing file is refused with one line naming it", () => {
  const { status, stderr } = run("ingest", "missing.json");
  assert.equal(status, 1);
  assert.equal(stderr.trim(), "Cannot read missing.json.");
});

test("query without a filter is refused", () => {
  const { status, stderr } = run("query");
  assert.equal(status, 1);
  assert.match(stderr, /--component <name> or --license <id>/);
});
