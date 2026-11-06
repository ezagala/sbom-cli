import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDatabase, type Database } from "./db.ts";
import { ingest } from "./ingest.ts";
import { queryByComponent, queryByLicense } from "./query.ts";

const fixture = readFileSync(new URL("../fixtures/juice-shop-14.1.1.cdx.json", import.meta.url), "utf8");

function seeded(): Database {
  const db = openDatabase(":memory:");
  ingest(db, fixture);
  return db;
}

test("a component is found in the document that contains it", () => {
  assert.deepEqual(queryByComponent(seeded(), "ms"), [{ name: "juice-shop", version: "14.1.1" }]);
});

test("a version filter matches only that version", () => {
  const db = seeded();
  assert.deepEqual(queryByComponent(db, "ms", "2.1.3"), [{ name: "juice-shop", version: "14.1.1" }]);
  assert.deepEqual(queryByComponent(db, "ms", "9.9.9"), []);
});

test("a scoped package is found by its full name, not by its bare name", () => {
  const db = seeded();
  const juiceShop = [{ name: "juice-shop", version: "14.1.1" }];
  assert.deepEqual(queryByComponent(db, "@nlpjs/core"), juiceShop);
  assert.deepEqual(queryByComponent(db, "@otplib/core", "12.0.1"), juiceShop);
  // 12.0.1 is the @otplib version, so it must not match @nlpjs/core.
  assert.deepEqual(queryByComponent(db, "@nlpjs/core", "12.0.1"), []);
  assert.deepEqual(queryByComponent(db, "core"), []);
});

test("an unknown component finds nothing", () => {
  assert.deepEqual(queryByComponent(seeded(), "nope"), []);
});

test("a suspect license returns its component with the flag set", () => {
  assert.deepEqual(queryByLicense(seeded(), "GPL-2.0"), [
    { componentGroup: null, componentName: "fuzzball", componentVersion: "1.4.0", documentName: "juice-shop", documentVersion: "14.1.1", suspect: true },
  ]);
});

test("a common license returns every component that carries it", () => {
  const rows = queryByLicense(seeded(), "MIT");
  assert.equal(rows.length, 920);
  assert.equal(rows.some((row) => row.suspect), false);
});
