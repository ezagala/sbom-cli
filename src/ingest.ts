import { insertDocument, upsertLicenses, type Database } from "./db.ts";
import { isSuspect } from "./licenses.ts";
import { parseCycloneDx } from "./sbom.ts";

export type IngestSummary = {
  name: string;
  version: string;
  components: number;
  // How many components carry at least one suspect license.
  suspect: number;
};

export function ingest(db: Database, text: string): IngestSummary {
  const doc = parseCycloneDx(text);

  const licenseIds = new Set(doc.components.flatMap((c) => c.licenses.map((l) => l.id)));
  upsertLicenses(db, [...licenseIds].map((id) => ({ id, suspect: isSuspect(id) })));
  insertDocument(db, doc);

  const suspect = doc.components.filter((c) => c.licenses.some((l) => isSuspect(l.id))).length;
  return { name: doc.name, version: doc.version, components: doc.components.length, suspect };
}
