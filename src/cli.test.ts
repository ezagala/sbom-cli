import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));
const fixture = fileURLToPath(new URL("../fixtures/juice-shop-14.1.1.cdx.json", import.meta.url));

function run(...args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("ingest parses the fixture and prints a summary", () => {
  const { status, stdout } = run("ingest", fixture);
  assert.equal(status, 0);
  assert.equal(stdout.trim(), "Parsed juice-shop 14.1.1: 1101 components");
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
