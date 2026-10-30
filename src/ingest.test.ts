import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDatabase } from "./db.ts";
import { ingest } from "./ingest.ts";

const fixture = readFileSync(new URL("../fixtures/juice-shop-14.1.1.cdx.json", import.meta.url), "utf8");

function count(db: ReturnType<typeof openDatabase>, sql: string): number {
  return db.prepare(sql).get()!.n as number;
}

test("ingesting the fixture stores every component and reports the summary", () => {
  const db = openDatabase(":memory:");
  const summary = ingest(db, fixture);
  assert.deepEqual(summary, { name: "juice-shop", version: "14.1.1", components: 1101, suspect: 6 });
  assert.equal(count(db, "select count(*) as n from documents"), 1);
  assert.equal(count(db, "select count(*) as n from components"), 1101);
});

test("licenses on the static list are flagged and others are not", () => {
  const db = openDatabase(":memory:");
  ingest(db, fixture);
  const flag = (id: string) => db.prepare("select suspect from licenses where id = ?").get(id)!.suspect;
  assert.equal(flag("GPL-2.0"), 1);
  assert.equal(flag("CC-BY-3.0"), 1);
  assert.equal(flag("WTFPL"), 1);
  assert.equal(flag("MIT"), 0);
});

test("a component with an expression gets one license row per member", () => {
  const db = openDatabase(":memory:");
  ingest(db, fixture);
  // Two fixture components declare (MIT OR Apache-2.0), each with two members.
  assert.equal(count(db, "select count(*) as n from component_licenses where raw_text = '(MIT OR Apache-2.0)'"), 4);
});

test("ingesting the same file twice stores two documents", () => {
  const db = openDatabase(":memory:");
  ingest(db, fixture);
  ingest(db, fixture);
  assert.equal(count(db, "select count(*) as n from documents"), 2);
});

test("a file that is not CycloneDX is refused and nothing is stored", () => {
  const db = openDatabase(":memory:");
  assert.throws(() => ingest(db, JSON.stringify({ spdxVersion: "SPDX-3.0" })), /not a CycloneDX/);
  assert.equal(count(db, "select count(*) as n from documents"), 0);
});
