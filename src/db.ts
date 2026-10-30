// The database client. This is the only file that knows SQL.
import { DatabaseSync } from "node:sqlite";
import type { Document } from "./model.ts";

// The connection type the rest of the program passes around.
export type Database = DatabaseSync;

const schema = `
  create table if not exists documents (
    id integer primary key,
    format text not null,
    spec_version text not null,
    serial_number text,
    name text not null,
    version text not null,
    ingested_at text not null,
    raw text not null
  );

  create table if not exists components (
    id integer primary key,
    document_id integer not null references documents (id),
    name text not null,
    version text not null,
    purl text,
    bom_ref text
  );
  create index if not exists components_name_version on components (name, version);
  create index if not exists components_purl on components (purl);

  create table if not exists licenses (
    id text primary key,
    name text,
    suspect integer not null default 0
  );

  create table if not exists component_licenses (
    component_id integer not null references components (id),
    license_id text not null references licenses (id),
    raw_text text,
    primary key (component_id, license_id)
  );
  create index if not exists component_licenses_license on component_licenses (license_id);
`;

export function openDatabase(path: string): Database {
  const db = new DatabaseSync(path);
  db.exec("pragma foreign_keys = on");
  db.exec(schema);
  return db;
}

export function upsertLicenses(db: Database, licenses: { id: string; suspect: boolean }[]): void {
  const upsert = db.prepare(
    "insert into licenses (id, suspect) values (?, ?) on conflict (id) do update set suspect = excluded.suspect",
  );
  for (const license of licenses) {
    upsert.run(license.id, license.suspect ? 1 : 0);
  }
}

export function hasDocument(db: Database, name: string, version: string): boolean {
  return db.prepare("select 1 from documents where name = ? and version = ?").get(name, version) !== undefined;
}

// Writes the document, its components, and their licenses in one transaction.
// Returns the new document id.
export function insertDocument(db: Database, doc: Document): number {
  const insertDoc = db.prepare(
    `insert into documents (format, spec_version, serial_number, name, version, ingested_at, raw)
     values (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertComponent = db.prepare(
    "insert into components (document_id, name, version, purl, bom_ref) values (?, ?, ?, ?, ?)",
  );
  const ensureLicense = db.prepare("insert or ignore into licenses (id) values (?)");
  // "or ignore" because a component may list the same license twice.
  const insertComponentLicense = db.prepare(
    "insert or ignore into component_licenses (component_id, license_id, raw_text) values (?, ?, ?)",
  );

  db.exec("begin");
  try {
    const documentId = Number(
      insertDoc.run(
        doc.format,
        doc.specVersion,
        doc.serialNumber,
        doc.name,
        doc.version,
        new Date().toISOString(),
        doc.raw,
      ).lastInsertRowid,
    );
    for (const component of doc.components) {
      const componentId = Number(
        insertComponent.run(documentId, component.name, component.version, component.purl, component.bomRef)
          .lastInsertRowid,
      );
      for (const license of component.licenses) {
        ensureLicense.run(license.id);
        insertComponentLicense.run(componentId, license.id, license.rawText);
      }
    }
    db.exec("commit");
    return documentId;
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

export type DocumentMatch = { name: string; version: string };

export function findDocumentsWithComponent(db: Database, name: string, version?: string): DocumentMatch[] {
  // coalesce makes the version filter a no-op when no version is given.
  const rows = db
    .prepare(
      `select distinct d.name, d.version
       from components c
       join documents d on d.id = c.document_id
       where c.name = ? and c.version = coalesce(?, c.version)
       order by d.name, d.version`,
    )
    .all(name, version ?? null) as { name: string; version: string }[];
  return rows.map((row) => ({ name: row.name, version: row.version }));
}

export type LicenseMatch = {
  componentName: string;
  componentVersion: string;
  documentName: string;
  documentVersion: string;
  suspect: boolean;
};

export function findComponentsWithLicense(db: Database, licenseId: string): LicenseMatch[] {
  const rows = db
    .prepare(
      `select c.name as componentName, c.version as componentVersion,
              d.name as documentName, d.version as documentVersion, l.suspect
       from component_licenses cl
       join components c on c.id = cl.component_id
       join documents d on d.id = c.document_id
       join licenses l on l.id = cl.license_id
       where cl.license_id = ?
       order by c.name, c.version`,
    )
    .all(licenseId) as {
    componentName: string;
    componentVersion: string;
    documentName: string;
    documentVersion: string;
    suspect: number;
  }[];
  return rows.map((row) => ({
    componentName: row.componentName,
    componentVersion: row.componentVersion,
    documentName: row.documentName,
    documentVersion: row.documentVersion,
    suspect: row.suspect === 1,
  }));
}
