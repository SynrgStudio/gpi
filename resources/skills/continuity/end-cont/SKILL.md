---
name: end-cont
description: 'End and archive a Continuity Mode session. Use with /end-cont, end-cont, "end continuity", or "archive continuity". Reads AUTONOMOUS_EXECUTION.md, ACTIVE_QUEUE.md, and STATE.md, archives a snapshot under docs/continuity/archive/<session>/, clears the active queue, updates metadata, and writes a suggested commit message.'
---

# /end-cont — end and archive a continuity session

Goal: close a continuous work session, preserve evidence, and produce a suggested commit message.

Command chain:

```text
/init-cont  -> creates the session
/plan-cont  -> creates/refines the queue
/start-cont -> executes the queue
/end-cont   -> archives the session and produces a commit-message suggestion
```

## When to use

Trigger with:

- `/end-cont`
- `end-cont`
- `end continuity`
- `archive continuity`
- `finish this continuity session`
- `we are done with this session`

## Required loading

Read:

1. higher-priority harness/project rules;
2. `AUTONOMOUS_EXECUTION.md`;
3. `ACTIVE_QUEUE.md`;
4. `STATE.md`;
5. `git status` / `git diff --name-only` to detect modified files;
6. relevant checklist/plan if needed for the summary.

Validate:

- the three continuity files share the same `continuity_session`;
- there is a clear goal;
- the queue has a summarizable state.

## Do not commit

`/end-cont` does not commit unless the user explicitly asks. It only generates a commit message suggestion for later use.

## Archive destination

Create:

```text
docs/continuity/archive/<continuity_session>/
```

Save snapshots:

```text
AUTONOMOUS_EXECUTION.md
ACTIVE_QUEUE.md
STATE.md
FINAL_REPORT.md
COMMIT_MESSAGE.txt
```

Do not fully move `STATE.md`; it remains live at the project root.

Do not delete `AUTONOMOUS_EXECUTION.md`; keep it as the persistent contract, but update status if appropriate.

`ACTIVE_QUEUE.md` may be replaced with an idle pointer to the archived session.

## Final report

Create `FINAL_REPORT.md` with:

```md
# FINAL_REPORT — <session>

## Goal
## Result
## Queue summary
## Completed tasks
## Blocked/partial/cancelled tasks
## Files changed
## Validation
## Remaining work
## Next recommendation
```

## Commit message

Create `COMMIT_MESSAGE.txt` with:

```text
<type>(<scope>): <summary>

<body bullets>

Validation:
- ...
```

Choose type/scope from the changes:

- `feat(...)` for user/API features;
- `fix(...)` for bug fixes;
- `test(...)` for tests only;
- `docs(...)` for docs only;
- `chore(...)` for hardening/infra/docs+tests combinations;
- `refactor(...)` for structural changes without external behavior changes.

Example:

```text
chore(core): close phase 3 hardening

Complete Phase 3 module runtime hardening.

- Add continuity execution contract and queue flow
- Expand external host hardening coverage
- Validate timeout, restart backoff, auto-disable, IPC limits, and capability enforcement
- Update state and closure checklist

Validation:
- cargo fmt
- cargo test
- cargo check
- cargo run --bin rmenu -- --modules-debug
```

## Active-file cleanup

### ACTIVE_QUEUE.md

After archiving, replace with:

```md
---
continuity_session: none
created_at: <original or now>
updated_at: <now>
status: idle
goal: none
last_archived_session: <session>
archive_path: docs/continuity/archive/<session>/
---

# ACTIVE_QUEUE.md

No active continuity session.

Last archived session:
- docs/continuity/archive/<session>/

To start a new one:
- /init-cont <goal>
```

### AUTONOMOUS_EXECUTION.md

Keep the contract. Update metadata:

```md
status: idle
last_archived_session: <session>
```

If the contract should remain available without an active session, do not delete the rules.

### STATE.md

Add a final checkpoint:

- archived session;
- archive path;
- final validation;
- commit message path;
- next recommended command.

## Queue status interpretation

- If all tasks are `done`/`cancelled`: normal close.
- If there are `blocked`/`partial`/`pending` tasks: closing is allowed, but report remaining work clearly.
- If there is an `in_progress` task: mark it `partial` or `blocked` before archiving, with a note.

## Git safety

Do not use:

- `git add -A`
- `git add .`
- `git reset --hard`
- `git checkout .`
- `git clean -fd`
- `git stash`

Do not commit without explicit instruction.

## Final output

Respond:

```text
Continuity session archived.
Session: CONT-...
Archive: docs/continuity/archive/<session>/
Queue: X done, Y blocked, Z pending.
Commit message: docs/continuity/archive/<session>/COMMIT_MESSAGE.txt
Suggested:
<commit subject>
```
