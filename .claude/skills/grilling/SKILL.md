---
name: grilling
description: Stress-test a plan, design, decision or idea by interviewing the user in rounds until every open decision is settled. Use when the user asks to be grilled, wants their thinking poked at or pressure-tested, asks "what am I missing", or says anything with "grill" in it.
---

# grilling — interview until nothing is left assumed

The goal is a shared understanding of the plan, reached by asking questions rather than by
writing. Keep asking until there is nothing left that either of you is quietly assuming.

## The design tree

Treat the plan as a tree of decisions. Each decision, once made, opens the decisions that
depend on it: choosing "a CLI" opens "which input formats", which opens "what happens on a
malformed file". A decision is **open** until the user has settled it.

The **frontier** is the set of open decisions whose prerequisites are all settled — the
questions you can ask right now without guessing at an answer you have not heard yet.

## Rounds

1. Work out the frontier.
2. Ask all of it in one message: number every question and give your recommended answer.
3. Stop and wait for the user's answers.
4. Fold the answers into the tree. Settled decisions push the frontier outward and unblock
   the questions that hung off them. Go back to step 1.

A question that depends on another question in the same round is not on the frontier yet;
hold it for a later round.

Use this shape for every round:

```
❓ **Q1** - **<short title>**: <the question; as long as it needs, with the options laid out if there are several>

➡️ <your recommended answer, and why in a sentence>

---

❓ **Q2** - **<short title>**: <…>

➡️ <…>
```

Phrase each question so that a plain "yes" accepts your recommendation. The user can then
answer a round as briefly as "yes to all but Q3; Q3: the second option".

## Facts are yours, decisions are theirs

Never ask the user for something you could find out yourself — what the code does today,
which files exist, what a tool supports, what the docs say. When a frontier question needs
such a fact, send a subagent with a fresh context to fetch it, and keep going: a running
lookup is just an unsettled prerequisite, so only the questions that depend on it wait. Ask
the rest of the frontier now and bring the dependent questions back once the answer is in.

The decisions themselves belong to the user. Recommend, but put each one to them and wait.

## Finishing

You are done when the frontier is empty: every branch visited, nothing left assumed. Then
give a short summary of what was decided, and ask the user to confirm it matches their
understanding. Do not start acting on the plan — writing code, docs or tickets — until they
confirm.

---

Modeled on the `grilling` skill in [mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling) (MIT).
