# GPi UX Shell

## Layout thesis

GPi should feel like a serious local agent workspace for Pi: calm, fast, spatially stable and optimized for supervising multiple local agents.

After reviewing T3Code/Codex-style UI, the shell should bias toward a compact sidebar + clean chat timeline + powerful bottom composer. The cockpit metaphor remains, but the UI should avoid looking like a permanent dashboard full of panels.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top/status bar: project • session • model • branch • run state               │
├───────────────┬──────────────────────────────────────────────┬───────────────┤
│ Projects +    │ Selected session chat                        │ Detail panel  │
│ sessions      │                                              │ tools/files/  │
│ sidebar       │ assistant/user stream                        │ diffs/context │
│               │                                              │               │
├───────────────┴──────────────────────────────────────────────┴───────────────┤
│ Input composer                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Left sidebar

The sidebar is the operational dashboard.

### Project group

Shows:

- project name
- local path/short path
- aggregate status dot
- count of active/attention-needed sessions
- collapse/expand state

### Session row

Shows:

- session title
- status badge/icon
- short last activity
- subtle progress animation if active
- attention marker if waiting/error/blocked
- optional changed-file count

### Sidebar ordering

Within a project:

1. waiting/error/blocked sessions
2. active running sessions
3. recently updated sessions
4. idle/completed sessions

Selected row should be visually obvious but not loud.

## Center chat

The chat is for conversation, not logs.

### Message principles

- User messages are compact and readable.
- Assistant streaming is smooth and stable.
- Thinking can be collapsed/secondary.
- Tool calls appear as compact inline markers with detail in right panel.
- Errors are clear and actionable.

### Running banner

At the top of chat or just above input:

- current run state
- current tool if any
- queued steering/follow-up count
- abort button/shortcut later

### Revert by message

When a turn changes files and GPi has a safe file snapshot, the turn Supercard can expose `Revert changes`.

Rules:

- The action belongs to the Supercard/turn, not the assistant text.
- Copy should say "Reverts files to the state before this message."
- Confirmation modal lists created, modified and deleted files.
- If files changed after the snapshot, GPi blocks revert and shows conflicts.
- The feature works in git and non-git projects because GPi owns the snapshots.

## Right detail panel

Purpose: inspect operational detail without cluttering chat. The panel should be contextual/collapsible rather than a mandatory always-visible raw event list.

Tabs/sections:

- Tools
- Files
- Diffs
- Context
- Logs/errors

MVP can implement a single stacked panel before tabs.

Rules:

- Collapsible.
- Width stable.
- Never required to read normal answer text.
- Updates live for selected session.

## Input composer

The input is sacred. It should become GPi's main control surface, similar in role to T3Code/Codex composers.

Requirements:

- multiline
- keyboard-first send
- clear selected session target
- visible disabled/queued state
- draft preserved when switching sessions if possible
- no lag on focus or typing

MVP shortcut policy can be simple, but must leave room for configurable keybindings later.

## Top/status bar

Shows low-noise global context:

- selected project
- selected session
- model/thinking level when known
- git branch when known
- connection/bridge mode: mock, sdk, rpc
- compact status/cost later

## Visual language

- dark premium baseline
- glass panels with subtle blur/translucency
- hairline borders
- soft shadows
- rounded corners
- restrained accent color
- high contrast text for actual content
- motion under 150ms for common transitions

Avoid:

- heavy DevOps dashboards
- saturated status spam
- giant tool logs in the main flow
- layout jumps during streaming

## Status visual mapping

| Status | Sidebar treatment | Chat/detail treatment |
| --- | --- | --- |
| idle | muted dot | ready input |
| thinking | pulsing low-intensity dot | subtle thinking label |
| streaming | active shimmer/dot | streaming text |
| running_tool | tool badge | current tool card |
| editing_files | file badge | changed files visible |
| waiting_approval | strong accent badge | approval card/action |
| waiting_input | strong accent badge | input highlighted |
| blocked | warning badge | blocker explanation |
| error | error badge | error card with retry/copy |
| completed | success tick briefly, then idle | final message complete |

## Multi-session supervision behavior

The user should be able to keep 2-5 sessions active and understand the system by glancing at the sidebar.

Required cues:

- non-selected active sessions animate subtly
- waiting sessions are promoted visually
- last activity text updates after tool/message events
- selected session is not the only live thing

## Empty states

### No projects

Message:

> Create a project to start using GPi as a cockpit for Pi.

Actions:

- Create project
- Import from Pi sessions later

### Project with no sessions

Actions:

- New session
- Open existing Pi session later

### Session with no messages

Show:

- project path
- model/bridge state if known
- prompt suggestions later

## MVP component list

- `AppShell`
- `TopStatusBar`
- `ProjectSidebar`
- `ProjectGroup`
- `SessionRow`
- `ChatPane`
- `MessageList`
- `MessageBubble`
- `RunStatusBanner`
- `DetailPanel`
- `ToolCallCard`
- `FileChangeCard`
- `InputComposer`

## Manual UX validation

Open the shell with mock data and verify:

- at least 3 projects can be represented
- one project can show several sessions
- at least 3 sessions can show different active states simultaneously
- switching selected session feels instant
- right panel detail does not crowd the chat
- input target is obvious
