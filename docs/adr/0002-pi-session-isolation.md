# ADR 0002: Pi session isolation strategy

## Status

Updated. Supersedes the earlier in-process SDK decision.

WorkerPiRuntime is now the target architecture for real Pi sessions. The existing main-process SDK bridge remains a temporary fallback during migration, not the final runtime model.

## Context

GPi runs as a local Electron app. Pi is the agent engine and GPi is the cockpit UI around it.

The first working implementation embedded `@mariozechner/pi-coding-agent` SDK in Electron main and created one `AgentSession` handle per live GPi session. That was the fastest path to validate:

- real session creation/opening;
- prompt streaming;
- tool/file/diff timeline events;
- model/thinking controls;
- compaction;
- imported session reopening.

The product goal is now clearer: GPi must be a real multi-agent cockpit. Users should be able to run multiple Pi agents in parallel without opening multiple terminals and without one busy session degrading the whole app.

The current main-process SDK bridge has already shown UI responsiveness risks around session opening/prewarm. Those issues can be mitigated, but the final multi-agent architecture needs stronger isolation.

## Decision

Adopt WorkerPiRuntime as the target architecture:

```text
Renderer
  -> preload IPC
  -> Electron main router
  -> WorkerPiRuntime manager
  -> one worker per active real Pi session
  -> Pi SDK AgentSession
```

Design the worker runtime completely from the start:

- typed request/response protocol;
- unsolicited streaming events;
- remote session handles;
- run ids / turn ids;
- per-session cancellation;
- worker health;
- crash/restart/dispose lifecycle;
- backpressure/coalescing;
- full model/thinking/compaction/session-stats support.

Implement it incrementally, but do not design a throwaway mini-RPC.

## Rationale

WorkerPiRuntime directly supports the core product requirements:

- 2-5 real sessions running concurrently;
- independent event streams;
- per-session abort/retry/dispose;
- isolation if one Pi session, provider, tool, or SDK path hangs/crashes;
- responsive Electron main process for window, storage, IPC, sidebar, composer and timeline routing;
- safer future prewarm because workers can warm without blocking main;
- clearer supervision primitives for active agents.

The renderer/preload contract should stay stable. The migration should happen behind the existing narrow GPi bridge boundary.

## Architecture boundary

### Renderer

Renderer remains a UI consumer. It does not load Pi SDK and does not know whether a session is main-process or worker-backed.

### Electron main

Main becomes a lightweight router and safety boundary:

- validates all renderer IPC payloads;
- validates paths before worker calls;
- owns workspace storage;
- owns safe file diff lookup;
- owns workflow skill installation;
- owns worker lifecycle and event routing.

### Worker

Worker owns Pi SDK objects:

- `SessionManager`;
- `AgentSession`;
- SDK subscriptions;
- prompts/follow-ups/steering/abort;
- model/thinking/compaction/stats.

No raw SDK object crosses process boundaries.

## Consequences

Positive:

- aligns architecture with GPi's multi-agent product identity;
- prevents a single busy session from monopolizing Electron main;
- enables stronger crash isolation and retry semantics;
- makes prewarm and long-running session supervision safer;
- keeps renderer mostly stable by preserving normalized `GpiPiEvent` events.

Negative:

- increases implementation complexity;
- requires a typed RPC protocol and worker lifecycle management;
- packaging may need extra care for worker entrypoints;
- debugging spans multiple processes;
- event ordering/backpressure must be designed explicitly.

## Migration plan

The active queue tracks the migration:

- T072 — design WorkerPiRuntime completely from zero;
- T073 — create shared protocol/types;
- T074 — implement worker process and dispatcher;
- T075 — implement main-side WorkerPiRuntime manager;
- T076 — move session lifecycle into worker;
- T077 — move prompt/followUp/abort/streaming into worker;
- T078 — move model/thinking/compaction/stats/prewarm into worker;
- T079 — implement health/crash isolation/backpressure;
- T080 — make WorkerPiRuntime default and validate multi-agent cockpit.

## Fallback policy

The current main-process SDK runtime may remain during migration as a fallback for diagnosis and rollback. It must not be the product target after T080 unless validation shows a blocking worker issue.

If fallback remains shipped, it should be explicit and internal, not a permanent parallel architecture that doubles maintenance cost.

## Validation

WorkerPiRuntime is considered successful when GPi can:

- run at least two real Pi sessions simultaneously;
- stream both without event mixing;
- switch sessions while both run;
- abort one session without affecting another;
- recover/report a crashed or degraded worker;
- change model/thinking and compact per worker-backed session;
- keep startup and hover interactions smooth.

Detailed design lives in `docs/technical/pi-worker-runtime.md`.
