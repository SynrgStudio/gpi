---
continuity_session: CONT-2026-05-10-1630-gpi-roadmap
created_at: 2026-05-10 16:30
updated_at: 2026-05-10 16:30
status: active
goal: Complete GPi roadmap items for file mentions, project file tree, Windows Open in GPi context menu, startup splash, Linux packaging, updater validation, and workflow polish.
---

# AUTONOMOUS_EXECUTION.md

## Purpose

Maintain an auditable, resumable execution contract for GPi work across sessions.

## Session metadata

- Session: CONT-2026-05-10-1630-gpi-roadmap
- Status: active
- Created: 2026-05-10 16:30
- Updated: 2026-05-10 16:30
- Goal: Complete GPi roadmap items for file mentions, project file tree, Windows Open in GPi context menu, startup splash, Linux packaging, updater validation, and workflow polish.

## Source of truth

- `AUTONOMOUS_EXECUTION.md` = rules of engagement.
- `ACTIVE_QUEUE.md` = task queue, ordering, dependencies, validation.
- `STATE.md` = live log, checkpoints, blockers, next step.

## Command chain

```text
/init-cont  -> creates session + contract + base queue
/plan-cont  -> refines ACTIVE_QUEUE.md with complete plan
/start-cont -> executes ACTIVE_QUEUE.md
/fin-cont   -> archives session and suggests commit message
```

## Triggers

Use this session for:

- `init-cont`, `/init-cont`, `inicializa continuidad`.
- `plan-cont`, `/plan-cont`, `arma el plan`.
- `start-cont`, `/start-cont`, `continúa`, `ejecuta cola`.
- `fin-cont`, `/fin-cont`, `finaliza continuidad`.

## Scope and autonomy level

Allowed autonomy: implement planned GPi tasks when `/start-cont` is requested, stopping for unclear product decisions, destructive operations, credentials, or external release operations not explicitly requested.

## Allowed actions

- Read project docs and source.
- Edit GPi source, tests, packaging scripts, docs.
- Run `npm run check` after code changes.
- Run targeted unit tests when tests are created/modified.
- Generate local installers only when requested or needed for validation.

## Forbidden actions

- Do not commit or push unless the user explicitly asks.
- Do not use `git add -A` or `git add .`.
- Do not run `git reset --hard`, `git checkout .`, `git clean -fd`, or `git stash` without confirmation.
- Do not overwrite intentional code without asking.
- Do not auto-install system packages without approval.

## Validation commands

- `npm run check`
- `npm run test:unit` when reducers/tests are touched.
- `npm run package:win` / `npm run installer:win` only for packaging validation.

## Execution loop

1. Read `ACTIVE_QUEUE.md` and `STATE.md`.
2. Pick first pending task whose dependencies are done.
3. Mark task `in_progress` with claim and timestamp.
4. Implement minimal slice.
5. Validate.
6. Mark task `done`, `partial`, or `blocked`.
7. Update `STATE.md` checkpoint.
8. Continue until queue complete or stop condition.

## Stop conditions

- User asks to stop.
- Validation fails and root cause is not clear.
- Task requires product decision not captured in queue.
- Task requires privileged OS/package-manager mutation.
- Git/release operation is needed but user has not requested it.

## Checkpointing rules

Update `STATE.md` after every completed, blocked, or partial task with:

- What changed.
- Validation run.
- Blockers.
- Next task.

## Queue rules

- Status values: pending, in_progress, done, blocked, partial, cancelled.
- Never renumber existing task IDs.
- Add new tasks at the end.
- Preserve done/in_progress/blocked claims.
- If splitting a task, create new IDs and mark original partial/cancelled with notes.

## Claim rules

- Claim field should identify the current agent/session.
- Clear stale claims only when clearly abandoned or user instructs.

## Archive/finalization rules

`/fin-cont` should archive these files under `docs/continuity/archive/<session>/`, clear active queue, update state, and suggest commit message. Do not commit unless requested.

## Reporting format

Respond briefly:

```text
Task: Txxx — title
Status: done|blocked|partial
Validation: ...
Next: ...
```

## Project-specific task map

Key areas:

- Composer/workflow UI: `src/renderer/ui/App.tsx`, `src/renderer/styles.css`.
- Workspace state: `src/renderer/state/workspace-store.ts`, `src/domain/types.ts`.
- Electron main/preload: `src/main/main.ts`, `src/preload/preload.cts`, `src/renderer/vite-env.d.ts`.
- Packaging: `scripts/`, `installer/`, `.github/workflows/`.
- Docs: `docs/implementation/roadmap.md`, `docs/implementation/linux-packaging.md`.

## Re-entry instructions

On new session:

1. Read `AUTONOMOUS_EXECUTION.md`.
2. Read `ACTIVE_QUEUE.md`.
3. Read `STATE.md`.
4. Continue from first pending executable task.

## Commit policy

Only commit/push when the user asks. Stage exact files only.
