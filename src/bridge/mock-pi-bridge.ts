import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { GpiWorkspaceSnapshot } from "../domain/types.js";
import type { GpiCompactionOptions, GpiModelOptions, GpiPiBridge, GpiPiEvent, GpiPiSessionHandle } from "./pi-bridge.js";

class MockPiSessionHandle implements GpiPiSessionHandle {
  private listeners = new Set<(event: GpiPiEvent) => void>();

  readonly sessionFile = undefined;

  constructor(public readonly id: string) {}

  async prompt(text: string): Promise<void> {
    this.emit({ type: "status_changed", sessionId: this.id, status: "streaming" });
    this.emit({ type: "text_delta", sessionId: this.id, delta: text, responseMeta: "Mock model · thinking off" });
    this.emit({
      type: "tool_started",
      sessionId: this.id,
      toolCallId: "mock-read",
      toolName: "read",
      argsSummary: "path: docs/sdk.md",
      fileChanges: [],
    });
    this.emit({
      type: "tool_finished",
      sessionId: this.id,
      toolCallId: "mock-read",
      toolName: "read",
      isError: false,
      durationMs: 120,
      resultSummary: "read completed",
      fileChanges: [],
      diffs: [],
      fileSnapshots: [],
    });
    this.emit({ type: "status_changed", sessionId: this.id, status: "completed" });
  }

  async steer(text: string): Promise<void> {
    await this.prompt(text);
  }

  async followUp(text: string): Promise<void> {
    await this.prompt(text);
  }

  async abort(): Promise<void> {
    this.emit({ type: "status_changed", sessionId: this.id, status: "completed" });
  }

  getModelOptions(): GpiModelOptions {
    return { currentModel: undefined, currentThinkingLevel: "off", availableThinkingLevels: ["off"], supportsThinking: false, models: [] };
  }

  async setModel(_provider: string, _modelId: string): Promise<void> {
    throw new Error("Mock sessions do not support model selection");
  }

  setThinkingLevel(_level: ThinkingLevel): void {
    return;
  }

  getCompactionOptions(): GpiCompactionOptions {
    return { isCompacting: false, autoCompactionEnabled: false };
  }

  async compact(_customInstructions?: string): Promise<GpiCompactionOptions> {
    throw new Error("Mock sessions do not support compaction");
  }

  abortCompaction(): GpiCompactionOptions {
    return this.getCompactionOptions();
  }

  setAutoCompactionEnabled(_enabled: boolean): GpiCompactionOptions {
    return this.getCompactionOptions();
  }

  dispose(): void {
    this.listeners.clear();
  }

  subscribe(listener: (event: GpiPiEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: GpiPiEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

export class MockPiBridge implements GpiPiBridge {
  async getWorkspaceSnapshot(): Promise<GpiWorkspaceSnapshot> {
    return {
      selectedProjectId: "gpi",
      selectedSessionId: "vision",
      projects: [
        { id: "gpi", name: "GPi", path: "C:/gpi", sessionIds: ["vision", "sdk-bridge"] },
        { id: "pi", name: "Pi", path: "C:/pi", sessionIds: ["tui-polish"] },
      ],
      sessions: [
        { id: "vision", projectId: "gpi", title: "Product vision", status: "completed", lastActivity: "Vision docs ready", origin: "mock" },
        { id: "sdk-bridge", projectId: "gpi", title: "SDK bridge spike", status: "running_tool", lastActivity: "Reading Pi SDK docs", origin: "mock" },
        { id: "tui-polish", projectId: "pi", title: "TUI polish", status: "waiting_input", lastActivity: "Needs direction", origin: "mock" },
      ],
    };
  }

  async createSession(options: { projectId: string; projectPath: string }): Promise<GpiPiSessionHandle> {
    return new MockPiSessionHandle(`${options.projectId}-new-session`);
  }

  async openSession(options: { sessionPath: string; projectPath: string }): Promise<GpiPiSessionHandle> {
    return new MockPiSessionHandle(options.sessionPath);
  }
}
