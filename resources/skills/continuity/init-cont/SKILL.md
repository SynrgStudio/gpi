---
name: init-cont
description: 'Initialize a Continuity Mode session. Use with /init-cont, init-cont, "initialize continuity", or "prepare continuity mode". Creates or updates AUTONOMOUS_EXECUTION.md, ACTIVE_QUEUE.md, and STATE.md with a shared continuity_session, timestamps, goal, operating contract, and initial queue when the goal is clear.'
---

# /init-cont — initialize a continuity session

Goal: create the active infrastructure for long-running, autonomous, auditable, pausable, and resumable work.

Command chain:

```text
/init-cont  -> creates the session, contract, state, and base queue
/plan-cont  -> refines ACTIVE_QUEUE.md into a complete plan
/start-cont -> executes ACTIVE_QUEUE.md
/end-cont   -> archives the session and produces a suggested commit message
```

## Active files

`/init-cont` creates or updates:

```text
AUTONOMOUS_EXECUTION.md  # operating contract and active-session metadata
ACTIVE_QUEUE.md          # active plan/queue and active-session metadata
STATE.md                 # live log/checkpoints and active-session metadata
```

All three files must share the same `continuity_session`.

## Required metadata

Every managed file must start with front matter:

```md
---
continuity_session: CONT-YYYY-MM-DD-HHMM-<slug>
created_at: YYYY-MM-DD HH:MM
updated_at: YYYY-MM-DD HH:MM
status: active
goal: <goal>
---
```

Rules:

- `continuity_session` is explicit; do not rely only on filesystem timestamps.
- `created_at` does not change after creation.
- `updated_at` changes on every meaningful update.
- `status` may be `active`, `archived`, `paused`, or `idle`.
- If an active session already exists, continue or update it instead of creating another one without a clear reason.

## When to use

Trigger with:

- `/init-cont`
- `/init-cont <goal>`
- `init-cont`
- `initialize continuity`
- `prepare continuity mode`
- `create autonomous_execution.md`
- `prepare the repo for start-cont`

## Principles

- Do not implement tasks.
- Prepare infrastructure and, when the goal is clear, a reasonable initial queue.
- Do not create empty generic boilerplate.
- Do not delete existing progress.
- Prefer a small set of well-linked markdown files over heavy infrastructure.
- Auditable markdown is the source of truth.

## Procedure

### 1. Detect or create the session

1. Look for `AUTONOMOUS_EXECUTION.md`, `ACTIVE_QUEUE.md`, and `STATE.md`.
2. If all three exist and share the same `continuity_session` with `status: active`, continue that session.
3. If they do not exist, create a new session:
   - format: `CONT-YYYY-MM-DD-HHMM-<goal-slug>`;
   - if there is no goal, use the repo/topic: `CONT-YYYY-MM-DD-HHMM-session`.
4. If session IDs mismatch, report the mismatch and ask for confirmation unless the repair is obvious and safe.

### 2. Inspect minimum context

Read, if present:

- project/harness rules (`AGENTS.md` or equivalent injected rules);
- previous `STATE.md`;
- implementation plans/checklists (`IMPLEMENTATION_PLAN.md`, `CORE_CLOSURE_CHECKLIST.md`, `TODO.md`, `ROADMAP.md`);
- primary README/specs;
- manifests (`Cargo.toml`, `package.json`, etc.) to infer stack and validation commands.

Do not scan the entire repository indiscriminately.

### 3. Create or update AUTONOMOUS_EXECUTION.md

It must include:

```md
## Purpose
## Session metadata
## Source of truth
## Command chain
## Triggers
## Scope and autonomy level
## Allowed actions
## Forbidden actions
## Validation commands
## Execution loop
## Stop conditions
## Checkpointing rules
## Queue rules
## Claim rules
## Archive/finalization rules
## Reporting format
## Project-specific task map
## Re-entry instructions
## Commit policy
```

It must declare:

```text
AUTONOMOUS_EXECUTION.md = operating contract
ACTIVE_QUEUE.md         = queue/tasks/dependencies
STATE.md                = live log/checkpoints
```

### 4. Create or update ACTIVE_QUEUE.md

If missing, create:

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

If there is a clear goal/checklist, create an initial queue. If the plan needs deeper analysis, create the skeleton and recommend `/plan-cont`.

### 5. Create or update STATE.md

If missing, create at minimum:

```md
# STATE

## Current status
## Last checkpoint
## Active continuity session
## Active goal
## Validation status
## Known blockers
## Next recommended step
```

If it exists, preserve history and add an init checkpoint.

### 6. Connect planning automatically when appropriate

If the user gave a clear goal and enough context exists:

- create an initial queue directly in `ACTIVE_QUEUE.md`;
- do not implement;
- state whether `/start-cont` can begin or `/plan-cont` should refine the queue first.

If the goal is large or ambiguous:

- leave `ACTIVE_QUEUE.md` prepared;
- recommend `/plan-cont`.

## Safety and git

Include in the contract:

- no commit unless explicitly requested;
- no `git add -A` or `git add .` if prohibited;
- no `git reset --hard`, `git checkout .`, `git clean -fd`, or `git stash` without confirmation;
- protect changes from other agents;
- stage exact files only if the user requests a commit.

## Final response

Respond briefly:

```text
Continuity initialized.
Session: CONT-...
Files: AUTONOMOUS_EXECUTION.md, ACTIVE_QUEUE.md, STATE.md
Goal: ...
Validation: ...
Next: /plan-cont or /start-cont
```
