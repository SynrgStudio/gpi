---
name: start-cont
description: 'Execute the active Continuity Mode queue. Use with /start-cont, start-cont, "continue", "execute the queue", or "do as much as possible". Reads AUTONOMOUS_EXECUTION.md, ACTIVE_QUEUE.md, and STATE.md with the same active continuity_session; claims executable tasks, implements them, validates them, checkpoints, and continues until done or a real stop condition is reached.'
---

# /start-cont — execute the active plan

Goal: execute the already planned `ACTIVE_QUEUE.md`. Do not replan unless a minimal repair is required; the queue is the source of truth.

Command chain:

```text
/init-cont  -> creates the session
/plan-cont  -> creates/refines the queue
/start-cont -> executes the queue
/end-cont   -> archives the session
```

## When to use

Trigger with:

- `/start-cont`
- `/start-cont <optional scope>`
- `start-cont`
- `continue`
- `execute the queue`
- `do not stop until done`
- `do as much as possible`
- `continue from STATE.md`

If the user says `/start-cont status`, show status only; do not implement.

## Required loading

Read:

1. higher-priority harness/project rules;
2. `AUTONOMOUS_EXECUTION.md`;
3. `ACTIVE_QUEUE.md`;
4. `STATE.md`;
5. docs/code relevant to the selected task.

Validate:

- all three active files exist;
- they share the same `continuity_session`;
- `status: active`;
- `ACTIVE_QUEUE.md` has at least one executable task.

If the plan is missing, ask for or run `/plan-cont`.

## Task selection

Choose:

1. an `in_progress` task claimed by this agent/session;
2. a stale `in_progress` task, recording a resume note;
3. the first executable `partial` task with a clear Next step;
4. the first `pending` task whose dependencies are `done`;
5. if none exist, report blockers/status.

Do not take `blocked` or `cancelled` tasks.
Do not overwrite a recent claim from another agent.

## Claim

Before editing code, update `ACTIVE_QUEUE.md`:

```md
Status: in_progress
Claimed by: current-agent
Started: YYYY-MM-DD HH:MM
Last update: YYYY-MM-DD HH:MM
```

Also update front matter `updated_at`.

## Execution loop

For each task:

1. Read Scope/DoD/Validation/Files/Risk/Depends.
2. Inspect the minimum relevant code/docs.
3. Implement a small change.
4. Run the task validation.
5. If validation fails, debug and iterate.
6. Update the task:
   - `done` if DoD and validation are satisfied;
   - `blocked` if it requires user input, manual validation, or a prohibited command;
   - `partial` if useful validated progress exists but a clear Next remains.
7. Update `STATE.md` with a checkpoint.
8. If executable tasks remain and scope allows, continue.

Do not stop just because one batch of work was completed.

## Validation

Use the task's Validation section. If missing, use the contract/project default.

Do not mark `done` without validation. If validation is manual and cannot be performed, mark `blocked` or ask for input if required.

## Status values

Use only:

```text
pending
in_progress
done
blocked
partial
cancelled
```

## Stop conditions

Stop only if:

- the queue/goal is complete;
- there are no executable tasks;
- a task requires human input;
- manual validation is required;
- a required command is prohibited or unavailable;
- checks/tests fail after reasonable debugging;
- context is near the limit after checkpointing;
- continuing requires destructive or out-of-scope changes.

## Required checkpoint before stopping

### ACTIVE_QUEUE.md

- final task status;
- Last update;
- Blocker/Next/Notes when applicable.

### STATE.md

- task executed;
- files touched;
- validations;
- remaining work;
- next step.

### Front matter

Update `updated_at` in modified continuity files.

## Status mode

If the user asks for status:

- do not implement;
- read queue/state;
- summarize current goal;
- show `in_progress`;
- show next executable pending task;
- show blocked tasks;
- provide the next command.

## Git

- No commit unless explicitly requested.
- No `git add -A` or `git add .` if prohibited.
- No destructive commands: `reset --hard`, `checkout .`, `clean -fd`, `stash` without confirmation.
- Stage exact files only if the user asks for a commit.

## Final report

```text
Status: completed | blocked | checkpoint
Session: CONT-...
Task: Txxx — ...
Done:
- ...
Files:
- ...
Validation:
- ...: OK
Queue:
- done: n
- pending: n
- blocked: n
Next:
- /start-cont or /end-cont
```
