import { hasDocument, insertDocument, upsertLicenses, type Database } from "./db.ts";
import { isSuspect } from "./licenses.ts";
import { parseCycloneDx } from "./sbom.ts";

// A document is identified by its name and version. Ingesting one that is
// already stored changes nothing and says so.
export type IngestResult =
  | { stored: true; name: string; version: string; components: number; suspect: number }
  | { stored: false; name: string; version: string };

export function ingest(db: Database, text: string): IngestResult {
  const doc = parseCycloneDx(text);
  if (hasDocument(db, doc.name, doc.version)) {
    return { stored: false, name: doc.name, version: doc.version };
  }

  const licenseIds = new Set(doc.components.flatMap((c) => c.licenses.map((l) => l.id)));
  upsertLicenses(db, [...licenseIds].map((id) => ({ id, suspect: isSuspect(id) })));
  insertDocument(db, doc);

  // How many components carry at least one suspect license.
  const suspect = doc.components.filter((c) => c.licenses.some((l) => isSuspect(l.id))).length;
  return { stored: true, name: doc.name, version: doc.version, components: doc.components.length, suspect };
}
