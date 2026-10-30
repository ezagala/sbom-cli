#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { openDatabase, type LicenseMatch } from "./db.ts";
import { ingest } from "./ingest.ts";
import { queryByComponent, queryByLicense } from "./query.ts";

const program = new Command()
  .name("sbom-cli")
  .description("Ingest SBOMs and query them by component or license.");

program
  .command("ingest")
  .description("Parse a CycloneDX JSON file and store it.")
  .argument("<sbom-file>", "path to a CycloneDX 1.x JSON file")
  .option("--db <path>", "database file", "./sbom.db")
  .action((file: string, opts: { db: string }) => {
    const text = readFile(file);
    const summary = ingest(openDatabase(opts.db), text);
    console.log(
      `Ingested ${summary.name} ${summary.version}: ${summary.components} components, ${summary.suspect} with a suspect license`,
    );
  });

program
  .command("query")
  .description("Find documents by component, or components by license.")
  .option("--component <name>", "component name")
  .option("--version <version>", "only match this version of the component")
  .option("--license <id>", "license id")
  .option("--db <path>", "database file", "./sbom.db")
  .action((opts: { component?: string; version?: string; license?: string; db: string }) => {
    if (!opts.component && !opts.license) {
      fail("Give --component <name> or --license <id>.");
    }
    if (opts.component && opts.license) {
      fail("Give either --component or --license, not both.");
    }
    if (opts.version && !opts.component) {
      fail("--version only works together with --component.");
    }
    const db = openDatabase(opts.db);
    const lines = opts.component
      ? queryByComponent(db, opts.component, opts.version).map((d) => `${d.name} ${d.version}`)
      : queryByLicense(db, opts.license ?? "").map(formatLicenseMatch);
    if (lines.length === 0) {
      console.error("No matches");
    } else {
      console.log(lines.join("\n"));
    }
  });

// One tab-separated line: component name, version, document, and "suspect" when flagged.
function formatLicenseMatch(match: LicenseMatch): string {
  const line = `${match.componentName}\t${match.componentVersion}\t${match.documentName} ${match.documentVersion}`;
  return match.suspect ? `${line}\tsuspect` : line;
}

function readFile(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new Error(`Cannot read ${path}.`);
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

try {
  program.parse();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
