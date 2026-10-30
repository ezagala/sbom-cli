# <PR or slice name>: implementation plan

**Date:** <YYYY-MM-DD> · **Author:** Claude (<model>), for <requester> · **Status:** Draft · **Ticket:** [<KEY>](<url>) · **Branch:** `<branch, in the repo's naming convention>` · **Design:** [<file>](<relative path>) sections <…> · **Plan of record:** [<file>](<relative path>) section <…>

**Inputs.** <The design and plan above; `<repo>` at `origin/<default branch>` `<short sha>`, read on <date> (file and line pointers below are to that commit); the ticket(s) <keys> read on <date>; the repo tooling and guidance <names>; the standing rules in <guidance file path>; <prior review if any>.>

**How to read this document.** Section 1 says in plain language what the PR builds and why it is bounded where it is. Section 2 is the commit map: <N> commits, each with what it changes, how it is proven, and the first moment the code can be exercised live. Section 3 is the verification matrix that measures completeness, happy paths and failure modes together. Section 4 lists the decisions this plan makes that the design left open, with the alternative in each case. Section 5 is the live gate procedure, and section 6 the ordering rules and the estimate.

## Contents

1. **[What this PR builds](#1-what-this-pr-builds)** — <hook>.
2. **[Commit map](#2-commit-map)** — <N> commits, each verifiable on its own.
3. **[Verification matrix](#3-verification-matrix)** — the checks that define done.
4. **[Decisions made here](#4-decisions-made-here)** — gaps the design left, and the choice taken for each.
5. **[Live gate](#5-live-gate)** — the end-to-end run on a dev instance.
6. **[Rules, order and estimate](#6-rules-order-and-estimate)**

## 1. What this PR builds

*<One italic line: the boundary, before the detail.>*

<Two or three paragraphs in plain language: what is missing today, what lands, in order of trust, numbered. Then: what it deliberately does not do, and why stopping there is the point.>

## 2. Commit map

*<N> commits. Each is green on its own, each has its own proof, and the live-exercisable moments come as early as the dependencies allow: commit <a> can be run live the moment it exists, commit <b> is the first <…>, commit <c> the first <…>.*

Conventions used below. **Changes** names files against `origin/<default branch>`. **Proof** says how the commit is verified before the next one starts: unit tests run with `<test command>` for the test beside every changed file, and **live** means a run on a dev instance booted through `<the repo's live-verification tooling>` (section 5). "Instance" below always means that instance, never a shared one.

### Commit 1 — <title>

`<commit subject in the repo's convention>`

**In plain language.** <What it does. What it deliberately does not do yet. Why it sits here.>

**Changes**

- `<path>` (+ its test): <what is extended at `file:line`, what is introduced by name>.
- …

**Proof**

- Unit: <cases>.
- **Live, <first exercisable moment>:** <the command and what to observe>. — or — Live: nothing new to exercise; proven by commit <n>.

### Commit 2 — …

## 3. Verification matrix

*Each row is a check. "Kind" is U (unit test), L (live on a dev instance) or B (both). "Commit" is where the check first passes. The PR is complete when every row passes; the live rows are re-run once together as the live gate in section 5.*

### 3.1 <Area>

| # | Scenario | Expected | Kind | Commit |
|---|---|---|---|---|
| A1 | <happy path> | <observable result> | B | 1 |
| A2 | <failure mode> | <refusal, with code> | U | 1 |

### 3.n Whole-PR checks

| # | Check | Kind |
|---|---|---|
| W1 | The test beside every changed file passes; the package test suite is green | U |
| W2 | Lint and type-check on the changed packages; formatter only on edited files | — |
| W3 | Generated code regenerated in order; CI drift check green | — |
| W4 | Section 5 live gate passes end to end on one instance, torn down afterwards | L |
| W5 | No file outside the stated scope is touched (`git diff --stat` reviewed) | — |

## 4. Decisions made here

*Places where the design left a choice to the implementer. Each is this plan's recommendation; the alternative is stated so a reviewer can overrule it in one line.*

1. **<Decision>.** <Choice and reason.> *Alternative:* <one sentence>.
2. …

## 5. Live gate

*Run once per commit as marked above, and once as a whole before the PR is opened. Everything goes through `<the repo's live-verification tooling>`; read its instructions first, every time.*

1. <Boot / prerequisites.>
2. <Each step, referencing matrix row ids.>
3. <Teardown and secret cleanup.>

<What is not in this gate and which ticket owns it.>

## 6. Rules, order and estimate

- <Standing rules applied: commit cadence, pause-for-go-ahead, tests beside changed files, generation order, lint before push, comment style, whether to open the PR.>
- <Scope fences: files or layers this PR must not touch.>
- Order is fixed: 1 → 2 → … Commits <x> and <y> have no live moment of their own and are proven by their tests and by the commit after them.

**Estimate.** <Per commit group, with a total, and the reason it differs from any earlier figure.>
