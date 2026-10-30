import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findComponentsWithLicense, findDocumentsWithComponent, insertDocument, openDatabase, upsertLicenses } from "./db.ts";
import type { Component, Document } from "./model.ts";

function component(name: string, version: string, licenseIds: string[] = []): Component {
  return { name, version, purl: null, bomRef: null, licenses: licenseIds.map((id) => ({ id, rawText: null })) };
}

function document(name: string, version: string, components: Component[]): Document {
  return { format: "CycloneDX", specVersion: "1.6", serialNumber: null, name, version, components, raw: "{}" };
}

test("opening the same database file twice keeps the schema and the data", () => {
  const path = join(mkdtempSync(join(tmpdir(), "sbom-")), "test.db");
  insertDocument(openDatabase(path), document("app", "1.0.0", [component("ms", "2.1.3")]));
  const reopened = openDatabase(path);
  assert.deepEqual(findDocumentsWithComponent(reopened, "ms"), [{ name: "app", version: "1.0.0" }]);
});

test("a document can be found by one of its components", () => {
  const db = openDatabase(":memory:");
  insertDocument(db, document("app", "1.0.0", [component("ms", "2.1.3"), component("debug", "4.3.4")]));
  assert.deepEqual(findDocumentsWithComponent(db, "ms"), [{ name: "app", version: "1.0.0" }]);
  assert.deepEqual(findDocumentsWithComponent(db, "nope"), []);
});

test("a version filter keeps only that version", () => {
  const db = openDatabase(":memory:");
  insertDocument(db, document("app", "1.0.0", [component("ms", "2.1.3"), component("ms", "2.0.0")]));
  insertDocument(db, document("other", "2.0.0", [component("ms", "2.0.0")]));
  assert.deepEqual(findDocumentsWithComponent(db, "ms", "2.1.3"), [{ name: "app", version: "1.0.0" }]);
  assert.deepEqual(findDocumentsWithComponent(db, "ms", "2.0.0"), [
    { name: "app", version: "1.0.0" },
    { name: "other", version: "2.0.0" },
  ]);
  assert.deepEqual(findDocumentsWithComponent(db, "ms", "9.9.9"), []);
});

test("a document appears once even when it holds several versions of a component", () => {
  const db = openDatabase(":memory:");
  insertDocument(db, document("app", "1.0.0", [component("ms", "2.1.3"), component("ms", "2.0.0")]));
  assert.equal(findDocumentsWithComponent(db, "ms").length, 1);
});

test("a license shared by two components returns both with their document", () => {
  const db = openDatabase(":memory:");
  upsertLicenses(db, [{ id: "GPL-2.0", suspect: true }]);
  insertDocument(db, document("app", "1.0.0", [component("a", "1", ["MIT", "GPL-2.0"]), component("b", "2", ["GPL-2.0"])]));
  assert.deepEqual(findComponentsWithLicense(db, "GPL-2.0"), [
    { componentName: "a", componentVersion: "1", documentName: "app", documentVersion: "1.0.0", suspect: true },
    { componentName: "b", componentVersion: "2", documentName: "app", documentVersion: "1.0.0", suspect: true },
  ]);
  assert.equal(findComponentsWithLicense(db, "MIT")[0].suspect, false);
});

test("upserting a license twice leaves one row with the latest flag", () => {
  const db = openDatabase(":memory:");
  upsertLicenses(db, [{ id: "MIT", suspect: true }]);
  upsertLicenses(db, [{ id: "MIT", suspect: false }]);
  const row = db.prepare("select count(*) as n, sum(suspect) as s from licenses").get()!;
  assert.equal(row.n, 1);
  assert.equal(row.s, 0);
});

test("a document with no components still gets a row", () => {
  const db = openDatabase(":memory:");
  const id = insertDocument(db, document("empty", "0.0.1", []));
  assert.equal(db.prepare("select count(*) as n from documents where id = ?").get(id)!.n, 1);
});

test("a failed insert leaves no partial rows", () => {
  const db = openDatabase(":memory:");
  const broken = { ...component("ok", "1"), name: null as unknown as string };
  assert.throws(() => insertDocument(db, document("app", "1.0.0", [component("fine", "1"), broken])));
  assert.equal(db.prepare("select count(*) as n from documents").get()!.n, 0);
  assert.equal(db.prepare("select count(*) as n from components").get()!.n, 0);
});

test("a component that lists the same license twice gets one row", () => {
  const db = openDatabase(":memory:");
  insertDocument(db, document("app", "1.0.0", [component("a", "1", ["MIT", "MIT"])]));
  assert.equal(db.prepare("select count(*) as n from component_licenses").get()!.n, 1);
});
