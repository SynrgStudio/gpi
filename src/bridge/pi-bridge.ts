import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { GpiWorkspaceSnapshot, SessionStatus } from "../domain/types.js";

export interface GpiModelInfo {
  id: string;
  name: string;
  provider: string;
  label: string;
  reasoning: boolean;
  hasAuth: boolean;
}

export interface GpiModelOptions {
  currentModel: GpiModelInfo | undefined;
  currentThinkingLevel: ThinkingLevel;
  availableThinkingLevels: ThinkingLevel[];
  supportsThinking: boolean;
  models: GpiModelInfo[];
}

export interface GpiCompactionOptions {
  isCompacting: boolean;
  autoCompactionEnabled: boolean;
}

export interface GpiFileChangeHint {
  path: string;
  kind: "created" | "modified" | "deleted" | "renamed" | "unknown";
  source: "pi-tool-args" | "gpi-derived";
}

export interface GpiFileDiffHint {
  path: string;
  diff: string;
}

export interface GpiFileSnapshotHint {
  path: string;
  absolutePath: string;
  existsBefore: boolean;
  existsAfter: boolean;
  contentBefore: string | undefined;
  contentAfter: string | undefined;
}

export type GpiPiEvent = 
  | { type: "status_changed"; sessionId: string; status: SessionStatus }
  | { type: "run_phase"; sessionId: string; phase: "preparing_tool" | "working" | "thinking"; status: "started" | "finished"; timestamp: number }
  | { type: "thinking_delta"; sessionId: string; delta: string }
  | { type: "tool_call_delta"; sessionId: string; delta: string; toolName?: string }
  | { type: "timing_mark"; sessionId: string; mark: "agent_end" | "agent_start" | "first_text" | "first_thinking" | "first_tool" | "prompt_dispatched" | "worker_prompt_received"; timestamp: number; runId?: string }
  | { type: "text_delta"; sessionId: string; delta: string; responseMeta: string | undefined }
  | { type: "compaction_changed"; sessionId: string; options: GpiCompactionOptions; summary: string | undefined }
  | { type: "tool_started"; sessionId: string; toolCallId: string; toolName: string; argsSummary: string; fileChanges: GpiFileChangeHint[] }
  | { type: "session_stats"; sessionId: string; summary: string }
  | {
      type: "tool_finished";
      sessionId: string;
      toolCallId: string;
      toolName: string;
      isError: boolean;
      durationMs: number | undefined;
      resultSummary: string;
      fileChanges: GpiFileChangeHint[];
      diffs: GpiFileDiffHint[];
      fileSnapshots: GpiFileSnapshotHint[];
    }
  | { type: "error"; sessionId: string; message: string };

export interface GpiPiSessionHandle {
  id: string;
  sessionFile: string | undefined;
  prompt(text: string): Promise<void>;
  steer(text: string): Promise<void>;
  followUp(text: string): Promise<void>;
  abort(): Promise<void>;
  getModelOptions(): GpiModelOptions;
  getModelOptionsAsync?(): Promise<GpiModelOptions>;
  setModel(provider: string, modelId: string): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): void;
  setThinkingLevelAsync?(level: ThinkingLevel): Promise<GpiModelOptions>;
  getCompactionOptions(): GpiCompactionOptions;
  getCompactionOptionsAsync?(): Promise<GpiCompactionOptions>;
  compact(customInstructions?: string): Promise<GpiCompactionOptions>;
  abortCompaction(): GpiCompactionOptions;
  abortCompactionAsync?(): Promise<GpiCompactionOptions>;
  setAutoCompactionEnabled(enabled: boolean): GpiCompactionOptions;
  setAutoCompactionEnabledAsync?(enabled: boolean): Promise<GpiCompactionOptions>;
  dispose(): void;
  subscribe(listener: (event: GpiPiEvent) => void): () => void;
}

export interface GpiPiBridge {
  getWorkspaceSnapshot(): Promise<GpiWorkspaceSnapshot>;
  createSession(options: { projectId: string; projectPath: string }): Promise<GpiPiSessionHandle>;
  openSession(options: { sessionPath: string; projectPath: string }): Promise<GpiPiSessionHandle>;
}
