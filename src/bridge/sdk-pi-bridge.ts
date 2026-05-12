import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, ImageContent, Model } from "@earendil-works/pi-ai";
import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { GpiDiscoveredSession, GpiImageAttachment, GpiWorkspaceSnapshot, SessionStatus } from "../domain/types.js";
import type { GpiCompactionOptions, GpiFileChangeHint, GpiFileDiffHint, GpiFileSnapshotHint, GpiModelInfo, GpiModelOptions, GpiPiBridge, GpiPiEvent, GpiPiSessionHandle } from "./pi-bridge.js";

const execFileAsync = promisify(execFile);

function toPiImages(images: GpiImageAttachment[]): ImageContent[] {
  return images.map((image) => ({ type: "image", data: image.data, mimeType: image.mimeType }));
}

interface ToolStartMetadata {
  startedAt: number;
  fileChanges: GpiFileChangeHint[];
  beforeContents: Map<string, Promise<string | undefined>>;
}

export interface SdkPiBridgePrewarmSnapshot {
  status: "idle" | "warming" | "ready" | "error";
  startedAt: number | undefined;
  finishedAt: number | undefined;
  durationMs: number | undefined;
  sessionCount: number | undefined;
  error: string | undefined;
}

class SdkPiSessionHandle implements GpiPiSessionHandle {
  private readonly listeners = new Set<(event: GpiPiEvent) => void>();
  private readonly toolStarts = new Map<string, ToolStartMetadata>();
  private turnBaseline: Map<string, Promise<string | undefined>> = new Map();
  private readonly unsubscribe: () => void;
  private firstTextEmitted = false;
  private firstThinkingEmitted = false;
  private firstToolEmitted = false;

  readonly sessionFile: string | undefined;

  constructor(
    public readonly id: string,
    private readonly session: AgentSession,
    private readonly projectPath: string,
  ) {
    this.sessionFile = session.sessionFile;
    this.unsubscribe = this.session.subscribe((event) => this.handleEvent(event));
  }

  async prompt(text: string, images: GpiImageAttachment[] = []): Promise<void> {
    try {
      await this.session.prompt(text, images.length > 0 ? { images: toPiImages(images) } : undefined);
    } catch (error) {
      this.emitError(error);
      throw error;
    }
  }

  async steer(text: string, images: GpiImageAttachment[] = []): Promise<void> {
    try {
      await this.session.steer(text, toPiImages(images));
    } catch (error) {
      this.emitError(error);
      throw error;
    }
  }

  async followUp(text: string, images: GpiImageAttachment[] = []): Promise<void> {
    try {
      await this.session.followUp(text, toPiImages(images));
    } catch (error) {
      this.emitError(error);
      throw error;
    }
  }

  async abort(): Promise<void> {
    await this.session.abort();
    this.emit({ type: "status_changed", sessionId: this.id, status: "completed" });
  }

  getModelOptions(): GpiModelOptions {
    const models = this.session.modelRegistry.getAll().map((model) => toGpiModelInfo(model, this.session.modelRegistry.hasConfiguredAuth(model)));
    return {
      currentModel: this.session.model ? toGpiModelInfo(this.session.model, this.session.modelRegistry.hasConfiguredAuth(this.session.model)) : undefined,
      currentThinkingLevel: this.session.thinkingLevel,
      availableThinkingLevels: this.session.getAvailableThinkingLevels(),
      supportsThinking: this.session.supportsThinking(),
      models,
    };
  }

  async setModel(provider: string, modelId: string): Promise<void> {
    const model = this.session.modelRegistry.find(provider, modelId);
    if (!model) throw new Error(`Unknown model: ${provider}/${modelId}`);
    await this.session.setModel(model);
    this.emit({ type: "status_changed", sessionId: this.id, status: "idle" });
  }

  setThinkingLevel(level: ThinkingLevel): void {
    this.session.setThinkingLevel(level);
  }

  getCompactionOptions(): GpiCompactionOptions {
    return { isCompacting: this.session.isCompacting, autoCompactionEnabled: this.session.autoCompactionEnabled };
  }

  async compact(customInstructions?: string): Promise<GpiCompactionOptions> {
    const result = await this.session.compact(customInstructions);
    const options = this.getCompactionOptions();
    this.emit({ type: "compaction_changed", sessionId: this.id, options, summary: `compacted ${result.tokensBefore.toString()} tokens` });
    this.emitSessionStats();
    return options;
  }

  abortCompaction(): GpiCompactionOptions {
    this.session.abortCompaction();
    const options = this.getCompactionOptions();
    this.emit({ type: "compaction_changed", sessionId: this.id, options, summary: "compaction abort requested" });
    return options;
  }

  setAutoCompactionEnabled(enabled: boolean): GpiCompactionOptions {
    this.session.setAutoCompactionEnabled(enabled);
    const options = this.getCompactionOptions();
    this.emit({ type: "compaction_changed", sessionId: this.id, options, summary: `auto-compaction ${enabled ? "enabled" : "disabled"}` });
    return options;
  }

  dispose(): void {
    this.unsubscribe();
    this.listeners.clear();
    this.toolStarts.clear();
    this.session.dispose();
  }

  subscribe(listener: (event: GpiPiEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private handleEvent(event: AgentSessionEvent): void {
    switch (event.type) {
      case "agent_start":
        this.turnBaseline = new Map();
        void populateGitDirtyFileBaseline(this.projectPath, this.turnBaseline);
        this.firstTextEmitted = false;
        this.firstThinkingEmitted = false;
        this.firstToolEmitted = false;
        this.emit({ type: "timing_mark", sessionId: this.id, mark: "agent_start", timestamp: Date.now() });
        this.emit({ type: "run_phase", sessionId: this.id, phase: "working", status: "finished", timestamp: Date.now() });
        this.emitStatus("thinking");
        break;
      case "agent_end":
        this.emit({ type: "timing_mark", sessionId: this.id, mark: "agent_end", timestamp: Date.now() });
        this.emit({ type: "run_phase", sessionId: this.id, phase: "thinking", status: "finished", timestamp: Date.now() });
        this.emitStatus("completed");
        this.emitSessionStats();
        break;
      case "tool_execution_start":
        this.handleToolStart(event.toolCallId, event.toolName, event.args);
        break;
      case "tool_execution_end":
        void this.handleToolEnd(event.toolCallId, event.toolName, event.isError, event.result);
        break;
      case "message_update":
        if (event.assistantMessageEvent.type === "thinking_start") {
          if (!this.firstThinkingEmitted) {
            this.firstThinkingEmitted = true;
            this.emit({ type: "timing_mark", sessionId: this.id, mark: "first_thinking", timestamp: Date.now() });
          }
          this.emit({ type: "run_phase", sessionId: this.id, phase: "thinking", status: "started", timestamp: Date.now() });
        }
        if (event.assistantMessageEvent.type === "thinking_delta") {
          if (!this.firstThinkingEmitted) {
            this.firstThinkingEmitted = true;
            this.emit({ type: "timing_mark", sessionId: this.id, mark: "first_thinking", timestamp: Date.now() });
          }
          this.emit({ type: "thinking_delta", sessionId: this.id, delta: event.assistantMessageEvent.delta });
        }
        if (event.assistantMessageEvent.type === "thinking_end") {
          this.emit({ type: "run_phase", sessionId: this.id, phase: "thinking", status: "finished", timestamp: Date.now() });
        }
        if (event.assistantMessageEvent.type === "toolcall_start") {
          this.emit({ type: "run_phase", sessionId: this.id, phase: "thinking", status: "finished", timestamp: Date.now() });
          this.emit({ type: "run_phase", sessionId: this.id, phase: "preparing_tool", status: "started", timestamp: Date.now() });
        }
        if (event.assistantMessageEvent.type === "toolcall_delta") {
          this.emit({ type: "tool_call_delta", sessionId: this.id, delta: event.assistantMessageEvent.delta });
        }
        if (event.assistantMessageEvent.type === "toolcall_end") {
          this.emit({ type: "tool_call_delta", sessionId: this.id, delta: summarizeToolCall(event.assistantMessageEvent.toolCall) });
        }
        if (event.assistantMessageEvent.type === "text_delta") {
          if (!this.firstTextEmitted) {
            this.firstTextEmitted = true;
            this.emit({ type: "timing_mark", sessionId: this.id, mark: "first_text", timestamp: Date.now() });
          }
          this.emitStatus("streaming");
          this.emit({ type: "text_delta", sessionId: this.id, delta: event.assistantMessageEvent.delta, responseMeta: this.responseMeta() });
        }
        if (event.assistantMessageEvent.type === "error") {
          this.emitStatus("error");
          this.emit({ type: "error", sessionId: this.id, message: event.assistantMessageEvent.reason });
        }
        break;
      case "queue_update":
        if (event.steering.length > 0 || event.followUp.length > 0) this.emitStatus("waiting_input");
        break;
      case "compaction_start":
        this.emit({ type: "compaction_changed", sessionId: this.id, options: this.getCompactionOptions(), summary: `compaction started: ${event.reason}` });
        break;
      case "compaction_end":
        this.emit({
          type: "compaction_changed",
          sessionId: this.id,
          options: this.getCompactionOptions(),
          summary: event.aborted ? "compaction aborted" : event.errorMessage ? `compaction failed: ${event.errorMessage}` : `compaction finished: ${event.reason}`,
        });
        this.emitSessionStats();
        break;
      default:
        break;
    }
  }

  private responseMeta(): string {
    const model = this.session.model?.name ?? "Pi model";
    const thinking = this.session.supportsThinking() ? this.session.thinkingLevel : "thinking off";
    return `${model} · ${thinking}`;
  }

  private handleToolStart(toolCallId: string, toolName: string, args: unknown): void {
    this.emit({ type: "run_phase", sessionId: this.id, phase: "preparing_tool", status: "finished", timestamp: Date.now() });
    if (!this.firstToolEmitted) {
      this.firstToolEmitted = true;
      this.emit({ type: "timing_mark", sessionId: this.id, mark: "first_tool", timestamp: Date.now() });
    }
    const fileChanges = deriveFileChanges(toolName, args);
    this.toolStarts.set(toolCallId, { startedAt: Date.now(), fileChanges, beforeContents: snapshotFiles(this.projectPath, fileChanges) });
    this.emitStatus(fileChanges.length > 0 ? "editing_files" : "running_tool");
    this.emit({
      type: "tool_started",
      sessionId: this.id,
      toolCallId,
      toolName,
      argsSummary: summarizeUnknown(args),
      fileChanges,
    });
  }

  private async handleToolEnd(toolCallId: string, toolName: string, isError: boolean, result: unknown): Promise<void> {
    const start = this.toolStarts.get(toolCallId);
    this.toolStarts.delete(toolCallId);
    const derivedFileChanges = dedupeFileChanges([...(start?.fileChanges ?? []), ...deriveFileChanges(toolName, result)]);
    const gitFallbackChanges = derivedFileChanges.length === 0 ? await deriveGitFileChanges(this.projectPath) : [];
    const fileChanges = dedupeFileChanges([...derivedFileChanges, ...gitFallbackChanges]);
    const beforeContents = mergeBeforeContents(this.turnBaseline, start?.beforeContents ?? new Map());
    this.emit({
      type: "tool_finished",
      sessionId: this.id,
      toolCallId,
      toolName,
      isError,
      durationMs: start ? Date.now() - start.startedAt : undefined,
      resultSummary: summarizeUnknown(result),
      fileChanges,
      diffs: await buildFileDiffs(this.projectPath, fileChanges, beforeContents),
      fileSnapshots: await buildFileSnapshots(this.projectPath, fileChanges, beforeContents),
    });
    if (isError) this.emitStatus("error");
  }

  private emitStatus(status: SessionStatus): void {
    this.emit({ type: "status_changed", sessionId: this.id, status });
  }

  private emitSessionStats(): void {
    const stats = this.session.getSessionStats();
    const context = stats.contextUsage
      ? `, context: ${stats.contextUsage.tokens?.toString() ?? "unknown"}/${stats.contextUsage.contextWindow.toString()} (${stats.contextUsage.percent?.toString() ?? "unknown"}%)`
      : ", context: unavailable";
    this.emit({
      type: "session_stats",
      sessionId: this.id,
      summary: `stats: messages ${stats.totalMessages.toString()}, tools ${stats.toolCalls.toString()}, tokens ${stats.tokens.total.toString()}, cost ${stats.cost.toFixed(4)}${context}`,
    });
  }

  private emitError(error: unknown): void {
    this.emitStatus("error");
    this.emit({ type: "error", sessionId: this.id, message: error instanceof Error ? error.message : String(error) });
  }

  private emit(event: GpiPiEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

export class SdkPiBridge implements GpiPiBridge {
  private prewarmSnapshot: SdkPiBridgePrewarmSnapshot = {
    status: "idle",
    startedAt: undefined,
    finishedAt: undefined,
    durationMs: undefined,
    sessionCount: undefined,
    error: undefined,
  };
  private prewarmPromise: Promise<SdkPiBridgePrewarmSnapshot> | undefined;

  constructor(private readonly projectPath: string) {}

  prewarm(): Promise<SdkPiBridgePrewarmSnapshot> {
    if (this.prewarmPromise) return this.prewarmPromise;

    const startedAt = Date.now();
    this.prewarmSnapshot = {
      status: "warming",
      startedAt,
      finishedAt: undefined,
      durationMs: undefined,
      sessionCount: undefined,
      error: undefined,
    };

    this.prewarmPromise = SessionManager.list(this.projectPath)
      .then((sessions) => {
        const finishedAt = Date.now();
        this.prewarmSnapshot = {
          status: "ready",
          startedAt,
          finishedAt,
          durationMs: finishedAt - startedAt,
          sessionCount: sessions.length,
          error: undefined,
        };
        return this.prewarmSnapshot;
      })
      .catch((error: unknown) => {
        const finishedAt = Date.now();
        this.prewarmSnapshot = {
          status: "error",
          startedAt,
          finishedAt,
          durationMs: finishedAt - startedAt,
          sessionCount: undefined,
          error: error instanceof Error ? error.message : String(error),
        };
        return this.prewarmSnapshot;
      });

    return this.prewarmPromise;
  }

  getPrewarmSnapshot(): SdkPiBridgePrewarmSnapshot {
    return this.prewarmSnapshot;
  }

  async listSessions(projectPath: string): Promise<GpiDiscoveredSession[]> {
    const sessions = await SessionManager.list(projectPath);
    return sessions.map((session) => ({
      id: session.id,
      path: session.path,
      title: session.name ?? (session.firstMessage || session.id),
      cwd: session.cwd,
      created: session.created.toISOString(),
      modified: session.modified.toISOString(),
      messageCount: session.messageCount,
      firstMessage: session.firstMessage,
      allMessagesText: session.allMessagesText,
    }));
  }

  async getWorkspaceSnapshot(): Promise<GpiWorkspaceSnapshot> {
    const sessions = await SessionManager.list(this.projectPath);
    const sessionIds = sessions.map((session) => session.id);
    return {
      selectedProjectId: "current-project",
      selectedSessionId: sessionIds[0] ?? "new-session",
      projects: [{ id: "current-project", name: "Current Project", path: this.projectPath, sessionIds }],
      sessions: sessions.map((session) => ({
        id: session.id,
        projectId: "current-project",
        title: session.name ?? session.firstMessage,
        status: "idle",
        lastActivity: session.path,
        origin: "real",
      })),
    };
  }

  async createSession(options: { projectId: string; projectPath: string }): Promise<GpiPiSessionHandle> {
    const { session } = await createAgentSession({
      cwd: options.projectPath,
      sessionManager: SessionManager.create(options.projectPath),
    });
    return new SdkPiSessionHandle(session.sessionId, session, options.projectPath);
  }

  async openSession(options: { sessionPath: string; projectPath: string }): Promise<GpiPiSessionHandle> {
    const { session } = await createAgentSession({
      cwd: options.projectPath,
      sessionManager: SessionManager.open(options.sessionPath),
    });
    return new SdkPiSessionHandle(session.sessionId, session, options.projectPath);
  }
}

function toGpiModelInfo(model: Model<Api>, hasAuth: boolean): GpiModelInfo {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    label: `${model.name} · ${model.provider}`,
    reasoning: model.reasoning,
    hasAuth,
  };
}

function snapshotFiles(projectPath: string, fileChanges: GpiFileChangeHint[]): Map<string, Promise<string | undefined>> {
  return new Map(fileChanges.map((change) => [change.path, readProjectFile(projectPath, change.path)]));
}

async function populateGitDirtyFileBaseline(projectPath: string, baseline: Map<string, Promise<string | undefined>>): Promise<void> {
  const entries = await readGitStatusEntries(projectPath);
  for (const entry of entries) {
    if (!baseline.has(entry.path)) baseline.set(entry.path, readProjectFile(projectPath, entry.path));
  }
}

function mergeBeforeContents(...sources: Array<Map<string, Promise<string | undefined>>>): Map<string, Promise<string | undefined>> {
  const merged = new Map<string, Promise<string | undefined>>();
  for (const source of sources) {
    for (const [path, content] of source) if (!merged.has(path)) merged.set(path, content);
  }
  return merged;
}

async function buildFileSnapshots(projectPath: string, fileChanges: GpiFileChangeHint[], beforeContents: Map<string, Promise<string | undefined>>): Promise<GpiFileSnapshotHint[]> {
  const snapshots = await Promise.all(fileChanges.map(async (change) => {
    const absolutePath = resolveProjectFilePath(projectPath, change.path);
    if (!absolutePath) return undefined;
    const before = await (beforeContents.get(change.path) ?? readGitHeadFile(projectPath, change.path));
    const after = await readProjectFile(projectPath, change.path);
    if (before === after) return undefined;
    return {
      path: change.path,
      absolutePath,
      existsBefore: before !== undefined,
      existsAfter: after !== undefined,
      contentBefore: before,
      contentAfter: after,
    } satisfies GpiFileSnapshotHint;
  }));
  return snapshots.filter((snapshot): snapshot is GpiFileSnapshotHint => snapshot !== undefined);
}

async function buildFileDiffs(projectPath: string, fileChanges: GpiFileChangeHint[], beforeContents: Map<string, Promise<string | undefined>>): Promise<GpiFileDiffHint[]> {
  const diffs = await Promise.all(fileChanges.map(async (change) => {
    if (!beforeContents.has(change.path)) {
      const gitDiff = await readGitDiff(projectPath, change.path);
      if (gitDiff) return { path: change.path, diff: gitDiff };
    }
    const before = await (beforeContents.get(change.path) ?? readGitHeadFile(projectPath, change.path));
    const after = await readProjectFile(projectPath, change.path);
    if (before === after) return undefined;
    return { path: change.path, diff: createUnifiedDiff(change.path, before, after) };
  }));
  return diffs.filter((diff): diff is GpiFileDiffHint => diff !== undefined);
}

async function readProjectFile(projectPath: string, filePath: string): Promise<string | undefined> {
  const absolutePath = resolveProjectFilePath(projectPath, filePath);
  if (!absolutePath) return undefined;
  try {
    return await readFile(absolutePath, "utf8");
  } catch {
    return undefined;
  }
}

function resolveProjectFilePath(projectPath: string, filePath: string): string | undefined {
  const absolutePath = resolve(projectPath, filePath);
  if (isAbsolute(filePath) || relative(projectPath, absolutePath).startsWith("..")) return undefined;
  return absolutePath;
}

function createUnifiedDiff(path: string, before: string | undefined, after: string | undefined): string {
  const beforeLines = before?.split("\n") ?? [];
  const afterLines = after?.split("\n") ?? [];
  const commonPrefix = countCommonPrefix(beforeLines, afterLines);
  const commonSuffix = countCommonSuffix(beforeLines, afterLines, commonPrefix);
  const beforeMiddle = beforeLines.slice(commonPrefix, beforeLines.length - commonSuffix);
  const afterMiddle = afterLines.slice(commonPrefix, afterLines.length - commonSuffix);
  const contextBefore = beforeLines.slice(Math.max(0, commonPrefix - 3), commonPrefix);
  const contextAfter = afterLines.slice(afterLines.length - commonSuffix, Math.min(afterLines.length, afterLines.length - commonSuffix + 3));
  return [
    `--- ${before === undefined ? "/dev/null" : path}`,
    `+++ ${after === undefined ? "/dev/null" : path}`,
    `@@ -${Math.max(1, commonPrefix - contextBefore.length + 1).toString()} +${Math.max(1, commonPrefix - contextBefore.length + 1).toString()} @@`,
    ...contextBefore.map((line) => ` ${line}`),
    ...beforeMiddle.map((line) => `-${line}`),
    ...afterMiddle.map((line) => `+${line}`),
    ...contextAfter.map((line) => ` ${line}`),
  ].join("\n");
}

function countCommonPrefix(left: string[], right: string[]): number {
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) index += 1;
  return index;
}

function countCommonSuffix(left: string[], right: string[], prefix: number): number {
  let count = 0;
  while (count + prefix < left.length && count + prefix < right.length && left[left.length - 1 - count] === right[right.length - 1 - count]) count += 1;
  return count;
}

async function deriveGitFileChanges(projectPath: string): Promise<GpiFileChangeHint[]> {
  return readGitStatusEntries(projectPath).then((entries) => dedupeFileChanges(entries.map((entry) => ({ path: entry.path, kind: entry.kind, source: "gpi-derived" }))));
}

async function readGitStatusEntries(projectPath: string): Promise<Array<{ path: string; kind: GpiFileChangeHint["kind"] }>> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", projectPath, "status", "--porcelain", "-z"], { timeout: 5_000, maxBuffer: 512_000 });
    const entries = stdout.split("\0").filter((entry) => entry.length > 0);
    const changes: Array<{ path: string; kind: GpiFileChangeHint["kind"] }> = [];
    for (const entry of entries) {
      const status = entry.slice(0, 2);
      const path = entry.slice(3).trim();
      if (!path) continue;
      if (status === "??" || status.includes("A")) changes.push({ path, kind: "created" });
      else if (status.includes("D")) changes.push({ path, kind: "deleted" });
      else changes.push({ path, kind: "modified" });
    }
    return changes;
  } catch {
    return [];
  }
}

async function readGitHeadFile(projectPath: string, filePath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", projectPath, "show", `HEAD:${filePath}`], { timeout: 5_000, maxBuffer: 512_000 });
    return stdout;
  } catch {
    return undefined;
  }
}

async function readGitDiff(projectPath: string, filePath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", projectPath, "diff", "--", filePath], { timeout: 5_000, maxBuffer: 512_000 });
    if (stdout.trim().length > 0) return stdout;
    const status = await execFileAsync("git", ["-C", projectPath, "status", "--porcelain", "--", filePath], { timeout: 5_000, maxBuffer: 64_000 });
    if (!status.stdout.startsWith("??")) return undefined;
    const content = await readProjectFile(projectPath, filePath);
    if (content === undefined) return undefined;
    return createUnifiedDiff(filePath, undefined, content);
  } catch {
    return undefined;
  }
}

function deriveFileChanges(toolName: string, args: unknown): GpiFileChangeHint[] {
  const records = collectRecords(args);
  const changes: GpiFileChangeHint[] = [];
  for (const record of records) {
    const path = getString(record, "path") ?? getString(record, "file") ?? getString(record, "filePath") ?? getString(record, "target_file");
    if (!path) continue;
    if (toolName === "write") changes.push({ path, kind: "created", source: "pi-tool-args" });
    else if (toolName === "edit") changes.push({ path, kind: "modified", source: "pi-tool-args" });
    else changes.push({ path, kind: "unknown", source: "gpi-derived" });
  }
  return dedupeFileChanges(changes);
}

function collectRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap((item) => collectRecords(item));
  if (!isRecord(value)) return [];
  return [value, ...Object.values(value).flatMap((item) => collectRecords(item))];
}

function dedupeFileChanges(changes: GpiFileChangeHint[]): GpiFileChangeHint[] {
  const byPath = new Map<string, GpiFileChangeHint>();
  for (const change of changes) byPath.set(`${change.kind}:${change.path}`, change);
  return [...byPath.values()];
}

function summarizeToolCall(value: unknown): string {
  const summary = summarizeUnknown(value);
  return summary.length === 0 ? "tool call ready" : summary;
}

function summarizeUnknown(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return truncate(value);

  try {
    return truncate(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function truncate(value: string): string {
  return value.length > 220 ? `${value.slice(0, 217)}...` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}
