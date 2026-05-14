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

export type SessionOrigin = "mock" | "real" | "imported";

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

export interface GpiProjectFileEntry {
  path: string;
  name: string;
  kind: "directory" | "file";
  depth: number;
  size: number | undefined;
  modifiedAt: number | undefined;
}

export interface GpiProjectFileListing {
  projectId: string;
  projectPath: string;
  entries: GpiProjectFileEntry[];
  truncated: boolean;
  maxEntries: number;
  maxDepth: number;
  excludedDirectories: string[];
}

export interface GpiProjectContextFileStatus {
  agentsMd: boolean;
  readme: boolean;
  readmePath: string | undefined;
  piSettings: boolean;
}

export interface GpiProjectGitLastCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: number;
}

export interface GpiProjectGitStatus {
  isRepo: boolean;
  branch: string | undefined;
  detached: boolean;
  upstream: string | undefined;
  ahead: number;
  behind: number;
  staged: number;
  modified: number;
  deleted: number;
  untracked: number;
  conflicted: number;
  clean: boolean;
  lastCommit: GpiProjectGitLastCommit | undefined;
  error: string | undefined;
}

export interface GpiProjectContext {
  projectId: string;
  projectPath: string;
  git: GpiProjectGitStatus;
  files: GpiProjectContextFileStatus;
  checkedAt: number;
}

export type GpiOpenProjectRequest =
  | { ok: true; path: string }
  | { ok: false; error: string; path: string | undefined };

export interface GpiImageAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string;
  previewDataUrl: string;
  storagePath: string | undefined;
}

export interface GpiImageAttachmentInput {
  name: string;
  mimeType: string;
  data: string;
}

export type GpiImageAttachmentResult =
  | { ok: true; attachment: GpiImageAttachment }
  | { ok: false; error: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageAttachments?: GpiImageAttachment[];
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
  | (TimelineEventBase & { kind: "user_message"; text: string; imageAttachments?: GpiImageAttachment[] })
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
  projectFilesPanelVisible: boolean;
  developerMode: boolean;
  runWorkExpandedByDefault: boolean;
  piInstallOnboardingSeen: boolean;
  lastSeenAppVersion: string | undefined;
}

export interface GpiReleaseNotes {
  version: string;
  name: string | undefined;
  body: string | undefined;
  releaseUrl: string | undefined;
  source: "github" | "local-update-metadata";
}

export interface GpiCommandAvailability {
  available: boolean;
  executablePath: string | undefined;
  version: string | undefined;
  error: string | undefined;
}

export interface GpiPiRuntimeStatus {
  pi: GpiCommandAvailability;
  npm: GpiCommandAvailability;
  pnpm: GpiCommandAvailability;
  installable: boolean;
  preferredPackageManager: "npm" | "pnpm" | undefined;
  installCommand: string | undefined;
  missingPackageManagerMessage: string | undefined;
}

export interface GpiUpdateStatus {
  appVersion: string;
  latestAppVersion: string | undefined;
  appUpdateAvailable: boolean | undefined;
  appReleaseUrl: string | undefined;
  appReleaseName: string | undefined;
  appReleaseBody: string | undefined;
  appInstallerUrl: string | undefined;
  piPackageName: string;
  installedPiVersion: string | undefined;
  latestPiVersion: string | undefined;
  piUpdateAvailable: boolean | undefined;
  piUpdateCommand: string;
  piRuntime: GpiPiRuntimeStatus;
  checkedAt: number;
  error: string | undefined;
}

export interface GpiOpenExternalResult {
  ok: true;
}

export interface GpiAppUpdateDownloadResult {
  ok: true;
  installerPath: string;
  metadataPath: string | undefined;
}

export interface GpiAppUpdateInstallResult {
  ok: true;
}

export interface GpiPiUpdateResult {
  ok: boolean;
  command: string;
  output: string;
  error: string | undefined;
}

export interface GpiPiInstallResult {
  ok: boolean;
  command: string;
  packageManager: "npm" | "pnpm" | undefined;
  output: string;
  error: string | undefined;
  runtime: GpiPiRuntimeStatus;
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
