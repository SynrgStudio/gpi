import { fork } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createWorkerRuntimeError, isWorkerRuntimeEvent, isWorkerRuntimeResponse } from "../bridge/worker-runtime-protocol.js";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { GpiDiscoveredSession } from "../domain/types.js";
import type { GpiCompactionOptions, GpiModelOptions, GpiPiEvent, GpiPiSessionHandle } from "../bridge/pi-bridge.js";
import type { WorkerRuntimeEvent, WorkerRuntimeHealthSnapshot, WorkerRuntimeRemoteSessionId, WorkerRuntimeRequest, WorkerRuntimeRequestPayload, WorkerRuntimeResponse, WorkerRuntimeResponsePayload, WorkerRuntimeWorkerId } from "../bridge/worker-runtime-protocol.js";

interface PendingWorkerRequest {
  resolve: (payload: WorkerRuntimeResponsePayload) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class WorkerPiRuntimeManager {
  private readonly workers = new Map<WorkerRuntimeWorkerId, WorkerPiRuntimeProcess>();
  private workerSequence = 0;

  constructor(private readonly workerScriptPath: string) {}

  createWorker(): WorkerPiRuntimeProcess {
    const workerId = `pi-worker-${(this.workerSequence += 1).toString()}`;
    const worker = new WorkerPiRuntimeProcess(workerId, this.workerScriptPath);
    this.workers.set(workerId, worker);
    worker.subscribe((event) => {
      if (event.payload.type === "worker_health" && event.payload.health.health === "crashed") this.workers.delete(workerId);
      if (event.payload.type === "worker_disposed") this.workers.delete(workerId);
    });
    worker.start();
    return worker;
  }

  getWorker(workerId: WorkerRuntimeWorkerId): WorkerPiRuntimeProcess | undefined {
    return this.workers.get(workerId);
  }

  getWorkers(): WorkerPiRuntimeProcess[] {
    return [...this.workers.values()];
  }

  async createWorkerAndGetHealth(): Promise<{ worker: WorkerPiRuntimeProcess; health: WorkerRuntimeHealthSnapshot }> {
    const worker = this.createWorker();
    const response = await worker.request({ type: "health" });
    if (response.type !== "health") throw new Error(`Unexpected worker health response: ${response.type}`);
    return { worker, health: response.health };
  }

  async listSessions(projectPath: string): Promise<GpiDiscoveredSession[]> {
    const worker = this.createWorker();
    try {
      const response = await worker.request({ type: "list_sessions", projectPath });
      if (response.type !== "list_sessions") throw new Error(`Unexpected list sessions response: ${response.type}`);
      return response.sessions;
    } finally {
      await worker.shutdown();
    }
  }

  async createSession(options: { projectId: string; projectPath: string }): Promise<GpiPiSessionHandle> {
    const worker = this.createWorker();
    const response = await worker.request({ type: "create_session", projectId: options.projectId, projectPath: options.projectPath });
    if (response.type !== "create_session") throw new Error(`Unexpected create session response: ${response.type}`);
    return new RemoteWorkerPiSessionHandle(response.remoteSessionId, response.sessionFile, worker);
  }

  async openSession(options: { sessionPath: string; projectPath: string }): Promise<GpiPiSessionHandle> {
    const worker = this.createWorker();
    const response = await worker.request({ type: "open_session", sessionPath: options.sessionPath, projectPath: options.projectPath });
    if (response.type !== "open_session") throw new Error(`Unexpected open session response: ${response.type}`);
    return new RemoteWorkerPiSessionHandle(response.remoteSessionId, response.sessionFile, worker);
  }

  async shutdownAll(): Promise<void> {
    await Promise.allSettled([...this.workers.values()].map((worker) => worker.shutdown()));
    this.workers.clear();
  }
}

class RemoteWorkerPiSessionHandle implements GpiPiSessionHandle {
  private readonly listeners = new Set<(event: GpiPiEvent) => void>();
  private readonly unsubscribe: () => void;

  constructor(
    public readonly id: WorkerRuntimeRemoteSessionId,
    public readonly sessionFile: string | undefined,
    private readonly worker: WorkerPiRuntimeProcess,
  ) {
    this.unsubscribe = this.worker.subscribe((event) => {
      if (event.payload.type !== "pi_event" || event.payload.remoteSessionId !== this.id) return;
      this.emit(event.payload.event);
    });
  }

  async prompt(text: string): Promise<void> {
    await this.expectOk(await this.worker.request({ type: "prompt", remoteSessionId: this.id, runId: createRunId(this.id), text }, longRunningRequestTimeoutMs), "prompt");
  }

  async steer(text: string): Promise<void> {
    await this.expectOk(await this.worker.request({ type: "steer", remoteSessionId: this.id, text }, longRunningRequestTimeoutMs), "steer");
  }

  async followUp(text: string): Promise<void> {
    await this.expectOk(await this.worker.request({ type: "follow_up", remoteSessionId: this.id, runId: createRunId(this.id), text }, longRunningRequestTimeoutMs), "follow_up");
  }

  async abort(): Promise<void> {
    await this.expectOk(await this.worker.request({ type: "abort", remoteSessionId: this.id }, controlRequestTimeoutMs), "abort");
  }

  getModelOptions(): GpiModelOptions {
    throw new Error("Worker model options are async; use getModelOptionsAsync through main IPC phase");
  }

  async getModelOptionsAsync(): Promise<GpiModelOptions> {
    const response = await this.worker.request({ type: "get_model_options", remoteSessionId: this.id });
    if (response.type !== "get_model_options") throw new Error(`Unexpected model options response: ${response.type}`);
    return response.options;
  }

  async setModel(provider: string, modelId: string): Promise<void> {
    const response = await this.worker.request({ type: "set_model", remoteSessionId: this.id, provider, modelId });
    if (response.type !== "set_model") throw new Error(`Unexpected set model response: ${response.type}`);
  }

  setThinkingLevel(_level: ThinkingLevel): void {
    throw new Error("Worker thinking level is async; use setThinkingLevelAsync through main IPC phase");
  }

  async setThinkingLevelAsync(level: ThinkingLevel): Promise<GpiModelOptions> {
    const response = await this.worker.request({ type: "set_thinking_level", remoteSessionId: this.id, level });
    if (response.type !== "set_thinking_level") throw new Error(`Unexpected set thinking response: ${response.type}`);
    return response.options;
  }

  getCompactionOptions(): GpiCompactionOptions {
    throw new Error("Worker compaction options are async; use getCompactionOptionsAsync through main IPC phase");
  }

  async getCompactionOptionsAsync(): Promise<GpiCompactionOptions> {
    const response = await this.worker.request({ type: "get_compaction_options", remoteSessionId: this.id });
    if (response.type !== "get_compaction_options") throw new Error(`Unexpected compaction options response: ${response.type}`);
    return response.options;
  }

  async compact(customInstructions?: string): Promise<GpiCompactionOptions> {
    const response = await this.worker.request({ type: "compact", remoteSessionId: this.id, customInstructions }, longRunningRequestTimeoutMs);
    if (response.type !== "compact") throw new Error(`Unexpected compact response: ${response.type}`);
    return response.options;
  }

  abortCompaction(): GpiCompactionOptions {
    throw new Error("Worker abort compaction is async; use abortCompactionAsync through main IPC phase");
  }

  async abortCompactionAsync(): Promise<GpiCompactionOptions> {
    const response = await this.worker.request({ type: "abort_compaction", remoteSessionId: this.id });
    if (response.type !== "abort_compaction") throw new Error(`Unexpected abort compaction response: ${response.type}`);
    return response.options;
  }

  setAutoCompactionEnabled(_enabled: boolean): GpiCompactionOptions {
    throw new Error("Worker auto-compaction is async; use setAutoCompactionEnabledAsync through main IPC phase");
  }

  async setAutoCompactionEnabledAsync(enabled: boolean): Promise<GpiCompactionOptions> {
    const response = await this.worker.request({ type: "set_auto_compaction", remoteSessionId: this.id, enabled });
    if (response.type !== "set_auto_compaction") throw new Error(`Unexpected auto-compaction response: ${response.type}`);
    return response.options;
  }

  dispose(): void {
    this.unsubscribe();
    void this.worker.request({ type: "dispose_session", remoteSessionId: this.id }).finally(() => void this.worker.shutdown());
  }

  subscribe(listener: (event: GpiPiEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: GpiPiEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private expectOk(response: WorkerRuntimeResponsePayload, type: WorkerRuntimeResponsePayload["type"]): void {
    if (response.type !== type || !("ok" in response) || response.ok !== true) throw new Error(`Unexpected ${type} response: ${response.type}`);
  }
}

const controlRequestTimeoutMs = 30_000;
const longRunningRequestTimeoutMs = 30 * 60_000;

function createRunId(remoteSessionId: string): string {
  return `${remoteSessionId}-run-${Date.now().toString(36)}`;
}

export class WorkerPiRuntimeProcess {
  private child: ChildProcess | undefined;
  private readonly pending = new Map<string, PendingWorkerRequest>();
  private readonly eventListeners = new Set<(event: WorkerRuntimeEvent) => void>();
  private requestSequence = 0;
  private healthSnapshot: WorkerRuntimeHealthSnapshot | undefined;

  constructor(
    private readonly workerId: WorkerRuntimeWorkerId,
    private readonly workerScriptPath: string,
  ) {}

  get id(): WorkerRuntimeWorkerId {
    return this.workerId;
  }

  get health(): WorkerRuntimeHealthSnapshot | undefined {
    return this.healthSnapshot;
  }

  start(): void {
    if (this.child) return;
    this.child = fork(this.workerScriptPath, [], {
      execArgv: [],
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    this.child.on("message", (message: unknown) => this.handleMessage(message));
    this.child.on("exit", (code, signal) => this.handleExit(code, signal));
    this.child.on("error", (error) => this.rejectAll(error));
    this.child.stdout?.on("data", (chunk: Buffer) => this.emitLog("info", chunk.toString("utf8").trim()));
    this.child.stderr?.on("data", (chunk: Buffer) => this.emitLog("error", chunk.toString("utf8").trim()));
  }

  subscribe(listener: (event: WorkerRuntimeEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  async request(payload: WorkerRuntimeRequestPayload, timeoutMs = 15_000): Promise<WorkerRuntimeResponsePayload> {
    this.start();
    if (!this.child?.connected) throw new Error(`Worker ${this.workerId} is not connected`);

    const requestId = `${this.workerId}-request-${(this.requestSequence += 1).toString()}`;
    const request: WorkerRuntimeRequest = { kind: "request", requestId, sentAt: Date.now(), payload };
    return new Promise<WorkerRuntimeResponsePayload>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Worker request timed out: ${payload.type}`));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timeout });
      this.child?.send(request, (error) => {
        if (!error) return;
        clearTimeout(timeout);
        this.pending.delete(requestId);
        reject(error);
      });
    });
  }

  async shutdown(timeoutMs = 2_000): Promise<void> {
    if (!this.child) return;
    try {
      await this.request({ type: "shutdown" }, timeoutMs);
    } catch {
      this.child.kill();
    }
  }

  private handleMessage(message: unknown): void {
    if (isWorkerRuntimeEvent(message)) {
      if (message.payload.type === "worker_health") this.healthSnapshot = message.payload.health;
      this.emitEvent(message);
      return;
    }

    if (isWorkerRuntimeResponse(message)) {
      this.resolveResponse(message);
      return;
    }

    this.emitLog("warn", `Ignored invalid worker message from ${this.workerId}`);
  }

  private resolveResponse(response: WorkerRuntimeResponse): void {
    const pending = this.pending.get(response.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(response.requestId);
    if (response.ok) {
      pending.resolve(response.payload);
      return;
    }
    pending.reject(new Error(`${response.error.code}: ${response.error.message}`));
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.child = undefined;
    this.rejectAll(new Error(`Worker ${this.workerId} exited (${code?.toString() ?? signal ?? "unknown"})`));
    this.emitEvent({
      kind: "event",
      eventId: `${this.workerId}-exit-${Date.now().toString()}`,
      emittedAt: Date.now(),
      payload: {
        type: "worker_health",
        health: {
          workerId: this.workerId,
          remoteSessionId: undefined,
          health: "crashed",
          startedAt: this.healthSnapshot?.startedAt ?? Date.now(),
          lastSeenAt: Date.now(),
          currentRunId: undefined,
          queuedRequestCount: this.pending.size,
          recentError: createWorkerRuntimeError("worker_crashed", `Worker exited (${code?.toString() ?? signal ?? "unknown"})`),
          restartCount: this.healthSnapshot?.restartCount ?? 0,
          eventBacklogEstimate: 0,
        },
      },
    });
  }

  private rejectAll(error: Error): void {
    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(requestId);
    }
  }

  private emitLog(level: "debug" | "error" | "info" | "warn", message: string): void {
    if (message.length === 0) return;
    this.emitEvent({
      kind: "event",
      eventId: `${this.workerId}-log-${Date.now().toString()}`,
      emittedAt: Date.now(),
      payload: { type: "worker_log", level, message },
    });
  }

  private emitEvent(event: WorkerRuntimeEvent): void {
    for (const listener of this.eventListeners) listener(event);
  }
}
