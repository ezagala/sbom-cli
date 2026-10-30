---
name: implementation-plan
description: Write a grounded, commit-by-commit implementation plan for a scoped piece of engineering work — one PR, one ticket, one slice of a larger design. Use this whenever the user asks for an implementation plan, a build plan, a commit map, "how would you sequence this", "plan PR 2", "break this ticket into commits", or wants a verification matrix / test matrix / definition of done for a ticket, even if they do not say "plan". Also use it when a ticket or design doc describes work and the user asks whether it is ready to implement — the grounding phase answers that. The plan is verified against a pinned commit of the real code, not against the design's description of the code, and every commit in it has its own proof and its earliest possible live moment.
allowed-tools: Bash, Read, Write, Edit, Agent, Skill
---

# implementation-plan — a commit map that has been checked against the code

A plan written from a design doc alone inherits the design's mistakes about the code. A
typical case: the design says a background job "already returns" a status field, that the
team "already has" a retry helper and a lock utility, and that the rate limiter "prefers the
user over the key". At the pinned commit the status is only persisted, never returned; the
helper and the lock do not exist; and the guard order means the limiter never sees a user. A
plan that repeats those claims sends the implementer to look for things that are not there.
So this skill's center is a **grounding pass**: every claim the plan makes about existing code
is checked against a pinned commit and cited with a file and line, or it is marked unverified.

The output is one Markdown file. Its shape is fixed (section 4) because the people who read
these plans — the implementer, the reviewer, the person who runs the live gate — each go to
a known section. `references/example-plan.md` is a complete worked example in that shape.

## 1. Inputs — collect all of these before writing a line

The plan's header lists its inputs so a reader knows what it was built from. Gather:

| Input | Where it comes from | Required |
|---|---|---|
| **The work statement** | The ticket(s) in the team's issue tracker — fetched with the tracker's tool if one is available, including relations and comments — and, when the ticket is a slice of a larger project, the project description. This is the scope the plan must cover, no more. | Yes |
| **The design** | The design doc the ticket points at, wherever the team keeps designs, plus the plan-of-record section for this slice if a multi-PR plan exists. Read the design's *decisions* section: those are settled and the plan must not reopen them. | Yes |
| **The code, at a pinned ref** | The repo(s) the work lands in. Fetch the default branch, record the short SHA, and read everything through `git show <ref>:<path>` / `git grep -n <pat> <ref> -- <path>`; never through the working tree, which may be on another branch. Use `git -C <repo>` rather than `cd` in compound commands. | Yes |
| **Standing rules** | The repo's agent and contributor guidance (`CLAUDE.md`, `CONTRIBUTING.md`, module READMEs), the repo's own tooling for live verification and database access if it has any, and the user's recorded preferences that touch the area (branch naming, lint before push, test placement, regenerating generated code, whether to open PRs, whether to pause between commits). | Yes |
| **Prior reviews** | A critical review of the design, earlier round comments on a related PR, a verdict the user already gave in the conversation. These often contain the decisions the design left implicit. | If they exist |
| **Related tickets** | Tickets the work blocks or is blocked by; tickets whose text the plan might contradict (check them in the "drift" section). | If they exist |

If a required input is missing, say which one and stop; do not write a plan from the ticket
title. If the ticket itself is thin, the grounding pass still runs — the plan can be the
thing that makes the ticket concrete — but the header must say the work statement was thin.

## 2. Grounding pass

Turn the design and ticket into a numbered list of **claims about existing code** ("the
authentication layer resolves only the key and its account", "there is an audit write that
raises on failure", "scheduled jobs skip overlapping runs", "the serializer exposes the key's
kind") and **assumptions about what must be added**. Then verify every claim against the
pinned ref. This is noisy reading, so delegate it to a read-only subagent with the claims list
and the pinned ref, and ask for a compact table back: TRUE / PARTLY / FALSE per claim,
`file:line` evidence, one or two sentences, plus two lists: *gaps* (the design assumes
something that does not exist) and *surprises* (the code contradicts the design).
`references/grounding-checklist.md` has the subagent prompt shape and the hazards that are
easy to miss — exhaustive maps and `switch`es over an enum you are extending, prefix regexes,
allow-lists, generated code, serializers that list fields by hand, migration compatibility,
middleware ordering, request context that is empty early in the chain.

Grounding decides three things the plan depends on:

- **Which hooks exist**, so a commit can say "extend X at `file:line`" instead of "add X".
- **Which assumptions are net-new work**, so they become commits with their own proof rather
  than a sentence that hides a day of work.
- **Which decisions the design left open.** A gap with more than one reasonable fill is a
  decision; the plan takes one, states the alternative, and lists it in section 4 so the
  reviewer can overrule it in a line.

Every `file:line` in the plan comes from this pass and refers to the pinned SHA named in the
header. If something could not be verified, write *unverified* next to it rather than
guessing; a wrong line number costs the implementer more than a blank.

## 3. Deciding the commits

The commit map is the plan's spine. Choose boundaries by these rules, in this order:

1. **Each commit is green and provable on its own.** It has a test beside the code it changes
   or a live check that passes before the next commit starts. If a commit cannot be proven
   alone, its boundary is wrong.
2. **Live moments come as early as the dependencies allow.** Ask of every commit: "what is
   the first thing a person could run against a real instance after this lands?" Order so that
   the answer is "something" as often as possible — a command that writes a row, an endpoint
   that returns a token, a protected route that refuses correctly — and name that moment
   explicitly ("**Live, first token:** …"). Commits with no live moment (pure plumbing, a
   resolver with no route yet) are fine when the reason is stated and the next commit
   exercises them.
3. **Trust boundaries ship separately from the things behind them.** An authorization check,
   a credential resolver, an audit write: each in its own commit so the security-minded
   reviewer reads it alone.
4. **Enumerations are completed in one commit**, with every site listed, before anything can
   create a value of the new kind. The reviewer confirms the list is complete while the blast
   radius is still zero.
5. **Docs are the last commit**, and its proof is that someone who did not write the code can
   follow them.

Then write each commit block with: the commit subject in the repo's convention; an **In plain
language** paragraph (what it does, what it deliberately does not do yet, why it sits here);
**Changes** by file with the `file:line` of what is extended and the constants or names being
introduced; **Proof** split into unit and live, with the live line starting **Live, …** and
naming the first exercisable moment or saying there is none and why.

## 4. Output format

Use `references/plan-template.md` as the skeleton, and read `references/example-plan.md`
(a worked example, about 300 lines) once before writing: it shows the register of each
section, how a commit block reads when the hooks exist versus when they are net-new, and how
the matrix ids are referenced from the live gate. The sections, in order, and what each
reader looks for:

| Section | Reader | Contents |
|---|---|---|
| Header | everyone | Date, author, status, ticket, branch, design pointer, plan-of-record pointer; **Inputs** paragraph naming the pinned SHA and the date it was read; **How to read this document** |
| Contents | everyone | Numbered links with a one-line hook each |
| 1. What this PR builds | reviewer, lead | Plain language; the parts in order of trust; what it deliberately does not do; why it stops where it does |
| 2. Commit map | implementer | The blocks from section 3, numbered, with a one-paragraph preamble stating the conventions (what "live" means, what "proof" means) and where the live moments fall |
| 3. Verification matrix | implementer, reviewer, gate runner | Tables per area, rows `#`, Scenario, Expected, Kind (U unit / L live / B both), Commit where it first passes; a final whole-PR table (lint, type check, generated code, the live gate, diff-stat review). Happy paths **and** failure modes; see the checklist for the failure-mode prompts |
| 4. Decisions made here | reviewer | Numbered; each is a gap the design left, the choice, the reason, and the alternative in one sentence so it can be overruled in a line |
| 5. Live gate | gate runner | Step list for the end-to-end run, through the repo's live-verification tooling if it has any; what is out of this gate's scope and whose ticket owns it |
| 6. Rules, order and estimate | implementer, lead | The standing rules applied; the fixed order; which commits have no live moment; an estimate per commit group with the reason it differs from any earlier figure |

Write the file beside the design it implements (for example
`<design directory>/implementation/<slug>.md`), or where the user asks, and **do not commit
it** unless the user says to. Report the path and the decisions in section 4 in the reply,
since those are what the user has to react to.

## 5. Voice and discipline

- Plain language. The "In plain language" paragraphs are for someone who has not read the
  code; the Changes lists are for someone about to. Keep the two registers apart.
- Numbers, not adjectives: "60 per minute", "30 days", "about 4 days", "121 calls → 429".
- No opaque codes invented for the document (no "D13", "RU1"); commit numbers and matrix row
  ids like `P12` are fine because the tables define them.
- Never write "load-bearing". Say the plain thing.
- Code comments in the plan's examples: two lines at most, no ticket keys; the narrative goes
  in the commit message and in the plan.
- When the plan corrects the ticket or the design (a claim the code contradicts), say so in
  the reply and in a short "drift" note, and do not silently paper over it in the plan body.
- Do not reopen settled decisions. If a settled decision looks wrong against the code, flag
  it in the reply as a question for the user; the plan follows the decision as written.
- The plan is a proposal until the user says otherwise: offer test prompts or a dry read, do
  not start implementing.

## 6. Self-check before handing it over

- Every `file:line` traces to the pinned SHA in the header.
- Every design assumption that grounding found missing is either a commit or a decision.
- Every commit has a proof; every live moment is the earliest the dependencies allow.
- The matrix has failure modes for each trust boundary (expired, revoked, wrong kind, wrong
  account or owner, write failure, leaked secret in logs, rate exceeded) and for each CLI input.
- Section 4 lists every choice the design did not make.
- The reply names the path, the decisions, and anything the code contradicted.
