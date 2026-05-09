# GPi workflow skills validation

## Purpose

Validate the guided continuity workflow:

```text
Install -> Initialize -> Plan -> Start -> End
```

GPi only guides and sends real Pi skill commands. Pi still executes the skills.

## Preflight

- Open GPi in a real project.
- Confirm `Ctrl+P` opens only project/session switching.
- Confirm `Ctrl+K` opens action Command Palette.
- Confirm a real Pi session is selected.

## Install workflow skills

1. Start with no installed GPi workflow skills, or temporarily use a clean Pi skills directory.
2. Open GPi.
3. Confirm workflow onboarding appears if skills are missing.
4. Confirm listed skills:
   - `init-cont`
   - `plan-cont`
   - `start-cont`
   - `end-cont`
5. Click `View text` for each skill.
6. Confirm full skill text is visible and scrollable.
7. Click `Install missing skills`.
8. Confirm missing skills are copied and conflicts are not overwritten.
9. Restart GPi and confirm installed skills are detected.

Expected:
- No silent overwrite.
- No generic filesystem access exposed in renderer.
- Install result is clear.

## Initialize

1. Select a project without active continuity files.
2. Type a clear goal in the composer.
3. Click the workflow button labeled `Initialize`.

Expected:
- GPi sends `/init-cont <goal>` as a normal user message.
- Composer returns to normal prompt behavior.
- Pi creates/updates:
  - `AUTONOMOUS_EXECUTION.md`
  - `ACTIVE_QUEUE.md`
  - `STATE.md`

## Plan

1. After initialization, wait for GPi to refresh continuity state.
2. Confirm workflow button becomes `Plan`.
3. Optionally type a refinement.
4. Click `Plan`.

Expected:
- GPi sends `/plan-cont` or `/plan-cont <refinement>` once.
- It does not keep a sticky Plan mode.
- `ACTIVE_QUEUE.md` becomes a detailed executable queue.

## Start

1. After planning, wait for state refresh.
2. Confirm workflow button becomes `Start` when pending/partial executable work exists.
3. Click `Start`.

Expected:
- GPi sends `/start-cont` once.
- Timeline shows normal Pi action blocks.
- Composer remains usable for normal prompts/follow-ups.

## End

1. After queue is complete or no executable work remains, confirm workflow button becomes `End`.
2. Click `End`.

Expected:
- GPi sends `/end-cont` once.
- Pi archives continuity session according to the skill.

## Command Palette

Open `Ctrl+K` and validate workflow actions:

- `Install workflow skills` appears when skills are missing.
- `Initialize continuity` appears when skills are installed and a session is selected.
- `Plan queue`, `Start queue`, and `End continuity` send their one-shot commands.
- Removed actions remain absent:
  - New local session
  - Compact selected session
  - Archive selected session

## Regression checks

- `Send` still sends normal prompt text.
- `Ctrl+P` does not show commands.
- `Ctrl+K` does not switch sessions as primary behavior.
- Missing/conflicting continuity files do not cause destructive writes.
- Existing custom skills with the same name are not overwritten.
