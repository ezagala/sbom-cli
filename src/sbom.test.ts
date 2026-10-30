import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCycloneDx } from "./sbom.ts";

const fixture = readFileSync(new URL("../fixtures/juice-shop-14.1.1.cdx.json", import.meta.url), "utf8");

function bomWith(component: object): string {
  return JSON.stringify({
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    metadata: { component: { name: "app", version: "1.0.0" } },
    components: [{ name: "lib", version: "2.0.0", ...component }],
  });
}

test("parses the fixture", () => {
  const doc = parseCycloneDx(fixture);
  assert.equal(doc.name, "juice-shop");
  assert.equal(doc.version, "14.1.1");
  assert.equal(doc.specVersion, "1.6");
  assert.equal(doc.serialNumber, null);
  assert.equal(doc.components.length, 1101);
  assert.equal(doc.raw, fixture);
});

test("keeps a scoped package's name as given and its scope in the purl", () => {
  const doc = parseCycloneDx(fixture);
  const colors = doc.components.find((c) => c.purl === "pkg:npm/%40colors/colors@1.6.0");
  assert.equal(colors?.name, "colors");
  assert.equal(colors?.bomRef, "juice-shop@14.1.1|@colors/colors@1.6.0");
});

test("two license objects become two licenses", () => {
  const doc = parseCycloneDx(bomWith({ licenses: [{ license: { id: "MIT" } }, { license: { id: "ISC" } }] }));
  assert.deepEqual(doc.components[0].licenses, [
    { id: "MIT", rawText: null },
    { id: "ISC", rawText: null },
  ]);
});

test("an expression is split into its members", () => {
  const doc = parseCycloneDx(bomWith({ licenses: [{ expression: "(MIT OR Apache-2.0)" }] }));
  assert.deepEqual(doc.components[0].licenses, [
    { id: "MIT", rawText: "(MIT OR Apache-2.0)" },
    { id: "Apache-2.0", rawText: "(MIT OR Apache-2.0)" },
  ]);
});

test("a free-text license name is kept as its own id", () => {
  const doc = parseCycloneDx(bomWith({ licenses: [{ license: { name: "Apache2" } }] }));
  assert.deepEqual(doc.components[0].licenses, [{ id: "Apache2", rawText: null }]);
});

test("a component with no licenses has an empty list", () => {
  const doc = parseCycloneDx(bomWith({}));
  assert.deepEqual(doc.components[0].licenses, []);
});

test("refuses a file that is not CycloneDX", () => {
  const spdx = JSON.stringify({ spdxVersion: "SPDX-3.0" });
  assert.throws(() => parseCycloneDx(spdx), /not a CycloneDX 1.x SBOM/);
});

test("refuses a file that is not JSON", () => {
  assert.throws(() => parseCycloneDx("not json"), /not valid JSON/);
});
