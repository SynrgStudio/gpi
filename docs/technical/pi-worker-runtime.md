# WorkerPiRuntime architecture

## Goal

WorkerPiRuntime is GPi's target runtime architecture for real multi-agent operation. GPi should support multiple Pi agents running concurrently without making Electron main or the renderer feel blocked.

The target topology is:

```text
Renderer
  -> preload IPC
  -> Electron main router
  -> WorkerPiRuntime manager
  -> one worker per active real Pi session
  -> Pi SDK AgentSession
```

The current main-process SDK runtime remains only as a temporary fallback during migration.

## Product rationale

GPi is a cockpit for Pi, not a single-session terminal wrapper. The core product promise includes:

- 2-5 real Pi sessions running at once;
- independent streaming timelines;
- per-session abort/retry/dispose;
- no UI freeze when another agent opens a session, runs tools, compacts, or streams lots of events;
- crash isolation so a bad session/tool/provider can degrade one session without killing GPi.

That requires process/event-loop isolation. Main-process SDK embedding is useful for the current prototype, but it is not the final architecture.

## Non-goals

- Reimplement Pi's agent engine.
- Reimplement providers, auth, model registry, tools, skills, prompts, compaction, or session format.
- Expose generic filesystem, shell, process, or provider primitives to the renderer.
- Build a cloud orchestration service.
- Polish final worker UI before the runtime path is validated.

## Process ownership

### Renderer

Owns visual state and user interactions only:

- chat timeline rendering;
- sidebar/project/session selection;
- composer controls;
- model/thinking/compaction UI;
- command palette/onboarding.

Renderer talks only to preload IPC. It never sees worker process handles or Pi SDK objects.

### Electron main

Becomes a lightweight router and safety boundary:

- validates IPC payloads;
- validates project/session paths before sending work to a worker;
- owns workspace storage;
- owns safe git/file diff lookup;
- owns workflow skill installation;
- owns window controls;
- owns WorkerPiRuntime manager;
- forwards normalized `GpiPiEvent` events to renderer.

Main must not run Pi agent loops once WorkerPiRuntime is default.

### WorkerPiRuntime manager

Lives in Electron main and owns worker lifecycle:

- create worker for active session;
- route requests by remote session handle;
- maintain handle registry;
- subscribe to worker events;
- restart or dispose crashed workers;
- enforce concurrency limits;
- apply backpressure/coalescing policy;
- shut workers down on app close.

### Worker process

Owns Pi SDK objects and agent execution:

- `SessionManager` operations;
- `AgentSession` instances;
- Pi event subscriptions;
- prompt/followUp/steer/abort;
- model/thinking operations;
- compaction;
- session stats;
- per-session tool/diff metadata derivation that depends on Pi events.

A worker never exposes raw SDK objects over IPC.

## Isolation model

Default target: one worker per active real Pi session.

Reasons:

- simple crash isolation;
- per-session kill/restart semantics;
- clean ownership of `AgentSession` and event subscription;
- avoids one busy agent starving another in a shared worker event loop.

Potential future optimization: a small worker pool for idle/open-only sessions. Do not introduce pooling until worker-per-active-session is validated and measured.

## Worker primitive

Preferred order:

1. Electron `utilityProcess` if compatible with TypeScript build and packaged app paths.
2. Node `child_process.fork` if utility process packaging is too costly.
3. `worker_threads` only if process-level crash isolation is not required for the first implementation.

The chosen primitive must support:

- ESM-compatible entrypoint after `npm run compile:electron`;
- request/response messaging;
- unsolicited event messaging;
- kill/exit detection;
- packaged-app resource resolution.

## Protocol shape

The protocol is typed and complete from the start, even if some handlers initially return `unsupported`.

### Envelope

```ts
type WorkerRequest = {
  kind: "request";
  requestId: string;
  sentAt: number;
  payload: WorkerRequestPayload;
};

type WorkerResponse = {
  kind: "response";
  requestId: string;
  ok: true;
  payload: WorkerResponsePayload;
} | {
  kind: "response";
  requestId: string;
  ok: false;
  error: WorkerRuntimeError;
};

type WorkerEvent = {
  kind: "event";
  eventId: string;
  emittedAt: number;
  payload: WorkerEventPayload;
};
```

### Identifiers

- `workerId`: main-owned worker process id.
- `remoteSessionId`: stable handle id used by main/renderer for a worker-hosted `AgentSession`.
- `piSessionId`: Pi session id when known.
- `sessionFile`: Pi JSONL session file path when known.
- `runId`: GPi-owned id for a prompt/follow-up run.
- `turnId`: Pi/GPi turn correlation when available.
- `requestId`: request/response correlation id.
- `eventId`: monotonic/unique event id for diagnostics and dedupe.

### Request payloads

The protocol must cover all current runtime capabilities:

```ts
type WorkerRequestPayload =
  | { type: "health" }
  | { type: "list_sessions"; projectPath: string }
  | { type: "create_session"; projectId: string; projectPath: string }
  | { type: "open_session"; sessionPath: string; projectPath: string }
  | { type: "prompt"; remoteSessionId: string; runId: string; text: string }
  | { type: "follow_up"; remoteSessionId: string; runId: string; text: string }
  | { type: "steer"; remoteSessionId: string; text: string }
  | { type: "abort"; remoteSessionId: string }
  | { type: "get_model_options"; remoteSessionId: string }
  | { type: "set_model"; remoteSessionId: string; provider: string; modelId: string }
  | { type: "set_thinking_level"; remoteSessionId: string; level: string }
  | { type: "get_compaction_options"; remoteSessionId: string }
  | { type: "compact"; remoteSessionId: string; customInstructions?: string }
  | { type: "abort_compaction"; remoteSessionId: string }
  | { type: "set_auto_compaction"; remoteSessionId: string; enabled: boolean }
  | { type: "get_session_stats"; remoteSessionId: string }
  | { type: "dispose_session"; remoteSessionId: string }
  | { type: "shutdown" };
```

Main validates untrusted renderer input before constructing these messages. Worker still validates protocol shape defensively.

### Event payloads

Worker emits existing normalized `GpiPiEvent` equivalents plus runtime health:

```ts
type WorkerEventPayload =
  | { type: "pi_event"; remoteSessionId: string; event: GpiPiEvent }
  | { type: "worker_health"; health: WorkerHealthSnapshot }
  | { type: "worker_log"; level: "debug" | "info" | "warn" | "error"; message: string }
  | { type: "worker_disposed"; reason: string };
```

Main maps `remoteSessionId` to renderer session id before forwarding `GpiPiEvent` through the existing `gpi:pi-event` channel.

## Error model

Errors are typed and serializable:

```ts
type WorkerRuntimeErrorCode =
  | "invalid_request"
  | "unsupported"
  | "session_not_found"
  | "session_file_missing"
  | "project_path_invalid"
  | "pi_sdk_error"
  | "timeout"
  | "aborted"
  | "worker_crashed"
  | "worker_unavailable";
```

Every error includes:

- code;
- message;
- optional session id/file/path;
- optional retryable flag;
- optional cause summary, not raw unserializable objects.

Renderer receives actionable messages, not worker stack dumps.

## Health model

```ts
type WorkerHealth =
  | "starting"
  | "ready"
  | "busy"
  | "degraded"
  | "crashed"
  | "restarting"
  | "disposed";
```

Health snapshot includes:

- workerId;
- remoteSessionId if attached;
- health;
- startedAt;
- lastSeenAt;
- currentRunId;
- queuedRequestCount;
- recentError;
- restartCount;
- eventBacklogEstimate.

Initial UI can display only minimal degraded/crashed states. Full supervision polish comes later.

## Lifecycle

### Create session

1. Renderer calls existing `gpi:create-session`.
2. Main validates project id/path.
3. Worker manager spawns a worker.
4. Main sends `create_session`.
5. Worker creates Pi `AgentSession` and stores it by `remoteSessionId`.
6. Worker returns `{ remoteSessionId, sessionFile }`.
7. Main stores remote handle and returns existing `{ id, sessionFile }` shape to renderer.
8. Worker events are mapped to the existing event channel.

### Open session

Same as create, but main validates session file and project path first, then sends `open_session`.

### Prompt/follow-up

1. Renderer accepts prompt immediately into local workspace state.
2. Main sends `prompt`/`follow_up` with a `runId`.
3. Worker calls Pi SDK.
4. Worker maps Pi SDK events to `GpiPiEvent`.
5. Main forwards events to renderer.
6. Completion emits stats and idle/completed status.

### Abort

Abort is routed to the worker that owns the session. If worker is unresponsive, main can escalate to worker termination and mark the session degraded/crashed.

### Dispose/shutdown

- Disposing a session calls `AgentSession.dispose()` inside the worker if available and removes subscriptions.
- App shutdown sends `shutdown` to all workers with a short timeout, then kills remaining processes.

## Backpressure policy

WorkerPiRuntime should preserve ordering but avoid flooding the UI.

Rules:

- text deltas may be batched by renderer requestAnimationFrame as today;
- worker/main may coalesce health/log events;
- tool start/end and file/diff events must not be dropped;
- stats/compaction terminal events must not be dropped;
- if backlog grows, mark worker `degraded` and prefer batching text/log noise over dropping structural events.

## Security boundary

- Renderer never sends paths directly to worker.
- Main validates project/session paths using existing safe path functions before worker requests.
- Worker only receives validated paths and still handles missing files defensively.
- Worker does not expose shell/filesystem APIs beyond Pi SDK operations requested by main.
- No credentials are serialized to renderer or stored in GPi workspace.

## Migration phases

### Phase 1: architecture and protocol

- T072: this architecture and ADR update.
- T073: shared protocol types.

### Phase 2: worker substrate

- T074: worker entrypoint and dispatcher.
- T075: main-side WorkerPiRuntime manager.

### Phase 3: session lifecycle

- T076: list/create/open/dispose in worker.

### Phase 4: agent runs

- T077: prompt/followUp/steer/abort and streaming events.

### Phase 5: controls

- T078: model/thinking/compaction/stats/prewarm.

### Phase 6: supervision

- T079: health, crash isolation, restart, backpressure.

### Phase 7: default runtime

- T080: make WorkerPiRuntime default and validate real multi-agent cockpit.

## Validation target

Before returning to heavy UI polish, GPi should pass a real manual validation:

- create/open two real sessions in one project;
- run two prompts simultaneously;
- switch sessions while both stream;
- abort one run without affecting the other;
- recover or report a crashed/degraded worker;
- change model/thinking on a worker session;
- compact one session without freezing another;
- verify no startup or hover prewarm lag returns.

## Open decisions

- Exact worker primitive (`utilityProcess`, `child_process.fork`, or `worker_threads`). Default recommendation is process isolation over threads.
- Whether idle imported sessions get workers immediately or only on first prompt/open.
- How much worker health UI appears before the final supervision polish pass.
- Whether main-process SDK fallback remains shipped or is dev-only after T080.
