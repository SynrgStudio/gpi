# GPi ↔ Pi Integration

## Sources read

- `@mariozechner/pi-coding-agent/README.md`
- `docs/sdk.md`
- `docs/rpc.md`
- `docs/session-format.md`
- `docs/extensions.md`
- `docs/tui.md`
- `docs/packages.md`
- `docs/models.md`
- `examples/sdk/01-minimal.ts`
- `examples/sdk/11-sessions.ts`

## Integration goal

GPi should reuse Pi's engine and expose a GUI cockpit around it. The integration must support multiple project-scoped sessions running or visible at the same time.

GPi should not reimplement:

- provider/model registry
- auth storage
- tool execution
- skills/prompts/extensions discovery
- session tree semantics
- compaction/retry behavior
- agent loop

## Pi capabilities relevant to GPi

### Programmatic SDK

Pi exports a Node SDK from `@mariozechner/pi-coding-agent`:

- `createAgentSession()` creates one `AgentSession`.
- `createAgentSessionRuntime()` creates a runtime that supports session replacement.
- `AgentSession.subscribe()` streams lifecycle and content events.
- `AgentSession.prompt()`, `steer()`, `followUp()` and `abort()` control agent runs.
- `SessionManager` controls persistent, in-memory, continued and opened sessions.
- `DefaultResourceLoader` discovers extensions, skills, prompts, themes and context files.
- `AuthStorage` and `ModelRegistry` reuse Pi auth/model configuration.

This is the preferred integration path for a TypeScript/Node app because it gives type safety, direct event access and direct session state.

### RPC mode

Pi also exposes `pi --mode rpc` over stdin/stdout JSONL. It supports:

- prompt/steer/follow_up/abort
- new_session/switch_session/fork/clone
- get_state/get_messages/get_session_stats
- model and thinking controls
- session name
- event streaming
- extension UI sub-protocol

RPC is useful for process isolation or non-Node clients. It is less ergonomic than SDK for GPi if GPi is a Node/Electron/Tauri-with-Node backend app.

### Session files

Pi sessions are JSONL files under `~/.pi/agent/sessions/`, grouped by cwd. Entries form a tree via `id` and `parentId`.

Important for GPi:

- session files already persist messages and branch history
- session metadata includes cwd and session id
- session names can be set through Pi (`/name`, `pi.setSessionName()`, RPC `set_session_name`)
- SessionManager can list sessions for a cwd or all sessions
- GPi should not invent an incompatible session format for Pi conversations

### Events

SDK and RPC expose the event stream GPi needs:

- `agent_start` / `agent_end`
- `turn_start` / `turn_end`
- `message_start` / `message_update` / `message_end`
- `tool_execution_start` / `tool_execution_update` / `tool_execution_end`
- `queue_update`
- `compaction_start` / `compaction_end`
- `auto_retry_start` / `auto_retry_end`
- `extension_error`

`message_update.assistantMessageEvent` carries streaming deltas:

- `text_start` / `text_delta` / `text_end`
- `thinking_start` / `thinking_delta` / `thinking_end`
- `toolcall_start` / `toolcall_delta` / `toolcall_end`
- `done` / `error`

These map directly to GPi chat rendering, status badges and tool panels.

## Recommended architecture path

### Use WorkerPiRuntime as primary bridge

GPi should target WorkerPiRuntime as the primary bridge: Electron main routes validated requests to isolated worker processes, and each active real Pi session owns a Pi SDK `AgentSession` inside its worker.

Reasons:

- direct typed event subscriptions
- direct use of `SessionManager`
- direct reuse of `AuthStorage`, `ModelRegistry`, settings and resource loading
- easier multi-session orchestration inside one app process
- no need to parse JSONL process output for the primary implementation

### Keep main-process SDK as temporary fallback

The earlier main-process SDK bridge is now a migration fallback, not the target architecture. ADR 0002 and `docs/technical/pi-worker-runtime.md` define the WorkerPiRuntime target because real multi-agent parallelism is core to GPi.

## Conceptual GPi bridge interface

```ts
type GpiSessionStatus =
  | "idle"
  | "thinking"
  | "streaming"
  | "running_tool"
  | "editing_files"
  | "waiting_approval"
  | "waiting_input"
  | "blocked"
  | "error"
  | "completed";

interface GpiPiBridge {
  listPiSessions(projectPath: string): Promise<PiSessionSummary[]>;
  createSession(projectPath: string): Promise<GpiPiSessionHandle>;
  openSession(projectPath: string, sessionFileOrId: string): Promise<GpiPiSessionHandle>;
}

interface GpiPiSessionHandle {
  id: string;
  sessionFile?: string;
  prompt(text: string): Promise<void>;
  steer(text: string): Promise<void>;
  followUp(text: string): Promise<void>;
  abort(): Promise<void>;
  dispose(): void;
  subscribe(listener: (event: GpiPiEvent) => void): () => void;
}
```

Internal `GpiPiEvent` should normalize Pi SDK/RPC events into UI-friendly events:

- session status changed
- message started
- text delta
- thinking delta
- tool call started/updated/ended
- file change detected
- queue changed
- run completed
- run errored

## Multi-session design implications

GPi should not use a single global Pi runtime. WorkerPiRuntime should manage a registry:

```text
ProjectId -> SessionId -> WorkerPiRuntime remote session handle
```

Each active session handle owns:

- its own Pi `AgentSession`
- its own event subscription
- its own status accumulator
- its own message/event cache for UI rendering
- its own abort/dispose lifecycle

The sidebar derives status from all session accumulators, not just the selected session.

## Project/cwd behavior

Pi's resource loading and session organization are cwd-sensitive. GPi projects should therefore have a local path. Creating/opening a Pi session for a project should use that path as `cwd` so Pi discovers the right:

- `AGENTS.md`
- `.pi/settings.json`
- `.pi/extensions/`
- `.pi/prompts/`
- `.pi/skills/`
- session directory bucket

If GPi lets users create projects without local paths later, those projects should be treated as UI-only until a cwd is assigned.

## Session lifecycle mapping

### Create session

Use `SessionManager.create(projectPath)` with `createAgentSession()` or create a runtime with `createAgentSessionRuntime()`.

### Continue/list existing sessions

Use `SessionManager.list(projectPath)` for project-specific sessions. Use `SessionManager.listAll()` for an import/discovery view if needed.

### Open existing session

Use `SessionManager.open(path)` or runtime `switchSession()` depending on whether GPi models each chat as a separate handle or a replaceable runtime.

For GPi's multi-session cockpit, separate handles are simpler than a single replaceable runtime.

### Prompt

Call `session.prompt(text)` when idle. During streaming, call `session.steer()` or `session.followUp()`, or `session.prompt(text, { streamingBehavior })`.

The UI must make queue behavior explicit.

### Abort

Call `session.abort()` for selected session run cancellation. Abort is per session handle.

### Model and thinking controls

Pi SDK exposes real model/thinking control on `AgentSession`:

- `session.model` and `session.thinkingLevel` expose current state.
- `session.modelRegistry.getAll()` lists Pi's configured model registry without GPi duplicating provider data.
- `session.modelRegistry.hasConfiguredAuth(model)` lets GPi distinguish selectable authenticated models from visible-but-unusable models.
- `session.setModel(model)` validates auth and persists through Pi session/settings behavior.
- `session.getAvailableThinkingLevels()`, `session.supportsThinking()` and `session.setThinkingLevel(level)` expose model-bound thinking controls.

GPi implementation policy:

- Show selectors only for live Pi SDK-backed handles.
- Use Pi's registry and session methods; do not create a separate model registry or auth store.
- Disable controls while the selected session is actively running.
- For imported sessions without an open handle, show the current gap instead of pretending model switching is available.

### Compaction

Pi SDK exposes real compaction control on `AgentSession`:

- `session.isCompacting` reports manual/auto compaction in progress.
- `session.compact(customInstructions?)` manually compacts context and aborts the current agent operation first.
- `session.abortCompaction()` cancels in-progress compaction.
- `session.autoCompactionEnabled` reports the setting.
- `session.setAutoCompactionEnabled(enabled)` toggles Pi's own auto-compaction setting.
- `compaction_start` and `compaction_end` events provide lifecycle updates and reason/error state.

GPi implementation policy:

- Show compaction controls only when there is a live Pi SDK handle.
- Use Pi `AgentSession` methods directly; do not edit session files manually.
- Surface compaction lifecycle in the session log as bridge events.
- Manual compaction is a real action and may abort an in-progress agent operation, matching Pi SDK behavior.

### Dispose

Call `session.dispose()` when closing GPi or unloading a session handle.

## Tool calls and file changes

Pi exposes tool execution events:

- `tool_execution_start`
- `tool_execution_update`
- `tool_execution_end`

These are sufficient for a first tool panel. `toolName` and `toolCallId` correlate updates and results.

File changes can be inferred in stages:

1. First pass: show tool names and raw/summary details for `edit`, `write`, `bash` when available.
2. Safer pass: inspect built-in tool result details if exported/stable enough.
3. Later: optionally run a controlled git diff/status watcher per project, clearly marked as GPi-derived rather than Pi-emitted.

GPi should not invent file change events that imply Pi certainty if the bridge cannot prove them.

## Approvals and extension UI gates

Pi core intentionally avoids built-in permission popups, but extensions can implement gates through `ExtensionUIContext`:

- `ui.select(title, options, opts?)`
- `ui.confirm(title, message, opts?)`
- `ui.input(title, placeholder?, opts?)`
- `ui.custom(...)`

RPC mode has an explicit extension UI sub-protocol. SDK-created sessions expose extension facilities through Pi's extension runner, but GPi does not yet have a stable bridge contract for forwarding extension UI requests from SDK sessions into Electron and resolving them back.

Current GPi strategy:

- Keep `waiting_approval` in the domain model.
- Do not show fake approve/deny UI until the bridge has a real request id, prompt metadata and response path.
- Treat SDK extension UI forwarding as a bridge gap unless Pi exposes or documents a stable SDK hook for it.
- If approval support becomes urgent, prefer a narrow RPC/worker spike that uses the documented extension UI protocol rather than reaching into private SDK internals.

Minimum real approval event contract GPi needs:

```ts
type GpiApprovalRequest = {
  id: string;
  sessionId: string;
  kind: "confirm" | "select" | "input" | "custom";
  title: string;
  message?: string;
  options?: string[];
};
```

The renderer may enter `waiting_approval` only when such a real request is received. The response must be sent back through a paired bridge method such as `resolveApproval(requestId, value)`.

## Recommended first implementation phases

1. Mock bridge with the same event interface.
2. SDK bridge creating one in-memory/new persistent Pi session for a project path.
3. Session listing/opening via `SessionManager`.
4. Multiple concurrent SDK sessions in the same app process.
5. Tool event mapping.
6. File-change/diff derivation only after the real event path is stable.

## Risks

### Multiple sessions in one process

Pi SDK supports creating sessions programmatically, but GPi must validate that multiple concurrent sessions in one Node process do not conflict through shared global state, extensions, settings or cwd-sensitive tools.

Mitigation: start with 2-3 concurrent mock sessions, then 2 real SDK sessions. If conflicts appear, move real sessions to isolated worker processes or RPC subprocesses behind the same bridge interface.

### Extension UI in SDK mode

Interactive Pi has rich TUI methods. GPi needs to determine how SDK-created sessions should handle extension UI calls. RPC has explicit extension UI protocol; SDK embedding may require custom UI plumbing or accepting degraded extension UI at first.

Mitigation: treat extension UI/approval as a separate milestone.

### File diffs

Pi tool events expose tool lifecycle; diff extraction may require stable tool result shapes or GPi-side git diffing.

Mitigation: display tool calls first, file/diff detail second.

## Recommendation

Build GPi as a local TypeScript GUI with a Node-side SDK bridge. Keep the bridge interface adapter-based so RPC/process isolation remains possible if SDK multi-session constraints appear.

The first real integration should prioritize:

1. create/open one Pi session for a project path
2. send prompt
3. stream text into chat
4. update sidebar status from lifecycle events
5. show tool execution events in the right panel

This satisfies GPi's cockpit thesis without reimplementing Pi.

## Prewarm decision

GPi should use only safe, shallow prewarm initially.

Implemented prewarm boundary:

- Start a non-blocking bridge prewarm when Electron main loads.
- Prewarm calls `SessionManager.list(projectPath)` and records timing/session count.
- Expose prewarm status to the renderer for diagnostics/timing display.
- Do not share `AgentSession` instances between UI sessions.
- Do not manually cache auth tokens, model registry internals, tools, or cwd-bound resources.

Reasoning:

- `SessionManager.list(projectPath)` is read-only and cwd-scoped.
- It can warm filesystem/session metadata paths and gives useful timing telemetry.
- Deeper prewarm through Pi internals may risk sharing cwd-sensitive state or stale resources.
- Optimistic UI already solves perceived latency; this prewarm is informational and low-risk.

Future deeper prewarm should only happen if Pi exposes an explicit safe service-level API for reusable, cwd-scoped services.
