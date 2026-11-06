// The two questions the exercise asks. Each hands the work to the database client,
// so the CLI never calls the client directly.
import {
  findComponentsWithLicense,
  findDocumentsWithComponent,
  type Database,
  type DocumentMatch,
  type LicenseMatch,
} from "./db.ts";

// A package name as people write it, such as "@types/debug", is matched on both its group
// and its name, so "debug" finds only the package with no group.
export function queryByComponent(db: Database, packageName: string, version?: string): DocumentMatch[] {
  const { group, name } = splitPackageName(packageName);
  return findDocumentsWithComponent(db, group, name, version);
}

// The full package name for printing: "@types/debug", or "debug" when there is no group.
export function joinPackageName(group: string | null, name: string): string {
  return group === null ? name : `${group}/${name}`;
}

// Splits at the last slash, the same way a purl separates its namespace from its name.
function splitPackageName(packageName: string): { group: string | null; name: string } {
  const slash = packageName.lastIndexOf("/");
  if (slash === -1) {
    return { group: null, name: packageName };
  }
  return { group: packageName.slice(0, slash), name: packageName.slice(slash + 1) };
}

export function queryByLicense(db: Database, licenseId: string): LicenseMatch[] {
  return findComponentsWithLicense(db, licenseId);
}
