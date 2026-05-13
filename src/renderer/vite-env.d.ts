/// <reference types="vite/client" />

import type { GpiCompactionOptions, GpiModelOptions, GpiPiEvent } from "../bridge/pi-bridge";
import type { SdkPiBridgePrewarmSnapshot } from "../bridge/sdk-pi-bridge";
import type { ContinuityWorkflowStatus, GpiAppUpdateDownloadResult, GpiAppUpdateInstallResult, GpiDiscoveredSession, GpiImageAttachment, GpiImageAttachmentInput, GpiImageAttachmentResult, GpiOpenExternalResult, GpiOpenProjectRequest, GpiPiInstallResult, GpiPiUpdateResult, GpiProjectContext, GpiProjectFileListing, GpiReleaseNotes, GpiUpdateStatus, GpiWorkspaceSnapshot, TurnSnapshotManifest, TurnSnapshotRevertResult, TurnSnapshotSaveRequest, TurnSnapshotSaveResult, WorkflowSkillName, WorkflowSkillsInstallResult, WorkflowSkillsStatus, WorkflowSkillsUpdateResult, WorkspaceState } from "../domain/types";

interface GpiSessionHandleInfo {
  id: string;
  sessionFile: string | undefined;
}

interface GpiPreloadApi {
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  getContinuityStatus(projectId: string): Promise<ContinuityWorkflowStatus>;
  getWorkflowSkillsStatus(): Promise<WorkflowSkillsStatus>;
  getUpdateStatus(): Promise<GpiUpdateStatus>;
  getGpiReleaseNotes(version: string): Promise<GpiReleaseNotes>;
  updatePi(): Promise<GpiPiUpdateResult>;
  installPi(force?: boolean): Promise<GpiPiInstallResult>;
  openExternal(url: string): Promise<GpiOpenExternalResult>;
  downloadGpiUpdate(url: string): Promise<GpiAppUpdateDownloadResult>;
  installGpiUpdate(installerPath: string): Promise<GpiAppUpdateInstallResult>;
  getWorkflowSkillText(skillName: WorkflowSkillName): Promise<{ name: WorkflowSkillName; text: string }>;
  installWorkflowSkills(): Promise<WorkflowSkillsInstallResult>;
  updateWorkflowSkills(): Promise<WorkflowSkillsUpdateResult>;
  getWorkspaceSnapshot(): Promise<GpiWorkspaceSnapshot>;
  loadWorkspace(): Promise<{ workspace: WorkspaceState | undefined; path: string; recoveredFromCorruption: boolean; error: string | undefined }>;
  saveWorkspace(workspace: WorkspaceState): Promise<{ ok: true; path: string }>;
  saveTurnSnapshot(snapshot: TurnSnapshotSaveRequest): Promise<TurnSnapshotSaveResult>;
  getTurnSnapshotManifest(manifestPath: string): Promise<TurnSnapshotManifest>;
  revertTurnSnapshot(manifestPath: string): Promise<TurnSnapshotRevertResult>;
  chooseProjectPath(): Promise<{ path: string | undefined }>;
  validateProjectPath(projectPath: string): Promise<{ ok: boolean; error: string | undefined }>;
  getInitialOpenProjectRequest(): Promise<GpiOpenProjectRequest | undefined>;
  listProjectSessions(projectId: string): Promise<GpiDiscoveredSession[]>;
  listProjectFiles(projectId: string): Promise<GpiProjectFileListing>;
  getProjectContext(projectId: string): Promise<GpiProjectContext>;
  chooseImageAttachments(): Promise<GpiImageAttachmentResult[]>;
  ingestImageAttachment(input: GpiImageAttachmentInput): Promise<GpiImageAttachmentResult>;
  getPrewarmStatus(): Promise<SdkPiBridgePrewarmSnapshot>;
  getFileDiff(projectId: string, filePath: string): Promise<{ ok: true; diff: string; kind: "git" | "created" | "unavailable"; message: string | undefined }>;
  getModelOptions(sessionHandleId: string): Promise<GpiModelOptions>;
  setModel(sessionHandleId: string, provider: string, modelId: string): Promise<GpiModelOptions>;
  setThinkingLevel(sessionHandleId: string, level: string): Promise<GpiModelOptions>;
  getCompactionOptions(sessionHandleId: string): Promise<GpiCompactionOptions>;
  compactSession(sessionHandleId: string, customInstructions?: string): Promise<GpiCompactionOptions>;
  abortCompaction(sessionHandleId: string): Promise<GpiCompactionOptions>;
  setAutoCompaction(sessionHandleId: string, enabled: boolean): Promise<GpiCompactionOptions>;
  createSession(projectId: string): Promise<GpiSessionHandleInfo>;
  openSession(sessionPath: string, projectPath: string): Promise<GpiSessionHandleInfo>;
  prompt(sessionHandleId: string, text: string, images?: GpiImageAttachment[]): Promise<{ ok: true }>;
  followUp(sessionHandleId: string, text: string, images?: GpiImageAttachment[]): Promise<{ ok: true }>;
  steer(sessionHandleId: string, text: string, images?: GpiImageAttachment[]): Promise<{ ok: true }>;
  abort(sessionHandleId: string): Promise<{ ok: true }>;
  onOpenProjectRequest(listener: (request: GpiOpenProjectRequest) => void): () => void;
  onPiEvent(listener: (event: GpiPiEvent) => void): () => void;
}

declare global {
  interface Window {
    gpi?: GpiPreloadApi;
  }
}

export {};
