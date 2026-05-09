# GPi guided workflow skills

## Goal

GPi should make long-running Pi work feel guided without becoming a second harness. Continuity Mode is a curated GPi bundle of Pi skills plus a clear GUI flow. It is powered by real Pi skills and real text commands; GPi only packages, installs, explains and triggers them.

The user experience should feel like a product flow:

```text
Install skills -> Initialize -> Plan -> Start -> End
```

but each step is a one-shot action, not a sticky mode.

## Non-goals

- GPi does not implement agent planning/execution itself.
- GPi does not keep a persistent Plan/Build mode that rewrites every prompt.
- GPi does not hide what command is being sent to Pi.
- GPi does not silently overwrite user skills.
- GPi does not require the user's personal `D:\PISkills` folder at runtime.

## Bundled skills

GPi bundles recommended workflow skills as app resources:

- `init-cont`
- `plan-cont`
- `start-cont`
- `end-cont`

They are versioned with GPi and can be inspected before installation.

Runtime installation target is the user's Pi skills directory. GPi should detect installed/missing/conflicting skills before offering workflow actions.

## Installation UX

When workflow skills are missing, GPi should show a native GPi onboarding modal. It is recommended but not blocking.

The modal should include:

- Why GPi recommends these skills.
- What commands will become available.
- A list of bundled skills.
- A `View text` action for each skill.
- An `Install workflow skills` action.
- Conflict handling if a skill with the same name already exists.

### Conflict policy

- Missing skill: copy bundled `SKILL.md` into the user's Pi skill directory.
- Existing identical skill: report installed.
- Existing different skill: report conflict and do not overwrite silently.
- Future update flow may offer explicit replace/backup, but the first implementation should avoid destructive changes.

## One-shot commands

The composer workflow button and Command Palette actions send one command once, then return to normal prompting.

| Action | Command sent to Pi | Composer text behavior |
| --- | --- | --- |
| Initialize | `/init-cont <optional composer text>` | A discrete action that initializes continuity. Composer text is optional context. |
| Plan | `/plan-cont <optional composer text>` | Optional refinement. Empty text sends `/plan-cont`. |
| Start | `/start-cont <optional composer text>` | Optional scope/refinement. Empty text sends `/start-cont`. |
| End | `/end-cont <optional composer text>` | Optional finalization note. Empty text sends `/end-cont`. |

The sent command should be visible in the chat as the user's message, so there is no hidden prompt injection.

## Smart composer workflow button

The current `Build` button should become a workflow action button.

Labels:

- `Install` when bundled workflow skills are missing or conflicted.
- `Initialize` when no active continuity files are detected in the selected project.
- `Plan` when continuity files exist but no executable plan is detected.
- `Start` when `ACTIVE_QUEUE.md` has pending or partial executable tasks.
- `End` when the queue appears complete or has no executable remaining work.

The normal `Send` button remains available for regular prompts. The workflow button is a shortcut for the continuity command only.

### Avoiding sticky modes

After the workflow button sends `/init-cont`, `/plan-cont`, `/start-cont` or `/end-cont`, the composer remains in normal prompt mode. The next normal Enter/Send sends exactly what the user typed.

No `Plan` or `Build` state should persist across turns.

## Continuity state detection

GPi should inspect the selected project root read-only for:

- `AUTONOMOUS_EXECUTION.md`
- `ACTIVE_QUEUE.md`
- `STATE.md`

The detector should classify:

- `missing`: required files absent.
- `initialized`: files exist and share an active `continuity_session`, but queue is empty/skeletal.
- `planned`: queue exists but no executable pending/partial tasks are detected.
- `executable`: at least one pending/partial task appears executable.
- `complete`: tasks are all done/cancelled or no useful work remains.
- `blocked`: queue is blocked or metadata conflicts.
- `conflict`: files exist but `continuity_session` mismatches or front matter is invalid.

Detection is read-only. The skills are responsible for writing continuity files.

## Command Palette

`Ctrl+K` remains an action palette. It should show workflow actions based on state:

- `Install workflow skills`
- `Initialize continuity`
- `Plan queue`
- `Start queue`
- `End continuity`

`Ctrl+P` remains only project/session switching.

Commands removed from the palette by UX decision should stay removed unless reintroduced intentionally:

- `New local session`
- `Compact selected session`
- `Archive selected session`

## Onboarding explanation after install

After installation, GPi should explain the intended loop:

1. Talk normally with Pi until the goal is clear.
2. Click `Initialize` to create continuity files from the current goal/context.
3. Refine through normal chat if needed.
4. Click `Plan` to produce the task queue.
5. Review/refine the plan.
6. Click `Start` to execute the queue.
7. Click `End` when the continuity session should be archived.

## Failure handling

- If skills are missing and the user clicks a workflow action, open onboarding instead of sending a command.
- If continuity files are conflicted, show the conflict and avoid guessing the next phase.
- If no project is selected, disable workflow actions and ask the user to select/add a project.
- If the session is busy, the workflow button should be disabled or should queue only if Pi supports it explicitly; first implementation should disable to avoid accidental command stacking.

## Security model

- Installing skills is a filesystem write and must go through validated main-process IPC.
- Preload should expose only narrow workflow skill operations, not generic filesystem access.
- Skill preview should read bundled resources only.
- Installation should write only into the resolved Pi skills directory.
- Existing different skills must not be overwritten without an explicit future conflict flow.
