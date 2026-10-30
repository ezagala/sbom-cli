import type { Component, Document, License } from "./model.ts";

// The parts of a CycloneDX 1.x JSON file this program reads.
type RawLicense = {
  license?: { id?: string; name?: string };
  expression?: string;
};

type RawComponent = {
  name: string;
  version?: string;
  purl?: string;
  "bom-ref"?: string;
  licenses?: RawLicense[];
};

type RawBom = {
  bomFormat?: string;
  specVersion?: string;
  serialNumber?: string;
  metadata?: { component?: { name?: string; version?: string } };
  components?: RawComponent[];
};

export function parseCycloneDx(text: string): Document {
  let bom: RawBom;
  try {
    bom = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  if (bom.bomFormat !== "CycloneDX" || !bom.specVersion?.startsWith("1.")) {
    throw new Error("The file is not a CycloneDX 1.x SBOM.");
  }
  const root = bom.metadata?.component ?? {};
  return {
    format: "CycloneDX",
    specVersion: bom.specVersion,
    serialNumber: bom.serialNumber ?? null,
    name: root.name ?? "unknown",
    version: root.version ?? "unknown",
    components: (bom.components ?? []).map(toComponent),
    raw: text,
  };
}

function toComponent(raw: RawComponent): Component {
  return {
    name: raw.name,
    version: raw.version ?? "unknown",
    purl: raw.purl ?? null,
    bomRef: raw["bom-ref"] ?? null,
    licenses: toLicenses(raw.licenses ?? []),
  };
}

function toLicenses(raw: RawLicense[]): License[] {
  return raw.flatMap((entry): License[] => {
    if (entry.expression) {
      const expression = entry.expression;
      return splitExpression(expression).map((id) => ({ id, rawText: expression }));
    }
    const id = entry.license?.id ?? entry.license?.name;
    return id ? [{ id, rawText: null }] : [];
  });
}

// "(MIT OR Apache-2.0)" becomes ["MIT", "Apache-2.0"]. AND and OR are treated alike.
function splitExpression(expression: string): string[] {
  return expression
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter((word) => word !== "" && word !== "OR" && word !== "AND");
}
