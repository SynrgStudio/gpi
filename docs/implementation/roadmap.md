# GPi Implementation Roadmap

## Current implementation snapshot

As of 2026-05-06 22:43, GPi has a validated Electron + React + TypeScript prototype.

Validated:

- Electron app opens in dev mode.
- Glass shell renders projects, sessions, chat, detail panel and input.
- Local sessions can be created, selected and persisted.
- Mock event flow updates chat, sidebar and right panel.
- Real Pi SDK sessions can be created from the UI.
- Real prompts stream back into the chat.
- Real `read` and `write` tool events appear in the detail panel with args/result/duration.
- `write` file-change hints are derived from Pi tool args.
- Persisted real sessions reopen their Pi session file after Electron restart before prompting.
- Real-session creation uses optimistic `connecting` UX and feels instant.
- Safe shallow prewarm records Pi session-list timing without sharing `AgentSession` state.

Still intentionally rough:

- Project creation is still mock/local only.
- Right detail panel is a raw stacked event list, not a polished tools/files/diffs UI.
- No approval UI yet.
- No command palette, quick switcher, session archive/rename or keyboard navigation.
- No packaged production Electron build flow.

## Milestone policy

Build in layers. Do not connect real Pi before the UI/domain/event model works with mock events.

## M0 — Product and architecture docs

Status: done when T001-T009 are done.

DoD:

- vision, MVP, Pi integration, domain model, UX shell, architecture, persistence and visual system docs exist
- no code scaffold required

Validation:

- docs cross-check against original thesis and multi-session requirement

## M1 — Project scaffold

Goal: create the minimal app structure.

Likely stack recommendation pending implementation choice: TypeScript local app with a frontend renderer and Node bridge.

DoD:

- package manifest exists
- src structure exists
- check/typecheck command exists
- README explains status and commands

Validation:

- run defined check command

## M2 — Static glass shell with mock data

Goal: make GPi visible.

DoD:

- sidebar renders multiple projects/sessions
- center chat renders selected mock session
- right panel renders mock tools/files
- input composer visible
- visual tokens applied

Validation:

- check/typecheck
- manual UI inspection if app can be opened

## M3 — Local state and session switching

Goal: prove multi-session UI model.

DoD:

- select project/session
- switch sessions instantly
- per-session messages/status remain independent
- selected session and draft state are preserved locally

Validation:

- check/typecheck
- reducer/state tests if harness exists

## M4 — Mock Pi event bridge

Goal: prove event-driven UI.

DoD:

- mock bridge emits text deltas, tool start/end, file changes, errors
- chat streams simulated output
- sidebar updates non-selected sessions live
- right panel updates from events

Validation:

- check/typecheck
- event reducer tests if harness exists

## M5 — Persistence MVP

Goal: restart without losing workspace.

DoD:

- projects/sessions persist to local file
- selected project/session restores
- corrupted/missing file fails safe

Validation:

- check/typecheck
- storage tests if harness exists

## M6 — SDK bridge: one real Pi session

Goal: first real Pi integration.

DoD:

- create/open one Pi session for a project cwd
- send prompt
- stream assistant text
- update status from lifecycle events
- display errors safely

Validation:

- check/typecheck
- manual local prompt validation

## M7 — SDK bridge: multiple sessions

Goal: validate core product thesis technically.

DoD:

- at least two Pi sessions can exist as handles
- one selected and one non-selected session can update status
- abort/dispose is per session
- no global chat assumption appears

Validation:

- check/typecheck
- manual concurrent session validation

## M8 — Tool events and file-change surface

Goal: operational cockpit.

DoD:

- tool_execution_start/update/end map to ToolCall records
- sidebar shows running tool/editing files state
- right panel shows compact tool cards
- file changes are shown only when known or clearly derived

Validation:

- check/typecheck
- manual prompt that triggers at least one tool

## M9 — UX tightening pass

Goal: make it feel good.

DoD:

- session switching feels instant
- streaming does not jump layout
- attention-needed sessions are visible
- clutter is reduced
- shortcuts/input behavior reviewed

Validation:

- manual UX pass
- update docs/STATE with findings

## Recommended next iteration

### N1 — Replace mock project model with real project roots

- Add/create/select project roots.
- Persist project roots outside hardcoded mock data.
- Use project path as Pi cwd per project.

### N2 — Polish operational detail panel

- Split raw event list into `Tools`, `Files`, and `Logs` sections.
- Render tool cards with status, duration and compact expandable details.
- Render file cards separately from tool output.

### N3 — Improve session persistence and discovery

- Import/list existing Pi sessions per project.
- Reconcile GPi session records with Pi session files.
- Add rename/archive for sessions.

### N4 — Input and keyboard workflow

- Multiline composer behavior.
- Configurable send/newline shortcuts.
- Quick switcher / command palette.
- Next attention-needed session shortcut.

### N5 — Approval/extension UI strategy

- Define how GPi should surface Pi extension UI requests and approval gates.
- Do not fake approvals before the bridge has a reliable source of truth.

### N6 — Packaging/dev ergonomics

- Create a single dev launcher script that starts Vite, compiles Electron, and launches Electron safely.
- Decide production packaging path.

## Known manual decisions

- exact app shell: Electron, Tauri+Node sidecar, web local, or other
- package manager/build tooling
- persistence location for packaged app
- approval UI strategy
- whether real Pi sessions should remain in-process SDK or move to RPC subprocesses

## Risk sequence

Highest risk items are deferred until the mock architecture proves value:

1. real Pi SDK concurrency
2. extension UI/approvals
3. diff/file-change fidelity
4. packaging/distribution

## First code task after docs

Create scaffold only after confirming stack/app shell. If no stack is specified by the user, propose one before writing code.
