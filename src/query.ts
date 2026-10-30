// The two questions the exercise asks. Each hands the work to the database client,
// so the CLI never calls the client directly.
import {
  findComponentsWithLicense,
  findDocumentsWithComponent,
  type Database,
  type DocumentMatch,
  type LicenseMatch,
} from "./db.ts";

export function queryByComponent(db: Database, name: string, version?: string): DocumentMatch[] {
  return findDocumentsWithComponent(db, name, version);
}

export function queryByLicense(db: Database, licenseId: string): LicenseMatch[] {
  return findComponentsWithLicense(db, licenseId);
}
