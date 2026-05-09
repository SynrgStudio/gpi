---
name: plan-cont
description: 'Plan an already initialized Continuity Mode session. Use with /plan-cont, plan-cont, "make the plan", or "plan continuity". Reads AUTONOMOUS_EXECUTION.md, ACTIVE_QUEUE.md, and STATE.md with the same active continuity_session, then creates or refines ACTIVE_QUEUE.md with well-scoped tasks, DoD, validation, risks, dependencies, and timestamps.'
---

# /plan-cont — plan the active continuity queue

Goal: take the active session created by `/init-cont` and turn its goal into a complete, executable, resumable queue.

`/plan-cont` does not implement tasks.

Command chain:

```text
/init-cont  -> creates the session
/plan-cont  -> creates/refines the queue
/start-cont -> executes the queue
/end-cont   -> archives the session
```

## Key idea

The user should not need to repeat the full goal. `/init-cont` already stored it in:

```text
AUTONOMOUS_EXECUTION.md
ACTIVE_QUEUE.md
STATE.md
```

`/plan-cont` must read these three active files, verify that they share the same `continuity_session`, and plan from that goal plus any optional refinement supplied by the user.

## When to use

Trigger with:

- `/plan-cont`
- `/plan-cont <optional refinement>`
- `plan-cont`
- `make the plan`
- `plan continuity`
- `replan ACTIVE_QUEUE.md`

## Required loading

Read in order:

1. higher-priority harness/project rules;
2. `AUTONOMOUS_EXECUTION.md`;
3. `ACTIVE_QUEUE.md`;
4. `STATE.md`;
5. relevant implementation plans/checklists;
6. required specs/docs;
7. code only when needed to estimate scope, risk, likely files, or validation.

Validate:

- all three active files exist;
- all three have `continuity_session`;
- all three use the same session ID;
- the session is `status: active` or equivalent.

If the infrastructure is missing, ask for `/init-cont` first.

## Timestamps

Update `ACTIVE_QUEUE.md` front matter:

```md
updated_at: YYYY-MM-DD HH:MM
planned_at: YYYY-MM-DD HH:MM
```

If `planned_at` does not exist, add it. If it already exists, update `updated_at` and add a replan note.

## Deep planning loop

Before writing tasks:

1. Understand the goal from metadata and STATE.
2. Read the existing plan/checklist.
3. Identify real gaps.
4. Order work by dependencies.
5. Separate automatic work from manual validation/input.
6. Define validation for every task.
7. Estimate risk and likely files.
8. Avoid giant tasks and avoid meaningless tiny tasks.

## ACTIVE_QUEUE.md format

Preserve this structure:

```md
# ACTIVE_QUEUE.md

## Current goal

<goal>

## Queue policy

- Status values: pending, in_progress, done, blocked, partial, cancelled.
- Never renumber existing task IDs.
- Pick the first pending task whose dependencies are done.
- Preserve claims unless stale or explicitly overridden.

## Queue

### T001 — <title>

Status: pending
Claimed by:
Started:
Last update:
Scope:
- ...
DoD:
- ...
Validation:
- ...
Files likely touched:
- ...
Risk: low|medium|high
Depends on:
- none
Notes:
- ...
```

## Allowed status values

Use only:

```text
pending
in_progress
done
blocked
partial
cancelled
```

## Preservation rules

If `ACTIVE_QUEUE.md` already has tasks:

- do not renumber IDs;
- do not change the meaning of existing IDs;
- preserve `done` tasks;
- preserve `in_progress` tasks and claims;
- preserve `blocked` tasks and blockers;
- append new tasks at the end;
- if something is obsolete, mark it `cancelled`; do not delete it;
- if a task is split, create new tasks and mark the original `partial` or `cancelled` with a note.

## Task design

Every task must have:

- stable ID;
- concrete title;
- status;
- claim fields;
- bounded scope;
- observable DoD;
- concrete validation;
- likely files touched;
- risk `low|medium|high`;
- dependencies by task ID;
- useful notes.

Bad DoD:

```md
- improve runtime
```

Good DoD:

```md
- timeout test covers hung host
- host health becomes degraded/disabled as specified
- cargo test passes
```

## Manual work

If a task requires user/manual validation:

```md
Status: blocked
Blocker:
- Manual launcher UX validation required.
Validation:
- manual: open launcher and confirm behavior
```

Do not hide manual validation inside an automatic task.

## Final output

Update `ACTIVE_QUEUE.md` and `STATE.md`.

Respond:

```text
Plan updated.
Session: CONT-...
Goal: ...
Queue: X pending, Y blocked, Z done.
First executable task: T001 — ...
Next: /start-cont
```
