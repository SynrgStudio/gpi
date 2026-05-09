# GPi MVP

## MVP definition

The MVP is a local GPi cockpit that makes Pi usable as a multi-session daily workspace.

It must prove three things:

1. GPi can organize work by projects and sessions.
2. GPi can make one selected session pleasant to use.
3. GPi can show what other sessions are doing without forcing the user to open them.

The MVP can start with a mock bridge before real Pi integration, but the product model must be compatible with real Pi sessions from the start.

## Must-have initial scope

### 1. Local app shell

- Opens quickly.
- Uses a persistent layout.
- Does not require cloud login.
- Can run against local state and eventually local Pi.

### 2. Project/session sidebar

The sidebar is mandatory from day zero.

It must show:

- projects/workspaces
- sessions under each project
- selected session
- live session status
- last activity summary
- attention indicators for waiting input/approval/error

Minimum session operations:

- create local project
- create local session in a project
- select/switch session
- keep multiple sessions visible at once

### 3. Multi-session model

"Open more than one chat/agent at a time" means:

- GPi can hold multiple sessions in memory/local state.
- Each session has independent messages, status and event history.
- Switching selected session is instant and does not stop other sessions.
- The sidebar continues to show activity for non-selected sessions.
- Later, multiple real Pi runs can stream concurrently through the same event model.

### 4. Main chat surface

For the selected session:

- render user and assistant messages
- render streaming assistant output
- show current run status
- keep scroll behavior predictable
- avoid dumping operational logs into the chat body

### 5. Input composer

Minimum:

- multiline prompt input
- send prompt to selected session
- clear pending draft only after accepted send
- disabled/guarded state when selected session cannot accept input
- keyboard-first behavior

Later input improvements can include command palette, file mentions and multi-send.

### 6. Session status states

The MVP should support these statuses in the domain/UI, even if some are initially mock-only:

- idle
- thinking
- streaming
- running_tool
- editing_files
- waiting_approval
- waiting_input
- blocked
- error
- completed

Human-readable labels can differ, but internal states should stay explicit.

### 7. Right detail panel

A secondary panel should show operational detail for the selected session:

- current/previous tool calls
- file changes
- diffs or diff summaries when available
- errors/logs
- context/run metadata

The panel can be collapsible. It should not be required to read normal chat.

### 8. Basic persistence

At minimum, GPi should remember:

- projects
- sessions
- selected project/session
- local messages/events if not delegated to Pi
- last known status

## Should-have soon after MVP

- command palette
- quick session switcher
- keyboard shortcuts for next attention-needed session
- richer file/diff viewer
- session rename/archive
- branch/model indicators
- cancel/stop run control
- approval prompts surfaced as first-class UI
- copy/share selected output locally

## Later/future

- cloud sync
- collaboration
- marketplace
- plugin system
- full IDE/editor behavior
- complex multi-agent orchestration
- mobile UI
- analytics
- remote runners

## Main screens/regions

### Shell

Persistent layout containing:

- left sidebar: projects and sessions
- center: selected chat
- right panel: details
- bottom: input composer
- top/status bar: current project/session/model/branch/run state

### Empty state

When no project/session exists:

- create first project
- create first session
- explain that GPi wraps Pi rather than replacing it

### Session running state

When a session is active:

- chat streams output
- sidebar shows animated/running state
- right panel shows current tool/run detail
- input behavior is clear: queue, disabled, or allowed depending on Pi bridge capability

### Attention-needed state

When a session needs user intervention:

- sidebar badge is prominent but not alarming unless error
- session can be opened quickly
- required action is visible at top of chat/detail panel

## Core flows

### Create project

1. User creates a project with name and local path.
2. GPi adds it to sidebar.
3. GPi can create a first session under it.

### Create session

1. User selects project.
2. User creates session.
3. GPi creates local session record.
4. Session opens in chat surface.

### Switch session

1. User clicks or keyboard-selects a session.
2. Chat, input and right panel update instantly.
3. Other sessions keep their state and activity indicators.

### Send prompt

1. User types prompt in selected session.
2. GPi accepts prompt immediately.
3. Session status moves to thinking/streaming.
4. Events update chat and detail panel.

### Monitor parallel sessions

1. User keeps sidebar visible.
2. Badges/status show sessions running, waiting or errored.
3. User jumps to the next session needing attention.

### Inspect tool calls/diffs

1. User opens selected session.
2. Right panel shows tool calls and file changes.
3. User can inspect detail without losing chat position.

## Explicit exclusions from MVP

The MVP must not require:

- cloud accounts
- multi-user auth
- marketplace/plugin APIs
- remote sync
- enterprise settings
- a full code editor
- a complete reimplementation of Pi sessions/tools/providers

## MVP validation checklist

- A user can see more than one project/session in the sidebar.
- A user can switch between sessions without losing local chat state.
- A selected session can display messages and streaming events.
- A non-selected session can visibly change status.
- Tool/file detail has a place outside the main chat.
- The UI model does not assume a single global chat.
- The product still provides value if only one real Pi session is integrated first, because the multi-session shell is already present.
