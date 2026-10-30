# Working rules

This project answers a take-home exercise. It exists to show how the work is approached, not to be production software. Read `docs/charter.md` and `docs/design-guidelines.md` first.

## Code

- Optimize for readability. Idiomatic, conventional, and as simple as reasonably possible. No clever tricks.
- Keep runtime requirements to a minimum. Node 26 built-ins before dependencies.
- Scope tightly to the exercise requirements. The design doc's Out of scope list is binding.
- TypeScript runs directly under Node. `tsc` is a type check only, never a build step.
- Tests use `node:test` and sit beside the file they test, as `name.test.ts`.

## Prose

- Plain language everywhere: docs, comments, commit messages, CLI output.
- Jargon only when strictly required.

## Process

- Conventional commits.
- Work one commit at a time and pause for a go-ahead after each one lands.
