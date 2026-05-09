# ADR 0001: Initial GPi Architecture

## Status

Proposed

## Context

GPi is a local GUI/cockpit for Pi. The first version must support projects and multiple sessions from the start. Pi already provides the agent engine, providers, auth, tools, sessions, context, skills and prompts.

The GUI needs a bridge to Pi that can stream messages and tool events while keeping the UI responsive.

## Decision

Build GPi as a TypeScript local GUI with an adapter-based Pi bridge.

Initial recommended runtime shape:

```text
GPi App
├─ Renderer/UI shell
│  ├─ project/session sidebar
│  ├─ chat pane
│  ├─ detail panel
│  └─ input composer
├─ App state/store
│  ├─ workspace/project/session index
│  ├─ selected session state
│  └─ session status aggregation
├─ Pi bridge interface
│  ├─ MockPiBridge
│  ├─ SdkPiBridge (primary)
│  └─ RpcPiBridge (fallback/future)
├─ Event store/reducer
└─ Persistence layer
```

Use the Pi SDK as the primary integration path. Keep RPC as a fallback adapter if SDK multi-session constraints or process isolation needs appear.

## Component responsibilities

### UI shell

Renders layout and user interactions. It should not know Pi SDK details.

### Project/session index

Stores GPi's project list and session summaries. It maps GPi projects to local paths and GPi sessions to Pi session ids/files where available.

### Pi bridge

Owns Pi integration behind a narrow interface:

- list sessions for project
- create/open session
- prompt/steer/followUp/abort
- subscribe to normalized events
- dispose handle

### Event store/reducer

Consumes normalized events and updates:

- messages
- tool calls
- file changes
- run state
- sidebar summaries

### Sidebar status aggregator

Computes project and session badges from session summaries and priority rules.

### Detail panel model

Stores operational detail keyed by selected session: tool calls, file changes, diffs, errors and run metadata.

### Persistence

Stores GPi UI metadata and cache. Pi session history remains in Pi session files.

## Event flow

```text
User prompt
  -> InputComposer
  -> App command: sendPrompt(sessionId, text)
  -> PiBridgeSession.prompt(text)
  -> Pi SDK/RPC events
  -> normalize event
  -> session reducer
  -> sidebar aggregator + chat/detail render
```

## Multi-session strategy

GPi maintains independent session handles:

```text
Map<ProjectId, Map<SessionId, PiSessionHandle>>
```

Each handle has its own subscription and lifecycle. The selected session only determines which session is displayed in the center; it does not own execution globally.

If several SDK sessions in one process conflict, the same bridge interface can move real sessions to RPC subprocesses or workers.

## Persistence strategy

GPi persists:

- projects
- GPi session records
- selected project/session
- layout preferences
- last known statuses
- UI-only draft/cache data

Pi persists:

- actual conversation entries
- branches
- compactions
- model/thinking changes
- Pi session names

Recommended first storage: a simple local JSON file under a GPi app data directory or project-local `.gpi/` during prototyping. Use atomic writes.

Do not store secrets in GPi. Reuse Pi `AuthStorage` and existing provider auth.

## Alternatives considered

### Directly parse Pi session files only

Rejected as primary path. It can recover history but cannot drive live streaming or tool lifecycle.

### Spawn `pi --mode rpc` per session

Viable fallback. Pros: isolation and language-agnostic protocol. Cons: process overhead, JSONL client complexity, extension UI protocol handling and less type safety.

### Embed Pi SDK per session

Accepted as primary. Pros: typed, direct events, direct SessionManager/AuthStorage/ModelRegistry usage. Risk: validate multi-session concurrency.

### Build a custom agent engine

Rejected. It violates GPi's thesis and duplicates Pi.

## Consequences

Positive:

- GPi remains focused on UX.
- Multi-session is architectural from day one.
- Pi upgrades can improve GPi without duplicate engine work.
- Mock bridge enables UI progress before real integration is complete.

Negative/risk:

- GPi depends on Pi SDK stability.
- Extension UI/approval behavior may need dedicated handling.
- Multi-session SDK behavior must be tested with real concurrent sessions.

## Initial validation path

1. Implement mock bridge and UI shell.
2. Implement SDK bridge for one session.
3. Run two SDK sessions concurrently in the same app process.
4. If conflicts appear, implement RPC bridge behind same interface.
5. Add tool event mapping.
6. Add file/diff extraction only after event mapping is stable.
