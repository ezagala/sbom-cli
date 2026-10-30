#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { openDatabase } from "./db.ts";
import { ingest } from "./ingest.ts";

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
  .action((opts: { component?: string; version?: string; license?: string }) => {
    if (!opts.component && !opts.license) {
      fail("Give --component <name> or --license <id>.");
    }
    fail("Query is not implemented yet.");
  });

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
