# SBOM CLI: implementation plan

**Date:** 2026-10-29 · **Author:** Claude (Fable 5.1), for Eric · **Status:** Draft · **Ticket:** none; the work statement is [exercise_instructions.md](exercise_instructions.md) and the commit outline from the kickoff · **Branch:** `main` · **Design:** [design-guidelines.md](design-guidelines.md) all sections, [sql-vs-nosql.md](sql-vs-nosql.md) · **Charter:** [charter.md](charter.md)

**Inputs.** The design docs above; `sbom-cli` at `origin/main` `902bfd3`, read on 2026-10-29 (it holds only docs, `CLAUDE.md`, and `.gitignore`, so every source file below is new); the standing rules in [CLAUDE.md](../CLAUDE.md); the fixture at `../cli/fixtures/juice-shop-14.1.1.cdx.json` and its README; the `node:sqlite` review from the forked session on 2026-10-29; the environment on this machine, checked on 2026-10-29.

**How to read this document.** Section 1 says in plain language what gets built and where it stops. Section 2 is the commit map: five commits, each with what it changes, how it is proven, and the first moment it can be run for real. Section 3 is the verification matrix. Section 4 lists the decisions this plan makes that the design left open, with the alternative for each. Section 5 is the live gate, and section 6 the rules and the estimate.

## Contents

1. **[What this builds](#1-what-this-builds)** — a two-command CLI over SQLite, in plain language.
2. **[Grounding](#2-grounding)** — what was checked against the pinned commit and the machine.
3. **[Commit map](#3-commit-map)** — five commits, each verifiable on its own.
4. **[Verification matrix](#4-verification-matrix)** — the checks that define done.
5. **[Decisions made here](#5-decisions-made-here)** — gaps the design left, and the choice taken for each.
6. **[Live gate](#6-live-gate)** — the end-to-end run from a fresh clone.
7. **[Rules, order and estimate](#7-rules-order-and-estimate)**

## 1. What this builds

*A CLI that reads one CycloneDX SBOM into SQLite and answers two questions about it.*

Today the repo holds a design and nothing else. What lands is a TypeScript program that runs directly under Node 26 with one runtime dependency, `commander`. It has two commands. `ingest <sbom-file>` parses a CycloneDX 1.6 JSON file, splits each component's licenses into SPDX ids, marks the ids on a short static list as suspect, and writes the document, its components, and their licenses into four SQLite tables. `query --component <name> [--version <v>]` prints the documents that contain that component. `query --license <id>` prints the components that carry that license and the document each belongs to.

The parts land in the order the architecture diagram stacks them, bottom up after the entry point: the CLI shell and the parser first, then the database client, then ingest with enrichment, then query, then the README.

It deliberately does not parse SPDX, store the dependency graph, flatten nested components, carry the full SPDX license list, or parse license expressions properly. The design doc's Out of scope list is binding and each item above is on it.

## 2. Grounding

The pinned commit has no code, so there are no hooks to extend. Grounding instead checked the claims the design makes about the environment. Each was run on this machine on 2026-10-29.

| # | Claim | Result | Evidence |
|---|---|---|---|
| G1 | `origin/main` `902bfd3` holds only docs, assets, `CLAUDE.md`, `.gitignore` | TRUE | `git ls-tree -r origin/main`: 10 files, none under `src` |
| G2 | Node 26 runs `.ts` files directly with no flag | TRUE, with a condition | `node v26.12.1`. A `.ts` file with `import` fails unless the nearest `package.json` has `"type": "module"` |
| G3 | `node:sqlite` loads with no flag and its main class is `Database` | PARTLY | Runtime exports `Database` and `DatabaseSync`. `@types/node@26.6.6`, the latest, exports only `DatabaseSync`; `import { Database }` fails the type check. `DatabaseSync` runs with no deprecation warning. SQLite 3.54.0 |
| G4 | `node --test` finds `src/*.test.ts` with no config | TRUE | One test file beside source, `node --test` from the project root: 1 pass |
| G5 | `tsc` can type-check `.ts` imports with no emit | TRUE | `typescript@7.0.2` with `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `module: nodenext`: clean |
| G6 | `commander` supports two subcommands each with a `--db` option | TRUE | `commander@15.0.0`. A `query` subcommand with `--version` does not collide with commander's own version flag because `program.version()` is never called. A bare `query` with no filter is accepted by commander, so that refusal is ours to write |
| G7 | The fixture is CycloneDX 1.6 with 1,101 library components and no nesting | TRUE | `jq`: 1,101 components, all `library`, 0 with child `components`, 1,102 dependency entries |
| G8 | Licenses arrive in four shapes | TRUE | 1,079 components with one `license` object, 5 with two, 7 with an SPDX `expression`, 10 with none. Three free-text `name` values: `MIT/X11`, `BSD`, `Apache2`. 11 distinct SPDX ids |
| G9 | Component names repeat at different versions | TRUE | 117 names at more than one version; `ms` appears 14 times |
| G10 | The fixture carries a serial number and timestamp | FALSE | `serialNumber` is null and `metadata` has no `timestamp`. `ingested_at` is set by the program |
| G11 | Scoped npm packages keep the scope out of `name` | TRUE | `name: "colors", group: "@colors"`, purl `pkg:npm/%40colors/colors@1.6.0`. See decision 6 |

Gaps the design left are listed in section 5. Surprises: G2 and G3. Both are small and are absorbed by commit 1 and commit 2.

## 3. Commit map

*Five commits. Each is green on its own, each has its own proof, and the live moments come as early as the dependencies allow: commit 1 parses the fixture from the command line the moment it exists, commit 3 is the first write to a database file, commit 4 the first answered query.*

Conventions used below. **Changes** names files against `origin/main` `902bfd3`; every file is new unless marked. **Proof** says how the commit is verified before the next one starts: unit tests run with `npm test`, which is `node --test`, for the test beside every source file; `npm run typecheck`, which is `tsc`, must be clean; and **live** means running the CLI in this checkout against the fixture. Commit subjects follow conventional commits. The code rules in `CLAUDE.md` apply throughout: readable over clever, built-ins before dependencies, plain language in every string a user sees.

### Commit 1 — Project, CLI shell, fixture, parser

`feat: bootstrap CLI with commander entry point and CycloneDX parser`

**In plain language.** This commit makes the project exist and gives it the ability to read an SBOM, without storing anything. After it, `ingest` prints what it parsed and `query` says it is not implemented yet. The parser lands in full here rather than as a stub, because it is self-contained, its tests run against the real fixture, and it gives the project a live moment on day one. The data model types land here too because the parser produces them.

**Changes**

- `package.json`: name `sbom-cli`, `"type": "module"` (G2), `"private": true`, `engines.node >=26`, `bin` pointing at `src/cli.ts`, scripts `start`, `test`, `typecheck`. Dependency `commander@^15`. Dev dependencies `typescript@^7` and `@types/node@^26`.
- `tsconfig.json`: the options verified in G5, `strict`, `include: ["src"]`.
- `.nvmrc`: `26`.
- `fixtures/juice-shop-14.1.1.cdx.json` and `fixtures/README.md`: copied from `../cli/fixtures` with the provenance table and SHA-256.
- `src/model.ts`: the three plain types the layers share. `Document` with `format`, `specVersion`, `serialNumber`, `name`, `version`, `components`, `raw`. `Component` with `name`, `version`, `purl`, `bomRef`, `licenses`. `License` with `id` and `rawText`.
- `src/sbom.ts` (+ `src/sbom.test.ts`): `parseCycloneDx(text: string): Document`. Refuses anything whose `bomFormat` is not `CycloneDX` or whose `specVersion` does not start with `1.`, with a one-line message. Takes the document name and version from `metadata.component`. For each component, turns the `licenses` array into `License[]`: a `license.id` or `license.name` becomes one entry; an `expression` is split on `OR`, `AND`, and parentheses into one entry per member with `rawText` set to the original expression. Keeps the whole file text as `raw`.
- `src/cli.ts` (+ `src/cli.test.ts`): the commander program with `ingest <sbom-file>` and `query`, each with `--db <path>` defaulting to `./sbom.db`. `query` takes `--component <name>`, `--version <version>`, `--license <id>`. In this commit `ingest` reads the file, calls the parser, and prints a summary; `query` prints `not implemented yet` to stderr and exits 1. Shebang line `#!/usr/bin/env node`. The CLI never imports `node:sqlite` or touches SQL, in this commit or any later one.

**Proof**

- Unit: parser accepts the fixture and yields 1,101 components with the document named `juice-shop` `14.1.1`; a component with two license objects yields two entries; `(MIT OR Apache-2.0)` yields `MIT` and `Apache-2.0` with the expression as `rawText`; a free-text name is kept as its own id; a component with no licenses yields an empty list; wrong `bomFormat` and malformed JSON are refused with the message. CLI: `ingest` with no argument exits non-zero; `query` with no filter exits non-zero with a message.
- **Live, first parse:** `node src/cli.ts ingest fixtures/juice-shop-14.1.1.cdx.json` prints `Parsed juice-shop 14.1.1: 1101 components`. `node src/cli.ts ingest missing.json` prints a one-line error and exits 1. `npm test` and `npm run typecheck` are clean.

### Commit 2 — Database client

`feat(db): open SQLite and add the schema with write and read queries`

**In plain language.** This commit is the only place SQL lives. It opens a database, creates the four tables and three indexes from the design if they are missing, and exposes a handful of named functions: two that write and two that read. Nothing calls it from the CLI yet, so the program looks the same as after commit 1. It is separate so a reviewer can read the schema and the queries on their own, and so the `node:sqlite` surface stays in one file.

**Changes**

- `src/db.ts` (+ `src/db.test.ts`):
  - `openDatabase(path: string): DatabaseSync` using the `DatabaseSync` name the types export (G3, decision 1). Runs the schema with `create table if not exists`: `documents (id integer primary key, format, spec_version, serial_number, name, version, ingested_at, raw)`; `components (id integer primary key, document_id references documents, name, version, purl, bom_ref)`; `licenses (id text primary key, name, suspect integer not null default 0)`; `component_licenses (component_id references components, license_id references licenses, raw_text, primary key (component_id, license_id))`. Indexes on `components (name, version)`, `components (purl)`, and `component_licenses (license_id)`. No `dependencies` table, per Out of scope.
  - `upsertLicenses(db, licenses: { id: string; suspect: boolean }[])`: insert or replace.
  - `insertDocument(db, doc: Document): number`: one transaction (`BEGIN` and `COMMIT` through `exec`) that inserts the document row with `ingested_at` as an ISO timestamp, then every component, then every component license with `insert or ignore`, since a component may list the same license twice and the primary key would otherwise refuse it. Returns the document id.
  - `findDocumentsWithComponent(db, name: string, version?: string)`: distinct document name and version, ordered by name then version.
  - `findComponentsWithLicense(db, licenseId: string)`: component name and version, document name and version, and the license's `suspect` flag, ordered by component name then version.

**Proof**

- Unit, all against `:memory:`: opening twice is idempotent; inserting a two-component document and reading it back by component name returns one document; with `version` only the matching version returns; a license shared by two components returns two rows with the right document; `upsertLicenses` twice leaves one row with the latest flag; inserting a document whose component list is empty still creates the document row.
- Live: nothing new to exercise from the CLI; proven by its tests and by commit 3.

### Commit 3 — Ingest and enrichment

`feat(ingest): store parsed SBOMs and flag suspect licenses`

**In plain language.** This commit connects the parser to the database and adds the one piece of judgement in the program: a short static list of license ids that are not open source or deserve a second look. After it, `ingest` writes a real database file and reports how many components it stored and how many carry a suspect license. The static list is its own file so the list and the reason for each entry can be read in isolation.

**Changes**

- `src/licenses.ts` (+ `src/licenses.test.ts`): `SUSPECT_LICENSES`, a `Map<string, string>` from SPDX id to a plain-language reason, and `isSuspect(id: string): boolean`. Decision 7 fixes the initial contents. Three of its ids appear in the fixture, so enrichment is observable.
- `src/ingest.ts` (+ `src/ingest.test.ts`): `ingest(db, text: string): { name; version; components: number; suspect: number }`. Calls `parseCycloneDx`, collects the distinct license ids across all components, calls `upsertLicenses` with `isSuspect` applied to each, calls `insertDocument`, and returns the summary. Knows nothing about files or flags.
- `src/cli.ts` (modified from commit 1): `ingest` now reads the file, calls `openDatabase(opts.db)` then `ingest(db, text)`, and prints `Ingested juice-shop 14.1.1: 1101 components, 6 with a suspect license`. Errors from the parser or the file system print one line to stderr and exit 1.

**Proof**

- Unit: ingesting the fixture into `:memory:` stores 1,101 components and the document row; `GPL-2.0`, `CC-BY-3.0`, and `WTFPL` are marked suspect and `MIT` is not; a component with an expression gets one `component_licenses` row per member; ingesting the same text twice stores one document and reports it (decision 9). `isSuspect` is true for every id on the list and false for `MIT`.
- **Live, first write:** `node src/cli.ts ingest fixtures/juice-shop-14.1.1.cdx.json` prints the summary and creates `./sbom.db`. `node -e` against the file shows 1 document, 1,101 components, 3 license rows marked suspect, and 6 components that carry one. `--db /tmp/other.db` writes there instead.

### Commit 4 — Query

`feat(query): find documents by component and components by license`

**In plain language.** This commit answers the two questions the exercise asks. The business function is thin because the database client already does the work; what it adds is the rule that exactly one of the two filters must be given, and the plain-text shape of the output. After it, the program is complete except for its README.

**Changes**

- `src/query.ts` (+ `src/query.test.ts`): `queryByComponent(db, name, version?)` and `queryByLicense(db, licenseId)`, each returning the rows from the client unchanged. The one-filter rule lives in the CLI since it is about flags.
- `src/cli.ts` (modified): `query` refuses when neither or both of `--component` and `--license` are given, or when `--version` appears without `--component`, with a one-line message and exit 1. Otherwise prints one line per match. Component query: `<document name> <document version>`. License query: `<component name>\t<component version>\t<document name> <document version>`, with a trailing `\tsuspect` on rows whose license is flagged. No matches prints `No matches` to stderr and exits 0.

**Proof**

- Unit: against an in-memory database seeded through `ingest` with the fixture, `queryByComponent("ms")` returns one document; with version `2.1.3` the same one, with a version that does not exist none; `queryByLicense("GPL-2.0")` returns one row flagged suspect; `queryByLicense("MIT")` returns 920 rows. CLI tests cover each refusal and the no-match path.
- **Live, first answer:** after the commit 3 ingest, `node src/cli.ts query --component ms` prints `juice-shop 14.1.1`; `--component ms --version 2.1.3` prints the same; `--component ms --version 9.9.9` prints `No matches`; `--license GPL-2.0` prints one tab-separated line ending in `suspect`; `--license MIT | wc -l` prints 920; a bare `query` exits 1 with the message.

### Commit 5 — README

`docs: add README with usage`

**In plain language.** The exercise asks for a README of one or two paragraphs explaining how to use the CLI. This is the last commit because its proof is that someone who did not write the code can follow it from a fresh clone.

**Changes**

- `README.md`: what the tool does in two sentences; prerequisites (Node 26, `npm install`); the two commands with one example each using the fixture; where the database file goes and how to point it elsewhere; a pointer to `docs/` for the design.

**Proof**

- Live: the section 6 gate, run from a fresh clone by following only the README.

## 4. Verification matrix

*Each row is a check. "Kind" is U (unit test), L (live in this checkout against the fixture) or B (both). "Commit" is where the check first passes. The work is complete when every row passes; the live rows are re-run together as the gate in section 6.*

### 4.1 Project and CLI shell

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| C1 | `npm install` on Node 26 | one runtime dependency, no native build | L | 1 |
| C2 | `npm run typecheck` | clean, nothing emitted | L | 1 |
| C3 | `npm test` | finds every `src/*.test.ts` | L | 1 |
| C4 | `ingest` with no argument | exit 1, commander's missing-argument message | B | 1 |
| C5 | `ingest` with a file that does not exist | exit 1, one line naming the path | B | 1 |
| C6 | `query` with no filter | exit 1, one-line message | B | 1 (unit), 4 (final message) |
| C7 | `--db` on either command | the given path is used | B | 3 |

### 4.2 Parser

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| P1 | The fixture | 1,101 components, document `juice-shop` `14.1.1` | B | 1 |
| P2 | Two license objects on one component | two `License` entries | U | 1 |
| P3 | `(MIT OR Apache-2.0)` | entries `MIT` and `Apache-2.0`, `rawText` is the expression | U | 1 |
| P4 | Free-text name `Apache2` | one entry with id `Apache2` | U | 1 |
| P5 | No `licenses` field | empty list | U | 1 |
| P6 | `bomFormat` is `SPDX` or missing | refused with a message naming CycloneDX | U | 1 |
| P7 | Not JSON | refused with a message | U | 1 |
| P8 | Scoped package | `name` is `colors`, `purl` keeps the scope (decision 6) | U | 1 |

### 4.3 Database client

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| D1 | Open `:memory:` twice | schema created once, no error | U | 2 |
| D2 | Insert one document, read by component name | one document row back | U | 2 |
| D3 | Read by name and version | only the matching version | U | 2 |
| D4 | Read by license shared by two components | two rows, each with its document | U | 2 |
| D5 | Upsert the same license twice | one row, latest flag | U | 2 |
| D6 | Insert fails midway | no partial rows (transaction) | U | 2 |
| D7 | One component lists `MIT` twice | one `component_licenses` row | U | 2 |

### 4.4 Ingest and enrichment

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| I1 | Ingest the fixture | summary line, 1,101 components, 6 with a suspect license | B | 3 |
| I2 | `GPL-2.0`, `CC-BY-3.0`, `WTFPL` | `suspect = 1`; `MIT` is 0 | B | 3 |
| I3 | Expression component | one `component_licenses` row per member | U | 3 |
| I4 | Same document twice | one document row; `Already ingested` on stderr, exit 0 | B | 3 |
| I5 | `ingest` with an SPDX file | exit 1, message, no database write | B | 3 |
| I6 | Every id on the suspect list | `isSuspect` true; `MIT` false | U | 3 |

### 4.5 Query

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| Q1 | `--component ms` | `juice-shop 14.1.1`, once | B | 4 |
| Q2 | `--component ms --version 2.1.3` | same line | B | 4 |
| Q3 | `--component ms --version 9.9.9` | `No matches` on stderr, exit 0 | B | 4 |
| Q4 | `--component nope` | `No matches`, exit 0 | B | 4 |
| Q5 | `--license GPL-2.0` | one tab-separated line ending in `suspect` | B | 4 |
| Q6 | `--license MIT` | 920 lines (one per component, expression members included), none marked | B | 4 |
| Q7 | `--license` and `--component` together | exit 1, message | B | 4 |
| Q8 | `--version` without `--component` | exit 1, message | B | 4 |
| Q9 | `query` before any ingest | `No matches`, exit 0, database created empty | L | 4 |

### 4.6 Whole-project checks

| # | Check | Kind |
|---|---|---|
| W1 | `npm test` green; a test beside every source file | U |
| W2 | `npm run typecheck` clean | — |
| W3 | `src/cli.ts` imports nothing from `node:sqlite`; only `src/db.ts` contains SQL | — |
| W4 | Section 6 gate passes from a fresh clone following only the README | L |
| W5 | Every commit subject is a conventional commit; `git diff --stat` per commit touches only its listed files | — |

## 5. Decisions made here

*Places where the design left a choice. Each is this plan's recommendation; the alternative is stated so it can be overruled in one line.*

1. **Use the `DatabaseSync` name.** The runtime's main class is `Database`, but the Node types package only knows `DatabaseSync`, and it runs with no warning (G3). The import lives in one file, so renaming later is a one-line change. *Alternative:* import `Database` and silence the type error with a local declaration.
2. **A license id is whatever string the SBOM gives.** SPDX ids, free-text names like `Apache2`, and each member of a split expression all become a `licenses` row on first sight. This means `query --license Apache2` works and the `licenses` table needs no seed. *Alternative:* keep only SPDX ids and drop free text into `raw_text`.
3. **Expressions are split, not evaluated.** `(MIT OR Apache-2.0)` becomes two license rows for the component, with the expression kept in `raw_text`. A query for either id finds the component. *Alternative:* store the expression as one opaque id.
4. **The component query prints distinct documents.** One line per document that contains the component, regardless of how many versions it contains. *Alternative:* one line per occurrence with the version appended.
5. **The license query is tab-separated with a trailing marker.** Component name, version, document name and version, and the word `suspect` on flagged rows. Plain and grep-friendly. *Alternative:* an aligned table with a header.
6. **Component names are stored as the SBOM gives them.** For scoped npm packages that is `colors`, not `@colors/colors`; the scope stays in `purl` (G11). *Alternative:* store `group/name` when a group is present, so queries match how npm users write the name.
7. **The suspect list.** `GPL-2.0`, `GPL-3.0`, `LGPL-2.1`, `LGPL-3.0`, `AGPL-3.0` as copyleft; `CC-BY-3.0`, `CC-BY-4.0`, `CC-BY-SA-4.0` as content licenses, not software licenses; `WTFPL` as not OSI approved; `SSPL-1.0` and `BUSL-1.1` as source-available but not open source. Each entry carries its reason in the code. *Alternative:* a shorter list of only the three ids the fixture contains.
8. **No matches is not an error.** Nothing on stdout, `No matches` on stderr, exit 0, so the command composes with pipes. *Alternative:* exit 1.
9. **Re-ingest is a no-op.** A document is identified by its name and version; ingesting one that is already stored changes nothing and says so on stderr with exit 0. This was first planned as no dedupe, and changed after the live gate showed the component query and the license query disagreeing about how many documents exist. *Alternative:* replace the stored document, or exit 1.
10. **The parser lands complete in commit 1.** The outline said "scaffold parse"; a complete parser costs the same and gives commit 1 a live moment. *Alternative:* a stub that returns a fixed document.
11. **A fifth commit for the README.** The outline had four; the exercise requires a README, and the skill's rule is that docs come last with a fresh-clone proof. *Alternative:* fold the README into commit 4.
12. **Commits land on `main` directly.** Solo take-home, no PR, each commit reviewed in the pause after it lands. *Alternative:* a feature branch with one PR at the end.
13. **Run as `node src/cli.ts`.** The README shows this form. `bin` is set so `npm link` also works, but the README does not depend on it. *Alternative:* document `npm link` as the primary way.
14. **Plain `commander`, no `@commander-js/extra-typings`.** Two subcommands with a few options do not need inferred option types; the handlers declare their option shape in one line. *Alternative:* add the typings package as the sibling project did.

## 6. Live gate

*Run once as a whole after commit 5, from a fresh clone, following only the README. Each step names the matrix rows it covers.*

1. `git clone` into a scratch folder; `nvm use`; `npm install` (C1). `npm run typecheck` and `npm test` (C2, C3, W1, W2).
2. `node src/cli.ts query --component ms` before any ingest (Q9).
3. `node src/cli.ts ingest fixtures/juice-shop-14.1.1.cdx.json` (I1). Check the file exists. Run it again and confirm a second document (I4).
4. Component queries: Q1, Q2, Q3, Q4. License queries: Q5, Q6. Refusals: C4, C5, C6, Q7, Q8.
5. `--db /tmp/gate.db` on ingest then query (C7).
6. `grep -l sqlite src/*.ts` lists only `src/db.ts` (W3).
7. Delete the scratch clone, `./sbom.db`, and `/tmp/gate.db`.

SPDX input, nested components, and the dependency graph are not in this gate; they are on the design doc's Out of scope list.

## 7. Rules, order and estimate

- One commit at a time. After each commit lands, stop and wait for a go-ahead before starting the next, per `CLAUDE.md`.
- A test beside every source file, run with `node --test`. Type check before every commit. No build step.
- Plain language in every user-facing string, comment, and commit message. Comments two lines at most.
- Scope fences: only `src/db.ts` imports `node:sqlite` or contains SQL. `src/cli.ts` contains no business logic beyond flag validation and printing. Nothing on the Out of scope list is touched.
- Order is fixed: 1 → 2 → 3 → 4 → 5. Commit 2 has no live moment of its own and is proven by its tests and by commit 3.

**Estimate.** Commit 1: about 1.5 hours, most of it the parser tests and the fixture README. Commit 2: about 1 hour. Commit 3: about 1 hour. Commit 4: about 1 hour. Commit 5 and the gate: about half an hour. Around 5 hours of engineering, before the pauses for review between commits. There was no earlier figure to compare against.
