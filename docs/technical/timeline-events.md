# GPi timeline event model

## Goal

GPi's chat should feel like pi.dev: every meaningful agent action appears as its own chronological block in the conversation, not hidden inside a generic work summary or secondary inspector.

The current `details: string[]` model remains useful for compatibility and logs, but it is not expressive enough to drive a polished action timeline. This document defines the typed event model that should become the primary visual source.

## Principles

- Preserve truth: render real Pi/GPi events, not invented actions.
- Preserve order: user prompt, actions, diffs and assistant response must appear in the order GPi observed them.
- Preserve context: events belong to a session and usually to a turn.
- Preserve performance: large payloads should be previewed/lazy-rendered.
- Preserve compatibility: existing persisted sessions with only messages/details must still render.
- Keep inspector secondary: Files/Tools/Logs aggregate the same event source instead of maintaining separate parsing logic.

## Storage shape

Add a session-indexed timeline event record:

```ts
export type SessionTimelineEvents = Record<string, TimelineEvent[]>;
```

Add it to `WorkspaceState` as optional/migrated data:

```ts
interface WorkspaceState {
  timelineEvents: SessionTimelineEvents;
}
```

Hydration should default missing `timelineEvents` to `{}` and may synthesize minimal legacy events from `chatMessages`/`details` for old sessions later. Initial implementation can keep legacy rendering fallback while new events are collected.

## Base event contract

Every event has stable metadata:

```ts
type TimelineEventBase = {
  id: string;
  sessionId: string;
  turnId: string | undefined;
  createdAt: number;
  order: number;
  source: "gpi" | "pi" | "legacy" | "mock";
};
```

### IDs

IDs should be deterministic enough for React keys and persistence:

- Prompt/user events: generated when prompt is accepted.
- Assistant events: generated when the first assistant delta for the turn arrives.
- Tool events: include Pi `toolCallId` where available.
- Diff events: derive from `toolCallId + path + index` or a generated event id if the diff comes later.
- Compaction/stats/errors: generated from session id, timestamp/order and event type.

### `turnId`

A turn begins when GPi accepts a user prompt/follow-up/steer or mock prompt. The initial version can generate `turnId` from the user event id. Events received before a known turn can use `undefined`; renderers should still show them chronologically.

Turn boundaries are important for:

- avoiding historical action blocks flooding new turns;
- placing actions between the right user and assistant message;
- grouping events in future collapsible turn sections.

### `order`

`order` is a monotonic per-session integer assigned in the reducer. It is the canonical render order. `createdAt` is for display/debug only and should not be used as the sole sort key.

## Event union

```ts
type TimelineEvent =
  | UserMessageTimelineEvent
  | AssistantMessageTimelineEvent
  | ToolTimelineEvent
  | FileChangeTimelineEvent
  | DiffTimelineEvent
  | CommandTimelineEvent
  | StatsTimelineEvent
  | CompactionTimelineEvent
  | ErrorTimelineEvent
  | SystemTimelineEvent;
```

### User message

```ts
type UserMessageTimelineEvent = TimelineEventBase & {
  kind: "user_message";
  text: string;
};
```

Created by:

- `markPromptAccepted()` for prompt/follow-up/mock prompt acceptance.

Render:

- existing right-aligned user bubble.

### Assistant message

```ts
type AssistantMessageTimelineEvent = TimelineEventBase & {
  kind: "assistant_message";
  text: string;
  responseMeta?: string;
  streaming: boolean;
};
```

Created/updated by:

- `GpiPiEvent.text_delta`.
- Mock streaming events.

Render:

- assistant message block.
- response metadata must be stored as a snapshot from the run, not read live from dropdown state.

### Tool event

```ts
type ToolTimelineEvent = TimelineEventBase & {
  kind: "tool";
  toolCallId: string;
  toolName: string;
  status: "started" | "finished";
  argsSummary?: string;
  resultSummary?: string;
  isError?: boolean;
  durationMs?: number;
};
```

Created by:

- `GpiPiEvent.tool_started`.
- `GpiPiEvent.tool_finished`.

Render:

- own action card in chat.
- started and finished can either update the same block or render as two states of one block. Prefer update-by-`toolCallId` to reduce duplicate noise while still showing a distinct block for each tool call.

### File change event

```ts
type FileChangeTimelineEvent = TimelineEventBase & {
  kind: "file_change";
  path: string;
  status: "created" | "modified" | "deleted" | "renamed" | "confirmed" | "unknown";
  origin: "pi-tool-args" | "gpi-derived" | "tool-result";
};
```

Created by:

- `fileChanges` from tool start/end.

Render:

- compact file badge/card, or included inside associated tool card if there is no diff.
- Files inspector aggregates these events by session.

### Diff event

```ts
type DiffTimelineEvent = TimelineEventBase & {
  kind: "diff";
  path: string;
  diff: string;
  diffKind: "git" | "created" | "before-after" | "snapshot" | "unavailable";
  message?: string;
};
```

Created by:

- `GpiPiEvent.tool_finished.diffs` real before/after diffs.
- fallback `getFileDiff` results when no emitted diff exists.

Render:

- own diff card in chat.
- default closed if large.
- additions green, removals red, metadata/context neutral.
- should remain visible between action events and final assistant response.

### Command event

```ts
type CommandTimelineEvent = TimelineEventBase & {
  kind: "command";
  command: string;
  cwd?: string;
  status: "started" | "finished";
  output?: string;
  exitCode?: number;
  durationMs?: number;
};
```

Created by:

- tool events when Pi exposes shell/bash command details in args/result.
- future richer bridge mapping.

Render:

- terminal-like command card.
- output preview lazy-rendered.

Initial implementation may not be able to produce this for every bash invocation until bridge parsing is richer. If command text is unavailable, render the tool event honestly instead.

### Stats event

```ts
type StatsTimelineEvent = TimelineEventBase & {
  kind: "stats";
  summary: string;
};
```

Created by:

- `GpiPiEvent.session_stats`.

Render:

- compact muted usage/context card.

### Compaction event

```ts
type CompactionTimelineEvent = TimelineEventBase & {
  kind: "compaction";
  status: "started" | "finished" | "aborted" | "failed" | "info";
  summary: string;
};
```

Created by:

- `GpiPiEvent.compaction_changed`.

Render:

- compact card. `already compacted` should be info, not error.

### Error event

```ts
type ErrorTimelineEvent = TimelineEventBase & {
  kind: "error";
  message: string;
  recoverable: boolean;
};
```

Created by:

- `GpiPiEvent.error`.
- rejected GPi actions that should be visible in chat rather than only global banner.

Render:

- error card with copy button.

### System event

```ts
type SystemTimelineEvent = TimelineEventBase & {
  kind: "system";
  message: string;
  tone: "neutral" | "success" | "warning";
};
```

Created by:

- session reopen/handle ready/import events if useful in the timeline.

Render:

- low-emphasis status card.

## Mapping from current `GpiPiEvent`

| `GpiPiEvent` | Timeline event(s) |
| --- | --- |
| `status_changed` | optional `system`; usually update session status only |
| `text_delta` | create/update `assistant_message` |
| `tool_started` | create/update `tool`; create `file_change` for file hints |
| `tool_finished` | update `tool`; create `file_change`; create `diff` for emitted diffs |
| `session_stats` | create `stats` |
| `compaction_changed` | create `compaction` |
| `error` | create `error` |

GPi UI actions also map:

| GPi action | Timeline event(s) |
| --- | --- |
| prompt accepted | `user_message` and new `turnId` |
| follow-up queued | `user_message` with new/queued turn semantics |
| mock event | `system` or typed equivalent where possible |
| reopen handle | `system` low-emphasis event only if useful |

## Render order rules

Render per session by `order` ascending.

For the common turn shape:

```text
user_message
system/tool/file_change/command/stats/compaction/error events
actual diff events
assistant_message
```

If assistant streaming starts before a late tool/diff event arrives, reducers should still append by observation order. The renderer may keep the current behavior of placing current-turn action events before the final assistant message while streaming, but persisted order remains authoritative.

## Legacy migration strategy

Initial migration:

1. Add `timelineEvents` to `WorkspaceState` and hydrate missing data to `{}`.
2. New events are appended going forward.
3. Existing UI can continue reading `chatMessages`/`details` until T058.
4. Inspector can keep parsing `details` until it is switched to aggregate timeline events.

Later migration:

- Convert `chatMessages` into user/assistant events for imported/old sessions.
- Convert parseable `details` strings into best-effort `system`, `tool`, `diff`, `stats`, `compaction` events with `source: "legacy"`.
- Keep original details for audit/debug if needed.

## Inspector relationship

The inspector should become derived views over `timelineEvents`:

- Tools tab: `tool`, `command`, `error`, `stats`, `compaction`.
- Files tab: `file_change`, `diff`.
- Logs tab: `system`, raw/legacy details and low-priority events.

This avoids independent parsing paths where the chat and inspector disagree.

## Performance requirements

- Large `diff` and `command.output` payloads should support preview/lazy render.
- Closed blocks should not mount expensive previews.
- Streaming assistant message updates should be batched before hitting React state.
- Workspace persistence should debounce frequent event updates.

## Open questions

- Whether tool start/end should be one mutable event or two immutable events. Recommendation: one event updated by `toolCallId` for tool cards, with order from start time.
- Whether `turnId` should be explicit in bridge events. Initial implementation can assign in renderer store based on accepted prompts.
- How much legacy `details` migration is worth before real users have large old GPi workspaces.
