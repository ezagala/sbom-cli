# sbom-cli

A small command line tool that reads a Software Bill of Materials (SBOM) into a local SQLite database and answers two questions about it: which documents contain a given component, and which components carry a given license. It reads CycloneDX 1.x JSON. While ingesting, it marks licenses from a short static list as suspect, so a reviewer can spot copyleft, content, or source-available licenses at a glance.

The tool is a take-home exercise, built to show an approach rather than to be production software. It runs directly on Node 26 with one dependency and no build step. The design, the data model, and the reasoning behind the database choice are in [docs/](docs/).

## Setup

Node 26 or later is required.

```bash
npm install
```

## Usage

Ingest an SBOM. This creates `./sbom.db` in the current folder if it does not exist.

```bash
node src/cli.ts ingest fixtures/juice-shop-14.1.1.cdx.json
```

Find the documents that contain a component, optionally at one version. Each match is one line: document name and version.

```bash
node src/cli.ts query --component ms
```

```bash
node src/cli.ts query --component ms --version 2.1.3
```

Find the components that carry a license. Each match is one tab-separated line: component name, component version, the document it belongs to, and the word `suspect` when the license is on the static list.

```bash
node src/cli.ts query --license GPL-2.0
```

When nothing matches, the command prints `No matches` to stderr and exits 0.

Both commands accept `--db <path>` to use a different database file. A document is identified by its name and version; ingesting one that is already stored changes nothing and says so.

## Development

```bash
npm test
```

```bash
npm run typecheck
```

Tests sit beside the files they test under `src/`.

## Attribution

Designed and built by Eric Zagala with Claude Code.
