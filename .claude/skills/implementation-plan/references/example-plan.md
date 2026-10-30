# PR 1, CLI access tokens: implementation plan

> **Worked example.** Larkspur, its repository, its files and its line numbers are invented to show the shape and register of a plan written with this skill. Nothing here describes a real codebase.

**Date:** 2026-03-04 · **Author:** Claude, for the platform team · **Status:** Draft · **Ticket:** [EXP-318](https://tracker.example.com/EXP-318) · **Branch:** `feature/exp-318-cli-access-tokens` · **Design:** [README.md](../README.md) sections 2–4 · **Plan of record:** [implementation-plan.md](../implementation-plan.md) section 2

**Inputs.** The design and plan above; `larkspur` at `origin/main` `7b3e0c91f`, read on 2026-03-04 (file and line pointers below are to that commit); ticket EXP-318 and its blocker EXP-319, read on 2026-03-04; the `scripts/dev-instance` README; the standing rules in the repo's `CONTRIBUTING.md`; the security review of the design posted on EXP-318 on 2026-03-02.

**How to read this document.** Section 1 says in plain language what the PR builds and why it is the first of two. Section 2 is the commit map: eight commits, each with what it changes, how it is proven, and the first moment the code can be exercised live. Section 3 is the verification matrix that measures completeness, happy paths and failure modes together. Section 4 lists the decisions this plan makes that the design left open, with the alternative in each case. Section 5 is the live gate procedure, and section 6 the ordering rules and the estimate.

## Contents

1. **[What this PR builds](#1-what-this-pr-builds)** — a personal credential for the CLI, in plain language.
2. **[Commit map](#2-commit-map)** — eight commits, each verifiable on its own.
3. **[Verification matrix](#3-verification-matrix)** — the checks that define done.
4. **[Decisions made here](#4-decisions-made-here)** — gaps the design left, and the choice taken for each.
5. **[Live gate](#5-live-gate)** — the end-to-end run on a dev instance.
6. **[Rules, order and estimate](#6-rules-order-and-estimate)**

## 1. What this PR builds

*A personal, short-lived credential for the `lark` CLI, before any CLI command reads a report.*

Today, Larkspur's API accepts two kinds of caller: a browser session, and a workspace API key. Workspace keys belong to the workspace, not to a person; when one is used, the request carries a synthetic "workspace" user, so nothing downstream can say who acted, and a member who leaves the workspace keeps whatever key they copied. The `lark` CLI needs the opposite: a credential that belongs to one person in one workspace, lapses on its own, stops working the moment that person's membership does, and leaves a trace of every call in the workspace's audit log.

Five things land, in order of trust:

1. **A workspace switch.** A boolean, `cli_access_enabled`, that a workspace admin turns on. While it is off, no personal token can be minted or used in that workspace. Admins already manage workspace settings through an existing endpoint; this adds one field to it.
2. **A token kind.** A third `ApiKey.Kind`, `PERSONAL`, with prefix `lsp_`, owned by a user as well as a workspace, and carrying exactly one scope, `reports:read`. Every place that enumerates key kinds learns the new one. The existing admin key list and revoke paths learn to show it.
3. **Minting.** A new endpoint, `POST /api/v1/tokens/`, where a signed-in member mints a token for themselves only, only while the switch is on and their membership is active, with an expiry at most 30 days out. The secret is shown once.
4. **A person behind the token.** A new authentication class resolves an `lsp_` token to the real user who owns it, rechecks their membership and the switch on every request, and attaches the token's workspace and scope. A permission class and a per-token rate limit sit in front of the one route this PR adds, `GET /api/v1/cli/whoami`, which reports what was resolved. Every admitted call writes an audit row before the handler runs, and is refused if that write fails.
5. **CLI login.** `lark auth login|status|logout` mints a token from a session file, stores it owner-only under `~/.config/lark/`, and refuses to read a token from the environment or from inside a repository.

What it deliberately does not do: read any report, add any CLI command beyond `auth`, or change the web UI's settings page. Those are PR 2 (EXP-319). The point of stopping here is that the reviewer can read the credential's whole lifecycle and its trust boundary on their own, before any route that returns customer data uses it.

## 2. Commit map

*Eight commits. Each is green on its own, each has its own proof, and the live-exercisable moments come as early as the dependencies allow: commit 1 can be run live the moment it exists, commit 3 is the first token, commit 5 the first authenticated request, commit 7 the full CLI login.*

Conventions used below. **Changes** names files against `origin/main`. **Proof** says how the commit is verified before the next one starts: unit tests run with `uv run pytest <path>` for the test module beside every changed file, and **live** means a run on a dev instance booted with `scripts/dev-instance up <slug>` (section 5). "Instance" below always means that instance, never the shared staging database.

### Commit 1 — The workspace switch

`feat(workspaces): add cli_access_enabled setting (EXP-318)`

**In plain language.** This commit answers "does this workspace allow CLI access at all?" and nothing else. It adds one switch to the workspace settings that admins already edit, off by default for every workspace. Nothing reads the switch yet; no token exists and no route checks it. It goes first because every later commit needs a workspace with the switch on, and because it can be exercised on a dev instance as soon as it lands.

**Changes**

- `app/workspaces/models.py`: `WorkspaceSettings` (lines 41–68) gains `cli_access_enabled = models.BooleanField(default=False)`.
- `app/workspaces/migrations/0027_workspacesettings_cli_access_enabled.py`: one `AddField` with `default=False`. Postgres fills the default without rewriting the table; precedent `0024_workspacesettings_week_start`.
- `app/workspaces/serializers.py` (+ `tests/test_serializers.py`): `WorkspaceSettingsSerializer.Meta.fields` (line 19, an explicit list) gains `cli_access_enabled`. The settings view is already admin-only for writes (`IsWorkspaceAdmin` at `views.py:52`), and its updates are already audited through `audit.service.record()` at `views.py:77`, so the change shows up in the audit log with no new code.

**Proof**

- Unit: serializer round-trip; a member's `PATCH` is 403; an admin's `PATCH` sets the field and records one `workspace.settings_changed` event with before and after.
- Migration: `uv run python manage.py migrate` on the instance, then `makemigrations --check --dry-run` reports nothing.
- **Live, first exercisable moment:** on the instance, `PATCH /api/v1/workspaces/<id>/settings/ {"cli_access_enabled": true}` with an admin session → 200; the same with a member session → 403; `audit_auditevent` has one row with `action = 'workspace.settings_changed'` and the field in `changes`.

### Commit 2 — Token kind, prefix and visibility

`feat(integrations): PERSONAL api key kind and lsp prefix (EXP-318)`

**In plain language.** This commit teaches the system that a third kind of key exists, so that every place which looks at a key's kind or prefix knows what to do with it: the key generator, the header parser, and the admin list and revoke views. Nothing can mint one yet, so after this commit nothing looks different to anyone. It is separated from minting so that the reviewer can confirm the list of sites is complete before a key of this kind can exist. One site is checked by a test that already fails when a kind has no prefix; the others were found by searching for the existing `INGEST` kind.

**Changes**

- `app/integrations/models.py`: `ApiKey.Kind` (lines 22–25) gains `PERSONAL = "personal"`; `ApiKey` gains `owner = models.ForeignKey(User, null=True, on_delete=models.CASCADE, related_name="personal_tokens")`. Migration `0019_apikey_personal_kind.py`: `AlterField` on `kind` choices (no database change, since choices are not enforced in Postgres) and `AddField` for `owner`. No database constraint ties `owner` to the kind; decision 6 says what enforces it instead.
- `app/integrations/keys.py` (+ `tests/test_keys.py`): `PREFIX_BY_KIND` (lines 12–15) gains `PERSONAL: "lsp"`; `TOKEN_RE` (line 31) becomes `^(lsw|lsi|lsp)_[A-Za-z0-9]{40}$`. The existing `test_every_kind_has_prefix` now covers the new kind.
- `app/api/authentication.py` (+ test): `ApiKeyAuthentication` matches its own prefixes with a separate regex at line 22 (`Authorization: Key …`) and line 26 (`X-Api-Key`). Both stay `lsw|lsi`, so an `lsp_` token makes it return `None` and fall through to the next class. A test pins this; there is no code change.
- `app/integrations/views.py` (+ test): `VISIBLE_KINDS` (line 48) gains `PERSONAL`, so workspace admins can see and revoke members' tokens; the `owner` email is shown.
- `app/integrations/serializers.py`: `ApiKeySerializer.Meta.fields` (line 14) gains `kind` and `owner_email` (see decision 6). The list is explicit, so nothing else leaks.
- `uv run python manage.py spectacular --file openapi.yaml` (generated; never hand-edited).

**Proof**

- Unit: generate → parse → verify round-trips for `lsp_`; an unknown prefix `lsx_` is rejected; `ApiKeyAuthentication` returns `None` for `lsp_` in both headers; the admin list includes a personal key and a non-admin's list is still 403.
- Live: nothing new to exercise; the existing workspace-key create, list and revoke flow still works on the instance (regression only).

### Commit 3 — Minting a personal token

`feat(tokens): self-mint personal tokens with a 30-day cap (EXP-318)`

**In plain language.** This commit lets a signed-in member create a token for themselves. The server checks that their membership in the workspace is active and that the workspace has CLI access switched on, insists on an expiry no more than 30 days out, and fixes the scope itself, so the caller cannot ask for more. The secret comes back once. After this commit a real `lsp_` token can be held, listed and revoked, but no route accepts it yet.

**Changes**

- New app `app/tokens/` registered in `settings/base.py` `INSTALLED_APPS` (line 38):
  - `serializers.py` (+ test): `MintTokenSerializer` with `name` (1–64 chars) and `expires_in_days` (integer 1–30, required); any other field is rejected (`unknown_fields = "reject"` via the repo's `StrictSerializer` base in `app/api/serializers.py:9`).
  - `services.py` (+ test): `mint_personal_token(user, workspace, name, expires_in_days)`: load the `Membership` (`app/workspaces/models.py:90`) and require `status == ACTIVE`; require `workspace.settings.cli_access_enabled`; create the `ApiKey` with `kind=PERSONAL`, `owner=user`, `created_by=user`, `scopes=["reports:read"]`, `expires_at=now + days`; return the row and the plain secret. Constants `PERSONAL_TOKEN_MAX_DAYS = 30` and `REPORTS_READ_SCOPE = "reports:read"` live in `app/tokens/constants.py` so commit 5 shares them.
  - `views.py` (+ test): `TokenViewSet` at `/api/v1/tokens/` with `create`, `list` (own tokens only) and `destroy` (own tokens only; sets `revoked_at`, idempotent). Session authentication only: `authentication_classes = [SessionAuthentication]`, so a token cannot mint another token.
- `app/api/urls.py`: register the viewset.
- OpenAPI regenerated.

**Proof**

- Unit: happy path (`lsp_` prefix, scope exactly `["reports:read"]`, expiry stored); refusals: switch off, membership suspended, membership absent, `expires_in_days` 0, 31 or missing, an extra `scopes` field; `list` shows only the caller's tokens; `destroy` on another member's token is 404.
- **Live, first token:** on the instance, with the switch on from commit 1, `curl -X POST …/api/v1/tokens/ -b "sessionid=<member session>" -H "X-CSRFToken: …" -d '{"name":"laptop","expires_in_days":30}'` → 201 with `lsp_…` once. Repeat with `31` → 400 naming the cap. Turn the switch off, repeat → 403. `GET …/api/v1/tokens/` lists the token without its secret; `DELETE …/api/v1/tokens/<id>/` → 204, and again → 204.

### Commit 4 — Resolving the person behind a token

`feat(api): PersonalTokenAuthentication resolves the owning member (EXP-318)`

**In plain language.** When a request arrives with a workspace key today, the server learns which workspace it belongs to and gives the request a stand-in user. This commit adds the lookup for personal tokens: find the token, check that it is the right kind, not revoked and not expired, load its owner, and recheck the owner's membership and the workspace switch. The request then carries the real person. Each way the lookup can fail has its own named reason, so the route can answer 401 or 403 correctly and the audit can say why. It is its own commit because it is the most sensitive function in the PR and deserves to be read alone, with one test per refusal.

**Changes**

- `app/api/authentication.py` (+ test): `PersonalTokenAuthentication(BaseAuthentication)` beside `ApiKeyAuthentication`. Reads `Authorization: Bearer lsp_…` only (decision 7: one header form keeps the parser small). Same lookup shape as the existing class (`ApiKey.objects.select_related("workspace", "owner")` by prefix id, constant-time hash check at `keys.py:58`), then: `kind == PERSONAL`, `revoked_at is None`, `expires_at > now`, `owner` present, `owner.is_active`, membership in `key.workspace` with `status == ACTIVE`, switch on, `REPORTS_READ_SCOPE in key.scopes`. Each refusal raises `TokenRefused(reason)` with a stable code (`TOKEN_REVOKED | TOKEN_EXPIRED | WRONG_KIND | WRONG_SCOPE | USER_INACTIVE | MEMBERSHIP_INACTIVE | CLI_ACCESS_DISABLED`); the token reasons map to 401 and the rest to 403. Returns `(owner, TokenContext(key=key, workspace=key.workspace, scopes=key.scopes))`, so `request.user` is the person and `request.auth` is the context.
- `settings/base.py`: `DEFAULT_AUTHENTICATION_CLASSES` (lines 205–209) gains the new class after `ApiKeyAuthentication`. Order does not matter for correctness, since the two classes never claim the same prefix, but it is stated in a comment.

**Proof**

- Unit: one test per refusal plus the happy path; a workspace key through the new class returns `None`; a personal token through `ApiKeyAuthentication` returns `None`.
- Live: no route accepts the token yet; proven in commit 5.

### Commit 5 — Permission, per-token rate limit and `whoami`

`feat(cli): CliTokenRequired permission and GET /api/v1/cli/whoami (EXP-318)`

**In plain language.** This commit builds the door. A permission class admits only requests authenticated by a personal token with the reports scope; a rate limit counts calls per token, not per person or per address; and one route, `whoami`, reports back who the server thinks is calling, in which workspace, with which token. It exists so that the whole boundary can be exercised from a terminal, including every refusal, before PR 2 adds a route that reads report data. The audit write is held back to the next commit so the two halves can be reviewed apart.

**Changes**

- New module `app/cli_api/`:
  - `permissions.py` (+ test): `CliTokenRequired` admits only `isinstance(request.auth, TokenContext)` with `REPORTS_READ_SCOPE` present. A session or a workspace key is 403.
  - `throttles.py` (+ test): `TokenRateThrottle(SimpleRateThrottle)` with `scope = "cli_token"` and `get_cache_key` returning `f"cli-token:{request.auth.key.pk}"`. Grounding found that the global `UserRateThrottle` (`settings/base.py:212–220`) keys on `request.user.pk`, which for workspace keys is `None` and falls back to the client IP; the new class makes the per-token choice explicit. Rate `"cli_token": "120/min"` added to `DEFAULT_THROTTLE_RATES` (decision 4).
  - `views.py` (+ test): `WhoamiView` at `GET /api/v1/cli/whoami` with `permission_classes = [CliTokenRequired]` and `throttle_classes = [TokenRateThrottle]`, returning `{ user: { id, email }, workspace: { id, name }, token: { id, name, expires_at }, scopes }`.
- `app/api/urls.py`: register the route.
- OpenAPI regenerated.

**Proof**

- Unit: permission refusals (session, workspace key, personal token missing the scope); throttle key is per token even when two tokens share an owner; response shape contains no secret.
- **Live, first authenticated request:** on the instance, with a token from commit 3: `curl …/api/v1/cli/whoami -H "Authorization: Bearer lsp_…"` → 200 with the member, workspace and token; a workspace key → 403; a revoked token → 401; turn the switch off → next call 403; suspend the membership → next call 403; `lsp_` on `POST /api/v1/tokens/` → 403 (session only); 121 calls in a minute → the 121st is 429, and a second token from the same member is unaffected.

### Commit 6 — Audit before the handler

`feat(cli): raising audit write before dispatch, outcome after (EXP-318)`

**In plain language.** This commit makes every admitted CLI call leave a permanent record in the workspace's audit log. The record is written before the handler runs, and if it cannot be written the call is refused: no record, no work. When the handler finishes, the same row is updated with how the call ended. Refused requests leave no row, because they never reached the workspace's data; they remain in the ordinary request log. The existing audit helper deliberately swallows write failures, which is the opposite of what is needed here, so this commit adds a raising variant beside it.

**Changes**

- `app/audit/service.py` (+ test): `record_strict(**fields) -> AuditEvent` beside `record()` (lines 18–41). Same fields, no `try`/`except`, returns the row. `update_outcome(event, *, status, error_code=None)` writes `changes["outcome"]` on that row and nothing else. No code has updated `audit_auditevent` before; decision 2 explains why this is the one exception and gives the alternative.
- `app/cli_api/audit.py` (+ test): `CliAuditMixin` for CLI views. `initial()` runs after authentication, permission and throttle checks (`APIView.initial`, DRF), then calls `record_strict(action="cli.request", workspace=…, actor=request.user, token_id=…, path=request.path, request_id=request.META.get("HTTP_X_REQUEST_ID"), ip=…, user_agent=…)`. If it raises, the mixin returns 503 `AUDIT_UNAVAILABLE` and the handler never runs. `finalize_response()` calls `update_outcome` with the status code and, on an exception, the exception's class name (never the body).
- `app/cli_api/views.py`: `WhoamiView` gains the mixin.
- A test captures log output for a full request and asserts that neither `lsp_` nor the session cookie value appears in it or in the audit row.

**Proof**

- Unit: fields written; outcome updated; `record_strict` raising → 503 and the handler mock not called; handler raising → outcome `error`; a refused request (any 401, 403 or 429 from commit 5) → no row.
- **Live:** `whoami` on the instance, then a read-only query on `audit_auditevent`: one row with `action = 'cli.request'`, the member as actor, the token id, and `changes->'outcome'->>'status' = '200'`. The failed-write path (A2) has no clean live form on a shared instance, so it is unit-only; say so in the PR description.

### Commit 7 — CLI: `lark auth login|status|logout`

`feat(cli): lark auth login, status and logout (EXP-318)`

**In plain language.** This commit gives the member a way to get and manage their token from the terminal. They sign in to Larkspur in the browser as usual, save their session cookie to a private file, and point `lark auth login` at it; the CLI mints a token through the endpoint from commit 3 and stores it in a private file in their home directory. `lark auth status` shows which workspace it is for and when it expires; `lark auth logout` revokes it and deletes the file. The session file is read once and never printed. The CLI refuses to use a token found in an environment variable or anywhere inside a git repository, so a token cannot be committed by accident. After this commit the whole first-time setup works end to end on a dev instance.

**Changes**

- `cli/lark/auth.py` (+ `cli/tests/test_auth.py`, pure functions tested without network): Click group `auth` with `login`, `status` and `logout`; common option `--api-url` (default from `~/.config/lark/config.toml`, required when unset); `login` takes `--session-file <path>` (required), `--name` (default the hostname) and `--days <1–30>` (default 30).
- `cli/lark/token_store.py` (+ test): stores `{ token, id, workspace, api_url, expires_at, minted_at }` in `~/.config/lark/token.json`, mode `0600`, directory `0700`. `login` refuses to overwrite an unexpired token without `--force`. `load_token()` (shared with PR 2) refuses when `LARK_TOKEN` is set, or when the token file resolves inside any directory containing `.git`, with a message naming the rule.
- `login` → `POST /api/v1/tokens/` with the session cookie and CSRF token from the session file; `status` reads the file and calls `whoami`, printing everything but the secret and warning when fewer than 3 days remain; `logout` → `DELETE /api/v1/tokens/<id>/`, then removes the file. Every HTTP error prints the status and the API's `detail` and exits non-zero; a 403 with `CLI_ACCESS_DISABLED` tells the member to ask a workspace admin.
- The session file locally comes from the existing dev command `uv run python manage.py dev_session --email <member>` (`app/accounts/management/commands/dev_session.py`), which prints a valid `sessionid`. On hosted environments it is the browser's `sessionid` cookie, copied from the developer tools. Sessions last two weeks (`SESSION_COOKIE_AGE` default; not set in `settings/base.py`), so a copied cookie stays usable long enough to log in.

**Proof**

- Unit: option parsing and refusals (missing `--session-file`, `--days 31`, `LARK_TOKEN` set, token file inside a repo), file permissions, the secret redacted in `status`, request bodies for each command, error mapping.
- **Live, full first-time setup:** on the instance, `uv run python manage.py dev_session --email <member> > "$TMPDIR/session"` (owner-only), then `lark auth login --api-url http://127.0.0.1:<port> --session-file "$TMPDIR/session"` → `~/.config/lark/token.json` exists with mode 600; `lark auth status` shows workspace, expiry and no secret; `curl …/whoami` with the stored token → 200; `lark auth logout` → the file is gone and the same `curl` → 401. Turn the switch off and run `login` again → the admin hint is printed. Delete the session file.

### Commit 8 — Documentation

`docs: CLI access tokens for members and admins (EXP-318)`

**In plain language.** This commit writes down how to use what the previous seven built, where people already look: the CLI README for members setting up the CLI, the admin guide for the workspace switch and revoking members' tokens, and the API module docs for the next engineer who changes authentication. The test of this commit is that someone who did not write the code can follow the docs alone through first-time setup.

**Changes**

- `cli/README.md`: an "Authenticating" section (getting a session file locally and on hosted environments, `login`, renewing every 30 days, the token file is a credential, never in an environment variable or a repository).
- `docs/admin/workspace-settings.md`: the switch, what turning it off does to existing tokens (they stop working on the next request), and revoking a member's token from the key list.
- `app/api/README.md`: the three authentication classes, which prefixes each claims, and the order of authentication, permission, throttle and audit for CLI routes.

**Proof**

- Lint on changed files only, links checked by eye, and the section 5 walkthrough re-run from the docs alone by someone who did not write the code.

## 3. Verification matrix

*Each row is a check. "Kind" is U (unit test), L (live on a dev instance) or B (both). "Commit" is where the check first passes. The PR is complete when every row passes; the live rows are re-run once together as the live gate in section 5.*

### 3.1 Workspace switch

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| S1 | Admin turns the switch on | 200, field set, one `workspace.settings_changed` audit row with before and after | B | 1 |
| S2 | Member tries to turn it on | 403, no write | B | 1 |
| S3 | New workspace | switch is off | U | 1 |
| S4 | Migration on a fresh instance database | applies; `makemigrations --check` clean | L | 1 |

### 3.2 Token kind and visibility

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| K1 | Generate → parse → verify a `PERSONAL` key | round-trips; secret starts `lsp_` | U | 2 |
| K2 | Unknown prefix `lsx_` | rejected | U | 2 |
| K3 | `lsp_` presented to `ApiKeyAuthentication` in either header | returns `None` | U | 2 |
| K4 | Admin lists workspace keys | includes personal tokens with owner email | B | 2 (unit), 3 (live) |
| K5 | Admin revokes a member's personal token | `revoked_at` set; the member's next `whoami` is 401 | B | 2 (unit), 5 (live) |
| K6 | Existing workspace-key create, list and revoke | unchanged (regression) | B | 2 |

### 3.3 Mint

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| M1 | Active member, switch on, 30 days | 201, secret once, `lsp_`, scope `["reports:read"]`, expiry stored | B | 3 |
| M2 | 31 days | 400 naming the cap | B | 3 |
| M3 | 0 days, or the field missing | 400 | U | 3 |
| M4 | Switch off | 403 `CLI_ACCESS_DISABLED` | B | 3 |
| M5 | Membership suspended or absent | 403 | U | 3 |
| M6 | Extra `scopes` field in the body | 400 | U | 3 |
| M7 | Mint using an `lsp_` token instead of a session | 403 | L | 5 |
| M8 | Member lists tokens | only their own; no secrets | B | 3 |
| M9 | Member deletes their token twice; deletes another member's | 204, 204; 404 | B | 3 |

### 3.4 Authentication and route

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| R1 | Valid token, active member, switch on | `whoami` 200 with user, workspace, token, scopes | B | 5 |
| R2 | Revoked token | 401 `TOKEN_REVOKED` | B | 4/5 |
| R3 | Expired token | 401 `TOKEN_EXPIRED` | U | 4 |
| R4 | Token row missing the scope | 403 `WRONG_SCOPE` | U | 4 |
| R5 | Owner deactivated | 403 `USER_INACTIVE` | U | 4 |
| R6 | Membership suspended after minting | 403 `MEMBERSHIP_INACTIVE` on the next request | B | 4/5 |
| R7 | Switch turned off after minting | 403 `CLI_ACCESS_DISABLED` on the next request | B | 4/5 |
| R8 | Workspace key on `whoami` | 403 | B | 5 |
| R9 | Session on `whoami` | 403 | U | 5 |
| R10 | `request.user` after authentication | the owning member, not the synthetic workspace user | U | 4 |
| R11 | Throttle cache key with two tokens, one owner | two keys, `cli-token:<id>` each | U | 5 |
| R12 | 121 calls in 60 seconds with one token | the 121st is 429; the second token is unaffected | L | 5 |
| R13 | `whoami` body | no secret, no session value | U | 5 |

### 3.5 Audit

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| A1 | Admitted `whoami` | one row: `action = cli.request`, actor = member, workspace, token id, path, outcome status 200 | B | 6 |
| A2 | `record_strict` raises | 503 `AUDIT_UNAVAILABLE`, handler never runs | U | 6 |
| A3 | Handler raises after admission | same row gets outcome `error` with the exception class; no second row | U | 6 |
| A4 | Refused request (any of R2–R9, R12) | no row | B | 6 |
| A5 | Token and session value | absent from the audit row and from captured log output | U | 6 |

### 3.6 CLI

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| C1 | `login` with a fresh session file | `token.json` mode 600, directory 700; secret appears nowhere else | B | 7 |
| C2 | `status` | workspace, expiry, days left; no secret; warning under 3 days | B | 7 |
| C3 | `logout` | API 204, file removed, next `whoami` 401 | B | 7 |
| C4 | Session file stale | 403 from the API mapped to "session expired, copy a fresh one" | B | 7 |
| C5 | `login` with the switch off | the admin hint is printed, exit non-zero | L | 7 |
| C6 | `--days 31`, missing `--session-file`, no API URL configured | usage error | U | 7 |
| C7 | `LARK_TOKEN` set, or the token file inside a git repository | refuses with the rule named | U | 7 |
| C8 | `login` when an unexpired token exists | refuses without `--force` | U | 7 |
| C9 | Process arguments during `login` | contain the session-file path, never the cookie value | U | 7 |

### 3.7 Whole-PR checks

| # | Check | Kind |
|---|---|---|
| W1 | The test module beside every changed file passes; `uv run pytest` green | U |
| W2 | `uv run ruff check` and `uv run mypy app cli` on the changed packages; formatter only on edited files | — |
| W3 | Migrations generated and checked; `openapi.yaml` regenerated; CI's OpenAPI drift check green | — |
| W4 | Section 5 live gate passes end to end on one dev instance, torn down afterwards | L |
| W5 | No report, export or web UI file is touched (`git diff --stat` reviewed) | — |

## 4. Decisions made here

*Places where the design left a choice to the implementer. Each is this plan's recommendation; the alternative is stated so a reviewer can overrule it in one line.*

1. **A separate `/api/v1/tokens/` endpoint for minting.** The existing key endpoint is admin-only and mints workspace keys; a member's self-service path with different rules reads more clearly on its own. *Alternative:* a `kind` field on the existing endpoint with a member branch; one fewer route, but admin and member rules interleave in one view.
2. **Outcome on the same audit row.** The design asks for one row per call with its result. Nothing has updated audit rows before; `update_outcome` touches only `changes["outcome"]` on the row it was handed. *Alternative:* a second `cli.response` row linked by request id; keeps the table append-only, but every reader needs a join and "one row per call" is lost.
3. **30-day maximum lifetime.** The design says "short-lived" without a number. Thirty days means a monthly renewal for regular users and bounds a leaked token to a month at most. *Alternative:* 7 days, which matches the security review's suggestion and means weekly renewal.
4. **120 requests per minute per token.** The design asks for a per-token limit without a figure; 120 is twice the web UI's report-page peak in last month's metrics. PR 2 imports the same rate name.
5. **A file, not the OS keychain.** Owner-only file storage works the same on every platform the CLI supports and is testable without a keychain. *Alternative:* the `keyring` library with the file as a fallback; safer at rest, but a second code path and a native dependency.
6. **No database constraint tying `owner` to `PERSONAL`.** Enforced in `mint_personal_token` and pinned by a model test instead, since the condition is awkward to express as a check constraint. *Alternative:* a raw-SQL `CHECK ((kind = 'personal') = (owner_id IS NOT NULL))` in the migration.
7. **`Authorization: Bearer` only.** The existing key class accepts two header forms; the new class accepts one, so there is one parser to review. *Alternative:* also accept `X-Api-Key`, matching the workspace keys.
8. **The token is bound to one workspace at mint time.** A member of several workspaces mints one token per workspace. *Alternative:* a workspace header on each request; fewer tokens, but every route then has to validate a second input.

## 5. Live gate

*Run once per commit as marked above, and once as a whole before the PR is opened. Everything goes through `scripts/dev-instance`; read its README first, every time.*

1. `scripts/dev-instance up exp-318` from the branch; note the API port from its output. Fresh checkout: `uv sync` first.
2. Seed two members and one admin with `uv run python manage.py seed_dev --workspace exp-318`. Turn the switch on as the admin (S1); confirm the member is refused (S2).
3. Session: `uv run python manage.py dev_session --email <member> > "$TMPDIR/session"` (owner-only; delete at the end). Mint by curl (M1, M2, M4), list (M8), revoke (M9), mint again.
4. `whoami` happy path (R1); refusals R2, R6, R7, R8; `lsp_` on the mint endpoint (M7); rate burst (R12); admin lists and revokes the member's token (K4, K5).
5. Audit rows for steps 3–4 (A1, A4).
6. CLI first-time setup end to end (C1–C5).
7. `scripts/dev-instance down exp-318`; delete the session file and `~/.config/lark/token.json`.

Setup on the hosted environments (browser cookie, real workspaces) is not part of this PR's gate; it is the first item of EXP-320 and happens after the release.

## 6. Rules, order and estimate

- One commit at a time, each green before the next. Prepare and verify the PR, then stop and ask before opening it.
- Tests beside every changed file; migrations before OpenAPI regeneration; lint before push; formatter only on files this PR edits.
- Comments two lines at most, no ticket keys in comments; the narrative is in the commit messages and here.
- No report, export or web UI changes in this PR. `settings/base.py` is the only shared configuration touched, in commits 4 and 5.
- Order is fixed: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Commits 2 and 4 have no live moment of their own and are proven by their tests and by the commit after them.

**Estimate.** Commits 1–2: one day. Commit 3: half a day. Commits 4–6: one and a half days, most of it tests and the raising audit path. Commit 7: one day. Commit 8 and the whole-PR live gate: half a day. About four and a half days of engineering before review, against the ticket's original three days; the difference is the audit-before-handler requirement and the CLI's storage rules, both added by the 2026-03-02 security review.
