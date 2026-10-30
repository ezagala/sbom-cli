// Licenses worth a second look, with the reason for each.
// Anything not on this list is not flagged.
export const SUSPECT_LICENSES: ReadonlyMap<string, string> = new Map([
  ["GPL-2.0", "Copyleft: work that includes it must be released under the same terms."],
  ["GPL-3.0", "Copyleft: work that includes it must be released under the same terms."],
  ["LGPL-2.1", "Copyleft for the library itself; linking rules need review."],
  ["LGPL-3.0", "Copyleft for the library itself; linking rules need review."],
  ["AGPL-3.0", "Copyleft that also applies to software used over a network."],
  ["CC-BY-3.0", "A content license, not a software license."],
  ["CC-BY-4.0", "A content license, not a software license."],
  ["CC-BY-SA-4.0", "A content license with share-alike terms, not a software license."],
  ["WTFPL", "Not approved by the Open Source Initiative."],
  ["SSPL-1.0", "Source available, but not open source."],
  ["BUSL-1.1", "Source available, but not open source."],
]);

export function isSuspect(licenseId: string): boolean {
  return SUSPECT_LICENSES.has(licenseId);
}
