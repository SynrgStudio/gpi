import process from "node:process";
import { SdkPiBridge } from "../bridge/sdk-pi-bridge.js";
import { createWorkerRuntimeError, isWorkerRuntimeRequest } from "../bridge/worker-runtime-protocol.js";
import type { GpiPiSessionHandle } from "../bridge/pi-bridge.js";
import type { WorkerRuntimeEvent, WorkerRuntimeHealthSnapshot, WorkerRuntimeMessage, WorkerRuntimeRemoteSessionId, WorkerRuntimeRequest, WorkerRuntimeResponse, WorkerRuntimeResponsePayload, WorkerRuntimeWorkerId } from "../bridge/worker-runtime-protocol.js";

const workerId: WorkerRuntimeWorkerId = `worker-${process.pid.toString()}`;
const startedAt = Date.now();
let health: WorkerRuntimeHealthSnapshot = createHealth("starting");
let shuttingDown = false;
let eventSequence = 0;
const bridge = new SdkPiBridge(process.cwd());
const sessions = new Map<WorkerRuntimeRemoteSessionId, { handle: GpiPiSessionHandle; unsubscribe: () => void }>();

process.on("message", (message: unknown) => {
  void handleIncomingMessage(message);
});

process.on("uncaughtException", (error) => {
  health = createHealth("crashed", error instanceof Error ? error.message : String(error));
  sendEvent({ type: "worker_health", health });
  sendEvent({ type: "worker_log", level: "error", message: health.recentError?.message ?? "Worker crashed" });
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  health = createHealth("degraded", message);
  sendEvent({ type: "worker_health", health });
  sendEvent({ type: "worker_log", level: "error", message });
});

health = createHealth("ready");
sendEvent({ type: "worker_health", health });
sendEvent({ type: "worker_log", level: "info", message: `WorkerPiRuntime ready (${workerId})` });

async function handleIncomingMessage(message: unknown): Promise<void> {
  if (!isWorkerRuntimeRequest(message)) {
    sendResponse({
      kind: "response",
      requestId: "unknown",
      ok: false,
      error: createWorkerRuntimeError("invalid_request", "Invalid worker runtime message", { retryable: false }),
    });
    return;
  }

  try {
    const payload = await dispatchRequest(message);
    sendResponse({ kind: "response", requestId: message.requestId, ok: true, payload });
  } catch (error) {
    sendResponse({
      kind: "response",
      requestId: message.requestId,
      ok: false,
      error: toWorkerRuntimeError(error),
    });
  }
}

async function dispatchRequest(request: WorkerRuntimeRequest): Promise<WorkerRuntimeResponsePayload> {
  switch (request.payload.type) {
    case "health":
      health = createHealth(shuttingDown ? "disposed" : "ready");
      return { type: "health", health };
    case "shutdown":
      shuttingDown = true;
      for (const remoteSessionId of sessions.keys()) disposeSession(remoteSessionId);
      health = createHealth("disposed");
      sendEvent({ type: "worker_health", health });
      sendEvent({ type: "worker_disposed", reason: "shutdown requested" });
      queueMicrotask(() => process.exit(0));
      return { type: "shutdown", ok: true };
    case "list_sessions": {
      const sessions = await bridge.listSessions(request.payload.projectPath);
      return { type: "list_sessions", sessions };
    }
    case "create_session": {
      const handle = await bridge.createSession({ projectId: request.payload.projectId, projectPath: request.payload.projectPath });
      attachSession(handle);
      return { type: "create_session", remoteSessionId: handle.id, piSessionId: handle.id, sessionFile: handle.sessionFile };
    }
    case "open_session": {
      const handle = await bridge.openSession({ sessionPath: request.payload.sessionPath, projectPath: request.payload.projectPath });
      attachSession(handle);
      return { type: "open_session", remoteSessionId: handle.id, piSessionId: handle.id, sessionFile: handle.sessionFile };
    }
    case "prompt": {
      const { remoteSessionId, text, runId, images } = request.payload;
      sendEvent({ type: "pi_event", remoteSessionId, runId, event: { type: "timing_mark", sessionId: remoteSessionId, mark: "worker_prompt_received", timestamp: Date.now(), runId } });
      sendEvent({ type: "pi_event", remoteSessionId, runId, event: { type: "run_phase", sessionId: remoteSessionId, phase: "working", status: "started", timestamp: Date.now() } });
      startSessionRun(remoteSessionId, () => requireSession(remoteSessionId).prompt(text, images));
      sendEvent({ type: "pi_event", remoteSessionId, runId, event: { type: "timing_mark", sessionId: remoteSessionId, mark: "prompt_dispatched", timestamp: Date.now(), runId } });
      return { type: "prompt", ok: true };
    }
    case "follow_up": {
      const { remoteSessionId, text, images } = request.payload;
      startSessionRun(remoteSessionId, () => requireSession(remoteSessionId).followUp(text, images));
      return { type: "follow_up", ok: true };
    }
    case "steer": {
      const { remoteSessionId, text, images } = request.payload;
      startSessionRun(remoteSessionId, () => requireSession(remoteSessionId).steer(text, images));
      return { type: "steer", ok: true };
    }
    case "abort":
      await requireSession(request.payload.remoteSessionId).abort();
      return { type: "abort", ok: true };
    case "get_model_options":
      return { type: "get_model_options", options: requireSession(request.payload.remoteSessionId).getModelOptions() };
    case "set_model": {
      const handle = requireSession(request.payload.remoteSessionId);
      await handle.setModel(request.payload.provider, request.payload.modelId);
      return { type: "set_model", options: handle.getModelOptions() };
    }
    case "set_thinking_level": {
      const handle = requireSession(request.payload.remoteSessionId);
      handle.setThinkingLevel(request.payload.level);
      return { type: "set_thinking_level", options: handle.getModelOptions() };
    }
    case "get_compaction_options":
      return { type: "get_compaction_options", options: requireSession(request.payload.remoteSessionId).getCompactionOptions() };
    case "compact": {
      const options = await requireSession(request.payload.remoteSessionId).compact(request.payload.customInstructions);
      return { type: "compact", options };
    }
    case "abort_compaction":
      return { type: "abort_compaction", options: requireSession(request.payload.remoteSessionId).abortCompaction() };
    case "set_auto_compaction":
      return { type: "set_auto_compaction", options: requireSession(request.payload.remoteSessionId).setAutoCompactionEnabled(request.payload.enabled) };
    case "get_session_stats":
      return { type: "get_session_stats", summary: "Session stats unavailable through WorkerPiRuntime protocol in this phase" };
    case "dispose_session":
      disposeSession(request.payload.remoteSessionId);
      return { type: "dispose_session", ok: true };
    default:
      throwUnsupported("unknown");
  }
}

function startSessionRun(remoteSessionId: WorkerRuntimeRemoteSessionId, run: () => Promise<void>): void {
  void run().catch((error: unknown) => {
    const runtimeError = toWorkerRuntimeError(error);
    sendEvent({ type: "pi_event", remoteSessionId, event: { type: "error", sessionId: remoteSessionId, message: runtimeError.message } });
  });
}

function attachSession(handle: GpiPiSessionHandle): void {
  const existing = sessions.get(handle.id);
  existing?.unsubscribe();
  const unsubscribe = handle.subscribe((event) => sendEvent({ type: "pi_event", remoteSessionId: handle.id, event }));
  sessions.set(handle.id, { handle, unsubscribe });
}

function requireSession(remoteSessionId: WorkerRuntimeRemoteSessionId): GpiPiSessionHandle {
  const session = sessions.get(remoteSessionId);
  if (!session) throw createSessionNotFoundError(remoteSessionId);
  return session.handle;
}

function disposeSession(remoteSessionId: WorkerRuntimeRemoteSessionId): void {
  const session = sessions.get(remoteSessionId);
  if (!session) return;
  session.unsubscribe();
  session.handle.dispose();
  sessions.delete(remoteSessionId);
}

function createSessionNotFoundError(remoteSessionId: WorkerRuntimeRemoteSessionId): Error {
  return Object.assign(new Error(`Worker session not found: ${remoteSessionId}`), { workerRuntimeCode: "session_not_found", remoteSessionId });
}

function throwUnsupported(type: string): never {
  throw Object.assign(new Error(`Worker request not implemented yet: ${type}`), { workerRuntimeCode: "unsupported" });
}

function toWorkerRuntimeError(error: unknown) {
  if (typeof error === "object" && error !== null && "workerRuntimeCode" in error) {
    const code = error.workerRuntimeCode === "session_not_found" || error.workerRuntimeCode === "unsupported" ? error.workerRuntimeCode : "pi_sdk_error";
    const remoteSessionId = "remoteSessionId" in error && typeof error.remoteSessionId === "string" ? error.remoteSessionId : undefined;
    return createWorkerRuntimeError(code, error instanceof Error ? error.message : String(error), { remoteSessionId, retryable: code !== "unsupported" });
  }
  return error instanceof Error
    ? createWorkerRuntimeError("pi_sdk_error", error.message, { causeSummary: error.stack, retryable: true })
    : createWorkerRuntimeError("pi_sdk_error", String(error), { retryable: true });
}

function createHealth(state: WorkerRuntimeHealthSnapshot["health"], errorMessage?: string): WorkerRuntimeHealthSnapshot {
  return {
    workerId,
    remoteSessionId: undefined,
    health: state,
    startedAt,
    lastSeenAt: Date.now(),
    currentRunId: undefined,
    queuedRequestCount: 0,
    recentError: errorMessage ? createWorkerRuntimeError(state === "crashed" ? "worker_crashed" : "worker_unavailable", errorMessage) : undefined,
    restartCount: 0,
    eventBacklogEstimate: 0,
  };
}

function sendEvent(payload: WorkerRuntimeEvent["payload"]): void {
  sendMessage({
    kind: "event",
    eventId: `${workerId}-event-${(eventSequence += 1).toString()}`,
    emittedAt: Date.now(),
    payload,
  });
}

function sendResponse(response: WorkerRuntimeResponse): void {
  sendMessage(response);
}

function sendMessage(message: WorkerRuntimeMessage): void {
  if (!process.send) return;
  process.send(message);
}
