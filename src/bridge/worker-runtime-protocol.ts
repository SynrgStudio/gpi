import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { GpiDiscoveredSession, GpiImageAttachment } from "../domain/types.js";
import type { GpiCompactionOptions, GpiModelOptions, GpiPiEvent } from "./pi-bridge.js";

export type WorkerRuntimeRequestId = string;
export type WorkerRuntimeEventId = string;
export type WorkerRuntimeWorkerId = string;
export type WorkerRuntimeRemoteSessionId = string;
export type WorkerRuntimeRunId = string;
export type WorkerRuntimeTurnId = string;

export type WorkerRuntimeHealthState = "busy" | "crashed" | "degraded" | "disposed" | "ready" | "restarting" | "starting";

export interface WorkerRuntimeHealthSnapshot {
  workerId: WorkerRuntimeWorkerId;
  remoteSessionId: WorkerRuntimeRemoteSessionId | undefined;
  health: WorkerRuntimeHealthState;
  startedAt: number;
  lastSeenAt: number;
  currentRunId: WorkerRuntimeRunId | undefined;
  queuedRequestCount: number;
  recentError: WorkerRuntimeError | undefined;
  restartCount: number;
  eventBacklogEstimate: number;
}

export type WorkerRuntimeErrorCode =
  | "aborted"
  | "invalid_request"
  | "pi_sdk_error"
  | "project_path_invalid"
  | "session_file_missing"
  | "session_not_found"
  | "timeout"
  | "unsupported"
  | "worker_crashed"
  | "worker_unavailable";

export interface WorkerRuntimeError {
  code: WorkerRuntimeErrorCode;
  message: string;
  retryable: boolean;
  remoteSessionId?: WorkerRuntimeRemoteSessionId;
  sessionFile?: string;
  projectPath?: string;
  causeSummary?: string;
}

export interface WorkerRuntimeSessionInfo {
  remoteSessionId: WorkerRuntimeRemoteSessionId;
  piSessionId: string;
  sessionFile: string | undefined;
}

export type WorkerRuntimeRequestPayload =
  | { type: "abort"; remoteSessionId: WorkerRuntimeRemoteSessionId }
  | { type: "abort_compaction"; remoteSessionId: WorkerRuntimeRemoteSessionId }
  | { type: "compact"; remoteSessionId: WorkerRuntimeRemoteSessionId; customInstructions?: string }
  | { type: "create_session"; projectId: string; projectPath: string }
  | { type: "dispose_session"; remoteSessionId: WorkerRuntimeRemoteSessionId }
  | { type: "follow_up"; remoteSessionId: WorkerRuntimeRemoteSessionId; runId: WorkerRuntimeRunId; text: string; images?: GpiImageAttachment[] }
  | { type: "get_compaction_options"; remoteSessionId: WorkerRuntimeRemoteSessionId }
  | { type: "get_model_options"; remoteSessionId: WorkerRuntimeRemoteSessionId }
  | { type: "get_session_stats"; remoteSessionId: WorkerRuntimeRemoteSessionId }
  | { type: "health" }
  | { type: "list_sessions"; projectPath: string }
  | { type: "open_session"; sessionPath: string; projectPath: string }
  | { type: "prompt"; remoteSessionId: WorkerRuntimeRemoteSessionId; runId: WorkerRuntimeRunId; text: string; images?: GpiImageAttachment[] }
  | { type: "set_auto_compaction"; remoteSessionId: WorkerRuntimeRemoteSessionId; enabled: boolean }
  | { type: "set_model"; remoteSessionId: WorkerRuntimeRemoteSessionId; provider: string; modelId: string }
  | { type: "set_thinking_level"; remoteSessionId: WorkerRuntimeRemoteSessionId; level: ThinkingLevel }
  | { type: "shutdown" }
  | { type: "steer"; remoteSessionId: WorkerRuntimeRemoteSessionId; text: string; images?: GpiImageAttachment[] };

export type WorkerRuntimeResponsePayload =
  | { type: "abort"; ok: true }
  | { type: "abort_compaction"; options: GpiCompactionOptions }
  | { type: "compact"; options: GpiCompactionOptions }
  | ({ type: "create_session" } & WorkerRuntimeSessionInfo)
  | { type: "dispose_session"; ok: true }
  | { type: "follow_up"; ok: true }
  | { type: "get_compaction_options"; options: GpiCompactionOptions }
  | { type: "get_model_options"; options: GpiModelOptions }
  | { type: "get_session_stats"; summary: string }
  | { type: "health"; health: WorkerRuntimeHealthSnapshot }
  | { type: "list_sessions"; sessions: GpiDiscoveredSession[] }
  | ({ type: "open_session" } & WorkerRuntimeSessionInfo)
  | { type: "prompt"; ok: true }
  | { type: "set_auto_compaction"; options: GpiCompactionOptions }
  | { type: "set_model"; options: GpiModelOptions }
  | { type: "set_thinking_level"; options: GpiModelOptions }
  | { type: "shutdown"; ok: true }
  | { type: "steer"; ok: true };

export interface WorkerRuntimeRequest {
  kind: "request";
  requestId: WorkerRuntimeRequestId;
  sentAt: number;
  payload: WorkerRuntimeRequestPayload;
}

export type WorkerRuntimeResponse =
  | {
      kind: "response";
      requestId: WorkerRuntimeRequestId;
      ok: true;
      payload: WorkerRuntimeResponsePayload;
    }
  | {
      kind: "response";
      requestId: WorkerRuntimeRequestId;
      ok: false;
      error: WorkerRuntimeError;
    };

export type WorkerRuntimeEventPayload =
  | { type: "pi_event"; remoteSessionId: WorkerRuntimeRemoteSessionId; event: GpiPiEvent; runId?: WorkerRuntimeRunId; turnId?: WorkerRuntimeTurnId }
  | { type: "worker_disposed"; reason: string }
  | { type: "worker_health"; health: WorkerRuntimeHealthSnapshot }
  | { type: "worker_log"; level: "debug" | "error" | "info" | "warn"; message: string };

export interface WorkerRuntimeEvent {
  kind: "event";
  eventId: WorkerRuntimeEventId;
  emittedAt: number;
  payload: WorkerRuntimeEventPayload;
}

export type WorkerRuntimeMessage = WorkerRuntimeEvent | WorkerRuntimeRequest | WorkerRuntimeResponse;

export function createWorkerRuntimeError(code: WorkerRuntimeErrorCode, message: string, options: Omit<Partial<WorkerRuntimeError>, "code" | "message"> = {}): WorkerRuntimeError {
  return {
    code,
    message,
    retryable: options.retryable ?? isRetryableWorkerRuntimeError(code),
    remoteSessionId: options.remoteSessionId,
    sessionFile: options.sessionFile,
    projectPath: options.projectPath,
    causeSummary: options.causeSummary,
  };
}

export function isRetryableWorkerRuntimeError(code: WorkerRuntimeErrorCode): boolean {
  return code === "timeout" || code === "worker_crashed" || code === "worker_unavailable" || code === "pi_sdk_error";
}

export function isWorkerRuntimeRequest(message: unknown): message is WorkerRuntimeRequest {
  return isRecord(message) && message.kind === "request" && typeof message.requestId === "string" && typeof message.sentAt === "number" && isRecord(message.payload) && typeof message.payload.type === "string";
}

export function isWorkerRuntimeResponse(message: unknown): message is WorkerRuntimeResponse {
  return isRecord(message) && message.kind === "response" && typeof message.requestId === "string" && typeof message.ok === "boolean";
}

export function isWorkerRuntimeEvent(message: unknown): message is WorkerRuntimeEvent {
  return isRecord(message) && message.kind === "event" && typeof message.eventId === "string" && typeof message.emittedAt === "number" && isRecord(message.payload) && typeof message.payload.type === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
