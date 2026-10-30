// The plain types shared by the parser, the business logic, and the database client.

export type License = {
  // An SPDX id, a free-text name, or one member of a split expression.
  id: string;
  // The original expression when the id came from splitting one.
  rawText: string | null;
};

export type Component = {
  name: string;
  version: string;
  purl: string | null;
  bomRef: string | null;
  licenses: License[];
};

export type Document = {
  format: "CycloneDX";
  specVersion: string;
  serialNumber: string | null;
  name: string;
  version: string;
  components: Component[];
  // The file as it was given, kept so enrichment can be re-run later.
  raw: string;
};
