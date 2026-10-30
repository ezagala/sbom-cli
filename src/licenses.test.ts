import test from "node:test";
import assert from "node:assert/strict";
import { SUSPECT_LICENSES, isSuspect } from "./licenses.ts";

test("every license on the list is suspect", () => {
  for (const id of SUSPECT_LICENSES.keys()) {
    assert.equal(isSuspect(id), true, id);
  }
});

test("common permissive licenses are not suspect", () => {
  for (const id of ["MIT", "ISC", "Apache-2.0", "BSD-3-Clause"]) {
    assert.equal(isSuspect(id), false, id);
  }
});
