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

test("query with both filters is refused", () => {
  const { status, stderr } = run("query", "--component", "ms", "--license", "MIT");
  assert.equal(status, 1);
  assert.match(stderr, /not both/);
});

test("query with --version but no --component is refused", () => {
  const { status, stderr } = run("query", "--version", "1.0.0", "--license", "MIT");
  assert.equal(status, 1);
  assert.match(stderr, /--version only works/);
});

test("query answers from an ingested database", () => {
  const db = tempPath("sbom.db");
  assert.equal(run("ingest", fixture, "--db", db).status, 0);

  const byComponent = run("query", "--component", "ms", "--db", db);
  assert.equal(byComponent.status, 0);
  assert.equal(byComponent.stdout, "juice-shop 14.1.1\n");

  const byVersion = run("query", "--component", "ms", "--version", "2.1.3", "--db", db);
  assert.equal(byVersion.stdout, "juice-shop 14.1.1\n");

  const byLicense = run("query", "--license", "GPL-2.0", "--db", db);
  assert.equal(byLicense.status, 0);
  assert.equal(byLicense.stdout, "fuzzball\t1.4.0\tjuice-shop 14.1.1\tsuspect\n");

  const common = run("query", "--license", "MIT", "--db", db);
  assert.equal(common.stdout.trim().split("\n").length, 920);
  assert.equal(common.stdout.includes("suspect"), false);
});

test("query with no matches says so on stderr and exits 0", () => {
  const db = tempPath("sbom.db");
  const { status, stdout, stderr } = run("query", "--component", "nope", "--db", db);
  assert.equal(status, 0);
  assert.equal(stdout, "");
  assert.equal(stderr.trim(), "No matches");
});
