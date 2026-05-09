import { contextBridge, ipcRenderer } from "electron";
import type { GpiCompactionOptions, GpiModelOptions, GpiPiEvent } from "../bridge/pi-bridge.js";
import type { SdkPiBridgePrewarmSnapshot } from "../bridge/sdk-pi-bridge.js";
import type { ContinuityWorkflowStatus, GpiDiscoveredSession, GpiOpenExternalResult, GpiPiUpdateResult, GpiUpdateStatus, GpiWorkspaceSnapshot, TurnSnapshotManifest, TurnSnapshotRevertResult, TurnSnapshotSaveRequest, TurnSnapshotSaveResult, WorkflowSkillName, WorkflowSkillsInstallResult, WorkflowSkillsStatus, WorkflowSkillsUpdateResult, WorkspaceState } from "../domain/types.js";

interface GpiSessionHandleInfo {
  id: string;
  sessionFile: string | undefined;
}

const versions = {
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron,
};

contextBridge.exposeInMainWorld("gpi", {
  versions,
  minimizeWindow: () => ipcRenderer.invoke("gpi:window-minimize") as Promise<void>,
  toggleMaximizeWindow: () => ipcRenderer.invoke("gpi:window-toggle-maximize") as Promise<void>,
  closeWindow: () => ipcRenderer.invoke("gpi:window-close") as Promise<void>,
  getContinuityStatus: (projectId: string) => ipcRenderer.invoke("gpi:get-continuity-status", projectId) as Promise<ContinuityWorkflowStatus>,
  getWorkflowSkillsStatus: () => ipcRenderer.invoke("gpi:get-workflow-skills-status") as Promise<WorkflowSkillsStatus>,
  getUpdateStatus: () => ipcRenderer.invoke("gpi:get-update-status") as Promise<GpiUpdateStatus>,
  updatePi: () => ipcRenderer.invoke("gpi:update-pi") as Promise<GpiPiUpdateResult>,
  openExternal: (url: string) => ipcRenderer.invoke("gpi:open-external", url) as Promise<GpiOpenExternalResult>,
  getWorkflowSkillText: (skillName: WorkflowSkillName) => ipcRenderer.invoke("gpi:get-workflow-skill-text", skillName) as Promise<{ name: WorkflowSkillName; text: string }>,
  installWorkflowSkills: () => ipcRenderer.invoke("gpi:install-workflow-skills") as Promise<WorkflowSkillsInstallResult>,
  updateWorkflowSkills: () => ipcRenderer.invoke("gpi:update-workflow-skills") as Promise<WorkflowSkillsUpdateResult>,
  getWorkspaceSnapshot: () => ipcRenderer.invoke("gpi:get-workspace-snapshot") as Promise<GpiWorkspaceSnapshot>,
  loadWorkspace: () => ipcRenderer.invoke("gpi:load-workspace") as Promise<{ workspace: WorkspaceState | undefined; path: string; recoveredFromCorruption: boolean; error: string | undefined }>,
  saveWorkspace: (workspace: WorkspaceState) => ipcRenderer.invoke("gpi:save-workspace", workspace) as Promise<{ ok: true; path: string }>,
  saveTurnSnapshot: (snapshot: TurnSnapshotSaveRequest) => ipcRenderer.invoke("gpi:save-turn-snapshot", snapshot) as Promise<TurnSnapshotSaveResult>,
  getTurnSnapshotManifest: (manifestPath: string) => ipcRenderer.invoke("gpi:get-turn-snapshot-manifest", manifestPath) as Promise<TurnSnapshotManifest>,
  revertTurnSnapshot: (manifestPath: string) => ipcRenderer.invoke("gpi:revert-turn-snapshot", manifestPath) as Promise<TurnSnapshotRevertResult>,
  chooseProjectPath: () => ipcRenderer.invoke("gpi:choose-project-path") as Promise<{ path: string | undefined }>,
  validateProjectPath: (projectPath: string) => ipcRenderer.invoke("gpi:validate-project-path", projectPath) as Promise<{ ok: boolean; error: string | undefined }>,
  listProjectSessions: (projectId: string) => ipcRenderer.invoke("gpi:list-project-sessions", projectId) as Promise<GpiDiscoveredSession[]>,
  getPrewarmStatus: () => ipcRenderer.invoke("gpi:get-prewarm-status") as Promise<SdkPiBridgePrewarmSnapshot>,
  getFileDiff: (projectId: string, filePath: string) => ipcRenderer.invoke("gpi:get-file-diff", projectId, filePath) as Promise<{ ok: true; diff: string; kind: "git" | "created" | "unavailable"; message: string | undefined }>,
  getModelOptions: (sessionHandleId: string) => ipcRenderer.invoke("gpi:get-model-options", sessionHandleId) as Promise<GpiModelOptions>,
  setModel: (sessionHandleId: string, provider: string, modelId: string) => ipcRenderer.invoke("gpi:set-model", sessionHandleId, provider, modelId) as Promise<GpiModelOptions>,
  setThinkingLevel: (sessionHandleId: string, level: string) => ipcRenderer.invoke("gpi:set-thinking-level", sessionHandleId, level) as Promise<GpiModelOptions>,
  getCompactionOptions: (sessionHandleId: string) => ipcRenderer.invoke("gpi:get-compaction-options", sessionHandleId) as Promise<GpiCompactionOptions>,
  compactSession: (sessionHandleId: string, customInstructions?: string) => ipcRenderer.invoke("gpi:compact-session", sessionHandleId, customInstructions) as Promise<GpiCompactionOptions>,
  abortCompaction: (sessionHandleId: string) => ipcRenderer.invoke("gpi:abort-compaction", sessionHandleId) as Promise<GpiCompactionOptions>,
  setAutoCompaction: (sessionHandleId: string, enabled: boolean) => ipcRenderer.invoke("gpi:set-auto-compaction", sessionHandleId, enabled) as Promise<GpiCompactionOptions>,
  createSession: (projectId: string) => ipcRenderer.invoke("gpi:create-session", projectId) as Promise<GpiSessionHandleInfo>,
  openSession: (sessionPath: string, projectPath: string) => ipcRenderer.invoke("gpi:open-session", sessionPath, projectPath) as Promise<GpiSessionHandleInfo>,
  prompt: (sessionHandleId: string, text: string) => ipcRenderer.invoke("gpi:prompt", sessionHandleId, text) as Promise<{ ok: true }>,
  followUp: (sessionHandleId: string, text: string) => ipcRenderer.invoke("gpi:follow-up", sessionHandleId, text) as Promise<{ ok: true }>,
  steer: (sessionHandleId: string, text: string) => ipcRenderer.invoke("gpi:steer", sessionHandleId, text) as Promise<{ ok: true }>,
  abort: (sessionHandleId: string) => ipcRenderer.invoke("gpi:abort", sessionHandleId) as Promise<{ ok: true }>,
  onPiEvent: (listener: (event: GpiPiEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, piEvent: GpiPiEvent) => listener(piEvent);
    ipcRenderer.on("gpi:pi-event", handler);
    return () => ipcRenderer.off("gpi:pi-event", handler);
  },
});
