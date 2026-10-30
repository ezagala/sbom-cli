# Grounding checklist

How to turn a design into verified claims, and what tends to be missed.

## The subagent prompt shape

Delegate the reading. Give the subagent the pinned ref, the claims, and the output shape, and
forbid edits and the working tree. A prompt that has worked:

```
Read-only code verification. Do NOT edit, commit, or run services.
Repo: <path>. Verify against `origin/<default branch>` = <sha> (already fetched).
Use `git -C <repo> grep -n <pat> <ref> -- <path>` and
`git -C <repo> show <ref>:<path>`; never the working tree; never `cd`.

Context: <two sentences on what the design proposes>.

For each claim, report TRUE / PARTLY / FALSE with file:line evidence and
one or two sentences. Be concise; no file dumps.

1. <claim about existing behaviour, phrased so it can be false>
2. <…>

Return a compact table, then two lists:
"Gaps: design assumes something that does not exist" and
"Surprises: code contradicts the design".
```

Phrase claims so they can be false. "The authentication layer loads the user" is checkable;
"the authentication layer handles auth" is not. Ask for enum values, signatures and field
names verbatim when the plan will need them.

A second, narrower pass is usually worth it once the commit boundaries are known: "for the
files commit N touches, give me the exact signatures, the registration points, the test file
beside each, and an example of the pattern I am extending." That is what makes the Changes
lists precise.

## Hazards that hide work

Each of these has cost a day or a review round when missed.

- **Exhaustive maps and `switch`es over an enum.** In a typed language, adding an enum value
  breaks the build until every exhaustive site is updated; that is good, but the plan must
  list them so the commit is sized right. Searching for an existing value of the enum
  (`git grep -n <ExistingValue>`) finds the non-exhaustive sites too — the ones that will
  silently fall through to a default.
- **Prefix and format regexes.** A new token prefix, id prefix or file extension is usually
  matched in more than one place (header parsing *and* an alternate header; the loader *and*
  every test that calls the loader with a default directory).
- **Allow-lists and visibility filters.** List/revoke/delete paths often filter by a fixed set
  of types; a new type is invisible and un-revocable until added. Read-only database roles
  and operational allow-lists need the new tables.
- **Generated code.** API clients, API specs, schemas generated from type definitions: never
  hand-edit; name the regeneration commands and their order (each generator before anything
  that consumes its output).
- **Serializers that list fields by hand** vs serializers with exclude lists. Adding a column
  to a model can leak through an exclude-list serializer; adding a field to an explicit one
  is a deliberate change that must be named.
- **Migrations and rollout compatibility.** Code deployed before an enum value or column
  exists may fail when it reads a row carrying it. Nullable columns are usually safe; new enum
  values are safe only while no row carries them. Note the repo's rollout-compatibility rule,
  if it has one.
- **Middleware and authorization ordering.** Global checks usually run before route-level
  ones, and some hooks run only after all of them. Request context populated late in the chain
  is empty earlier, so anything written early must pass the account and user explicitly.
- **Best-effort vs raising paths.** Audit, metrics and notification helpers often swallow
  errors by design. If the design needs "refuse the work when the write fails", find or add
  the raising path and say which.
- **"Existing" outcome or status fields.** Check whether a computed value is actually on the
  returned shape or only persisted. A status computed inside a job and never returned is
  net-new work to surface.
- **Precedent that does not exist.** "A wrapper job", "a child workflow", "a lock utility",
  "worker versioning": grep for the primitive the design names. No hits means the plan's
  first use carries design cost — say so and make it a decision.
- **Config that is unset.** A timeout, a session lifetime, a header mapping the design relies
  on may be a library or provider default rather than something the repo sets. Say "default,
  not set in <file>" instead of quoting the default as fact.
- **Environment protections.** If a step runs through a deploy pipeline, check which refs the
  environment accepts and whether required reviewers exist; the answer changes who can run it.

## Failure-mode prompts for the verification matrix

For every trust boundary, ask each of these and give the row an id:

- Credential: revoked, expired, wrong kind, wrong prefix for its stored type, right kind on
  the wrong route, used where it must be refused (management routes, other protocols).
- Principal: disabled, pending, wrong domain or organization, entitlement absent / expired /
  revoked after the credential was issued (does revocation take effect on the next request?).
- Target: missing, malformed, unknown, the system/internal one, the wrong kind, one the caller
  does not belong to.
- Writes that must precede work: the write raises → the work does not happen; the handler
  raises after the write → the record says so; a refused request → no record where it
  would be misleading.
- Secrets: the token, the session, response bodies never appear in logs or audit rows.
- Limits: the Nth+1 call is refused; a different key or account is unaffected.
- CLI/task inputs: every required flag missing, out-of-range values, a credential found
  somewhere it must not be read from, overwrite without `--force`, the error from the server
  surfaced with its reason.
- Regression: the existing path of the same shape (the old key type, the old route) is
  unchanged.
- Whole-PR: lint, type-check, generated code in sync, no files touched outside the stated
  scope, the live gate run once end to end and torn down.
