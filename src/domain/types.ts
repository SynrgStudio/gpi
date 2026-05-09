export type SessionStatus =
  | "connecting"
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

export type SessionOrigin = "mock" | "local" | "real" | "imported";

export interface GpiProject {
  id: string;
  name: string;
  path: string;
  sessionIds: string[];
}

export interface GpiSessionSummary {
  id: string;
  projectId: string;
  title: string;
  status: SessionStatus;
  lastActivity: string;
  origin: SessionOrigin;
}

export interface GpiDiscoveredSession {
  id: string;
  path: string;
  title: string;
  cwd: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
  allMessagesText: string;
}

export interface GpiWorkspaceSnapshot {
  projects: GpiProject[];
  sessions: GpiSessionSummary[];
  selectedProjectId: string;
  selectedSessionId: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  responseMeta?: string;
}

export type TimelineEventSource = "gpi" | "pi" | "legacy" | "mock";

export interface TimelineEventBase {
  id: string;
  sessionId: string;
  turnId: string | undefined;
  createdAt: number;
  order: number;
  source: TimelineEventSource;
}

export type TimelineEvent =
  | (TimelineEventBase & { kind: "user_message"; text: string })
  | (TimelineEventBase & { kind: "assistant_message"; text: string; responseMeta?: string; streaming: boolean })
  | (TimelineEventBase & { kind: "run_phase"; phase: "preparing_tool" | "working" | "thinking"; status: "started" | "finished"; startedAt: number; endedAt?: number; text?: string })
  | (TimelineEventBase & {
      kind: "tool";
      toolCallId: string;
      toolName: string;
      status: "started" | "finished";
      argsSummary?: string;
      resultSummary?: string;
      isError?: boolean;
      durationMs?: number;
    })
  | (TimelineEventBase & {
      kind: "file_change";
      path: string;
      status: "created" | "modified" | "deleted" | "renamed" | "confirmed" | "unknown";
      origin: "pi-tool-args" | "gpi-derived" | "tool-result";
    })
  | (TimelineEventBase & { kind: "diff"; path: string; diff: string; diffKind: "git" | "created" | "before-after" | "snapshot" | "unavailable"; message?: string })
  | (TimelineEventBase & { kind: "command"; command: string; cwd?: string; status: "started" | "finished"; output?: string; exitCode?: number; durationMs?: number })
  | (TimelineEventBase & { kind: "stats"; summary: string })
  | (TimelineEventBase & { kind: "compaction"; status: "started" | "finished" | "aborted" | "failed" | "info"; summary: string })
  | (TimelineEventBase & { kind: "error"; message: string; recoverable: boolean })
  | (TimelineEventBase & { kind: "system"; message: string; tone: "neutral" | "success" | "warning" });

export type WorkflowSkillName = "end-cont" | "init-cont" | "plan-cont" | "start-cont";
export type WorkflowSkillInstallStatus = "conflict" | "installed" | "missing";

export interface WorkflowSkillStatus {
  name: WorkflowSkillName;
  status: WorkflowSkillInstallStatus;
  installedPath: string;
}

export interface WorkflowSkillsStatus {
  skillsDirectory: string;
  skills: WorkflowSkillStatus[];
}

export interface WorkflowSkillsInstallResult {
  skillsDirectory: string;
  installed: WorkflowSkillName[];
  skipped: WorkflowSkillName[];
  conflicts: WorkflowSkillName[];
}

export interface WorkflowSkillsUpdateResult {
  skillsDirectory: string;
  updated: WorkflowSkillName[];
  skipped: WorkflowSkillName[];
}

export type ContinuityWorkflowPhase = "blocked" | "complete" | "conflict" | "executable" | "initialized" | "missing" | "planned";

export interface ContinuityWorkflowStatus {
  phase: ContinuityWorkflowPhase;
  summary: string;
  projectPath: string;
  continuitySession: string | undefined;
  counts: {
    blocked: number;
    cancelled: number;
    done: number;
    inProgress: number;
    partial: number;
    pending: number;
  };
}

export type SessionMessages = Record<string, string[]>;
export type SessionChatMessages = Record<string, ChatMessage[]>;
export type SessionDrafts = Record<string, string>;
export type SessionDetails = Record<string, string[]>;
export type SessionTimelineEvents = Record<string, TimelineEvent[]>;
export type BackendHandles = Record<string, string>;
export type SessionFiles = Record<string, string>;
export type ArchivedSessions = Record<string, boolean>;
export type SessionSelectionRanks = Record<string, number>;
export type TurnSnapshotFileStatus = "created" | "deleted" | "modified";

export interface TurnSnapshotFileEntry {
  path: string;
  absolutePath: string;
  status: TurnSnapshotFileStatus;
  existsBefore: boolean;
  existsAfter: boolean;
  hashBefore: string | undefined;
  hashAfter: string | undefined;
  sizeBefore: number | undefined;
  sizeAfter: number | undefined;
  contentBeforePath: string | undefined;
  contentAfterPath: string | undefined;
}

export interface TurnSnapshotManifest {
  schemaVersion: 1;
  snapshotId: string;
  projectId: string;
  projectPath: string;
  sessionId: string;
  turnId: string;
  userMessageId: string | undefined;
  createdAt: number;
  completedAt: number | undefined;
  files: TurnSnapshotFileEntry[];
  captureErrors: Array<{ path: string; message: string }>;
}

export interface TurnSnapshotIndexEntry {
  snapshotId: string;
  sessionId: string;
  turnId: string;
  userMessageId: string | undefined;
  createdAt: number;
  completedAt: number | undefined;
  fileCount: number;
  hasCaptureErrors: boolean;
  manifestPath: string;
}

export type TurnSnapshotIndex = Record<string, Record<string, TurnSnapshotIndexEntry>>;

export interface TurnSnapshotFileSaveInput {
  path: string;
  absolutePath: string;
  existsBefore: boolean;
  existsAfter: boolean;
  contentBefore: string | undefined;
  contentAfter: string | undefined;
}

export interface TurnSnapshotSaveRequest {
  projectId: string;
  projectPath: string;
  sessionId: string;
  turnId: string;
  userMessageId: string | undefined;
  createdAt: number;
  completedAt: number | undefined;
  files: TurnSnapshotFileSaveInput[];
  captureErrors: Array<{ path: string; message: string }>;
}

export interface TurnSnapshotSaveResult {
  indexEntry: TurnSnapshotIndexEntry;
  manifest: TurnSnapshotManifest;
}

export interface TurnSnapshotRevertConflict {
  path: string;
  reason: string;
}

export type TurnSnapshotRevertResult =
  | { ok: true; revertedFiles: string[] }
  | { ok: false; conflicts: TurnSnapshotRevertConflict[] };

export interface WorkspaceSettings {
  revertSafeEditsEnabled: boolean;
  piInstallOnboardingSeen: boolean;
}

export interface GpiUpdateStatus {
  appVersion: string;
  piPackageName: string;
  installedPiVersion: string | undefined;
  latestPiVersion: string | undefined;
  piUpdateAvailable: boolean | undefined;
  piUpdateCommand: string;
  checkedAt: number;
  error: string | undefined;
}

export interface GpiPiUpdateResult {
  ok: boolean;
  command: string;
  output: string;
  error: string | undefined;
}

export interface WorkspaceState extends GpiWorkspaceSnapshot {
  storageVersion: 1;
  messages: SessionMessages;
  chatMessages: SessionChatMessages;
  drafts: SessionDrafts;
  details: SessionDetails;
  timelineEvents: SessionTimelineEvents;
  backendHandles: BackendHandles;
  sessionFiles: SessionFiles;
  archivedSessions: ArchivedSessions;
  sessionSelectionRanks: SessionSelectionRanks;
  turnSnapshots: TurnSnapshotIndex;
  settings: WorkspaceSettings;
}
