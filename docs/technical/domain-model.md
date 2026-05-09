# GPi Domain Model

## Design rule

No domain entity may assume a single global chat. GPi is project-first and session-first.

## Entities

### Workspace

Top-level local GPi installation state.

Fields:

- `id`
- `projects: Project[]`
- `selectedProjectId?`
- `selectedSessionId?`
- `settings`

### Project

A local work context, usually mapped to a filesystem path / Pi cwd.

Fields:

- `id`
- `name`
- `path`
- `sessions: SessionSummary[]`
- `createdAt`
- `updatedAt`
- `lastOpenedAt`

Rules:

- A project can have many sessions.
- A project path is required for real Pi integration.
- A project aggregate status is derived from child sessions.

### Session

A chat/agent lane inside a project.

Fields:

- `id`
- `projectId`
- `title`
- `piSessionId?`
- `piSessionFile?`
- `status: SessionStatus`
- `messages: Message[]`
- `events: SessionEvent[]`
- `activeRunId?`
- `lastActivityAt`
- `createdAt`
- `updatedAt`

Rules:

- A session owns its messages and event history.
- Switching selected session never stops other sessions.
- A non-selected session can still receive events and status updates.

### AgentRun

One prompt-processing lifecycle inside a session.

Fields:

- `id`
- `sessionId`
- `promptMessageId`
- `status: RunStatus`
- `startedAt`
- `endedAt?`
- `error?`
- `toolCallIds: string[]`

Rules:

- A session has at most one active run for the first MVP unless Pi bridge proves queued/concurrent prompts are safe.
- Steering/follow-up messages are represented as queued inputs, not separate active runs until delivered.

### Message

A normalized UI message.

Fields:

- `id`
- `sessionId`
- `role: user | assistant | tool | system | custom`
- `content`
- `status: streaming | complete | error | aborted`
- `createdAt`
- `updatedAt`
- `piEntryId?`
- `runId?`

### ToolCall

A normalized tool execution record.

Fields:

- `id`
- `sessionId`
- `runId`
- `toolName`
- `args`
- `status: pending | running | succeeded | failed | cancelled`
- `startedAt`
- `endedAt?`
- `summary?`
- `outputPreview?`
- `details?`

### FileChange

A UI-level file change associated with a run or tool call.

Fields:

- `id`
- `projectId`
- `sessionId`
- `runId?`
- `toolCallId?`
- `path`
- `kind: created | modified | deleted | renamed | unknown`
- `diff?`
- `source: pi-tool-event | gpi-git-diff | manual`
- `createdAt`

Rule: if GPi derives file changes by git diff, mark `source` accordingly.

### Approval

A user intervention request.

Fields:

- `id`
- `sessionId`
- `runId?`
- `kind: command | file_write | session_switch | extension_ui | unknown`
- `title`
- `body`
- `status: pending | approved | rejected | expired | cancelled`
- `createdAt`
- `resolvedAt?`

### SessionEvent

Append-only normalized event log for UI reconstruction.

Fields:

- `id`
- `sessionId`
- `type`
- `payload`
- `createdAt`
- `source: mock | pi-sdk | pi-rpc | gpi`

## Status enums

### SessionStatus

- `idle`
- `thinking`
- `streaming`
- `running_tool`
- `editing_files`
- `waiting_approval`
- `waiting_input`
- `blocked`
- `error`
- `completed`

### RunStatus

- `queued`
- `starting`
- `thinking`
- `streaming`
- `running_tools`
- `waiting_approval`
- `aborting`
- `completed`
- `failed`
- `aborted`

## Status priority for sidebar

When multiple signals exist, sidebar attention priority is:

1. `error`
2. `blocked`
3. `waiting_approval`
4. `waiting_input`
5. `editing_files`
6. `running_tool`
7. `streaming`
8. `thinking`
9. `completed`
10. `idle`

Project status is derived from the highest-priority child session status.

## Main transitions

### Prompt accepted

```text
idle/completed -> thinking
create AgentRun(status=starting/thinking)
append user Message
```

### Text stream starts

```text
thinking -> streaming
assistant Message(status=streaming)
```

### Tool starts

```text
streaming/thinking -> running_tool
ToolCall(status=running)
```

If the tool is known to mutate files (`edit`, `write`) or a file change is detected:

```text
running_tool -> editing_files
FileChange created/updated
```

### Tool ends

```text
ToolCall -> succeeded/failed
if more active tools: keep running_tool/editing_files
else return to streaming/thinking until turn ends
```

### Agent ends successfully

```text
streaming/running_tool/editing_files -> completed
AgentRun -> completed
assistant Message -> complete
```

After a quiet timeout or new prompt readiness, UI may display `idle` while preserving last completed state metadata.

### Human intervention needed

```text
any active -> waiting_approval or waiting_input
Approval(status=pending) optional
```

### Abort/error

```text
any active -> error | blocked | completed
AgentRun -> failed | aborted
```

## Concurrency rules

- GPi may have many sessions loaded.
- GPi should support at least 2-5 active session handles.
- Each session event stream updates only that session's reducer.
- Sidebar aggregation reads from session summaries, not live component state.
- Selected session is a view concern, not execution ownership.
- Prompts target exactly one session in MVP.
- Future multi-send should create independent prompt events per target session.

## Restoration rules

On app start:

1. Load GPi workspace/project/session index.
2. For each project, list known Pi sessions if project path exists.
3. Restore local selected project/session.
4. Lazily open Pi session handles only when needed, unless a run recovery mechanism exists.
5. Recompute sidebar aggregate statuses from persisted last-known status, then update as live sessions connect.

## Validation checklist

- No entity uses a singleton `currentChat` as source of truth.
- Session state can be rendered while not selected.
- Project sidebar state can be derived without mounting chat views.
- Session restore can occur from persisted Pi session file plus GPi UI metadata.
