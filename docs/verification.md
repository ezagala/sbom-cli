# Verification

The program was verified two ways at every commit: unit tests run with `npm test`, and live runs of the CLI against the fixture. Each commit had to pass both before the next began. The full list of checks, with the commit where each first passes, is the matrix in [implementation-plan.md](implementation-plan.md).

## Unit tests

38 tests, each beside the file it tests, run with Node's built-in runner. Database tests use an in-memory SQLite database through the same code path as a file, so there is no test-only branch.

| File | Happy paths | Failure modes |
|---|---|---|
| `sbom.test.ts` | Parses the fixture: 1,101 components, document name and version. Two license objects, an expression split into members, a free-text name, a scoped package name kept as given. | Not JSON. Not CycloneDX. No licenses on a component. |
| `db.test.ts` | Find a document by component, by component and version, a document once despite several versions, a license shared by two components with the suspect flag. Reopening a file keeps schema and data. | A failed insert leaves no partial rows. Upserting a license twice leaves one row. A component listing the same license twice gets one row. A document with no components. |
| `licenses.test.ts` | Every id on the static list is suspect. | Common permissive licenses are not. |
| `ingest.test.ts` | The fixture stores 1,101 components and reports 6 with a suspect license. The three list ids present in the fixture are flagged, MIT is not. An expression yields one row per member. | A non-CycloneDX file is refused and nothing is stored. The same document twice stores it once and reports it. |
| `query.test.ts` | A component found in its document, at one version, and `GPL-2.0` returning `fuzzball` flagged. `MIT` returns 920 components, none flagged. | An unknown component and an unknown version return nothing. |
| `cli.test.ts` | Ingest prints the summary and creates the database at `--db`. Each query prints its expected lines. | Missing file argument. Unreadable file. Non-CycloneDX file. An already stored document. No filter, both filters, `--version` without `--component`. No matches exits 0 with a note on stderr. |

## Live verification

After each commit, the CLI was run by hand against the fixture, matching the plan's live moments: commit 1 parses the file from the command line, commit 3 writes the first database file, commit 4 answers the first query.

The final gate ran from a fresh clone of the pushed repo, following only the README:

1. `npm install`, `npm run typecheck`, `npm test` on Node 26.
2. A query before any ingest: `No matches`, exit 0, empty database created.
3. Ingest the fixture, confirm the file exists, ingest again and confirm it is reported as already stored.
4. Component queries: `ms` found once, found at `2.1.3`, not found at `9.9.9`, unknown name not found.
5. License queries: `GPL-2.0` prints `fuzzball` with the `suspect` marker. `MIT` prints one line per component with no marker. `WTFPL` lists components that carry it inside an expression. The free-text name `Apache2` finds its component.
6. Refusals, each one line on stderr and exit 1: no file argument, missing file, SPDX file, no filter, both filters, `--version` without `--component`.
7. `--db` on both commands uses the given path.
8. Only `src/db.ts` mentions SQLite.

The clone and database files were deleted afterward.

## Not verified

SPDX input, nested components, and the dependency graph are out of scope and were not exercised. The schema was not tested against Postgres; the scaling discussion in the design doc is reasoning, not measurement.
