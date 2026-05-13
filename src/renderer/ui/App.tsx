import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import gpiIconUrl from "../assets/gpi-icon.svg";
import gitIconUrl from "../assets/git.svg";
import type { GpiCompactionOptions, GpiModelOptions, GpiPiEvent } from "../../bridge/pi-bridge";
import type { ChatMessage, ContinuityWorkflowStatus, GpiImageAttachment, GpiImageAttachmentResult, GpiOpenProjectRequest, GpiProject, GpiProjectContext, GpiProjectFileEntry, GpiProjectFileListing, GpiReleaseNotes, GpiSessionSummary, GpiUpdateStatus, SessionStatus, TimelineEvent, TurnSnapshotIndex, TurnSnapshotIndexEntry, TurnSnapshotManifest, TurnSnapshotSaveRequest, WorkflowSkillName, WorkflowSkillsStatus } from "../../domain/types";
import {
  addOptimisticRealSession,
  addProjectToWorkspace,
  addTurnSnapshotIndexEntry,
  appendRevertResultEvent,
  applyMockEventToWorkspace,
  archiveSessionInWorkspace,
  hydrateWorkspace,
  importProjectSessions,
  markAppVersionSeen,
  markPiInstallOnboardingSeen,
  markPromptAccepted,
  markRevertSafeTurn,
  markSessionAborted,
  markSessionError,
  markSessionReopened,
  markSessionReopening,
  reducePiEvent,
  removeProjectFromWorkspace,
  renameSessionInWorkspace,
  replaceOptimisticSession,
  restoreSessionInWorkspace,
  selectOrAddProjectByPath,
  selectProjectInWorkspace,
  selectSessionInWorkspace,
  toPersistedWorkspace,
  updateDraftInWorkspace,
  updateProjectInWorkspace,
  updateProjectFilesPanelVisibleSetting,
  updateRevertSafeEditsSetting,
} from "../state/workspace-store";

const originLabels = {
  imported: "Imported",
  mock: "Mock",
  real: "Pi",
} as const;

const statusLabels: Record<SessionStatus, string> = {
  connecting: "Connecting",
  idle: "Idle",
  thinking: "Thinking",
  streaming: "Streaming",
  running_tool: "Tool",
  editing_files: "Editing",
  waiting_approval: "Approval",
  waiting_input: "Input",
  blocked: "Blocked",
  error: "Error",
  completed: "Done",
};

const activeStatuses = new Set<SessionStatus>(["connecting", "thinking", "streaming", "running_tool", "editing_files"]);
const attentionStatuses = new Set<SessionStatus>(["waiting_approval", "waiting_input", "blocked", "error"]);
const attentionPriority: readonly SessionStatus[] = ["waiting_approval", "waiting_input", "blocked", "error", "running_tool", "editing_files", "streaming", "thinking", "connecting"];

const REVERT_SAFE_PROMPT_PREFIX = `[GPi Revert-Safe Editing Mode]

For this turn, optimize for safe per-message revert.

Tool priority for file changes:
1. Read existing files with the file read tool before editing.
2. Modify existing files with the structured edit tool when practical.
3. Create or replace single files with the write file tool when practical.
4. Use shell/bash/python/powershell commands that mutate files only when structured file tools are impractical.

Before using a shell command that may create, modify, delete, move, or format files, first state the exact project-relative file paths you expect it to affect.

Do not use shell commands to modify files when read/edit/write tools can accomplish the same change with similar effort.

Reason: GPi can create reliable before/after snapshots and enable Revert changes when file paths are known before modification.

User request:`;

function applyRevertSafePromptPolicy(prompt: string, enabled: boolean): string {
  if (!enabled) return prompt;
  if (prompt.trimStart().startsWith("/")) return prompt;
  if (prompt.includes("[GPi Revert-Safe Editing Mode]")) return prompt;
  return `${REVERT_SAFE_PROMPT_PREFIX}\n${prompt}`;
}

function applyFileMentionPromptPolicy(prompt: string, files: GpiProjectFileEntry[]): string {
  if (prompt.trimStart().startsWith("/")) return prompt;
  const mentionedFiles = extractFileMentions(prompt, files);
  if (mentionedFiles.length === 0) return prompt;
  return [`[GPi Mentioned Project Files]`, ...mentionedFiles.map((file) => `- ${file.path}`), "", "User request:", prompt].join("\n");
}

function extractFileMentions(text: string, files: GpiProjectFileEntry[]): GpiProjectFileEntry[] {
  const fileByPath = new Map(files.filter((file) => file.kind === "file").map((file) => [file.path, file]));
  const found = new Map<string, GpiProjectFileEntry>();
  for (const match of text.matchAll(/(?:^|\s)@([^\s]+)/g)) {
    const rawPath = match[1]?.replace(/^['\"]|['\"]$/g, "");
    const file = rawPath ? fileByPath.get(rawPath) : undefined;
    if (file) found.set(file.path, file);
  }
  return [...found.values()];
}

const DEFAULT_APP_KEYBINDINGS = {
  openCommandPalette: { key: "k", ctrl: true },
  openQuickSwitcher: { key: "p", ctrl: true },
  nextAttentionSession: { key: "j", ctrl: true },
  closeQuickSwitcher: { key: "Escape" },
  chooseQuickSwitcherItem: { key: "Enter" },
  quickSwitcherPrevious: { key: "ArrowUp" },
  quickSwitcherNext: { key: "ArrowDown" },
} as const;

type KeyBinding = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
};

function matchesKeyBinding(event: KeyboardEvent | ReactKeyboardEvent, binding: KeyBinding): boolean {
  return (
    event.key.toLowerCase() === binding.key.toLowerCase() &&
    event.ctrlKey === Boolean(binding.ctrl) &&
    event.altKey === Boolean(binding.alt) &&
    event.shiftKey === Boolean(binding.shift) &&
    event.metaKey === Boolean(binding.meta)
  );
}

type CustomScrollbar = {
  element: HTMLElement;
  track: HTMLDivElement;
  thumb: HTMLDivElement;
  onScroll: () => void;
};

function useCustomScrollbars(): void {
  useEffect(() => {
    const scrollbars = new Map<HTMLElement, CustomScrollbar>();
    let frame: number | undefined;

    function requestUpdate(): void {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        syncScrollbars();
      });
    }

    function isScrollable(element: HTMLElement): boolean {
      const style = window.getComputedStyle(element);
      const overflowY = style.overflowY;
      return (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight + 1;
    }

    function createScrollbar(element: HTMLElement): CustomScrollbar {
      const track = document.createElement("div");
      const thumb = document.createElement("div");
      track.className = "gpi-custom-scrollbar-track";
      thumb.className = "gpi-custom-scrollbar-thumb";
      track.appendChild(thumb);
      document.body.appendChild(track);

      let dragStartY = 0;
      let dragStartScrollTop = 0;

      function thumbHeight(): number {
        return Math.max(24, Math.round((element.clientHeight / element.scrollHeight) * element.clientHeight));
      }

      function scrollTopForPointer(clientY: number): number {
        const rect = track.getBoundingClientRect();
        const nextThumbTop = clientY - rect.top - thumbHeight() / 2;
        const maxThumbTop = Math.max(1, element.clientHeight - thumbHeight());
        return (nextThumbTop / maxThumbTop) * (element.scrollHeight - element.clientHeight);
      }

      thumb.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragStartY = event.clientY;
        dragStartScrollTop = element.scrollTop;

        function onMouseMove(moveEvent: MouseEvent): void {
          const maxScrollTop = element.scrollHeight - element.clientHeight;
          const maxThumbTop = Math.max(1, element.clientHeight - thumbHeight());
          const scrollDelta = ((moveEvent.clientY - dragStartY) / maxThumbTop) * maxScrollTop;
          element.scrollTop = dragStartScrollTop + scrollDelta;
        }

        function onMouseUp(): void {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });

      track.addEventListener("mousedown", (event) => {
        if (event.target !== track) return;
        event.preventDefault();
        event.stopPropagation();
        element.scrollTop = scrollTopForPointer(event.clientY);
      });

      const scrollbar = { element, track, thumb, onScroll: requestUpdate };
      element.addEventListener("scroll", scrollbar.onScroll, { passive: true });
      return scrollbar;
    }

    function removeScrollbar(scrollbar: CustomScrollbar): void {
      scrollbar.element.removeEventListener("scroll", scrollbar.onScroll);
      scrollbar.track.remove();
    }

    function clippedRectFor(element: HTMLElement, rect: DOMRect): { bottom: number; left: number; right: number; top: number } {
      const clipped = { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
      let ancestor = element.parentElement;

      while (ancestor && ancestor !== document.body) {
        const style = window.getComputedStyle(ancestor);
        if (style.overflow !== "visible" || style.overflowX !== "visible" || style.overflowY !== "visible") {
          const ancestorRect = ancestor.getBoundingClientRect();
          clipped.top = Math.max(clipped.top, ancestorRect.top);
          clipped.right = Math.min(clipped.right, ancestorRect.right);
          clipped.bottom = Math.min(clipped.bottom, ancestorRect.bottom);
          clipped.left = Math.max(clipped.left, ancestorRect.left);
        }
        ancestor = ancestor.parentElement;
      }

      return clipped;
    }

    function updateScrollbar(scrollbar: CustomScrollbar): void {
      const { element, track, thumb } = scrollbar;
      const rect = element.getBoundingClientRect();
      const clippedRect = clippedRectFor(element, rect);
      const maxScrollTop = element.scrollHeight - element.clientHeight;
      if (rect.width <= 0 || rect.height <= 0 || clippedRect.bottom <= clippedRect.top || maxScrollTop <= 1) {
        track.hidden = true;
        return;
      }

      const style = window.getComputedStyle(element);
      const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
      const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
      const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
      const inset = 6;
      const trackWidth = 10;
      const fullTrackTop = rect.top + borderTop + inset;
      const fullTrackBottom = rect.bottom - borderBottom - inset;
      const trackTop = Math.max(fullTrackTop, clippedRect.top + inset);
      const trackBottom = Math.min(fullTrackBottom, clippedRect.bottom - inset);
      const trackHeight = Math.max(0, trackBottom - trackTop);
      const fullTrackHeight = Math.max(0, fullTrackBottom - fullTrackTop);
      const height = Math.max(24, Math.round((element.clientHeight / element.scrollHeight) * trackHeight));
      const maxThumbTop = Math.max(1, fullTrackHeight - height);
      const fullTop = (element.scrollTop / maxScrollTop) * maxThumbTop;
      const clippedTop = Math.min(Math.max(fullTrackTop + fullTop, trackTop), Math.max(trackTop, trackBottom - height));
      track.hidden = trackHeight <= 0;
      track.style.zIndex = element.closest(".confirm-backdrop") ? "10010" : "70";
      track.style.left = `${Math.round(Math.min(rect.right, clippedRect.right) - borderRight - trackWidth - inset).toString()}px`;
      track.style.top = `${Math.round(trackTop).toString()}px`;
      track.style.height = `${Math.round(trackHeight).toString()}px`;
      thumb.style.height = `${Math.min(height, trackHeight).toString()}px`;
      thumb.style.transform = `translateY(${Math.round(clippedTop - trackTop).toString()}px)`;
    }

    function syncScrollbars(): void {
      const elements = Array.from(document.querySelectorAll<HTMLElement>("body *")).filter(isScrollable);
      const active = new Set(elements);

      for (const element of elements) {
        if (!scrollbars.has(element)) scrollbars.set(element, createScrollbar(element));
      }

      for (const [element, scrollbar] of scrollbars) {
        if (!active.has(element) || !document.body.contains(element)) {
          removeScrollbar(scrollbar);
          scrollbars.delete(element);
          continue;
        }
        updateScrollbar(scrollbar);
      }
    }

    const observer = new MutationObserver(requestUpdate);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(requestUpdate, 250);
    window.addEventListener("resize", requestUpdate);
    requestUpdate();

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener("resize", requestUpdate);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      for (const scrollbar of scrollbars.values()) removeScrollbar(scrollbar);
      scrollbars.clear();
    };
  }, []);
}

export function App() {
  useCustomScrollbars();
  const [workspace, setWorkspace] = useState(() => hydrateWorkspace(undefined));
  const [workspaceLoaded, setWorkspaceLoaded] = useState(() => window.gpi === undefined);
  const [bridgeError, setBridgeError] = useState<string | undefined>();
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");
  const [projectEditName, setProjectEditName] = useState("");
  const [projectEditPath, setProjectEditPath] = useState("");
  const [importStatus, setImportStatus] = useState<string | undefined>();
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [quickSwitcherMode, setQuickSwitcherMode] = useState<"commands" | "switcher">("switcher");
  const [quickSwitcherQuery, setQuickSwitcherQuery] = useState("");
  const [quickSwitcherIndex, setQuickSwitcherIndex] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | undefined>();
  const [revertPreview, setRevertPreview] = useState<RevertPreviewState | undefined>();
  const [imagePreview, setImagePreview] = useState<GpiImageAttachment | undefined>();
  const [workflowSkillsStatus, setWorkflowSkillsStatus] = useState<WorkflowSkillsStatus | undefined>();
  const [workflowOnboardingOpen, setWorkflowOnboardingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection>("revert");
  const [workflowOnboardingStep, setWorkflowOnboardingStep] = useState<"install" | "intro" | "simulation">("intro");
  const [workflowSkillPreview, setWorkflowSkillPreview] = useState<{ name: WorkflowSkillName; text: string } | undefined>();
  const [workflowInstallStatus, setWorkflowInstallStatus] = useState<string | undefined>();
  const [projectFiles, setProjectFiles] = useState<GpiProjectFileListing | undefined>();
  const [projectFilesLoading, setProjectFilesLoading] = useState(false);
  const [projectFilesError, setProjectFilesError] = useState<string | undefined>();
  const [projectContext, setProjectContext] = useState<GpiProjectContext | undefined>();
  const [projectContextLoading, setProjectContextLoading] = useState(false);
  const [projectContextError, setProjectContextError] = useState<string | undefined>();
  const [updateStatus, setUpdateStatus] = useState<GpiUpdateStatus | undefined>();
  const [updateStatusLoading, setUpdateStatusLoading] = useState(false);
  const [startupMinElapsed, setStartupMinElapsed] = useState(false);
  const [updateStatusChecked, setUpdateStatusChecked] = useState(false);
  const [workflowStatusChecked, setWorkflowStatusChecked] = useState(false);
  const [piUpdateRunning, setPiUpdateRunning] = useState(false);
  const [piInstallRunning, setPiInstallRunning] = useState(false);
  const [piUpdateMessage, setPiUpdateMessage] = useState<string | undefined>();
  const [gpiUpdateInstallerPath, setGpiUpdateInstallerPath] = useState<string | undefined>();
  const [gpiUpdateMessage, setGpiUpdateMessage] = useState<string | undefined>();
  const [gpiUpdateDownloading, setGpiUpdateDownloading] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<GpiReleaseNotes | undefined>();
  const [continuityStatus, setContinuityStatus] = useState<ContinuityWorkflowStatus | undefined>();
  const [modelOptionsByHandle, setModelOptionsByHandle] = useState<Record<string, GpiModelOptions>>({});
  const [compactionOptionsByHandle, setCompactionOptionsByHandle] = useState<Record<string, GpiCompactionOptions>>({});
  const modelHandleReconnects = useRef(new Set<string>());
  const prewarmedSessionIds = useRef(new Set<string>());
  const prewarmedSessionFiles = useRef(new Set<string>());
  const prewarmIntentTimers = useRef<Record<string, number>>({});
  const pendingTextDeltasRef = useRef<Record<string, { delta: string; responseMeta: string | undefined }>>({});
  const pendingTextFrameRef = useRef<number | undefined>(undefined);
  const pendingWorkspaceSaveRef = useRef<ReturnType<typeof toPersistedWorkspace> | undefined>(undefined);
  const workspaceSaveTimerRef = useRef<number | undefined>(undefined);
  const workspaceRef = useRef(workspace);
  const selectedSession = workspace.sessions.find((session) => session.id === workspace.selectedSessionId);
  const selectedProject = workspace.projects.find((project) => project.id === workspace.selectedProjectId) ?? workspace.projects[0];
  const selectedMessages = selectedSession ? workspace.chatMessages[selectedSession.id] ?? [] : [];
  const selectedDraft = selectedSession ? workspace.drafts[selectedSession.id] ?? "" : "";
  const selectedDetails = selectedSession ? workspace.details[selectedSession.id] ?? [] : [];
  const selectedTimelineEvents = selectedSession ? workspace.timelineEvents[selectedSession.id] ?? [] : [];
  const selectedSessionStats = latestSessionStatsSummary(selectedTimelineEvents);
  const selectedBackendHandle = selectedSession ? workspace.backendHandles[selectedSession.id] : undefined;
  const selectedSessionFile = selectedSession ? workspace.sessionFiles[selectedSession.id] : undefined;
  const selectedSessionArchived = selectedSession ? Boolean(workspace.archivedSessions[selectedSession.id]) : false;
  const selectedCompactionOptions = selectedBackendHandle ? compactionOptionsByHandle[selectedBackendHandle] : undefined;
  const selectedSessionCompacting = Boolean(selectedCompactionOptions?.isCompacting);
  const selectedSessionBusy = selectedSession ? (activeStatuses.has(selectedSession.status) || selectedSessionCompacting) && Boolean(selectedBackendHandle) : false;
  const selectedModelOptions = selectedBackendHandle ? modelOptionsByHandle[selectedBackendHandle] : undefined;
  const startupReady = workspaceLoaded && startupMinElapsed && updateStatusChecked && workflowStatusChecked;

  useEffect(() => {
    if (!window.gpi) return;

    let cancelled = false;
    void window.gpi
      .loadWorkspace()
      .then((result) => {
        if (cancelled) return;
        if (result.error) setBridgeError(`Workspace storage recovered: ${result.error}`);
        setWorkspace(hydrateWorkspace(result.workspace));
        setWorkspaceLoaded(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setBridgeError(`Workspace load failed: ${message}`);
        setWorkspaceLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const minTimer = window.setTimeout(() => setStartupMinElapsed(true), 700);
    const maxTimer = window.setTimeout(() => {
      setStartupMinElapsed(true);
      setUpdateStatusChecked(true);
      setWorkflowStatusChecked(true);
    }, 5_000);
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, []);

  useEffect(() => {
    if (!window.gpi || !workspaceLoaded) return;
    void refreshWorkflowSkillsStatus(true);
    void refreshUpdateStatus();
  }, [workspaceLoaded]);

  useEffect(() => {
    if (!window.gpi || !workspaceLoaded) return;

    const handleOpenProjectRequest = (request: GpiOpenProjectRequest): void => openProjectRequest(request);
    const unsubscribe = window.gpi.onOpenProjectRequest(handleOpenProjectRequest);
    void window.gpi.getInitialOpenProjectRequest().then((request) => {
      if (request) handleOpenProjectRequest(request);
    });
    return unsubscribe;
  }, [workspaceLoaded]);

  useEffect(() => {
    const appVersion = updateStatus?.appVersion;
    if (!appVersion || appVersion === "unknown") return;
    if (workspace.settings.lastSeenAppVersion === undefined) {
      setWorkspace((current) => markAppVersionSeen(current, appVersion));
      return;
    }
    if (workspace.settings.lastSeenAppVersion !== appVersion) {
      setReleaseNotesOpen(true);
      if (window.gpi) {
        void window.gpi.getGpiReleaseNotes(appVersion).then(setReleaseNotes).catch(() => setReleaseNotes(undefined));
      }
    }
  }, [updateStatus?.appVersion, workspace.settings.lastSeenAppVersion]);

  useEffect(() => {
    if (!window.gpi || !selectedProject) {
      setContinuityStatus(undefined);
      return;
    }
    let cancelled = false;
    void window.gpi.getContinuityStatus(selectedProject.id).then((status) => {
      if (!cancelled) setContinuityStatus(status);
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!cancelled) setBridgeError(`Continuity status unavailable: ${message}`);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, workspace.timelineEvents]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    if (!window.gpi || !selectedProject) {
      setProjectFiles(undefined);
      return;
    }
    let cancelled = false;
    setProjectFilesLoading(true);
    setProjectFilesError(undefined);
    void window.gpi.listProjectFiles(selectedProject.id).then((listing) => {
      if (!cancelled) setProjectFiles(listing);
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!cancelled) setProjectFilesError(message);
    }).finally(() => {
      if (!cancelled) setProjectFilesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id]);

  useEffect(() => {
    refreshProjectContext();
    if (!selectedProject) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshProjectContext();
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!window.gpi || !workspaceLoaded) return;
    pendingWorkspaceSaveRef.current = toPersistedWorkspace(workspace);
    if (workspaceSaveTimerRef.current !== undefined) window.clearTimeout(workspaceSaveTimerRef.current);
    workspaceSaveTimerRef.current = window.setTimeout(() => flushWorkspaceSave(), 450);
  }, [workspace, workspaceLoaded]);

  useEffect(() => {
    if (!window.gpi) return undefined;
    function flushOnExit(): void {
      flushWorkspaceSave();
    }
    window.addEventListener("beforeunload", flushOnExit);
    return () => {
      window.removeEventListener("beforeunload", flushOnExit);
      flushWorkspaceSave();
    };
  }, []);

  useEffect(() => {
    if (!window.gpi) return undefined;
    return window.gpi.onPiEvent((event) => {
      if (event.type === "text_delta") {
        queueTextDelta(event);
        return;
      }
      flushPendingTextDeltas();
      if (event.type === "compaction_changed") {
        setCompactionOptionsByHandle((current) => ({ ...current, [event.sessionId]: event.options }));
      }
      if (event.type === "tool_finished" && event.fileSnapshots.length > 0) void persistTurnSnapshotForToolEvent(event);
      setWorkspace((current) => reducePiEvent(current, event));
    });
  }, []);

  useEffect(() => () => {
    if (pendingTextFrameRef.current !== undefined) window.cancelAnimationFrame(pendingTextFrameRef.current);
  }, []);

  useEffect(() => {
    if (!window.gpi || !selectedSession || !selectedSessionFile || selectedBackendHandle || !selectedProject) return;
    if (selectedSession.origin !== "real" && selectedSession.origin !== "imported") return;
    if (modelHandleReconnects.current.has(selectedSession.id)) return;
    modelHandleReconnects.current.add(selectedSession.id);
    void reopenSessionForModelControls(selectedSession.id, selectedSessionFile, selectedProject.path);
  }, [selectedBackendHandle, selectedProject, selectedSession, selectedSessionFile]);

  useEffect(() => {
    if (!window.gpi || !selectedBackendHandle) return;
    let cancelled = false;
    void window.gpi
      .getModelOptions(selectedBackendHandle)
      .then((options) => {
        if (!cancelled) setModelOptionsByHandle((current) => ({ ...current, [selectedBackendHandle]: options }));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setBridgeError(`Model options unavailable: ${message}`);
      });
    void window.gpi
      .getCompactionOptions(selectedBackendHandle)
      .then((options) => {
        if (!cancelled) setCompactionOptionsByHandle((current) => ({ ...current, [selectedBackendHandle]: options }));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setBridgeError(`Compaction options unavailable: ${message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBackendHandle]);

  useEffect(() => {
    setRenameDraft(selectedSession?.title ?? "");
  }, [selectedSession?.id, selectedSession?.title]);

  useEffect(() => {
    setProjectEditName(selectedProject?.name ?? "");
    setProjectEditPath(selectedProject?.path ?? "");
  }, [selectedProject?.id, selectedProject?.name, selectedProject?.path]);

  const selectedSessionTools = useMemo(
    () => [...selectedDetails, `${selectedSession?.status ?? "idle"} - current session status`],
    [selectedDetails, selectedSession?.status],
  );
  const switcherItems = useMemo(
    () => buildQuickSwitcherItems(workspace.projects, workspace.sessions, workspace.archivedSessions, quickSwitcherQuery, showArchivedSessions, quickSwitcherMode, {
      hasSelectedProject: Boolean(selectedProject),
      hasSelectedSession: Boolean(selectedSession),
      selectedSessionArchived,
      selectedSessionCanCompact: Boolean(selectedSession && (selectedSession.origin === "real" || selectedSession.origin === "imported")),
      workflowSkillsInstalled: workflowSkillsReady(),
    }),
    [quickSwitcherMode, quickSwitcherQuery, selectedProject, selectedSession, selectedSessionArchived, showArchivedSessions, workflowSkillsStatus, workspace.archivedSessions, workspace.projects, workspace.sessions],
  );
  const nextAttentionSession = useMemo(
    () => findNextAttentionSession(workspace.sessions, workspace.archivedSessions, workspace.selectedSessionId),
    [workspace.archivedSessions, workspace.selectedSessionId, workspace.sessions],
  );

  useEffect(() => {
    if (!quickSwitcherOpen) return;
    setQuickSwitcherIndex(0);
  }, [quickSwitcherOpen, quickSwitcherQuery]);

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent): void {
      if (isEditableTarget(event.target)) return;
      if (matchesKeyBinding(event, DEFAULT_APP_KEYBINDINGS.openCommandPalette)) {
        event.preventDefault();
        openCommandPalette();
      }
      if (matchesKeyBinding(event, DEFAULT_APP_KEYBINDINGS.openQuickSwitcher)) {
        event.preventDefault();
        openQuickSwitcher();
      }
      if (matchesKeyBinding(event, DEFAULT_APP_KEYBINDINGS.nextAttentionSession)) {
        event.preventDefault();
        jumpToNextAttentionSession();
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [nextAttentionSession]);

  async function refreshWorkflowSkillsStatus(openIfNeeded: boolean): Promise<void> {
    if (!window.gpi) {
      setWorkflowStatusChecked(true);
      return;
    }
    try {
      const status = await window.gpi.getWorkflowSkillsStatus();
      setWorkflowSkillsStatus(status);
      if (openIfNeeded && workflowSkillsInstalled(status)) markPlanModeOnboardingSeen();
      if (openIfNeeded && !workflowSkillsInstalled(status) && !planModeOnboardingSeen()) {
        setWorkflowOnboardingStep("intro");
        setWorkflowOnboardingOpen(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBridgeError(`Workflow skills unavailable: ${message}`);
    } finally {
      setWorkflowStatusChecked(true);
    }
  }

  async function refreshSettingsStatus(): Promise<void> {
    setWorkflowInstallStatus("Refreshing local status...");
    await Promise.all([refreshWorkflowSkillsStatus(false), refreshUpdateStatus()]);
    setWorkflowInstallStatus(`Refreshed ${new Date().toLocaleTimeString()}.`);
  }

  async function refreshUpdateStatus(clearUpdateMessage = true): Promise<void> {
    if (!window.gpi) {
      setUpdateStatusChecked(true);
      return;
    }
    setUpdateStatusLoading(true);
    if (clearUpdateMessage) {
      setPiUpdateMessage(undefined);
      setGpiUpdateMessage(undefined);
      setGpiUpdateInstallerPath(undefined);
    }
    try {
      setUpdateStatus(await window.gpi.getUpdateStatus());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUpdateStatus({
        appVersion: "unknown",
        latestAppVersion: undefined,
        appUpdateAvailable: undefined,
        appReleaseUrl: undefined,
        appReleaseName: undefined,
        appReleaseBody: undefined,
        appInstallerUrl: undefined,
        piPackageName: "@earendil-works/pi-coding-agent",
        installedPiVersion: undefined,
        latestPiVersion: undefined,
        piUpdateAvailable: undefined,
        piUpdateCommand: "pi update",
        piRuntime: {
          pi: { available: false, executablePath: undefined, version: undefined, error: message },
          npm: { available: false, executablePath: undefined, version: undefined, error: "not checked" },
          pnpm: { available: false, executablePath: undefined, version: undefined, error: "not checked" },
          installable: false,
          preferredPackageManager: undefined,
          installCommand: undefined,
          missingPackageManagerMessage: message,
        },
        checkedAt: Date.now(),
        error: message,
      });
    } finally {
      setUpdateStatusLoading(false);
      setUpdateStatusChecked(true);
    }
  }

  async function updateGpiFromSettings(): Promise<void> {
    if (!window.gpi || !updateStatus) return;
    if (gpiUpdateInstallerPath) {
      setGpiUpdateMessage("Starting GPi installer...");
      await window.gpi.installGpiUpdate(gpiUpdateInstallerPath);
      return;
    }
    const url = updateStatus.appInstallerUrl;
    if (!url) {
      if (updateStatus.appReleaseUrl) await window.gpi.openExternal(updateStatus.appReleaseUrl);
      return;
    }
    setGpiUpdateDownloading(true);
    setGpiUpdateMessage("Downloading GPi update...");
    try {
      const result = await window.gpi.downloadGpiUpdate(url);
      setGpiUpdateInstallerPath(result.installerPath);
      setGpiUpdateMessage("Update downloaded. Click Install Update to close GPi and run the installer.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGpiUpdateMessage(`GPi update download failed: ${message}`);
    } finally {
      setGpiUpdateDownloading(false);
    }
  }

  async function installPiFromSettings(): Promise<void> {
    if (!window.gpi) return;
    setPiInstallRunning(true);
    setPiUpdateMessage(`Installing Pi with \`${updateStatus?.piRuntime.installCommand ?? "npm install -g @earendil-works/pi-coding-agent"}\`...`);
    try {
      const result = await window.gpi.installPi(false);
      setPiUpdateMessage(result.ok ? `Pi install finished. ${result.output || result.command}` : `Pi install needs attention: ${result.error ?? result.output}`);
      await refreshUpdateStatus(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPiUpdateMessage(`Pi install failed: ${message}`);
    } finally {
      setPiInstallRunning(false);
    }
  }

  async function updatePiFromSettings(): Promise<void> {
    if (!window.gpi) return;
    setPiUpdateRunning(true);
    setPiUpdateMessage("Updating Pi with `pi update`...");
    try {
      const result = await window.gpi.updatePi();
      setPiUpdateMessage(result.ok ? `Pi update finished. ${result.output || result.command}` : `Pi update failed: ${result.error ?? result.output}`);
      await refreshUpdateStatus(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPiUpdateMessage(`Pi update failed: ${message}`);
    } finally {
      setPiUpdateRunning(false);
    }
  }

  async function previewWorkflowSkill(skillName: WorkflowSkillName): Promise<void> {
    if (!window.gpi) return;
    setWorkflowSkillPreview(await window.gpi.getWorkflowSkillText(skillName));
  }

  async function installWorkflowSkills(): Promise<void> {
    if (!window.gpi) return;
    setWorkflowInstallStatus("Installing workflow skills...");
    try {
      const result = await window.gpi.installWorkflowSkills();
      setWorkflowInstallStatus(result.conflicts.length > 0
        ? `Installed ${result.installed.length.toString()}; ${result.conflicts.length.toString()} conflict${result.conflicts.length === 1 ? "" : "s"} need review.`
        : `Installed ${result.installed.length.toString()} workflow skill${result.installed.length === 1 ? "" : "s"}.`);
      await refreshWorkflowSkillsStatus(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkflowInstallStatus(`Install failed: ${message}`);
    }
  }

  async function updateWorkflowSkills(): Promise<void> {
    if (!window.gpi) return;
    setWorkflowInstallStatus("Updating workflow skills...");
    try {
      const result = await window.gpi.updateWorkflowSkills();
      setWorkflowInstallStatus(`Updated ${result.updated.length.toString()} workflow skill${result.updated.length === 1 ? "" : "s"}.`);
      await refreshWorkflowSkillsStatus(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkflowInstallStatus(`Update failed: ${message}`);
    }
  }

  function queueTextDelta(event: Extract<GpiPiEvent, { type: "text_delta" }>): void {
    const pending = pendingTextDeltasRef.current[event.sessionId];
    pendingTextDeltasRef.current[event.sessionId] = {
      delta: `${pending?.delta ?? ""}${event.delta}`,
      responseMeta: pending?.responseMeta ?? event.responseMeta,
    };
    if (pendingTextFrameRef.current !== undefined) return;
    pendingTextFrameRef.current = window.requestAnimationFrame(() => {
      pendingTextFrameRef.current = undefined;
      flushPendingTextDeltas();
    });
  }

  function flushPendingTextDeltas(): void {
    const pendingEntries = Object.entries(pendingTextDeltasRef.current);
    if (pendingEntries.length === 0) return;
    pendingTextDeltasRef.current = {};
    setWorkspace((current) => pendingEntries.reduce((next, [sessionId, pending]) => reducePiEvent(next, {
      type: "text_delta",
      sessionId,
      delta: pending.delta,
      responseMeta: pending.responseMeta,
    }), current));
  }

  function selectSession(session: GpiSessionSummary): void {
    setWorkspace((current) => selectSessionInWorkspace(current, session));
  }

  function selectProject(project: GpiProject): void {
    setWorkspace((current) => selectProjectInWorkspace(current, project.id));
  }

  function openQuickSwitcher(): void {
    setQuickSwitcherMode("switcher");
    setQuickSwitcherQuery("");
    setQuickSwitcherIndex(0);
    setQuickSwitcherOpen(true);
  }

  function openCommandPalette(): void {
    setQuickSwitcherMode("commands");
    setQuickSwitcherQuery("");
    setQuickSwitcherIndex(0);
    setQuickSwitcherOpen(true);
  }

  function closeQuickSwitcher(): void {
    setQuickSwitcherOpen(false);
  }

  function jumpToNextAttentionSession(): void {
    if (!nextAttentionSession) return;
    setWorkspace((current) => selectSessionInWorkspace(current, nextAttentionSession));
  }

  function selectQuickSwitcherItem(item: QuickSwitcherItem): void {
    if (item.kind === "project") setWorkspace((current) => selectProjectInWorkspace(current, item.project.id));
    if (item.kind === "session") setWorkspace((current) => selectSessionInWorkspace(current, item.session));
    if (item.kind === "command") runPaletteCommand(item.command);
    closeQuickSwitcher();
  }

  function runPaletteCommand(command: PaletteCommand): void {
    if (command === "add-project") void addProjectFromPalette();
    if (command === "install-workflow-skills") {
      setWorkflowOnboardingStep("install");
      setWorkflowOnboardingOpen(true);
    }
    if (command === "take-plan-onboarding") {
      setWorkflowOnboardingStep("intro");
      setWorkflowOnboardingOpen(true);
    }
    if (command === "initialize-continuity") sendPrompt(selectedDraft.trim().length > 0 ? `/init-cont ${selectedDraft.trim()}` : "/init-cont");
    if (command === "plan-continuity") sendPrompt(selectedDraft.trim().length > 0 ? `/plan-cont ${selectedDraft.trim()}` : "/plan-cont");
    if (command === "start-continuity") sendPrompt(selectedDraft.trim().length > 0 ? `/start-cont ${selectedDraft.trim()}` : "/start-cont");
    if (command === "finish-continuity") sendPrompt(selectedDraft.trim().length > 0 ? `/end-cont ${selectedDraft.trim()}` : "/end-cont");
    if (command === "new-pi-session") void createPiSession();
    if (command === "import-pi-sessions") void importCurrentProjectSessions();
    if (command === "next-attention") jumpToNextAttentionSession();
    if (command === "toggle-archived") setShowArchivedSessions((current) => !current);
    if (command === "restore-selected-session") restoreSelectedSession();
  }

  function renameSelectedSession(): void {
    if (!selectedSession) return;
    setWorkspace((current) => renameSessionInWorkspace(current, selectedSession.id, renameDraft));
  }

  async function persistTurnSnapshotForToolEvent(event: Extract<GpiPiEvent, { type: "tool_finished" }>): Promise<void> {
    if (!window.gpi) return;
    const currentWorkspace = workspaceRef.current;
    const session = currentWorkspace.sessions.find((candidate) => candidate.id === event.sessionId);
    if (!session) return;
    const project = currentWorkspace.projects.find((candidate) => candidate.id === session.projectId);
    if (!project) return;
    const turnId = latestTurnId(currentWorkspace.timelineEvents[event.sessionId] ?? []);
    if (!turnId) return;
    const request: TurnSnapshotSaveRequest = {
      projectId: project.id,
      projectPath: project.path,
      sessionId: event.sessionId,
      turnId,
      userMessageId: turnId,
      createdAt: Date.now(),
      completedAt: Date.now(),
      files: event.fileSnapshots,
      captureErrors: [],
    };
    try {
      const result = await window.gpi.saveTurnSnapshot(request);
      setWorkspace((current) => addTurnSnapshotIndexEntry(current, result.indexEntry));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBridgeError(`Turn snapshot failed: ${message}`);
    }
  }

  function flushWorkspaceSave(): void {
    if (!window.gpi || pendingWorkspaceSaveRef.current === undefined) return;
    if (workspaceSaveTimerRef.current !== undefined) {
      window.clearTimeout(workspaceSaveTimerRef.current);
      workspaceSaveTimerRef.current = undefined;
    }
    const nextWorkspace = pendingWorkspaceSaveRef.current;
    pendingWorkspaceSaveRef.current = undefined;
    void window.gpi.saveWorkspace(nextWorkspace).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setBridgeError(`Workspace save failed: ${message}`);
    });
  }

  function archiveSelectedSession(): void {
    if (!selectedSession) return;
    setWorkspace((current) => archiveSessionInWorkspace(current, selectedSession.id));
  }

  function restoreSelectedSession(): void {
    if (!selectedSession) return;
    setWorkspace((current) => restoreSessionInWorkspace(current, selectedSession.id));
  }

  function workflowSkillsReady(): boolean {
    return Boolean(workflowSkillsStatus && workflowSkillsInstalled(workflowSkillsStatus));
  }

  function hasContinuityWorkStarted(): boolean {
    if (!continuityStatus) return false;
    return continuityStatus.counts.done > 0 || continuityStatus.counts.partial > 0 || continuityStatus.counts.cancelled > 0 || continuityStatus.counts.inProgress > 0;
  }

  function shouldShowPlanRefinementButton(): boolean {
    if (!workflowSkillsReady() || !continuityStatus) return false;
    if (continuityStatus.phase === "complete") return true;
    return continuityStatus.phase === "executable" && hasContinuityWorkStarted();
  }

  function workflowLabel(): string {
    if (!workflowSkillsReady()) return "Initialize";
    if (selectedMessages.length === 0 && selectedTimelineEvents.length === 0) return "Initialize";
    if (!continuityStatus) return "Initialize";
    if (continuityStatus.phase === "missing") return "Initialize";
    if (continuityStatus.phase === "initialized") return "Plan";
    if (continuityStatus.phase === "planned" || continuityStatus.phase === "executable") return "Start";
    return "End";
  }

  function sendPlanWorkflowPrompt(): void {
    const context = selectedDraft.trim();
    sendPrompt(`/plan-cont${context.length > 0 ? ` ${context}` : ""}`);
  }

  function runComposerWorkflowAction(): void {
    if (!workflowSkillsReady()) {
      setWorkflowOnboardingStep("intro");
      setWorkflowOnboardingOpen(true);
      return;
    }
    const label = workflowLabel();
    const context = selectedDraft.trim();
    const suffix = context.length > 0 ? ` ${context}` : "";
    if (label === "Initialize") sendPrompt(`/init-cont${suffix}`);
    if (label === "Plan") sendPrompt(`/plan-cont${suffix}`);
    if (label === "Start") sendPrompt(`/start-cont${suffix}`);
    if (label === "End") sendPrompt(`/end-cont${suffix}`);
  }

  function openProjectRequest(request: GpiOpenProjectRequest): void {
    if (!request.ok) {
      setBridgeError(`Open in GPi failed: ${request.error}${request.path ? ` (${request.path})` : ""}`);
      return;
    }

    const projectId = `project-${Date.now().toString(36)}`;
    setBridgeError(undefined);
    setWorkspace((current) => selectOrAddProjectByPath(current, { id: projectId, name: projectNameFromPath(request.path), path: request.path }));
  }

  async function addProjectFromPalette(): Promise<void> {
    if (!window.gpi) {
      setBridgeError("GPi preload API is not available. Restart Electron after running npm run compile:electron.");
      return;
    }

    const result = await window.gpi.chooseProjectPath();
    const path = result.path;
    if (!path) return;
    const projectId = `project-${Date.now().toString(36)}`;
    setWorkspace((current) => addProjectToWorkspace(current, { id: projectId, name: projectNameFromPath(path), path }));
  }

  async function chooseProjectPath(): Promise<void> {
    if (!window.gpi) {
      setBridgeError("GPi preload API is not available. Restart Electron after running npm run compile:electron.");
      return;
    }

    const result = await window.gpi.chooseProjectPath();
    if (!result.path) return;
    setNewProjectPath(result.path);
    if (newProjectName.trim().length === 0) setNewProjectName(projectNameFromPath(result.path));
  }

  async function chooseProjectEditPath(): Promise<void> {
    if (!window.gpi) {
      setBridgeError("GPi preload API is not available. Restart Electron after running npm run compile:electron.");
      return;
    }

    const result = await window.gpi.chooseProjectPath();
    if (result.path) setProjectEditPath(result.path);
  }

  async function importCurrentProjectSessions(): Promise<void> {
    if (!selectedProject || !window.gpi) return;

    setImportStatus(`Scanning ${selectedProject.name}...`);
    try {
      const sessions = await window.gpi.listProjectSessions(selectedProject.id);
      const knownFiles = new Set(Object.values(workspace.sessionFiles));
      const importCount = sessions.filter((session) => !knownFiles.has(session.path)).length;
      setWorkspace((current) => importProjectSessions(current, selectedProject.id, sessions));
      setImportStatus(importCount === 0 ? "No new Pi sessions found" : `Imported ${importCount.toString()} Pi session${importCount === 1 ? "" : "s"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setImportStatus(undefined);
      setBridgeError(`Import failed: ${message}`);
    }
  }

  function createProject(): void {
    const name = newProjectName.trim();
    const path = newProjectPath.trim();
    if (name.length === 0 || path.length === 0) return;

    const projectId = `project-${Date.now().toString(36)}`;
    setWorkspace((current) => addProjectToWorkspace(current, { id: projectId, name, path }));
    setNewProjectName("");
    setNewProjectPath("");
  }

  async function updateSelectedProject(): Promise<void> {
    if (!selectedProject) return;
    const name = projectEditName.trim();
    const path = projectEditPath.trim();
    if (name.length === 0 || path.length === 0) return;
    if (window.gpi) {
      const validation = await window.gpi.validateProjectPath(path);
      if (!validation.ok) {
        setBridgeError(`Project path invalid: ${validation.error ?? path}`);
        return;
      }
    }
    setWorkspace((current) => updateProjectInWorkspace(current, selectedProject.id, { name, path }));
  }

  function removeSelectedProject(): void {
    if (!selectedProject) return;
    const project = selectedProject;
    setConfirmDialog({
      title: `Remove ${project.name}?`,
      body: "This only removes the project from GPi. Files and Pi session history on disk are not deleted.",
      confirmLabel: "Remove project",
      tone: "danger",
      onConfirm: () => setWorkspace((current) => removeProjectFromWorkspace(current, project.id)),
    });
  }

  async function createPiSession(targetProject = selectedProject): Promise<void> {
    if (!targetProject) return;
    if (!window.gpi) {
      setBridgeError("GPi preload API is not available. Restart Electron after running npm run compile:electron.");
      return;
    }

    setBridgeError(undefined);
    const runtimeStatus = updateStatus ?? await window.gpi.getUpdateStatus();
    setUpdateStatus(runtimeStatus);
    if (!runtimeStatus.piRuntime.pi.available) {
      setConfirmDialog({
        title: "Pi runtime is missing",
        body: runtimeStatus.piRuntime.installCommand
          ? `GPi needs the Pi CLI before it can create sessions. Open Runtime settings to run: ${runtimeStatus.piRuntime.installCommand}`
          : runtimeStatus.piRuntime.missingPackageManagerMessage ?? "GPi cannot find the Pi CLI or a supported package manager on PATH.",
        confirmLabel: "Open Runtime settings",
        tone: "neutral",
        onConfirm: () => {
          setSettingsInitialSection("runtime");
          setSettingsOpen(true);
        },
      });
      return;
    }
    const prewarm = await window.gpi.getPrewarmStatus();
    const clickedAt = performance.now();
    const temporarySessionId = `${targetProject.id}-connecting-${Date.now().toString(36)}`;
    const sessionNumber = targetProject.sessionIds.length + 1;
    const optimisticSession: GpiSessionSummary = {
      id: temporarySessionId,
      projectId: targetProject.id,
      title: `Pi session ${sessionNumber}`,
      status: "connecting",
      lastActivity: "Connecting to Pi",
      origin: "real",
    };

    setWorkspace((current) =>
      addOptimisticRealSession(current, targetProject.id, optimisticSession, [
        "visual session created immediately",
        `prewarm: ${prewarm.status}${prewarm.durationMs === undefined ? "" : ` in ${prewarm.durationMs.toString()}ms`}`,
        "creating Pi session...",
      ]),
    );

    try {
      const handle = await window.gpi.createSession(targetProject.id);
      const readyMs = Math.round(performance.now() - clickedAt);
      setWorkspace((current) => replaceOptimisticSession(current, temporarySessionId, handle.id, {
        backendHandle: handle.id,
        sessionFile: handle.sessionFile,
        readyMs,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkspace((current) => markSessionError(current, temporarySessionId, "Pi connection failed", `error: ${message}`));
    }
  }

  function updateDraft(value: string): void {
    if (!selectedSession) return;
    setWorkspace((current) => updateDraftInWorkspace(current, selectedSession.id, value));
  }

  const insertFileMention = useCallback((path: string): void => {
    window.dispatchEvent(new CustomEvent<{ path: string }>("gpi:file-mention-request", { detail: { path } }));
  }, []);

  function refreshProjectFiles(): void {
    if (!window.gpi || !selectedProject) return;
    setProjectFilesLoading(true);
    setProjectFilesError(undefined);
    void window.gpi.listProjectFiles(selectedProject.id).then(setProjectFiles).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setProjectFilesError(message);
    }).finally(() => setProjectFilesLoading(false));
  }

  function refreshProjectContext(): void {
    if (!window.gpi || !selectedProject) {
      setProjectContext(undefined);
      return;
    }
    setProjectContextLoading(true);
    setProjectContextError(undefined);
    void window.gpi.getProjectContext(selectedProject.id).then(setProjectContext).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setProjectContextError(message);
    }).finally(() => setProjectContextLoading(false));
  }

  async function changeModel(value: string): Promise<void> {
    if (!window.gpi || !selectedBackendHandle) return;
    const separatorIndex = value.indexOf("/");
    if (separatorIndex === -1) return;
    const provider = value.slice(0, separatorIndex);
    const modelId = value.slice(separatorIndex + 1);
    try {
      const options = await window.gpi.setModel(selectedBackendHandle, provider, modelId);
      setModelOptionsByHandle((current) => ({ ...current, [selectedBackendHandle]: options }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBridgeError(`Model change failed: ${message}`);
    }
  }

  async function changeThinkingLevel(level: string): Promise<void> {
    if (!window.gpi || !selectedBackendHandle) return;
    try {
      const options = await window.gpi.setThinkingLevel(selectedBackendHandle, level);
      setModelOptionsByHandle((current) => ({ ...current, [selectedBackendHandle]: options }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBridgeError(`Thinking level change failed: ${message}`);
    }
  }

  function sendPrompt(promptOverride?: string, images: GpiImageAttachment[] = []): void {
    const rawPrompt = promptOverride?.trim() ?? selectedDraft.trim();
    const userPrompt = rawPrompt.length === 0 && images.length > 0 ? "Please inspect the attached image(s)." : rawPrompt;
    const prompt = applyFileMentionPromptPolicy(userPrompt, projectFiles?.entries ?? []);
    if (!selectedSession || (rawPrompt.length === 0 && images.length === 0)) return;
    const sessionId = selectedSession.id;
    const acceptedDetail = selectedSessionBusy ? "Pi follow-up queued" : selectedBackendHandle || selectedSessionFile ? "Pi prompt sent" : "mock event: agent_start";
    const acceptedActivity = selectedSessionBusy ? "Follow-up queued" : selectedBackendHandle || selectedSessionFile ? "Pi prompt accepted" : "Prompt accepted";
    setWorkspace((current) => {
      const accepted = markPromptAccepted(current, sessionId, userPrompt, acceptedDetail, acceptedActivity, images);
      return current.settings.revertSafeEditsEnabled && !prompt.trimStart().startsWith("/") ? markRevertSafeTurn(accepted, sessionId) : accepted;
    });

    if (window.gpi && selectedSessionFile && !selectedBackendHandle && selectedProject) {
      void reopenAndSendRealPiPrompt(sessionId, selectedSessionFile, selectedProject.path, prompt, images);
      return;
    }

    if (selectedBackendHandle && window.gpi) {
      if (selectedSessionBusy) {
        void sendRealPiFollowUp(sessionId, selectedBackendHandle, prompt, images);
        return;
      }

      void sendRealPiPrompt(sessionId, selectedBackendHandle, prompt, images);
      return;
    }

    sendLocalPrompt(sessionId);
  }

  function scheduleSessionPrewarm(session: GpiSessionSummary): void {
    if (prewarmIntentTimers.current[session.id] !== undefined) return;
    prewarmIntentTimers.current[session.id] = window.setTimeout(() => {
      const { [session.id]: _timer, ...timers } = prewarmIntentTimers.current;
      prewarmIntentTimers.current = timers;
      void prewarmSessionOnIntent(session);
    }, 1_500);
  }

  function cancelSessionPrewarm(sessionId: string): void {
    const timer = prewarmIntentTimers.current[sessionId];
    if (timer === undefined) return;
    window.clearTimeout(timer);
    const { [sessionId]: _timer, ...timers } = prewarmIntentTimers.current;
    prewarmIntentTimers.current = timers;
  }

  async function prewarmSessionOnIntent(session: GpiSessionSummary): Promise<void> {
    if (!window.gpi) return;
    if (session.id === workspace.selectedSessionId) return;
    if (session.origin !== "real" && session.origin !== "imported") return;
    const sessionFile = workspace.sessionFiles[session.id];
    const project = workspace.projects.find((candidate) => candidate.id === session.projectId);
    if (!sessionFile || !project) return;
    if (workspace.backendHandles[session.id]) return;
    if (prewarmedSessionIds.current.has(session.id) || prewarmedSessionFiles.current.has(sessionFile)) return;
    prewarmedSessionIds.current.add(session.id);
    prewarmedSessionFiles.current.add(sessionFile);
    try {
      const handle = await window.gpi.openSession(sessionFile, project.path);
      setWorkspace((current) => current.backendHandles[session.id]
        ? current
        : {
          ...current,
          backendHandles: { ...current.backendHandles, [session.id]: handle.id },
          sessionFiles: handle.sessionFile ? { ...current.sessionFiles, [session.id]: handle.sessionFile } : current.sessionFiles,
        });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isMissingSessionFileError(message)) {
        setWorkspace((current) => {
          const { [session.id]: _removedSessionFile, ...sessionFiles } = current.sessionFiles;
          return { ...current, sessionFiles };
        });
      }
    }
  }

  async function reopenAndSendRealPiPrompt(sessionId: string, sessionFile: string, projectPath: string, prompt: string, images: GpiImageAttachment[] = []): Promise<void> {
    if (!window.gpi) return;

    setWorkspace((current) => markSessionReopening(current, sessionId));

    try {
      const handle = await window.gpi.openSession(sessionFile, projectPath);
      setWorkspace((current) => markSessionReopened(current, sessionId, handle.id, handle.sessionFile));
      await sendRealPiPrompt(sessionId, handle.id, prompt, images);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBridgeError(message);
      setWorkspace((current) => markSessionError(current, sessionId, "Pi reopen failed", `error: ${message}`));
    }
  }

  async function reopenSessionForModelControls(sessionId: string, sessionFile: string, projectPath: string): Promise<void> {
    if (!window.gpi) return;

    setWorkspace((current) => markSessionReopening(current, sessionId));

    try {
      const handle = await window.gpi.openSession(sessionFile, projectPath);
      setWorkspace((current) => markSessionReopened(current, sessionId, handle.id, handle.sessionFile));
      const options = await window.gpi.getModelOptions(handle.id);
      const compactionOptions = await window.gpi.getCompactionOptions(handle.id);
      setModelOptionsByHandle((current) => ({ ...current, [handle.id]: options }));
      setCompactionOptionsByHandle((current) => ({ ...current, [handle.id]: compactionOptions }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const missingSessionFile = isMissingSessionFileError(message);
      setBridgeError(missingSessionFile ? "Pi session file is missing. Import sessions for this project to refresh GPi." : message);
      setWorkspace((current) => {
        const next = markSessionError(current, sessionId, missingSessionFile ? "Session file missing" : "Pi reopen failed", `error: ${message}`);
        if (!missingSessionFile) return next;
        const { [sessionId]: _removedSessionFile, ...sessionFiles } = next.sessionFiles;
        return { ...next, sessionFiles };
      });
    }
  }

  async function sendRealPiPrompt(sessionId: string, backendHandle: string, prompt: string, images: GpiImageAttachment[] = []): Promise<void> {
    try {
      await window.gpi?.prompt(backendHandle, applyRevertSafePromptPolicy(prompt, workspaceRef.current.settings.revertSafeEditsEnabled), images);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBridgeError(message);
      setWorkspace((current) => markSessionError(current, sessionId, "Pi prompt failed", `error: ${message}`));
    }
  }

  async function sendRealPiFollowUp(sessionId: string, backendHandle: string, prompt: string, images: GpiImageAttachment[] = []): Promise<void> {
    try {
      await window.gpi?.followUp(backendHandle, applyRevertSafePromptPolicy(prompt, workspaceRef.current.settings.revertSafeEditsEnabled), images);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBridgeError(message);
      setWorkspace((current) => markSessionError(current, sessionId, "Pi follow-up failed", `error: ${message}`));
    }
  }

  async function compactSessionFromSidebar(session: GpiSessionSummary): Promise<void> {
    if (!window.gpi) return;
    const existingHandle = workspace.backendHandles[session.id];
    const project = workspace.projects.find((candidate) => candidate.id === session.projectId);
    const sessionFile = workspace.sessionFiles[session.id];
    let handle = existingHandle;
    try {
      setWorkspace((current) => markSessionSidebarActivity(current, session.id, "Compacting", session.status));
      if (!handle && sessionFile && project) {
        const reopened = await window.gpi.openSession(sessionFile, project.path);
        handle = reopened.id;
        setWorkspace((current) => ({
          ...current,
          backendHandles: { ...current.backendHandles, [session.id]: reopened.id },
          sessionFiles: reopened.sessionFile ? { ...current.sessionFiles, [session.id]: reopened.sessionFile } : current.sessionFiles,
        }));
      }
      if (!handle) return;
      setCompactionOptionsByHandle((current) => ({ ...current, [handle]: { ...(current[handle] ?? { autoCompactionEnabled: false }), isCompacting: true } }));
      const options = await window.gpi.compactSession(handle);
      setCompactionOptionsByHandle((current) => ({ ...current, [handle]: options }));
      setWorkspace((current) => reducePiEvent(markSessionSidebarActivity(current, session.id, "Compacted", "completed"), {
        type: "compaction_changed",
        sessionId: session.id,
        options,
        summary: "session compacted",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("already compacted")) {
        setWorkspace((current) => reducePiEvent(markSessionSidebarActivity(current, session.id, "Compacted", "completed"), {
          type: "compaction_changed",
          sessionId: session.id,
          options: { isCompacting: false, autoCompactionEnabled: false },
          summary: "already compacted; nothing new to compact",
        }));
        return;
      }
      setBridgeError(`Compaction failed: ${message}`);
      setWorkspace((current) => markSessionError(current, session.id, "Compaction failed", `error: ${message}`));
    }
  }

  async function compactSelectedSession(): Promise<void> {
    if (!selectedSession) return;
    await compactSessionFromSidebar(selectedSession);
  }

  async function abortSelectedCompaction(): Promise<void> {
    if (!selectedBackendHandle || !window.gpi) return;
    const options = await window.gpi.abortCompaction(selectedBackendHandle);
    setCompactionOptionsByHandle((current) => ({ ...current, [selectedBackendHandle]: options }));
  }

  async function setSelectedAutoCompaction(enabled: boolean): Promise<void> {
    if (!selectedBackendHandle || !window.gpi) return;
    const options = await window.gpi.setAutoCompaction(selectedBackendHandle, enabled);
    setCompactionOptionsByHandle((current) => ({ ...current, [selectedBackendHandle]: options }));
  }

  async function abortSelectedRun(): Promise<void> {
    if (!selectedBackendHandle || !window.gpi || !selectedSession) return;

    try {
      await window.gpi.abort(selectedBackendHandle);
      setWorkspace((current) => markSessionAborted(current, selectedSession.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBridgeError(message);
      setWorkspace((current) => markSessionError(current, selectedSession.id, "Abort failed", `error: ${message}`));
    }
  }

  async function applyRevertPreview(preview: RevertPreviewState): Promise<void> {
    if (!window.gpi) return;
    const result = await window.gpi.revertTurnSnapshot(preview.snapshot.manifestPath);
    if (result.ok) {
      setWorkspace((current) => appendRevertResultEvent(current, preview.snapshot.sessionId, `Reverted ${result.revertedFiles.length.toString()} file${result.revertedFiles.length === 1 ? "" : "s"} to before this message`, "success"));
      setRevertPreview(undefined);
      return;
    }
    setWorkspace((current) => appendRevertResultEvent(current, preview.snapshot.sessionId, `Revert blocked: ${result.conflicts.length.toString()} conflict${result.conflicts.length === 1 ? "" : "s"}`, "warning"));
    setRevertPreview({ ...preview, error: result.conflicts.map((conflict) => `${conflict.path}: ${conflict.reason}`).join("\n") });
  }

  async function openRevertPreview(snapshot: TurnSnapshotIndexEntry): Promise<void> {
    if (!window.gpi) return;
    try {
      setRevertPreview({ snapshot, manifest: undefined, error: undefined });
      const manifest = await window.gpi.getTurnSnapshotManifest(snapshot.manifestPath);
      setRevertPreview({ snapshot, manifest, error: undefined });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRevertPreview({ snapshot, manifest: undefined, error: message });
    }
  }

  function sendLocalPrompt(sessionId: string): void {
    window.setTimeout(() => applyMockEvent(sessionId, "streaming", "mock event: text_delta - drafting response"), 220);
    window.setTimeout(() => applyMockEvent(sessionId, "running_tool", "mock event: tool_started read"), 520);
    window.setTimeout(() => applyMockEvent(sessionId, "editing_files", "mock event: file_change src/renderer/ui/App.tsx"), 820);
    window.setTimeout(() => applyMockEvent(sessionId, "completed", "mock event: agent_end"), 1160);
  }

  function applyMockEvent(sessionId: string, status: SessionStatus, detail: string): void {
    setWorkspace((current) => applyMockEventToWorkspace(current, sessionId, status, detail));
  }

  return (
    <main className="app-shell">
      <ProjectSidebar
        projects={workspace.projects}
        sessions={workspace.sessions}
        sessionSelectionRanks={workspace.sessionSelectionRanks}
        selectedProjectId={selectedProject?.id}
        selectedSessionId={selectedSession?.id}
        archivedSessions={workspace.archivedSessions}
        showArchivedSessions={showArchivedSessions}
        newProjectName={newProjectName}
        newProjectPath={newProjectPath}
        projectEditName={projectEditName}
        projectEditPath={projectEditPath}
        onChooseProjectEditPath={() => void chooseProjectEditPath()}
        onChooseProjectPath={() => void addProjectFromPalette()}
        importStatus={importStatus}
        onCreateProject={createProject}
        onCreatePiSession={(project) => void createPiSession(project)}
        onImportProjectSessions={() => void importCurrentProjectSessions()}
        onJumpToNextAttentionSession={jumpToNextAttentionSession}
        onOpenQuickSwitcher={openQuickSwitcher}
        onNewProjectNameChange={setNewProjectName}
        onNewProjectPathChange={setNewProjectPath}
        onProjectEditNameChange={setProjectEditName}
        onProjectEditPathChange={setProjectEditPath}
        onArchiveSession={(sessionId) => setWorkspace((current) => archiveSessionInWorkspace(current, sessionId))}
        onCompactSession={(session) => void compactSessionFromSidebar(session)}
        onSelectProject={selectProject}
        onRemoveProject={removeSelectedProject}
        onCancelPrewarmSession={cancelSessionPrewarm}
        onPrewarmSession={scheduleSessionPrewarm}
        onSelectSession={selectSession}
        onToggleShowArchived={() => setShowArchivedSessions((current) => !current)}
        onUpdateProject={() => void updateSelectedProject()}
      />

      <section className="chat-workspace">
        <header className="chat-header drag-region">
          <div className="chat-title-block">
            <div className="chat-kicker">
              <span>{selectedProject?.name ?? "No project"}</span>
              <span className="path-chip">cwd {selectedProject?.path ?? "No path"}</span>
            </div>
            <div className="chat-title-row">
              <h1>{selectedSession?.title ?? "No session"}</h1>
              <ProjectContextBadge context={projectContext} error={projectContextError} loading={projectContextLoading} onRefresh={refreshProjectContext} />
            </div>
          </div>
          <WindowControls updateStatus={updateStatus} updateStatusLoading={updateStatusLoading} onOpenSettings={() => {
            setSettingsInitialSection("revert");
            setSettingsOpen(true);
          }} />
        </header>

        <div className="chat-session-shell">
          <div className="chat-session-main">
            <MessageTimeline
              bridgeError={bridgeError}
              details={selectedDetails}
              hasSelectedProject={Boolean(selectedProject)}
              projectId={selectedProject?.id}
              messages={selectedMessages}
              timelineEvents={selectedTimelineEvents}
              turnSnapshots={workspace.turnSnapshots}
              selectedSessionId={selectedSession?.id}
              onPreviewImage={setImagePreview}
              onPreviewRevert={(snapshot) => void openRevertPreview(snapshot)}
              onCreateSession={() => void createPiSession(selectedProject)}
              selectedSessionStatus={selectedSession?.status}
            />

            {selectedSession ? (
              <Composer
                disabled={false}
                draft={selectedDraft}
                hasRealHandle={Boolean(selectedBackendHandle)}
                isBusy={selectedSessionBusy}
                isCompacting={selectedSessionCompacting}
                modelOptions={selectedModelOptions}
                selectedSession={selectedSession}
                sessionStats={selectedSessionStats}
                onAbort={() => void abortSelectedRun()}
                onAbortCompaction={() => void abortSelectedCompaction()}
                onCompact={() => void compactSelectedSession()}
                onChange={updateDraft}
                onModelChange={(value) => void changeModel(value)}
                onSend={(draft, images) => sendPrompt(draft, images)}
                onThinkingChange={(value) => void changeThinkingLevel(value)}
                workflowLabel={workflowLabel()}
                focusKey={selectedSession?.id}
                showPlanRefinement={shouldShowPlanRefinementButton()}
                revertSafeEditsEnabled={workspace.settings.revertSafeEditsEnabled}
                shouldAutoFocus={!quickSwitcherOpen && !confirmDialog && !workflowOnboardingOpen && !settingsOpen}
                onPlanRefinement={() => sendPlanWorkflowPrompt()}
                onRevertSafeEditsChange={(enabled) => setWorkspace((current) => updateRevertSafeEditsSetting(current, enabled))}
                projectFiles={projectFiles?.entries ?? []}
                onWorkflowAction={runComposerWorkflowAction}
              />
            ) : null}
          </div>

          {workspace.settings.projectFilesPanelVisible ? (
            <ProjectFilesPanel
              error={projectFilesError}
              listing={projectFiles}
              loading={projectFilesLoading}
              onFileClick={insertFileMention}
              onRefresh={refreshProjectFiles}
            />
          ) : null}
        </div>
      </section>

      {confirmDialog ? <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(undefined)} /> : null}
      {revertPreview ? <RevertPreviewDialog onApply={() => void applyRevertPreview(revertPreview)} preview={revertPreview} onClose={() => setRevertPreview(undefined)} /> : null}
      {imagePreview ? <ImagePreviewDialog image={imagePreview} onClose={() => setImagePreview(undefined)} /> : null}
      {settingsOpen ? (
        <SettingsDialog
          initialSection={settingsInitialSection}
          projectFilesPanelVisible={workspace.settings.projectFilesPanelVisible}
          revertSafeEditsEnabled={workspace.settings.revertSafeEditsEnabled}
          gpiUpdateDownloading={gpiUpdateDownloading}
          gpiUpdateInstallerReady={Boolean(gpiUpdateInstallerPath)}
          gpiUpdateMessage={gpiUpdateMessage}
          piInstallRunning={piInstallRunning}
          piUpdateMessage={piUpdateMessage}
          piUpdateRunning={piUpdateRunning}
          updateStatus={updateStatus}
          updateStatusLoading={updateStatusLoading}
          workflowInstallStatus={workflowInstallStatus}
          workflowPreview={workflowSkillPreview}
          workflowStatus={workflowSkillsStatus}
          onClose={() => setSettingsOpen(false)}
          onCloseWorkflowPreview={() => setWorkflowSkillPreview(undefined)}
          onInstallPi={() => void installPiFromSettings()}
          onInstallWorkflowSkills={() => void installWorkflowSkills()}
          onPreviewWorkflowSkill={(skillName) => void previewWorkflowSkill(skillName)}
          onProjectFilesPanelVisibleChange={(visible) => setWorkspace((current) => updateProjectFilesPanelVisibleSetting(current, visible))}
          onRefreshWorkflowSkills={() => void refreshSettingsStatus()}
          onRevertSafeEditsChange={(enabled) => setWorkspace((current) => updateRevertSafeEditsSetting(current, enabled))}
          onUpdateGpi={() => void updateGpiFromSettings()}
          onUpdatePi={() => void updatePiFromSettings()}
          onUpdateWorkflowSkills={() => void updateWorkflowSkills()}
        />
      ) : null}
      {workspaceLoaded && !workspace.settings.piInstallOnboardingSeen ? (
        <PiInstallOnboardingDialog onClose={() => setWorkspace((current) => markPiInstallOnboardingSeen(current))} />
      ) : null}
      {releaseNotesOpen && updateStatus ? (
        <ReleaseNotesDialog
          appVersion={updateStatus.appVersion}
          previousVersion={workspace.settings.lastSeenAppVersion}
          releaseNotes={releaseNotes ?? releaseNotesFromUpdateStatus(updateStatus)}
          onClose={() => {
            setWorkspace((current) => markAppVersionSeen(current, updateStatus.appVersion));
            setReleaseNotesOpen(false);
            setReleaseNotes(undefined);
          }}
        />
      ) : null}
      {workflowOnboardingOpen && workflowSkillsStatus ? (
        <WorkflowSkillsOnboarding
          installStatus={workflowInstallStatus}
          preview={workflowSkillPreview}
          status={workflowSkillsStatus}
          step={workflowOnboardingStep}
          onClose={() => {
            markPlanModeOnboardingSeen();
            setWorkflowOnboardingOpen(false);
          }}
          onInstall={() => void installWorkflowSkills()}
          onPreview={(skillName) => void previewWorkflowSkill(skillName)}
          onClosePreview={() => setWorkflowSkillPreview(undefined)}
          onSkip={() => {
            markPlanModeOnboardingSeen();
            setWorkflowOnboardingOpen(false);
          }}
          onStart={() => setWorkflowOnboardingStep("simulation")}
          onContinue={() => setWorkflowOnboardingStep("install")}
          onDone={() => {
            markPlanModeOnboardingSeen();
            setWorkflowOnboardingOpen(false);
          }}
        />
      ) : null}

      {!startupReady ? <StartupSplash error={bridgeError} workspaceLoaded={workspaceLoaded} updateStatusChecked={updateStatusChecked} workflowStatusChecked={workflowStatusChecked} /> : null}

      {quickSwitcherOpen ? (
        <QuickSwitcher
          activeIndex={quickSwitcherIndex}
          items={switcherItems}
          mode={quickSwitcherMode}
          query={quickSwitcherQuery}
          selectedProjectId={workspace.selectedProjectId}
          selectedSessionId={workspace.selectedSessionId}
          onActiveIndexChange={setQuickSwitcherIndex}
          onClose={closeQuickSwitcher}
          onQueryChange={setQuickSwitcherQuery}
          onSelect={selectQuickSwitcherItem}
        />
      ) : null}


    </main>
  );
}

type PaletteCommand = "add-project" | "finish-continuity" | "import-pi-sessions" | "initialize-continuity" | "install-workflow-skills" | "new-pi-session" | "next-attention" | "plan-continuity" | "restore-selected-session" | "start-continuity" | "take-plan-onboarding" | "toggle-archived";

type ConfirmDialogState = {
  title: string;
  body: string;
  confirmLabel: string;
  tone: "danger" | "neutral";
  onConfirm: () => void;
};

type RevertPreviewState = {
  snapshot: TurnSnapshotIndexEntry;
  manifest: TurnSnapshotManifest | undefined;
  error: string | undefined;
};

function RevertPreviewDialog(props: { preview: RevertPreviewState; onApply: () => void; onClose: () => void }) {
  const files = props.preview.manifest?.files ?? [];
  const grouped = groupSnapshotFiles(files);
  return (
    <div className="confirm-backdrop" onMouseDown={props.onClose}>
      <section className="confirm-dialog revert-preview-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div>
          <span className="confirm-eyebrow">Revert changes</span>
          <h2>Revert files to before this message?</h2>
          <p>GPi will restore the files captured before this turn. The next step will check for conflicts before changing anything.</p>
        </div>
        {props.preview.error ? <div className="thread-error-banner">Snapshot unavailable: {props.preview.error}</div> : null}
        {!props.preview.manifest && !props.preview.error ? <div className="revert-preview-empty">Loading snapshot…</div> : null}
        {props.preview.manifest ? (
          <div className="revert-preview-list">
            <span>{files.length.toString()} file{files.length === 1 ? "" : "s"} captured · {props.preview.manifest.captureErrors.length.toString()} capture error{props.preview.manifest.captureErrors.length === 1 ? "" : "s"}</span>
            {grouped.map((group) => (
              <div className="revert-preview-group" key={group.status}>
                <strong>{group.status}</strong>
                {group.files.map((file) => <code key={file.absolutePath}>{file.path}</code>)}
              </div>
            ))}
          </div>
        ) : null}
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={props.onClose} title="Cancel revert" type="button">Cancel</button>
          <button className="confirm-primary" disabled={!props.preview.manifest || Boolean(props.preview.error)} onClick={props.onApply} title="Apply conflict-checked revert" type="button">Revert changes</button>
        </div>
      </section>
    </div>
  );
}

function groupSnapshotFiles(files: TurnSnapshotManifest["files"]): Array<{ status: string; files: TurnSnapshotManifest["files"] }> {
  return ["modified", "created", "deleted"].map((status) => ({ status, files: files.filter((file) => file.status === status) })).filter((group) => group.files.length > 0);
}

function StartupSplash(props: { error: string | undefined; workspaceLoaded: boolean; updateStatusChecked: boolean; workflowStatusChecked: boolean }) {
  const phase = startupSplashPhase(props);
  return (
    <div className="startup-splash" aria-live="polite">
      <div className="startup-splash-card">
        <div className="startup-splash-mark">
          <img alt="GPi" src={gpiIconUrl} />
        </div>
        <div className="startup-splash-copy">
          <span>GPi</span>
          <strong>Glass cockpit for Pi</strong>
          <small>{phase}</small>
        </div>
        <div className="startup-splash-loader" aria-hidden="true"><span /></div>
        {props.error ? <div className="startup-splash-error">{props.error}</div> : null}
      </div>
    </div>
  );
}

function startupSplashPhase(props: { error: string | undefined; workspaceLoaded: boolean; updateStatusChecked: boolean; workflowStatusChecked: boolean }): string {
  if (props.error) return "Startup warning";
  if (!props.workspaceLoaded) return "Loading workspace...";
  if (!props.workflowStatusChecked) return "Checking continuity skills...";
  if (!props.updateStatusChecked) return "Checking updates...";
  return "Ready";
}

const ProjectFilesPanel = memo(function ProjectFilesPanel(props: { error: string | undefined; listing: GpiProjectFileListing | undefined; loading: boolean; onFileClick: (path: string) => void; onRefresh: () => void }) {
  const entries = props.listing?.entries ?? [];
  const initializedProjectId = useRef<string | undefined>(undefined);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(new Set());
  const visibleEntries = useMemo(() => visibleProjectFileEntries(entries, expandedDirectories).slice(0, 450), [entries, expandedDirectories]);

  useEffect(() => {
    if (!props.listing || initializedProjectId.current === props.listing.projectId) return;
    initializedProjectId.current = props.listing.projectId;
    setExpandedDirectories(new Set(entries.filter((entry) => entry.kind === "directory").map((entry) => entry.path)));
  }, [entries, props.listing]);

  function toggleDirectory(path: string): void {
    setExpandedDirectories((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  if (collapsed) {
    return (
      <aside className="project-files-panel collapsed">
        <button className="project-files-collapse-button" onClick={() => setCollapsed(false)} title="Open project files" type="button" aria-label="Open project files">
          <span aria-hidden="true" />
        </button>
      </aside>
    );
  }
  return (
    <aside className="project-files-panel">
      <div className="project-files-header">
        <div>
          <span className="eyebrow">Project files</span>
          <strong>{props.loading ? "Loading..." : `${entries.length.toString()} entries`}</strong>
        </div>
        <div className="project-files-header-actions">
          <button onClick={props.onRefresh} title="Refresh project files" type="button">Refresh</button>
          <button onClick={() => setCollapsed(true)} title="Collapse project files" type="button">Hide</button>
        </div>
      </div>
      {props.error ? <div className="project-files-error">{props.error}</div> : null}
      {props.listing?.truncated ? <div className="project-files-warning">Project list was truncated at {props.listing.maxEntries.toString()} entries.</div> : null}
      {entries.length > visibleEntries.length ? <div className="project-files-warning">Showing {visibleEntries.length.toString()} of {entries.length.toString()} entries. Type @ to search all files.</div> : null}
      <div className="project-files-list">
        {entries.length === 0 && !props.loading ? <div className="project-files-empty">No project files found.</div> : null}
        {visibleEntries.map((entry) => (
          <button
            className={`project-file-row kind-${entry.kind}`}
            key={entry.path}
            onClick={() => entry.kind === "directory" ? toggleDirectory(entry.path) : props.onFileClick(entry.path)}
            style={{ paddingLeft: `${(10 + Math.min(entry.depth, 8) * 9).toString()}px` }}
            title={entry.kind === "file" ? `Insert @${entry.path}` : entry.path}
            type="button"
          >
            <span className={entry.kind === "directory" && !expandedDirectories.has(entry.path) ? "project-file-chevron collapsed" : entry.kind === "directory" ? "project-file-chevron" : "project-file-spacer"} aria-hidden="true" />
            <small>{entry.name}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}, (previous, next) => previous.error === next.error && previous.loading === next.loading && previous.listing === next.listing);

function visibleProjectFileEntries(entries: GpiProjectFileEntry[], expandedDirectories: Set<string>): GpiProjectFileEntry[] {
  return entries.filter((entry) => {
    const ancestors = projectPathAncestors(entry.path);
    return ancestors.every((ancestor) => expandedDirectories.has(ancestor));
  });
}

function projectPathAncestors(path: string): string[] {
  const parts = path.split("/");
  if (parts.length <= 1) return [];
  const ancestors: string[] = [];
  for (let index = 1; index < parts.length; index += 1) {
    ancestors.push(parts.slice(0, index).join("/"));
  }
  return ancestors;
}

type PiInstallTab = "curl" | "npm" | "pnpm" | "bun";

const PI_INSTALL_COMMANDS: Record<PiInstallTab, { label: string; command: string }> = {
  curl: { label: "CURL", command: "curl -fsSL https://pi.dev/install.sh | sh" },
  npm: { label: "NPM", command: "npm install -g @earendil-works/pi-coding-agent" },
  pnpm: { label: "PNPM", command: "pnpm add -g @earendil-works/pi-coding-agent" },
  bun: { label: "BUN", command: "bun add -g @earendil-works/pi-coding-agent" },
};

function ReleaseNotesDialog(props: { appVersion: string; previousVersion: string | undefined; releaseNotes: GpiReleaseNotes | undefined; onClose: () => void }) {
  const body = props.releaseNotes?.body?.trim();
  return (
    <div className="confirm-backdrop pi-install-backdrop" onMouseDown={props.onClose}>
      <section className="pi-install-dialog release-notes-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="pi-install-heading">
          <span className="confirm-eyebrow">GPi updated</span>
          <h2>{props.releaseNotes?.name ?? `Version ${props.appVersion}`}</h2>
          <p>{props.previousVersion ? `Updated from ${props.previousVersion}.` : "GPi has been updated."} Review the latest changes before continuing.</p>
        </div>
        {body ? (
          <pre className="release-notes-markdown">{body}</pre>
        ) : (
          <div className="release-notes-list">
            <span>GPi was updated. Release notes are unavailable locally.</span>
            <span>Check the GitHub release page for the full changelog.</span>
          </div>
        )}
        {props.releaseNotes?.releaseUrl ? <a className="release-notes-link" href={props.releaseNotes.releaseUrl} rel="noreferrer" target="_blank">Open GitHub release</a> : null}
        <div className="confirm-actions">
          <button className="confirm-primary" onClick={props.onClose} title="Continue to GPi" type="button">Continue</button>
        </div>
      </section>
    </div>
  );
}

function releaseNotesFromUpdateStatus(status: GpiUpdateStatus): GpiReleaseNotes | undefined {
  if (status.appVersion !== status.latestAppVersion) return undefined;
  if (!status.appReleaseBody && !status.appReleaseUrl && !status.appReleaseName) return undefined;
  return {
    version: status.appVersion,
    name: status.appReleaseName,
    body: status.appReleaseBody,
    releaseUrl: status.appReleaseUrl,
    source: "github",
  };
}

function PiInstallOnboardingDialog(props: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<PiInstallTab>("curl");
  const active = PI_INSTALL_COMMANDS[activeTab];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      props.onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  return (
    <div className="confirm-backdrop pi-install-backdrop" onMouseDown={props.onClose}>
      <section className="pi-install-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="pi-install-heading">
          <span className="confirm-eyebrow">Pi.dev required</span>
          <h2>Install Pi before using GPi</h2>
          <p>GPi is a local GUI for Pi.dev. If Pi is not installed yet, use one of the official install commands below.</p>
          <a href="https://pi.dev/" rel="noreferrer" target="_blank">https://pi.dev/</a>
        </div>
        <div className="pi-install-tabs" role="tablist" aria-label="Pi install methods">
          {(Object.keys(PI_INSTALL_COMMANDS) as PiInstallTab[]).map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "active" : ""}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {PI_INSTALL_COMMANDS[tab].label}
            </button>
          ))}
        </div>
        <div className="pi-install-command-card">
          <div>
            <span>{active.label}</span>
            <MessageCopyButton label="Copy" text={active.command} />
          </div>
          <code>{active.command}</code>
        </div>
        <div className="confirm-actions">
          <button className="confirm-primary" onClick={props.onClose} title="Continue to GPi" type="button">Continue</button>
        </div>
      </section>
    </div>
  );
}

function ProjectContextBadge(props: { context: GpiProjectContext | undefined; error: string | undefined; loading: boolean; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const tone = projectContextTone(props.context, props.error);
  const label = projectContextLabel(props.context, props.error, props.loading);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      setOpen(false);
      setPinned(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="project-context-anchor" onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned) setOpen(false); }}>
      <button
        aria-label={`Project git status: ${label}`}
        className={`project-context-badge tone-${tone}`}
        onClick={() => {
          setOpen((current) => !current || !pinned);
          setPinned((current) => !current);
        }}
        type="button"
      >
        <img alt="" className="project-context-git-icon" src={gitIconUrl} />
      </button>
      {open ? <ProjectContextPopover context={props.context} error={props.error} loading={props.loading} /> : null}
    </div>
  );
}

function ProjectContextPopover(props: { context: GpiProjectContext | undefined; error: string | undefined; loading: boolean }) {
  const git = props.context?.git;
  return (
    <div className="project-context-popover">
      <div className="project-context-popover-head">
        <span>Project context</span>
        <small>{props.loading ? "Updating..." : "Auto-updated"}</small>
      </div>
      {props.error ? <div className="project-context-warning">{props.error}</div> : null}
      {git ? (
        <>
          <div className="project-context-section">
            <strong>Git</strong>
            <span>{git.isRepo ? `${git.branch ?? "detached"}${git.clean ? " · clean" : " · changed"}` : "No git repository"}</span>
          </div>
          {git.error ? <div className="project-context-warning">{git.error}</div> : null}
          {git.isRepo ? (
            <>
              <div className="project-context-grid">
                <span>Upstream</span><strong>{git.upstream ?? "Not configured"}</strong>
                <span>Remote</span><strong>↑ {git.ahead.toString()} · ↓ {git.behind.toString()}</strong>
                <span>Staged</span><strong>{git.staged.toString()}</strong>
                <span>Modified</span><strong>{git.modified.toString()}</strong>
                <span>Deleted</span><strong>{git.deleted.toString()}</strong>
                <span>Untracked</span><strong>{git.untracked.toString()}</strong>
                <span>Conflicts</span><strong>{git.conflicted.toString()}</strong>
              </div>
              {git.lastCommit ? <div className="project-context-commit"><span>{git.lastCommit.hash}</span><strong>{git.lastCommit.message}</strong><small>{git.lastCommit.author}</small></div> : null}
            </>
          ) : null}
        </>
      ) : <div className="project-context-section"><strong>Git</strong><span>{props.loading ? "Checking..." : "Not loaded"}</span></div>}
      <div className="project-context-section project-context-files">
        <strong>Context files</strong>
        <span className={props.context?.files.agentsMd ? "present" : "missing"}>AGENTS.md {props.context?.files.agentsMd ? "found" : "missing"}</span>
        <span className={props.context?.files.readme ? "present" : "missing"}>{props.context?.files.readmePath ?? "README missing"}</span>
        <span className={props.context?.files.piSettings ? "present" : "missing"}>.pi/settings.json {props.context?.files.piSettings ? "found" : "missing"}</span>
      </div>
    </div>
  );
}

function projectContextTone(context: GpiProjectContext | undefined, error: string | undefined): "clean" | "detached" | "dirty" | "error" | "missing" | "sync" {
  if (error || context?.git.error || context?.git.conflicted) return "error";
  if (!context || !context.git.isRepo) return "missing";
  if (context.git.detached) return "detached";
  if (!context.git.clean) return "dirty";
  if (context.git.ahead > 0 || context.git.behind > 0) return "sync";
  return "clean";
}

function projectContextLabel(context: GpiProjectContext | undefined, error: string | undefined, loading: boolean): string {
  if (loading && !context) return "git...";
  if (error) return "git error";
  if (!context?.git.isRepo) return "no git";
  const branch = context.git.branch ?? "detached";
  if (context.git.conflicted > 0) return `${branch} !`;
  if (!context.git.clean) return `${branch} *`;
  if (context.git.ahead > 0 || context.git.behind > 0) return `${branch} ↑${context.git.ahead.toString()} ↓${context.git.behind.toString()}`;
  return branch;
}

function ImagePreviewDialog(props: { image: GpiImageAttachment; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      props.onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  return (
    <div className="image-preview-backdrop" onMouseDown={props.onClose}>
      <div className="image-preview-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <button className="image-preview-close" onClick={props.onClose} title="Close image preview" type="button">×</button>
        <img alt={props.image.name} src={props.image.previewDataUrl} />
        <div className="image-preview-caption">{props.image.name}</div>
      </div>
    </div>
  );
}

function SettingsDialog(props: {
  initialSection: SettingsSection;
  projectFilesPanelVisible: boolean;
  revertSafeEditsEnabled: boolean;
  gpiUpdateDownloading: boolean;
  gpiUpdateInstallerReady: boolean;
  gpiUpdateMessage: string | undefined;
  piInstallRunning: boolean;
  piUpdateMessage: string | undefined;
  piUpdateRunning: boolean;
  updateStatus: GpiUpdateStatus | undefined;
  updateStatusLoading: boolean;
  workflowInstallStatus: string | undefined;
  workflowPreview: { name: WorkflowSkillName; text: string } | undefined;
  workflowStatus: WorkflowSkillsStatus | undefined;
  onClose: () => void;
  onCloseWorkflowPreview: () => void;
  onInstallPi: () => void;
  onInstallWorkflowSkills: () => void;
  onPreviewWorkflowSkill: (skillName: WorkflowSkillName) => void;
  onProjectFilesPanelVisibleChange: (visible: boolean) => void;
  onRefreshWorkflowSkills: () => void;
  onRevertSafeEditsChange: (enabled: boolean) => void;
  onUpdateGpi: () => void;
  onUpdatePi: () => void;
  onUpdateWorkflowSkills: () => void;
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(props.initialSection);
  const missingCount = props.workflowStatus?.skills.filter((skill) => skill.status === "missing").length ?? 0;
  const conflictCount = props.workflowStatus?.skills.filter((skill) => skill.status === "conflict").length ?? 0;
  const allInstalled = Boolean(props.workflowStatus && props.workflowStatus.skills.every((skill) => skill.status === "installed"));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      props.onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  return (
    <div className="settings-backdrop" onMouseDown={props.onClose}>
      <section className="settings-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <aside className="thread-sidebar settings-sidebar" aria-label="Settings sections">
          <div className="sidebar-header drag-region">
            <div className="brand-lockup">
              <span className="brand-glyph">G</span>
              <div>
                <strong>GPi</strong>
                <small>Pi agent workspace</small>
              </div>
            </div>
          </div>

          <div className="sidebar-command-bar clean settings-back-bar">
            <button aria-label="Back to chat" className="sidebar-search-command settings-back-command" onClick={props.onClose} title="Back to chat" type="button">
              <span>Back to chat</span>
              <kbd>Esc</kbd>
            </button>
          </div>

          <div className="session-list settings-sidebar-nav">
            <button className={activeSection === "revert" ? "session-row selected settings-section-row" : "session-row settings-section-row"} onClick={() => setActiveSection("revert")} type="button">
              <span />
              <span className="session-copy"><strong>Revert</strong><small>Prompt policy and snapshots</small></span>
              <span className="session-meta-stack" />
            </button>
            <button className={activeSection === "interface" ? "session-row selected settings-section-row" : "session-row settings-section-row"} onClick={() => setActiveSection("interface")} type="button">
              <span />
              <span className="session-copy"><strong>Interface</strong><small>Panels and UI toggles</small></span>
              <span className="session-meta-stack" />
            </button>
            <button className={activeSection === "onboarding" ? "session-row selected settings-section-row" : "session-row settings-section-row"} onClick={() => setActiveSection("onboarding")} type="button">
              <span />
              <span className="session-copy"><strong>Onboarding</strong><small>Continuity skills</small></span>
              <span className="session-meta-stack" />
            </button>
            <button className={activeSection === "runtime" ? "session-row selected settings-section-row" : "session-row settings-section-row"} onClick={() => setActiveSection("runtime")} type="button">
              <span />
              <span className="session-copy"><strong>Runtime</strong><small>Pi install and PATH</small></span>
              <span className="session-meta-stack" />
            </button>
            <button className={activeSection === "updates" ? "session-row selected settings-section-row" : "session-row settings-section-row"} onClick={() => setActiveSection("updates")} type="button">
              <span />
              <span className="session-copy"><strong>Updates</strong><small>GPi and Pi.dev</small></span>
              <span className="session-meta-stack" />
            </button>
          </div>
        </aside>

        <section className="chat-workspace settings-workspace">
          <header className="chat-header settings-header drag-region">
            <div className="chat-title-block">
              <div className="chat-kicker">
                <span>{settingsSectionTitle(activeSection)}</span>
                <span className="path-chip">Settings</span>
              </div>
              <h1>{settingsSectionSubtitle(activeSection)}</h1>
            </div>
            <WindowControls hideSettings />
          </header>

          <div className="settings-panel">
            {activeSection === "runtime" ? (
              <section className="settings-card">
                <div className="settings-card-heading">
                  <span>Runtime</span>
                  <strong>Pi install and PATH</strong>
                </div>
                <p>GPi uses the official Pi CLI. Missing runtimes can be installed with npm or pnpm, but installs only run when you click the button below. If Windows cannot see a new global install immediately, close and reopen GPi so PATH is refreshed.</p>
                <div className="settings-status-list">
                  <span><strong>Pi CLI</strong><small>{formatRuntimeCommandStatus(props.updateStatus?.piRuntime.pi, props.updateStatusLoading)}</small></span>
                  <span><strong>pnpm</strong><small>{formatRuntimeCommandStatus(props.updateStatus?.piRuntime.pnpm, props.updateStatusLoading)}</small></span>
                  <span><strong>npm</strong><small>{formatRuntimeCommandStatus(props.updateStatus?.piRuntime.npm, props.updateStatusLoading)}</small></span>
                  <span><strong>Preferred install</strong><small>{props.updateStatus?.piRuntime.installCommand ?? props.updateStatus?.piRuntime.missingPackageManagerMessage ?? "Not checked yet."}</small></span>
                </div>
                {props.piUpdateMessage ? <div className="settings-inline-warning">{props.piUpdateMessage}</div> : null}
                <div className="settings-update-actions">
                  <button className="settings-secondary-button" onClick={props.onRefreshWorkflowSkills} title="Refresh runtime status" type="button">{props.updateStatusLoading ? "Looking..." : "Refresh Runtime"}</button>
                  {props.updateStatus && !props.updateStatus.piRuntime.pi.available && props.updateStatus.piRuntime.installable ? (
                    <button className="settings-primary-button" disabled={props.piInstallRunning} onClick={props.onInstallPi} title={`Run ${props.updateStatus.piRuntime.installCommand ?? "official Pi install"}`} type="button">{props.piInstallRunning ? "Installing Pi..." : "Install Pi"}</button>
                  ) : null}
                  {props.updateStatus?.piUpdateAvailable ? (
                    <button className="settings-primary-button" disabled={props.piUpdateRunning} onClick={props.onUpdatePi} title="Run pi update" type="button">{props.piUpdateRunning ? "Updating Pi..." : "Update Pi"}</button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {activeSection === "updates" ? (
              <section className="settings-card">
                <div className="settings-card-heading">
                  <span>Updates</span>
                  <strong>GPi and Pi.dev</strong>
                </div>
                <p>GPi checks GitHub releases for app updates. Pi runtime install/update status lives in Runtime so app updates and CLI runtime management stay separate.</p>
                <div className="settings-status-list">
                  <span><strong>GPi</strong><small>{formatGpiUpdateStatus(props.updateStatus, props.updateStatusLoading)}</small></span>
                  <span>
                    <strong>Pi runtime</strong>
                    <small>{formatPiUpdateStatus(props.updateStatus, props.updateStatusLoading)}</small>
                  </span>
                </div>
                {props.updateStatus?.error && !props.updateStatus.installedPiVersion ? <div className="settings-inline-warning">{props.updateStatus.error}</div> : null}
                {props.gpiUpdateMessage ? <div className="settings-inline-warning">{props.gpiUpdateMessage}</div> : null}
                <div className="settings-update-actions">
                  <button className="settings-secondary-button" onClick={props.onRefreshWorkflowSkills} title="Check GPi/Pi versions and update availability" type="button">{props.updateStatusLoading ? "Looking..." : "Look for Updates"}</button>
                  {props.updateStatus?.appUpdateAvailable && (props.updateStatus.appInstallerUrl || props.updateStatus.appReleaseUrl) ? (
                    <button className="settings-primary-button" disabled={props.gpiUpdateDownloading} onClick={props.onUpdateGpi} title={props.gpiUpdateInstallerReady ? "Close GPi and run the downloaded installer" : "Download the latest GPi installer"} type="button">
                      {props.gpiUpdateDownloading ? "Downloading..." : props.gpiUpdateInstallerReady ? "Install Update" : "Update GPi"}
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {activeSection === "interface" ? (
              <section className="settings-card">
                <div className="settings-card-heading">
                  <span>Interface</span>
                  <strong>Workspace panels</strong>
                </div>
                <p>Control optional UI surfaces in the workspace. Future interface toggles will live here.</p>
                <label className="settings-toggle-row">
                  <span><strong>Project file tree</strong><small>Show the read-only project file panel used for file mentions.</small></span>
                  <button className={props.projectFilesPanelVisible ? "settings-toggle active" : "settings-toggle"} onClick={() => props.onProjectFilesPanelVisibleChange(!props.projectFilesPanelVisible)} type="button">{props.projectFilesPanelVisible ? "On" : "Off"}</button>
                </label>
              </section>
            ) : null}

            {activeSection === "revert" ? (
              <section className="settings-card">
                <div className="settings-card-heading">
                  <span>Revert</span>
                  <strong>How message revert works</strong>
                </div>
                <p>When `Revert-safe` is enabled, GPi keeps your original message visible but sends Pi an added instruction prefix asking it to prefer read/edit/write tools and to declare file paths before shell mutations.</p>
                <p>GPi captures before/after file snapshots outside the workspace file under `%APPDATA%/gpi/snapshots`. The `Revert changes` button restores the files for that message only after checking current hashes for conflicts.</p>
                <label className="settings-toggle-row">
                  <span><strong>Revert-safe prompt policy</strong><small>Inject helper instructions for safer snapshots. Original prompt remains visible.</small></span>
                  <button className={props.revertSafeEditsEnabled ? "settings-toggle active" : "settings-toggle"} onClick={() => props.onRevertSafeEditsChange(!props.revertSafeEditsEnabled)} type="button">{props.revertSafeEditsEnabled ? "On" : "Off"}</button>
                </label>
                <div className="settings-code-block">
                  <div>
                    <strong>Injected prompt prefix</strong>
                    <small>This is prepended only when Revert-safe is on. Your visible message stays unchanged.</small>
                  </div>
                  <pre>{REVERT_SAFE_PROMPT_PREFIX}</pre>
                </div>
              </section>
            ) : null}

            {activeSection === "onboarding" ? (
              <section className="settings-card">
                <div className="settings-card-heading">
                  <span>Onboarding</span>
                  <strong>Continuity skills</strong>
                </div>
                <p>These bundled skills power Initialize, Plan, Start, and End. Plan can be used before execution to create the queue, and after some work has already happened to refine or add tasks before continuing with Start. GPi checks whether each skill is installed, missing, or differs from the bundled copy.</p>
                <div className="workflow-skill-list settings-skill-list">
                  {props.workflowStatus ? props.workflowStatus.skills.map((skill) => (
                    <div className={`workflow-skill-row ${skill.status}`} key={skill.name}>
                      <div>
                        <strong>{skill.name}</strong>
                        <small>{skill.status === "installed" ? "Installed" : skill.status === "conflict" ? "Diff available: installed skill differs from GPi bundle" : "Missing"}</small>
                      </div>
                      <button
                        onClick={() => props.workflowPreview?.name === skill.name ? props.onCloseWorkflowPreview() : props.onPreviewWorkflowSkill(skill.name)}
                        title={props.workflowPreview?.name === skill.name ? `Close ${skill.name} preview` : `Preview ${skill.name} skill text`}
                        type="button"
                      >
                        {props.workflowPreview?.name === skill.name ? "Close preview" : "View text"}
                      </button>
                    </div>
                  )) : <div className="revert-preview-empty">Skill status not loaded yet.</div>}
                </div>
                {props.workflowPreview ? (
                  <div className="workflow-skill-preview">
                    <div>
                      <strong>{props.workflowPreview.name}</strong>
                    </div>
                    <pre>{props.workflowPreview.text}</pre>
                  </div>
                ) : null}
                <footer className="settings-footer-row">
                  <span>{props.workflowInstallStatus ?? (props.workflowStatus ? `${missingCount.toString()} missing · ${conflictCount.toString()} conflicts · ${props.workflowStatus.skillsDirectory}` : "Refresh to inspect installed skills")}</span>
                  <div>
                    <button className="settings-secondary-button" onClick={props.onRefreshWorkflowSkills} type="button">Refresh</button>
                    <button className="settings-secondary-button" disabled={conflictCount === 0 && missingCount === 0} onClick={props.onUpdateWorkflowSkills} title="Replace missing/conflicting skills with GPi bundled versions" type="button">Update bundled skills</button>
                    <button className="settings-primary-button" disabled={allInstalled || missingCount === 0} onClick={props.onInstallWorkflowSkills} type="button">Install missing</button>
                  </div>
                </footer>
              </section>
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}

function formatGpiUpdateStatus(status: GpiUpdateStatus | undefined, loading: boolean): string {
  if (loading && !status) return "Checking GitHub releases...";
  if (!status) return "Version status not loaded yet.";
  const latest = status.latestAppVersion ? `latest ${status.latestAppVersion}` : "latest unknown";
  const update = status.appUpdateAvailable === true ? "update available" : status.appUpdateAvailable === false ? "up to date" : "update status unknown";
  return `installed ${status.appVersion} · ${latest} · ${update}`;
}

function formatPiUpdateStatus(status: GpiUpdateStatus | undefined, loading: boolean): string {
  if (loading && !status) return "Checking installed and latest versions...";
  if (!status) return "Version status not loaded yet.";
  const installed = status.piRuntime.pi.available
    ? `installed ${status.installedPiVersion ?? status.piRuntime.pi.version ?? "unknown"}`
    : "Pi CLI missing";
  const latest = status.latestPiVersion ? `latest ${status.latestPiVersion}` : "latest unknown";
  const update = status.piUpdateAvailable === true ? "update available" : status.piUpdateAvailable === false ? "up to date" : "update status unknown";
  const install = status.piRuntime.installCommand ? `install: ${status.piRuntime.installCommand}` : status.piRuntime.missingPackageManagerMessage ?? "not installable";
  return `${status.piPackageName} · ${installed} · ${latest} · ${update} · ${status.piUpdateCommand} · ${install}`;
}

type SettingsSection = "interface" | "onboarding" | "revert" | "runtime" | "updates";

type RuntimeCommandStatus = GpiUpdateStatus["piRuntime"]["pi"];

function formatRuntimeCommandStatus(status: RuntimeCommandStatus | undefined, loading: boolean): string {
  if (loading && !status) return "Checking PATH...";
  if (!status) return "Not checked yet.";
  if (!status.available) return status.error ?? "Not found on PATH.";
  const version = status.version ? ` · ${status.version}` : "";
  return `${status.executablePath ?? "available"}${version}`;
}

function settingsSectionTitle(section: SettingsSection): string {
  if (section === "interface") return "Interface";
  if (section === "onboarding") return "Onboarding";
  if (section === "runtime") return "Runtime";
  if (section === "updates") return "Updates";
  return "Revert";
}

function settingsSectionSubtitle(section: SettingsSection): string {
  if (section === "interface") return "Panels and UI toggles";
  if (section === "onboarding") return "Continuity skills and updates";
  if (section === "runtime") return "Pi install, package managers, and PATH";
  if (section === "updates") return "GPi and Pi.dev local status";
  return "Message revert and prompt injection";
}

function ConfirmDialog(props: { dialog: ConfirmDialogState; onClose: () => void }) {
  return (
    <div className="confirm-backdrop" onMouseDown={props.onClose}>
      <section className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div>
          <span className="confirm-eyebrow">Confirm action</span>
          <h2>{props.dialog.title}</h2>
          <p>{props.dialog.body}</p>
        </div>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={props.onClose} title="Cancel this action" type="button">Cancel</button>
          <button
            className={props.dialog.tone === "danger" ? "confirm-danger" : "confirm-primary"}
            onClick={() => {
              props.dialog.onConfirm();
              props.onClose();
            }}
            title={props.dialog.confirmLabel}
            type="button"
          >
            {props.dialog.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function WorkflowSkillsOnboarding(props: {
  installStatus: string | undefined;
  preview: { name: WorkflowSkillName; text: string } | undefined;
  status: WorkflowSkillsStatus;
  step: "install" | "intro" | "simulation";
  onClose: () => void;
  onInstall: () => void;
  onPreview: (skillName: WorkflowSkillName) => void;
  onClosePreview: () => void;
  onSkip: () => void;
  onStart: () => void;
  onContinue: () => void;
  onDone: () => void;
}) {
  const missingCount = props.status.skills.filter((skill) => skill.status === "missing").length;
  const conflictCount = props.status.skills.filter((skill) => skill.status === "conflict").length;
  const allInstalled = props.status.skills.every((skill) => skill.status === "installed");
  return (
    <div className="workflow-onboarding-backdrop" onMouseDown={props.onClose}>
      <section className="workflow-onboarding" onMouseDown={(event) => event.stopPropagation()}>
        {props.step === "intro" ? (
          <>
            <header>
              <span className="eyebrow">Plan Mode</span>
              <h2>Take the guided Plan Mode tour?</h2>
              <p>GPi includes a curated bundle of Pi skills that adds Continuity Mode: a guided planning workflow for long-running work, built by GPi and executed by Pi.</p>
            </header>
            <div className="workflow-simulation-list">
              <WorkflowSimulationStep title="No sticky modes" body="Plan Mode is not a second harness. Each action sends one visible Pi command once, then the composer goes back to normal." command="Ask normally → Initialize → Plan → Start → End" />
              <WorkflowSimulationStep title="Skills are transparent" body="Before installing anything, GPi lets you inspect the exact skill text that will be copied into your Pi skills folder." command="View text before install" />
            </div>
            <footer>
              <span>You can skip this and use GPi normally.</span>
              <div>
                <button onClick={props.onSkip} title="Skip workflow onboarding" type="button">Skip</button>
                <button onClick={props.onStart} title="Start Plan Mode onboarding" type="button">Start onboarding</button>
              </div>
            </footer>
          </>
        ) : null}
        {props.step === "install" ? (
          <>
            <header>
              <span className="eyebrow">Plan Mode setup</span>
              <h2>Install guided continuity skills</h2>
              <p>GPi recommends these Pi skills for the best Plan Mode experience. You can inspect every skill before installing; GPi will not overwrite conflicts silently.</p>
            </header>
            <div className="workflow-skill-list">
              {props.status.skills.map((skill) => (
                <div className={`workflow-skill-row ${skill.status}`} key={skill.name}>
                  <div>
                    <strong>{skill.name}</strong>
                    <small>{skill.status === "installed" ? "Installed" : skill.status === "conflict" ? "Conflict: existing skill differs" : "Missing"}</small>
                  </div>
                  <button onClick={() => props.onPreview(skill.name)} title={`Preview ${skill.name} skill text`} type="button">View text</button>
                </div>
              ))}
            </div>
            {props.preview ? (
              <div className="workflow-skill-preview">
                <div>
                  <strong>{props.preview.name}</strong>
                  <button onClick={props.onClosePreview} title="Close skill preview" type="button">Close preview</button>
                </div>
                <pre>{props.preview.text}</pre>
              </div>
            ) : null}
            <footer>
              <span>{props.installStatus ?? `${missingCount.toString()} missing · ${conflictCount.toString()} conflicts · ${props.status.skillsDirectory}`}</span>
              <div>
                <button onClick={props.onSkip} title="Skip skill installation" type="button">Skip</button>
                {allInstalled ? <button onClick={props.onDone} title="Close onboarding" type="button">Done</button> : <button disabled={missingCount === 0} onClick={props.onInstall} title="Install missing GPi workflow skills" type="button">Install missing skills</button>}
              </div>
            </footer>
          </>
        ) : null}
        {props.step === "simulation" ? (
          <>
            <header>
              <span className="eyebrow">Plan Mode tour</span>
              <h2>How to use Plan Mode</h2>
              <p>This is a simulation of the flow. The real buttons send visible one-shot commands to Pi.</p>
            </header>
            <div className="workflow-simulation-list">
              <WorkflowSimulationStep title="1. Before Initialize" body="Talk normally with Pi until the goal is clear. Use Send, not the workflow button." command="Normal chat" />
              <WorkflowSimulationStep title="2. Initialize" body="When the goal is ready, click Initialize. It is a discrete action that initializes the continuity skill directly." command="Initialize" />
              <WorkflowSimulationStep title="3. Refine before Plan" body="Discuss corrections, constraints, and edge cases. Nothing is sticky; normal prompts remain normal." command="Send refinements normally" />
              <WorkflowSimulationStep title="4. Plan" body="Click Plan to ask Pi to turn the initialized goal into an executable queue." command="Plan → /plan-cont" />
              <WorkflowSimulationStep title="5. Review the plan" body="Read the queue, ask for changes if needed, then click Plan again when you want another planning pass." command="Optional Plan refinement" />
              <WorkflowSimulationStep title="6. Start" body="Click Start when the queue looks right. If no work has started, Start is the only execution action you need." command="Start → /start-cont" />
              <WorkflowSimulationStep title="7. Refine after work starts" body="After at least one task has been worked, GPi shows both Plan and Start: Plan adds/refines tasks, Start continues execution." command="Plan or Start" />
              <WorkflowSimulationStep title="8. End" body="When the session is complete, click End. GPi closes the continuity loop and archives the session state." command="End" />
            </div>
            <footer>
              <span>Last step: review the bundled skills and choose whether to install them.</span>
              <div>
                <button onClick={props.onSkip} title="Skip installing bundled workflow skills" type="button">Skip install</button>
                <button onClick={props.onContinue} title="Review bundled workflow skills" type="button">Review skills</button>
              </div>
            </footer>
          </>
        ) : null}
      </section>
    </div>
  );
}

function WorkflowSimulationStep(props: { title: string; body: string; command: string }) {
  return (
    <div className="workflow-simulation-step">
      <div>
        <strong>{props.title}</strong>
        <p>{props.body}</p>
      </div>
      <code>{props.command}</code>
    </div>
  );
}

type QuickSwitcherItem =
  | { kind: "command"; id: string; command: PaletteCommand; label: string; meta: string }
  | { kind: "project"; id: string; project: GpiProject; label: string; meta: string }
  | { kind: "session"; id: string; session: GpiSessionSummary; project: GpiProject | undefined; label: string; meta: string };

function QuickSwitcher(props: {
  activeIndex: number;
  items: QuickSwitcherItem[];
  mode: "commands" | "switcher";
  query: string;
  selectedProjectId: string;
  selectedSessionId: string;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (item: QuickSwitcherItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItem = props.items[props.activeIndex];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent): void {
    if (matchesKeyBinding(event, DEFAULT_APP_KEYBINDINGS.closeQuickSwitcher)) {
      event.preventDefault();
      props.onClose();
    }
    if (matchesKeyBinding(event, DEFAULT_APP_KEYBINDINGS.quickSwitcherPrevious)) {
      event.preventDefault();
      props.onActiveIndexChange(previousIndex(props.activeIndex, props.items.length));
    }
    if (matchesKeyBinding(event, DEFAULT_APP_KEYBINDINGS.quickSwitcherNext)) {
      event.preventDefault();
      props.onActiveIndexChange(nextIndex(props.activeIndex, props.items.length));
    }
    if (matchesKeyBinding(event, DEFAULT_APP_KEYBINDINGS.chooseQuickSwitcherItem) && activeItem) {
      event.preventDefault();
      props.onSelect(activeItem);
    }
  }

  return (
    <div className="quick-switcher-backdrop" onMouseDown={props.onClose}>
      <section className="quick-switcher" onKeyDown={handleKeyDown} onMouseDown={(event) => event.stopPropagation()}>
        <div className="quick-switcher-input-row">
          <input
            ref={inputRef}
            aria-label={props.mode === "commands" ? "Command palette" : "Quick switch sessions and projects"}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder={props.mode === "commands" ? "Run a command..." : "Switch to project or session..."}
            value={props.query}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="quick-switcher-results">
          {props.items.length === 0 ? <div className="quick-switcher-empty">No matching sessions or projects.</div> : null}
          {props.items.map((item, index) => {
            const selected = isCurrentQuickSwitcherItem(item, props.selectedProjectId, props.selectedSessionId);
            return (
              <button
                className={index === props.activeIndex ? "quick-switcher-item active" : "quick-switcher-item"}
                key={item.id}
                onMouseEnter={() => props.onActiveIndexChange(index)}
                onClick={() => props.onSelect(item)}
                title={`${item.label} · ${item.meta}`}
                type="button"
              >
                <span className={`quick-switcher-kind ${item.kind}`}>{quickSwitcherKindLabel(item)}</span>
                <span className="quick-switcher-copy">
                  <strong>{item.label}</strong>
                  <small>{item.meta}</small>
                </span>
                {selected ? <span className="quick-switcher-selected">Current</span> : null}
              </button>
            );
          })}
        </div>
        <div className="quick-switcher-help">
          <span>↑↓ move</span>
          <span>Enter open</span>
          <span>{props.mode === "commands" ? "Ctrl K commands" : "Ctrl P switch"}</span>
        </div>
      </section>
    </div>
  );
}

function isMissingSessionFileError(message: string): boolean {
  return message.includes("ENOENT") || message.toLowerCase().includes("no such file or directory");
}

function markSessionSidebarActivity(workspace: ReturnType<typeof hydrateWorkspace>, sessionId: string, lastActivity: string, status: SessionStatus): ReturnType<typeof hydrateWorkspace> {
  return {
    ...workspace,
    sessions: workspace.sessions.map((session) => (session.id === sessionId ? { ...session, status, lastActivity } : session)),
  };
}

function sessionStatusText(session: GpiSessionSummary, archived: boolean): string {
  if (archived) return "Archived";
  if (session.lastActivity.toLowerCase().includes("compact")) return "Comp";
  return statusLabels[session.status];
}

function ProjectSidebar(props: {
  projects: GpiProject[];
  sessions: GpiSessionSummary[];
  selectedProjectId: string | undefined;
  selectedSessionId: string | undefined;
  archivedSessions: Record<string, boolean>;
  sessionSelectionRanks: Record<string, number>;
  newProjectName: string;
  newProjectPath: string;
  projectEditName: string;
  projectEditPath: string;
  importStatus: string | undefined;
  showArchivedSessions: boolean;
  onChooseProjectEditPath: () => void;
  onChooseProjectPath: () => void;
  onCreateProject: () => void;
  onCreatePiSession: (project?: GpiProject) => void;
  onImportProjectSessions: () => void;
  onJumpToNextAttentionSession: () => void;
  onOpenQuickSwitcher: () => void;
  onNewProjectNameChange: (value: string) => void;
  onNewProjectPathChange: (value: string) => void;
  onProjectEditNameChange: (value: string) => void;
  onProjectEditPathChange: (value: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onCompactSession: (session: GpiSessionSummary) => void;
  onRemoveProject: () => void;
  onCancelPrewarmSession: (sessionId: string) => void;
  onPrewarmSession: (session: GpiSessionSummary) => void;
  onSelectProject: (project: GpiProject) => void;
  onSelectSession: (session: GpiSessionSummary) => void;
  onToggleShowArchived: () => void;
  onUpdateProject: () => void;
}) {
  return (
    <aside className="thread-sidebar">
      <div className="sidebar-header drag-region">
        <div className="brand-lockup">
          <span className="brand-glyph">G</span>
          <div>
            <strong>GPi</strong>
            <small>Pi agent workspace</small>
          </div>
        </div>
      </div>

      <div className="sidebar-command-bar clean">
        <button aria-label="Switch projects and sessions" className="sidebar-search-command" onClick={props.onOpenQuickSwitcher} title="Switch projects and sessions (Ctrl+P)" type="button">
          <span>Switch</span>
          <kbd>Ctrl P</kbd>
        </button>
        <div className="sidebar-mini-actions">
          <button aria-label="Add project" className="add-project-action" onClick={props.onChooseProjectPath} title="Add project" type="button">+</button>
        </div>
      </div>

      {props.projects.length === 0 ? (
        <div className="sidebar-empty-state">
          <strong>No projects yet</strong>
          <span>Add a local folder to start using GPi as a cockpit for Pi.</span>
        </div>
      ) : null}

      <ProjectList
        projects={props.projects}
        sessions={props.sessions}
        sessionSelectionRanks={props.sessionSelectionRanks}
        archivedSessions={props.archivedSessions}
        selectedProjectId={props.selectedProjectId}
        selectedSessionId={props.selectedSessionId}
        showArchivedSessions={props.showArchivedSessions}
        onArchiveSession={props.onArchiveSession}
        onCompactSession={props.onCompactSession}
        onCreatePiSession={props.onCreatePiSession}
        onCancelPrewarmSession={props.onCancelPrewarmSession}
        onPrewarmSession={props.onPrewarmSession}
        onSelectProject={props.onSelectProject}
        onSelectSession={props.onSelectSession}
      />


    </aside>
  );
}

function formatProjectCount(visibleCount: number, archivedCount: number, showArchivedSessions: boolean): string {
  if (archivedCount > 0 && !showArchivedSessions) return `${visibleCount.toString()}+`;
  return visibleCount.toString();
}

function projectStatusPreviewSessions(sessions: GpiSessionSummary[]): GpiSessionSummary[] {
  const signalSessions = sessions.filter((session) => session.status !== "idle");
  return (signalSessions.length > 0 ? signalSessions : sessions).slice(0, 4);
}

function ProjectList(props: {
  projects: GpiProject[];
  sessions: GpiSessionSummary[];
  archivedSessions: Record<string, boolean>;
  sessionSelectionRanks: Record<string, number>;
  selectedProjectId: string | undefined;
  selectedSessionId: string | undefined;
  showArchivedSessions: boolean;
  onArchiveSession: (sessionId: string) => void;
  onCompactSession: (session: GpiSessionSummary) => void;
  onCreatePiSession: (project?: GpiProject) => void;
  onCancelPrewarmSession: (sessionId: string) => void;
  onPrewarmSession: (session: GpiSessionSummary) => void;
  onSelectProject: (project: GpiProject) => void;
  onSelectSession: (session: GpiSessionSummary) => void;
}) {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [bottomScrollSpacer, setBottomScrollSpacer] = useState(0);
  const [archiveConfirmSession, setArchiveConfirmSession] = useState<GpiSessionSummary | undefined>();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: GpiSessionSummary } | undefined>();
  const listRef = useRef<HTMLDivElement>(null);

  function archiveSessionKeepingScroll(sessionId: string): void {
    const list = listRef.current;
    const beforeHeight = list?.scrollHeight ?? 0;
    const beforeTop = list?.scrollTop ?? 0;
    const wasNearBottom = list ? beforeTop + list.clientHeight > beforeHeight - 72 : false;
    props.onArchiveSession(sessionId);
    window.requestAnimationFrame(() => {
      const currentList = listRef.current;
      if (!currentList) return;
      const removedHeight = Math.max(0, beforeHeight - currentList.scrollHeight);
      if (wasNearBottom && removedHeight > 0) setBottomScrollSpacer((current) => current + removedHeight);
      window.requestAnimationFrame(() => {
        const nextList = listRef.current;
        if (nextList) nextList.scrollTop = beforeTop;
      });
    });
  }

  function toggleProject(projectId: string): void {
    setCollapsedProjects((current) => ({ ...current, [projectId]: !current[projectId] }));
  }

  useEffect(() => {
    if (!contextMenu) return;
    function close(): void {
      setContextMenu(undefined);
    }
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [contextMenu]);

  return (
    <>
    {archiveConfirmSession ? (
      <ConfirmDialog
        dialog={{
          title: `Delete ${archiveConfirmSession.title} from sidebar?`,
          body: "This removes the chat from GPi's visible workspace metadata. Pi session files on disk are not deleted.",
          confirmLabel: "Delete from sidebar",
          tone: "danger",
          onConfirm: () => archiveSessionKeepingScroll(archiveConfirmSession.id),
        }}
        onClose={() => setArchiveConfirmSession(undefined)}
      />
    ) : null}
    {contextMenu ? (
      <div className="session-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={(event) => event.stopPropagation()}>
        <button onClick={() => {
          props.onSelectSession(contextMenu.session);
          setContextMenu(undefined);
        }} title="Open this chat" type="button">Open chat</button>
        <button disabled={contextMenu.session.origin !== "real" && contextMenu.session.origin !== "imported"} onClick={() => {
          props.onCompactSession(contextMenu.session);
          setContextMenu(undefined);
        }} title="Compact this Pi session" type="button">Compact session</button>
        <button onClick={() => {
          props.onArchiveSession(contextMenu.session.id);
          setContextMenu(undefined);
        }} title="Hide this chat from the active sidebar" type="button">Archive chat</button>
        <button className="danger" onClick={() => {
          setArchiveConfirmSession(contextMenu.session);
          setContextMenu(undefined);
        }} title="Remove this chat from GPi metadata only" type="button">Delete from sidebar</button>
      </div>
    ) : null}
    <div className="project-list" ref={listRef} style={{ paddingBottom: `${12 + bottomScrollSpacer}px` }}>
      {props.projects.map((project) => {
        const allProjectSessions = props.sessions.filter((session) => session.projectId === project.id);
        const projectSessions = sortSessionsByAttention(
          allProjectSessions.filter((session) => props.showArchivedSessions || !props.archivedSessions[session.id]),
          props.selectedSessionId,
          props.sessionSelectionRanks,
        );
        const archivedCount = allProjectSessions.length - projectSessions.length;
        const attentionCount = projectSessions.filter((session) => attentionStatuses.has(session.status)).length;
        const activeCount = projectSessions.filter((session) => activeStatuses.has(session.status)).length;
        const collapsed = Boolean(collapsedProjects[project.id]);
        return (
          <section className={collapsed ? "project-group collapsed" : "project-group"} key={project.id}>
            <div className="project-header-wrap">
              <button className={project.id === props.selectedProjectId ? "project-header selected" : "project-header"} onClick={() => toggleProject(project.id)} title={`${collapsed ? "Expand" : "Collapse"} ${project.name}`} type="button">
                <div>
                  <strong>{project.name}</strong>
                  <span>{project.path}</span>
                </div>
                {collapsed ? (
                  <span className="project-inline-summary">
                    <span className="collapsed-session-dots" aria-hidden="true">
                      {projectStatusPreviewSessions(projectSessions).map((session) => <span className={`status-dot ${session.status}`} key={session.id} />)}
                    </span>
                    <span>{projectSessions.length.toString()} session{projectSessions.length === 1 ? "" : "s"}</span>
                  </span>
                ) : null}
                <span className="project-header-meta">
                  <span className={collapsed ? "project-chevron collapsed" : "project-chevron"} aria-hidden="true" />
                  <span className={attentionCount > 0 ? "project-count attention" : activeCount > 0 ? "project-count" : "project-count muted"}>
                    {formatProjectCount(attentionCount || activeCount || projectSessions.length, archivedCount, props.showArchivedSessions)}
                  </span>
                </span>
              </button>
              <button
                aria-label={`New Pi session in ${project.name}`}
                className="project-hover-add"
                title={`New Pi session in ${project.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onSelectProject(project);
                  props.onCreatePiSession(project);
                }}
                type="button"
              >
                +
              </button>
            </div>
            <div className={collapsed ? "session-list collapsed" : "session-list"}>
              {projectSessions.length === 0 ? <div className="project-empty-row">No visible sessions. Create or import one.</div> : null}
              {!collapsed && projectSessions.map((session) => (
                <button
                  className={session.id === props.selectedSessionId ? "session-row selected" : "session-row"}
                  key={session.id}
                  onClick={() => props.onSelectSession(session)}
                  onMouseEnter={() => props.onPrewarmSession(session)}
                  onMouseLeave={() => props.onCancelPrewarmSession(session.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY, session });
                  }}
                  title={`${session.title} · ${sessionStatusText(session, Boolean(props.archivedSessions[session.id]))}`}
                  type="button"
                >
                  <span className={`status-dot ${session.status}`} title={sessionStatusText(session, Boolean(props.archivedSessions[session.id]))} />
                  <span className="session-copy">
                    <strong>{session.title}</strong>
                    <small>{session.lastActivity}</small>
                  </span>
                  <span className="session-meta-stack">
                    <span className={`session-status ${attentionStatuses.has(session.status) ? "attention" : ""}`}>{sessionStatusText(session, Boolean(props.archivedSessions[session.id]))}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
    </>
  );
}

function SettingsIcon() {
  return (
    <svg className="window-control-settings" aria-hidden="true" fill="currentColor" viewBox="0 0 8 8">
      <path d="M3.5 0 3 1.19c-.1.03-.19.08-.28.13L1.53.82l-.72.72.5 1.19c-.05.1-.09.18-.13.28l-1.19.5v1l1.19.5c.04.1.08.18.13.28l-.5 1.19.72.72 1.19-.5c.09.04.18.09.28.13l.5 1.19h1L5 6.83c.09-.04.19-.08.28-.13l1.19.5.72-.72-.5-1.19c.04-.09.09-.19.13-.28l1.19-.5v-1l-1.19-.5c-.03-.09-.08-.19-.13-.28l.5-1.19-.72-.72-1.19.5c-.09-.04-.19-.09-.28-.13L4.5 0H3.5ZM4 2.5c.83 0 1.5.67 1.5 1.5S4.83 5.5 4 5.5 2.5 4.83 2.5 4 3.17 2.5 4 2.5" />
    </svg>
  );
}

function WindowControls(props: { hideSettings?: boolean; updateStatus?: GpiUpdateStatus; updateStatusLoading?: boolean; onOpenSettings?: () => void }) {
  const indicator = updateIndicator(props.updateStatus, Boolean(props.updateStatusLoading));
  return (
    <div className="window-controls">
      {props.hideSettings ? null : (
        <button aria-label="Open settings" className="settings-window-button" onClick={props.onOpenSettings} title={`Settings · ${indicator.title}`} type="button">
          <SettingsIcon />
          <span aria-hidden="true" className={`settings-update-dot tone-${indicator.tone}`} />
        </button>
      )}
      <button aria-label="Minimize" onClick={() => void window.gpi?.minimizeWindow()} title="Minimize" type="button"><span className="window-control-minimize" /></button>
      <button aria-label="Maximize" onClick={() => void window.gpi?.toggleMaximizeWindow()} title="Maximize" type="button"><span className="window-control-maximize" /></button>
      <button aria-label="Close" className="close" onClick={() => void window.gpi?.closeWindow()} title="Close" type="button"><span className="window-control-close" /></button>
    </div>
  );
}

type UpdateIndicatorTone = "major" | "minor" | "ok" | "unknown";

function updateIndicator(status: GpiUpdateStatus | undefined, loading: boolean): { title: string; tone: UpdateIndicatorTone } {
  if (loading && !status) return { title: "Checking updates", tone: "unknown" };
  if (!status || status.appVersion === "unknown") return { title: "Update status unavailable", tone: "unknown" };
  if (status.appUpdateAvailable) {
    const latest = status.latestAppVersion ?? "newer version";
    const appDistance = semverDistance(status.appVersion, latest);
    const tone: UpdateIndicatorTone = appDistance === undefined || appDistance > 1 ? "major" : "minor";
    return { title: `GPi ${latest} available, installed ${status.appVersion}`, tone };
  }
  if (status.piUpdateAvailable) return { title: `Pi update available, installed ${status.installedPiVersion ?? "unknown"}`, tone: "minor" };
  if (status.appUpdateAvailable === undefined || status.piUpdateAvailable === undefined) return { title: "Update status partially unavailable", tone: "unknown" };
  return { title: "GPi and Pi are up to date", tone: "ok" };
}

function semverDistance(current: string, latest: string): number | undefined {
  const currentParts = parseSemverParts(current);
  const latestParts = parseSemverParts(latest);
  if (!currentParts || !latestParts) return undefined;
  if (currentParts.major !== latestParts.major || currentParts.minor !== latestParts.minor) return Number.POSITIVE_INFINITY;
  return Math.max(0, latestParts.patch - currentParts.patch);
}

function parseSemverParts(version: string): { major: number; minor: number; patch: number } | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function PanelIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14.5 5v14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function HeaderMetric(props: { label: string; value: string; tone?: string }) {
  return (
    <div className={`header-metric ${props.tone ? `tone-${props.tone}` : ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function compactModelHeader(options: GpiModelOptions | undefined, sessionOrigin: GpiSessionSummary["origin"] | undefined): string {
  if (sessionOrigin !== "real") return "Pi only";
  if (!options) return "Loading";
  return options.currentModel?.name ?? "Pi default";
}

function selectableModels(options: GpiModelOptions | undefined): GpiModelOptions["models"] {
  if (!options) return [];
  const currentValue = options.currentModel ? `${options.currentModel.provider}/${options.currentModel.id}` : "";
  return options.models.filter((model) => model.hasAuth || currentValue === `${model.provider}/${model.id}`);
}

function MessageTimeline(props: {
  bridgeError: string | undefined;
  details: string[];
  hasSelectedProject: boolean;
  projectId: string | undefined;
  messages: ChatMessage[];
  timelineEvents: TimelineEvent[];
  turnSnapshots: TurnSnapshotIndex;
  selectedSessionId: string | undefined;
  selectedSessionStatus: SessionStatus | undefined;
  onPreviewImage: (image: GpiImageAttachment) => void;
  onPreviewRevert: (snapshot: TurnSnapshotIndexEntry) => void;
  onCreateSession: () => void;
}) {
  const shellRef = useRef<HTMLElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const autoScrollInterruptedRef = useRef(false);
  const scrollPillRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const lastMessage = props.messages.at(-1);
  const lastEvent = props.timelineEvents.at(-1);
  const timelineScrollSignal = useMemo(() => timelineAutoScrollSignal(props.timelineEvents), [props.timelineEvents]);

  useEffect(() => {
    pinnedToBottomRef.current = true;
    autoScrollInterruptedRef.current = false;
    setShowScrollToBottom(false);
    scrollTimelineToBottom(shellRef.current, "auto", () => autoScrollInterruptedRef.current);
  }, [props.selectedSessionId]);

  useEffect(() => {
    if (!pinnedToBottomRef.current || autoScrollInterruptedRef.current) return;
    scrollTimelineToBottom(shellRef.current, "auto", () => autoScrollInterruptedRef.current);
    const frame = window.requestAnimationFrame(() => scrollTimelineToBottom(shellRef.current, "auto", () => autoScrollInterruptedRef.current));
    return () => window.cancelAnimationFrame(frame);
  }, [lastEvent?.id, lastMessage?.text, props.details.length, props.messages.length, props.timelineEvents.length, timelineScrollSignal]);


  function handleTimelineScroll(): void {
    const shell = shellRef.current;
    if (!shell) return;
    const nearBottom = isNearScrollBottom(shell);
    if (nearBottom) autoScrollInterruptedRef.current = false;
    pinnedToBottomRef.current = nearBottom;
    setShowScrollToBottom(!nearBottom && props.messages.length > 0);
  }

  function handleTimelineWheel(event: React.WheelEvent<HTMLElement>): void {
    if (event.deltaY >= 0) return;
    autoScrollInterruptedRef.current = true;
    pinnedToBottomRef.current = false;
    setShowScrollToBottom(props.messages.length > 0 || props.timelineEvents.length > 0);
  }

  function scrollToBottom(): void {
    pinnedToBottomRef.current = true;
    autoScrollInterruptedRef.current = false;
    setShowScrollToBottom(false);
    scrollTimelineToBottom(shellRef.current, "smooth", () => autoScrollInterruptedRef.current);
  }

  return (
    <section className="timeline-shell" onScroll={handleTimelineScroll} onWheel={handleTimelineWheel} ref={shellRef}>
      <div className="timeline-content">
        {props.bridgeError ? <div className="thread-error-banner">{props.bridgeError}</div> : null}
        {props.messages.length === 0 && props.timelineEvents.length === 0 ? (
          <div className="empty-thread-state">
            <span>{props.selectedSessionId ? "Ready when you are." : "Project selected."}</span>
            <p>
              {props.selectedSessionId
                ? "Send a prompt to Pi. GPi keeps operational work, files and tools available without turning the chat into an IDE."
                : props.hasSelectedProject
                  ? "This project does not have any sessions yet. Create a Pi session to open the composer and start working in this folder."
                  : "Add or select a local project folder to begin. GPi is the cockpit; Pi remains the engine."}
            </p>
            {!props.selectedSessionId && props.hasSelectedProject ? (
              <button className="empty-thread-action" onClick={props.onCreateSession} title="Create a Pi session in this project" type="button">
                New session
              </button>
            ) : null}
          </div>
        ) : null}
        {props.timelineEvents.length > 0 ? (
          <TypedTimelineEvents events={props.timelineEvents} status={props.selectedSessionStatus} turnSnapshots={props.turnSnapshots} onPreviewImage={props.onPreviewImage} onPreviewRevert={props.onPreviewRevert} />
        ) : (
          <LinearTimelineMessages details={props.details} messages={props.messages} onPreviewImage={props.onPreviewImage} projectId={props.projectId} selectedSessionId={props.selectedSessionId} status={props.selectedSessionStatus} />
        )}
        <div ref={bottomRef} />
      </div>
      {showScrollToBottom ? (
        <div className="scroll-to-bottom-layer" ref={scrollPillRef}>
          <button className="scroll-to-bottom-pill" onClick={scrollToBottom} title="Jump to latest message" type="button">
            Jump to latest
          </button>
        </div>
      ) : null}
    </section>
  );
}

function latestTurnId(events: TimelineEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const turnId = events[index]?.turnId;
    if (turnId) return turnId;
  }
  return undefined;
}

function timelineAutoScrollSignal(events: TimelineEvent[]): string {
  const lastEvents = events.slice(-4);
  return lastEvents.map((event) => {
    if (event.kind === "assistant_message" || event.kind === "user_message") return `${event.id}:${event.text.length.toString()}`;
    if (event.kind === "run_phase") return `${event.id}:${event.status}:${(event.text?.length ?? 0).toString()}:${(event.endedAt ?? 0).toString()}`;
    if (event.kind === "tool") return `${event.id}:${event.status}:${event.resultSummary?.length ?? 0}:${event.durationMs ?? 0}`;
    if (event.kind === "diff") return `${event.id}:${event.path}:${event.diff.length.toString()}`;
    return `${event.id}:${event.createdAt.toString()}`;
  }).join("|");
}

function TypedTimelineEvents(props: { events: TimelineEvent[]; status: SessionStatus | undefined; turnSnapshots: TurnSnapshotIndex; onPreviewImage: (image: GpiImageAttachment) => void; onPreviewRevert: (snapshot: TurnSnapshotIndexEntry) => void }) {
  const events = useMemo(() => [...props.events].filter((event) => event.kind !== "stats").sort((a, b) => a.order - b.order), [props.events]);
  const grouped = useMemo(() => groupTimelineEvents(events), [events]);
  return (
    <>
      {grouped.map((item) => item.kind === "single" ? <TypedTimelineEventBlock event={item.event} key={item.event.id} onPreviewImage={props.onPreviewImage} /> : <TimelineRunSupercard collapseWhenInactive={item.followedByAssistantMessage} events={item.events} key={`group-${item.turnId}`} snapshot={findTurnSnapshot(props.turnSnapshots, item.events)} onPreviewImage={props.onPreviewImage} onPreviewRevert={props.onPreviewRevert} />)}
      {shouldShowLiveActivity(events, props.status) ? <TimelineLiveActivity status={props.status} /> : null}
    </>
  );
}

type TimelineRenderGroup =
  | { kind: "single"; event: TimelineEvent }
  | { kind: "run"; turnId: string; events: TimelineEvent[]; followedByAssistantMessage: boolean };

function groupTimelineEvents(events: TimelineEvent[]): TimelineRenderGroup[] {
  const groups: TimelineRenderGroup[] = [];
  let activeRun: { turnId: string; events: TimelineEvent[] } | undefined;
  for (const event of events) {
    if (event.kind === "user_message" || event.kind === "assistant_message") {
      if (activeRun) {
        groups.push({ kind: "run", turnId: activeRun.turnId, events: activeRun.events, followedByAssistantMessage: event.kind === "assistant_message" });
        activeRun = undefined;
      }
      groups.push({ kind: "single", event });
      continue;
    }
    if (event.kind === "system" || event.kind === "error") {
      if (activeRun) {
        groups.push({ kind: "run", turnId: activeRun.turnId, events: activeRun.events, followedByAssistantMessage: false });
        activeRun = undefined;
      }
      groups.push({ kind: "single", event });
      continue;
    }
    const turnId = event.turnId ?? "no-turn";
    if (!activeRun || activeRun.turnId !== turnId) {
      if (activeRun) groups.push({ kind: "run", turnId: activeRun.turnId, events: activeRun.events, followedByAssistantMessage: false });
      activeRun = { turnId, events: [] };
    }
    activeRun.events.push(event);
  }
  if (activeRun) groups.push({ kind: "run", turnId: activeRun.turnId, events: activeRun.events, followedByAssistantMessage: false });
  return groups;
}

function findTurnSnapshot(turnSnapshots: TurnSnapshotIndex, events: TimelineEvent[]): TurnSnapshotIndexEntry | undefined {
  const event = events.find((candidate) => candidate.turnId);
  if (!event?.turnId) return undefined;
  return turnSnapshots[event.sessionId]?.[event.turnId];
}

function TimelineRunSupercard(props: { collapseWhenInactive: boolean; events: TimelineEvent[]; snapshot: TurnSnapshotIndexEntry | undefined; onPreviewImage: (image: GpiImageAttachment) => void; onPreviewRevert: (snapshot: TurnSnapshotIndexEntry) => void }) {
  const active = props.events.some((event) => isTimelineEventActive(event));
  const [expanded, setExpanded] = useState(active);
  const tools = props.events.filter((event) => event.kind === "tool").length;
  const diffs = props.events.filter((event) => event.kind === "diff").length;
  const phases = props.events.filter((event) => event.kind === "run_phase").length;
  const startedAt = Math.min(...props.events.map((event) => event.createdAt));
  const endedAt = active ? Date.now() : Math.max(...props.events.map((event) => event.kind === "run_phase" ? event.endedAt ?? event.createdAt : event.createdAt));
  const summary = `${active ? "Running" : "Completed"} · ${phases.toString()} phases · ${tools.toString()} tools · ${diffs.toString()} diffs · ${Math.max(0, Math.round((endedAt - startedAt) / 1000)).toString()}s`;

  useEffect(() => {
    if (active) {
      setExpanded(true);
      return;
    }
    if (props.collapseWhenInactive) setExpanded(false);
  }, [active, props.collapseWhenInactive]);

  return (
    <div className={`timeline-run-supercard ${expanded ? "expanded" : "collapsed"}`}>
      <div className="timeline-run-supercard-header">
        <button aria-expanded={expanded} className="timeline-run-supercard-summary" onClick={() => setExpanded((current) => !current)} title={expanded ? "Collapse run work" : "Expand run work"} type="button">
          <span className="timeline-action-icon" />
          <span className="timeline-action-copy">
            <small>Run work</small>
            <strong>{summary}</strong>
          </span>
        </button>
        {props.snapshot ? (
          <button className="timeline-revert-button" onClick={() => props.onPreviewRevert(props.snapshot!)} title="Preview revert for files changed in this turn" type="button">
            Revert changes · {props.snapshot.fileCount.toString()} file{props.snapshot.fileCount === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
      <div className="timeline-run-supercard-content" aria-hidden={!expanded}>
        <div className="timeline-run-supercard-body">
          {props.events.map((event) => <TypedTimelineEventBlock event={event} key={event.id} onPreviewImage={props.onPreviewImage} />)}
        </div>
      </div>
    </div>
  );
}

function TimelineLiveActivity(props: { status: SessionStatus | undefined }) {
  const status = props.status ?? "thinking";
  return (
    <div className="timeline-live-activity" aria-live="polite">
      <span className={`status-dot ${status}`} />
      <span className="braille-loader" aria-hidden="true">⠋</span>
      <div>
        <strong>{liveActivityTitle(status)}</strong>
        <small>{liveActivityCopy(status)}</small>
      </div>
    </div>
  );
}

function shouldShowLiveActivity(events: TimelineEvent[], status: SessionStatus | undefined): boolean {
  if (!status || !activeStatuses.has(status)) return false;
  const lastEvent = events.at(-1);
  if (!lastEvent) return true;
  if (lastEvent.kind === "assistant_message" && lastEvent.text.trim().length > 0) return false;
  if ((lastEvent.kind === "tool" || lastEvent.kind === "command") && lastEvent.status === "started") return false;
  return true;
}

function liveActivityTitle(status: SessionStatus): string {
  if (status === "connecting") return "Connecting to Pi";
  if (status === "running_tool") return "Running tool";
  if (status === "editing_files") return "Editing files";
  if (status === "streaming") return "Streaming response";
  return "Pi is thinking";
}

function liveActivityCopy(status: SessionStatus): string {
  if (status === "connecting") return "Opening the SDK session.";
  if (status === "running_tool") return "Waiting for the next tool event.";
  if (status === "editing_files") return "Watching file changes.";
  if (status === "streaming") return "Waiting for the next token.";
  return "The run is active. GPi is waiting for Pi events.";
}

function TypedTimelineEventBlock(props: { event: TimelineEvent; onPreviewImage: (image: GpiImageAttachment) => void }) {
  const event = props.event;
  if (event.kind === "user_message") return <TimelineMessage message={{ id: event.id, role: "user", text: event.text, imageAttachments: event.imageAttachments }} onPreviewImage={props.onPreviewImage} />;
  if (event.kind === "assistant_message") return <TimelineMessage message={{ id: event.id, role: "assistant", text: event.text, responseMeta: event.responseMeta }} />;
  if (event.kind === "diff") return <TimelineDiffEvent event={event} />;
  if (event.kind === "tool") return <TimelineActionEvent event={event} title={event.toolName} eyebrow={event.status === "started" ? "Tool started" : event.isError ? "Tool error" : "Tool finished"} tone={event.isError ? "error" : event.status === "started" ? "active" : "success"} />;
  if (event.kind === "file_change") return <TimelineActionEvent event={event} title={event.path} eyebrow={`File ${event.status}`} tone="file" />;
  if (event.kind === "run_phase") return <TimelineRunPhaseEvent event={event} />;
  if (event.kind === "command") return <TimelineActionEvent event={event} title={event.command} eyebrow={event.status === "started" ? "Command started" : `Command finished${event.exitCode === undefined ? "" : ` · exit ${event.exitCode.toString()}`}`} tone={event.exitCode && event.exitCode !== 0 ? "error" : event.status === "started" ? "active" : "neutral"} />;
  if (event.kind === "stats") return <TimelineActionEvent event={event} title={event.summary} eyebrow="Session stats" tone="neutral" />;
  if (event.kind === "compaction") return <TimelineActionEvent event={event} title={event.summary} eyebrow={`Compaction ${event.status}`} tone={event.status === "failed" ? "error" : event.status === "finished" ? "success" : "neutral"} />;
  if (event.kind === "error") return <TimelineActionEvent event={event} title={event.message} eyebrow="Error" tone="error" />;
  return <TimelineActionEvent event={event} title={event.message} eyebrow="System" tone={event.tone === "warning" ? "warning" : event.tone === "success" ? "success" : "neutral"} />;
}

function TimelineRunPhaseEvent(props: { event: Extract<TimelineEvent, { kind: "run_phase" }> }) {
  const [, setTick] = useState(0);
  const active = props.event.status === "started";
  const [expanded, setExpanded] = useState(active);
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setTick((current) => current + 1), 1_000);
    return () => window.clearInterval(interval);
  }, [active]);

  useEffect(() => {
    setExpanded(active);
  }, [active]);

  const elapsed = runPhaseDuration(props.event);
  const isThinking = props.event.phase === "thinking";
  const label = props.event.phase === "preparing_tool" ? "Preparing tool call" : isThinking ? "Thinking" : "Working";
  const title = `${label} ${elapsed}`;
  const details = props.event.text ? [{ label: "stream", value: props.event.text }] : [];
  return (
    <details className={`timeline-action-block tone-${active ? "active" : "neutral"}`} onToggle={(event) => setExpanded(event.currentTarget.open)} open={expanded}>
      <summary>
        <span className="timeline-action-icon" />
        <span className="timeline-action-copy">
          <small>{label}</small>
          <strong>{title}</strong>
        </span>
        {details.length > 0 ? <span className="timeline-action-count">{details.length.toString()}</span> : null}
      </summary>
      {expanded && details.length > 0 ? (
        <div className="timeline-action-details">
          {details.map((detail) => <TimelineActionDetail detail={detail} key={detail.label} />)}
        </div>
      ) : null}
    </details>
  );
}

function TimelineActionEvent(props: { event: Exclude<TimelineEvent, Extract<TimelineEvent, { kind: "user_message" | "assistant_message" | "diff" }>>; title: string; eyebrow: string; tone: "active" | "error" | "file" | "neutral" | "success" | "warning" }) {
  const active = isTimelineEventActive(props.event);
  const [expanded, setExpanded] = useState(active);
  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);
  const details = timelineEventDetails(props.event);
  const hasDetails = details.length > 0;
  return (
    <details className={`timeline-action-block tone-${props.tone}`} onToggle={(event) => setExpanded(event.currentTarget.open)} open={expanded}>
      <summary>
        <span className="timeline-action-icon" />
        <span className="timeline-action-copy">
          <small>{props.eyebrow}</small>
          <strong>{props.title}</strong>
        </span>
        {hasDetails ? <span className="timeline-action-count">{details.length.toString()}</span> : null}
      </summary>
      {expanded && hasDetails ? (
        <div className="timeline-action-details">
          {details.map((detail) => <TimelineActionDetail detail={detail} key={detail.label} />)}
        </div>
      ) : null}
    </details>
  );
}

function TimelineActionDetail(props: { detail: { label: string; value: string } }) {
  return (
    <div className="timeline-action-detail">
      <span>{props.detail.label}</span>
      <code>{props.detail.value}</code>
    </div>
  );
}

function TimelineDiffEvent(props: { event: Extract<TimelineEvent, { kind: "diff" }> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="timeline-diff-group typed-diff-group">
      <div className="message-meta">Diff · {props.event.diffKind}{props.event.message ? ` · ${props.event.message}` : ""}</div>
      <details className="timeline-diff" onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>
          <span className="file-tree-status modified">diff</span>
          <code>{props.event.path}</code>
        </summary>
        {expanded ? <DiffPreview diff={props.event.diff} /> : null}
      </details>
    </section>
  );
}

function timelineEventDetails(event: Exclude<TimelineEvent, Extract<TimelineEvent, { kind: "user_message" | "assistant_message" | "diff" }>>): Array<{ label: string; value: string }> {
  if (event.kind === "tool") {
    return compactDetails([
      ["id", event.toolCallId],
      ["args", event.argsSummary],
      ["result", event.resultSummary],
      ["duration", event.durationMs === undefined ? undefined : `${event.durationMs.toString()}ms`],
    ]);
  }
  if (event.kind === "file_change") return compactDetails([["origin", event.origin], ["path", event.path]]);
  if (event.kind === "command") return compactDetails([["cwd", event.cwd], ["output", event.output], ["duration", event.durationMs === undefined ? undefined : `${event.durationMs.toString()}ms`]]);
  if (event.kind === "stats") return compactDetails([["summary", event.summary]]);
  if (event.kind === "compaction") return compactDetails([["summary", event.summary]]);
  if (event.kind === "error") return compactDetails([["message", event.message], ["recoverable", event.recoverable ? "yes" : "no"]]);
  if (event.kind === "run_phase") return compactDetails([["duration", runPhaseDuration(event)], ["content", event.text]]);
  if (event.kind === "system") return compactDetails([["message", event.message]]);
  return [];
}

function compactDetails(entries: Array<[string, string | undefined]>): Array<{ label: string; value: string }> {
  return entries.flatMap(([label, value]) => value && value.trim().length > 0 ? [{ label, value }] : []);
}

function runPhaseTitle(event: Extract<TimelineEvent, { kind: "run_phase" }>): string {
  const label = event.phase === "preparing_tool" ? "Preparing tool call" : event.phase === "working" ? "Working" : "Thinking";
  return `${label}${event.status === "started" ? "" : " done"}`;
}

function runPhaseDuration(event: Extract<TimelineEvent, { kind: "run_phase" }>): string {
  const end = event.endedAt ?? Date.now();
  return `${Math.max(0, Math.round((end - event.startedAt) / 1000)).toString()}s`;
}

function isTimelineEventActive(event: TimelineEvent): boolean {
  return ((event.kind === "tool" || event.kind === "command" || event.kind === "run_phase") && event.status === "started");
}

function LinearTimelineMessages(props: { details: string[]; messages: ChatMessage[]; onPreviewImage: (image: GpiImageAttachment) => void; projectId: string | undefined; selectedSessionId: string | undefined; status: SessionStatus | undefined }) {
  const lastMessage = props.messages.at(-1);
  const currentTurnDetails = getCurrentTurnDetails(props.details);
  const shouldPlaceWorkBeforeLastAssistant = lastMessage?.role === "assistant" && hasWorkActivity(currentTurnDetails, props.status);
  const visibleMessages = shouldPlaceWorkBeforeLastAssistant ? props.messages.slice(0, -1) : props.messages;

  return (
    <>
      {visibleMessages.map((message, index) => (
        <TimelineMessage key={message.id} message={message} onPreviewImage={props.onPreviewImage} />
      ))}
      <WorkActivity details={currentTurnDetails} status={props.status} />
      <TimelineDiffs details={currentTurnDetails} projectId={props.projectId} />
      {shouldPlaceWorkBeforeLastAssistant && lastMessage ? (
        <TimelineMessage key={lastMessage.id} message={lastMessage} onPreviewImage={props.onPreviewImage} />
      ) : null}
    </>
  );
}

function WorkActivity(props: { details: string[]; status: SessionStatus | undefined }) {
  const workItems = props.details.filter(isWorkDetail).slice(-5).reverse();
  const status = props.status ?? "idle";
  const isActive = activeStatuses.has(status);

  if (!hasWorkActivity(props.details, props.status)) return null;

  return (
    <details className="work-activity" open={isActive}>
      <summary>
        <span className={`status-dot ${status}`} />
        <strong>{isActive ? statusLabels[status] : "Recent work"}</strong>
        <small>{workItems.length.toString()} events</small>
      </summary>
      <div className="work-activity-list">
        {workItems.length === 0 ? <span className="work-activity-empty">No tool activity yet.</span> : null}
        {workItems.map((detail, index) => (
          <span key={`${detail}-${index.toString()}`}>{summarizeWorkDetail(detail)}</span>
        ))}
      </div>
    </details>
  );
}

function TimelineDiffs(props: { details: string[]; projectId: string | undefined }) {
  const fileEntries = useMemo(() => buildFileTreeEntries(props.details.map(parseInspectorDetail).filter((item) => item.kind === "file")), [props.details]);
  const [diffs, setDiffs] = useState<Record<string, { diff: string; kind: "git" | "created" | "unavailable"; message: string | undefined }>>({});

  useEffect(() => {
    if (!window.gpi || !props.projectId) return;
    let cancelled = false;
    for (const entry of fileEntries) {
      if (entry.status === "session" || diffs[entry.id] || entry.diff) continue;
      void window.gpi.getFileDiff(props.projectId, entry.path).then((result) => {
        if (cancelled) return;
        setDiffs((current) => ({ ...current, [entry.id]: { diff: result.diff, kind: result.kind, message: result.message } }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [diffs, fileEntries, props.projectId]);

  const visibleDiffs = fileEntries.filter((entry) => entry.diff ?? diffs[entry.id]?.diff);
  if (visibleDiffs.length === 0) return null;

  return (
    <section className="timeline-diff-group">
      <div className="message-meta">Changed files</div>
      {visibleDiffs.map((entry) => {
        const diff = entry.diff ? { diff: entry.diff } : diffs[entry.id];
        return <LazyTimelineDiffDetails diff={diff?.diff ?? ""} entry={entry} key={`timeline-diff-${entry.id}`} />;
      })}
    </section>
  );
}

function LazyTimelineDiffDetails(props: { diff: string; entry: FileTreeEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details className="timeline-diff" onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary>
        <span className={`file-tree-status ${props.entry.status}`}>{props.entry.status}</span>
        <code>{props.entry.path}</code>
      </summary>
      {expanded ? <DiffPreview diff={props.diff} /> : null}
    </details>
  );
}

function hasWorkActivity(details: string[], status: SessionStatus | undefined): boolean {
  return details.some(isWorkDetail) || Boolean(status && activeStatuses.has(status));
}

function getCurrentTurnDetails(details: string[]): string[] {
  for (let index = details.length - 1; index >= 0; index -= 1) {
    if (isPromptBoundaryDetail(details[index] ?? "")) return details.slice(index);
  }
  return [];
}

function isPromptBoundaryDetail(detail: string): boolean {
  return detail === "Pi prompt sent" || detail === "Pi follow-up queued" || detail === "mock event: agent_start" || detail === "Prompt accepted" || detail === "Follow-up queued";
}

function resolveMessageRole(message: string, index: number): "user" | "assistant" {
  if (message.startsWith("Pi: ")) return "assistant";
  return index % 2 === 0 ? "user" : "assistant";
}

function responseMetaLabel(message: ChatMessage): string {
  return message.responseMeta ? `Response · ${message.responseMeta}` : "Response";
}

function TimelineMessage(props: { message: ChatMessage; onPreviewImage?: (image: GpiImageAttachment) => void }) {
  if (props.message.role === "user") {
    return (
      <article className="timeline-row user-row">
        <div className="message-group user-message-group">
          <div className="user-bubble">
            {props.message.text.trim().length > 0 ? <MessageMarkdown text={props.message.text} /> : null}
            {props.message.imageAttachments && props.message.imageAttachments.length > 0 ? <MessageImages images={props.message.imageAttachments} onPreviewImage={props.onPreviewImage} /> : null}
          </div>
          <MessageCopyButton text={props.message.text} />
        </div>
      </article>
    );
  }

  const displayMessage = props.message.text.startsWith("Pi: ") ? props.message.text.slice(4) : props.message.text;
  const isImportedHistory = displayMessage.startsWith("Imported Pi session history") || displayMessage.startsWith("Imported Pi session with");

  return (
    <article className="timeline-row assistant-row">
      <div className={isImportedHistory ? "assistant-copy imported-history" : "assistant-copy"}><MessageMarkdown text={displayMessage} /></div>
      <div className="message-meta-row">
        <div className="message-meta">{isImportedHistory ? "Imported history preview" : responseMetaLabel(props.message)}</div>
        <MessageCopyButton text={displayMessage} />
      </div>
    </article>
  );
}

type MarkdownBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "code"; language: string; code: string };

function MessageMarkdown(props: { text: string }) {
  const blocks = parseMarkdownBlocks(props.text);
  return (
    <div className="markdown-body">
      {blocks.map((block, index) =>
        block.kind === "code" ? (
          <CodeBlock block={block} key={`${block.kind}-${index.toString()}`} />
        ) : (
          <p key={`${block.kind}-${index.toString()}`}>{renderInlineMarkdown(block.text)}</p>
        ),
      )}
    </div>
  );
}

function CodeBlock(props: { block: Extract<MarkdownBlock, { kind: "code" }> }) {
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{props.block.language || "code"}</span>
        <MessageCopyButton label="Copy" text={props.block.code} />
      </div>
      <pre><code>{props.block.code}</code></pre>
    </div>
  );
}

function MessageImages(props: { images: GpiImageAttachment[]; onPreviewImage?: (image: GpiImageAttachment) => void }) {
  return (
    <div className="message-image-grid">
      {props.images.map((image) => (
        <figure key={image.id}>
          {image.previewDataUrl ? (
            <button onClick={() => props.onPreviewImage?.(image)} title="Open image preview" type="button">
              <img alt={image.name} src={image.previewDataUrl} />
            </button>
          ) : <div className="message-image-placeholder"><strong>Preview unavailable</strong><span>The stored attachment file could not be loaded.</span></div>}
          <figcaption>{image.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function MessageCopyButton(props: { label?: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-button"
      onClick={() => {
        void navigator.clipboard.writeText(props.text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 900);
        });
      }}
      title="Copy to clipboard"
      type="button"
    >
      {copied ? "Copied" : props.label ?? "Copy"}
    </button>
  );
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let codeLines: string[] = [];
  let codeLanguage = "";
  let inCode = false;

  function flushParagraph(): void {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push({ kind: "code", language: codeLanguage, code: codeLines.join("\n") });
        codeLines = [];
        codeLanguage = "";
        inCode = false;
      } else {
        flushParagraph();
        codeLanguage = line.slice(3).trim();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.trim().length === 0) {
      flushParagraph();
      continue;
    }

    paragraph.push(line);
  }

  if (inCode) blocks.push({ kind: "code", language: codeLanguage, code: codeLines.join("\n") });
  flushParagraph();
  return blocks.length === 0 ? [{ kind: "paragraph", text }] : blocks;
}

function renderInlineMarkdown(text: string) {
  const normalized = text.replace(/^#{1,6}\s+/gm, "").replace(/^[-*]\s+/gm, "• ");
  const parts = normalized.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code className="inline-code" key={index.toString()}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index.toString()}>{part.slice(2, -2)}</strong>;
    return <span key={index.toString()}>{part}</span>;
  });
}

function Composer(props: {
  disabled: boolean;
  draft: string;
  hasRealHandle: boolean;
  isBusy: boolean;
  isCompacting: boolean;
  modelOptions: GpiModelOptions | undefined;
  projectFiles: GpiProjectFileEntry[];
  selectedSession: GpiSessionSummary | undefined;
  sessionStats: string | undefined;
  onAbort: () => void;
  onAbortCompaction: () => void;
  onChange: (value: string) => void;
  onCompact: () => void;
  onModelChange: (value: string) => void;
  onSend: (draft: string, images: GpiImageAttachment[]) => void;
  onThinkingChange: (value: string) => void;
  workflowLabel: string;
  focusKey: string | undefined;
  showPlanRefinement: boolean;
  revertSafeEditsEnabled: boolean;
  shouldAutoFocus: boolean;
  onPlanRefinement: () => void;
  onRevertSafeEditsChange: (enabled: boolean) => void;
  onWorkflowAction: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localDraft, setLocalDraft] = useState(props.draft);
  const [mentionChipPaths, setMentionChipPaths] = useState<string[]>([]);
  const [imageAttachments, setImageAttachments] = useState<GpiImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | undefined>();
  const [mentionQuery, setMentionQuery] = useState<string | undefined>();
  const [mentionIndex, setMentionIndex] = useState(0);
  const currentModelValue = props.modelOptions?.currentModel ? `${props.modelOptions.currentModel.provider}/${props.modelOptions.currentModel.id}` : "";
  const models = selectableModels(props.modelOptions);
  const canSelectModel = props.hasRealHandle && !props.isBusy && models.length > 0;
  const canSelectThinking = props.hasRealHandle && !props.isBusy && Boolean(props.modelOptions?.supportsThinking);
  const composerStatus = props.isCompacting ? "Compacting" : props.isBusy ? "Running - Enter queues follow-up" : props.hasRealHandle ? "Pi connected" : props.selectedSession ? `${originLabels[props.selectedSession.origin]} session` : "No active session";
  const mentionIndexEntries = useMemo(() => props.projectFiles.filter((file) => file.kind === "file"), [props.projectFiles]);
  const mentionSuggestions = useMemo(() => mentionQuery === undefined ? [] : findFileMentionSuggestions(mentionIndexEntries, mentionQuery), [mentionQuery, mentionIndexEntries]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 190).toString()}px`;
  }, [localDraft]);

  useEffect(() => {
    setLocalDraft(props.draft);
    setMentionChipPaths([]);
    setImageAttachments([]);
    setAttachmentError(undefined);
    setMentionQuery(undefined);
  }, [props.focusKey]);

  useEffect(() => {
    function handleFileMentionRequest(event: Event): void {
      const detail = (event as CustomEvent<{ path?: string }>).detail;
      if (detail?.path) appendMentionToDraft(detail.path);
    }
    window.addEventListener("gpi:file-mention-request", handleFileMentionRequest);
    return () => window.removeEventListener("gpi:file-mention-request", handleFileMentionRequest);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (localDraft !== props.draft) props.onChange(localDraft);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [localDraft, props.draft, props.onChange]);

  useEffect(() => {
    if (!props.shouldAutoFocus || props.disabled) return;
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [props.focusKey, props.disabled, props.shouldAutoFocus]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionQuery]);

  function updateComposerValue(value: string, cursor: number): void {
    setLocalDraft(value);
    const nextMentionQuery = activeMentionQuery(value, cursor);
    setMentionQuery((current) => current === nextMentionQuery ? current : nextMentionQuery);
  }

  async function attachImagesFromPicker(): Promise<void> {
    if (!window.gpi) return;
    addImageAttachmentResults(await window.gpi.chooseImageAttachments());
  }

  async function attachImageFiles(files: FileList | File[]): Promise<void> {
    if (!window.gpi) return;
    const imageFiles = [...files].filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const results = await Promise.all(imageFiles.map(async (file) => window.gpi?.ingestImageAttachment({ name: file.name || "image", mimeType: file.type || "application/octet-stream", data: await readFileAsBase64(file) }) ?? { ok: false as const, error: "GPi bridge unavailable" }));
    addImageAttachmentResults(results);
  }

  function addImageAttachmentResults(results: GpiImageAttachmentResult[]): void {
    const attachments = results.filter((result): result is Extract<GpiImageAttachmentResult, { ok: true }> => result.ok).map((result) => result.attachment);
    const errors = results.filter((result): result is Extract<GpiImageAttachmentResult, { ok: false }> => !result.ok).map((result) => result.error);
    if (attachments.length > 0) setImageAttachments((current) => [...current, ...attachments]);
    setAttachmentError(errors[0]);
  }

  function submitComposer(): void {
    const prompt = promptWithMentionChips();
    const images = imageAttachments;
    flushSync(() => {
      setLocalDraft("");
      setMentionChipPaths([]);
      setImageAttachments([]);
      setAttachmentError(undefined);
      props.onChange("");
    });
    props.onSend(prompt, images);
  }

  function addMentionChip(path: string): void {
    setMentionChipPaths((current) => current.includes(path) ? current : [...current, path]);
  }

  function promptWithMentionChips(): string {
    const chipMentions = mentionChipPaths.map((path) => `@${path}`).join(" ");
    return [chipMentions, localDraft.trim()].filter((part) => part.length > 0).join(" ");
  }

  function appendMentionToDraft(path: string): void {
    const textarea = textareaRef.current;
    flushSync(() => {
      addMentionChip(path);
      setMentionQuery(undefined);
    });
    textarea?.focus();
  }

  function insertMention(path: string): void {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? localDraft.length;
    const token = activeMentionToken(localDraft, cursor);
    if (!token) return;
    const next = `${localDraft.slice(0, token.start)}${localDraft.slice(cursor)}`.replace(/ {2,}/g, " ");
    flushSync(() => {
      setLocalDraft(next);
      addMentionChip(path);
      props.onChange(next);
      setMentionQuery(undefined);
    });
    textarea?.focus();
    textarea?.setSelectionRange(token.start, token.start);
  }

  return (
    <footer className="composer-region">
      <div
        className="composer-card"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          void attachImageFiles(event.dataTransfer.files);
        }}
      >
        <textarea
          aria-label="Prompt"
          disabled={props.disabled}
          onChange={(event) => updateComposerValue(event.target.value, event.target.selectionStart)}
          onClick={(event) => setMentionQuery(activeMentionQuery(localDraft, event.currentTarget.selectionStart))}
          onPaste={(event) => {
            const files = event.clipboardData.files;
            if (files.length > 0 && [...files].some((file) => file.type.startsWith("image/"))) {
              event.preventDefault();
              void attachImageFiles(files);
            }
          }}
          ref={textareaRef}
          onKeyDown={(event) => {
            if (mentionSuggestions.length > 0 && mentionQuery !== undefined) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setMentionIndex((current) => (current + 1) % mentionSuggestions.length);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setMentionIndex((current) => (current - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setMentionQuery(undefined);
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                insertMention(mentionSuggestions[mentionIndex]?.path ?? mentionSuggestions[0]?.path ?? "");
                return;
              }
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitComposer();
            }
          }}
          placeholder="Ask Pi to inspect, change, explain, or plan..."
          rows={3}
          value={localDraft}
        />
        {attachmentError ? <div className="composer-attachment-error">{attachmentError}</div> : null}
        {imageAttachments.length > 0 ? (
          <div className="composer-image-attachments">
            {imageAttachments.map((image) => (
              <button key={image.id} onClick={() => setImageAttachments((current) => current.filter((item) => item.id !== image.id))} title={`Remove ${image.name}`} type="button">
                <img alt="" src={image.previewDataUrl} />
                <span>{image.name}</span>
                <small>{formatBytes(image.size)}</small>
                <i aria-hidden="true">×</i>
              </button>
            ))}
          </div>
        ) : null}
        {mentionChipPaths.length > 0 ? (
          <div className="composer-mention-chips">
            {mentionChipPaths.map((path) => (
              <button key={path} onClick={() => setMentionChipPaths((current) => current.filter((item) => item !== path))} title={`Remove ${path}`} type="button">
                <span>{path}</span>
                <i aria-hidden="true">×</i>
              </button>
            ))}
          </div>
        ) : null}
        {mentionSuggestions.length > 0 ? (
          <div className="mention-suggestions">
            {mentionSuggestions.map((file, index) => (
              <button className={index === mentionIndex ? "active" : ""} key={file.path} onMouseDown={(event) => event.preventDefault()} onClick={() => insertMention(file.path)} type="button">
                <span>{file.name}</span>
                <small>{file.path}</small>
              </button>
            ))}
          </div>
        ) : null}
        <div className="composer-footer">
          <div className="composer-context">
            <span>{props.selectedSession?.title ?? "No session selected"}</span>
            <span>{composerStatus}</span>
          </div>
          <div className="composer-model-controls">
            {props.showPlanRefinement ? <button className="mode-button" onClick={props.onPlanRefinement} title="Refine the active continuity plan or add more tasks before continuing or finalizing" type="button">Plan</button> : null}
            <button className="mode-button" onClick={props.onWorkflowAction} title={workflowButtonTitle(props.workflowLabel, props.showPlanRefinement)} type="button">{props.workflowLabel}</button>
            <button
              className={props.revertSafeEditsEnabled ? "revert-safe-toggle active" : "revert-safe-toggle"}
              onClick={() => props.onRevertSafeEditsChange(!props.revertSafeEditsEnabled)}
              title="Revert-safe edits: prefer read/edit/write tools and ask Pi to declare files before shell mutations. GPi injects a prompt instruction when enabled."
              type="button"
            >
              Revert-safe
            </button>
            <ComposerSelect
              className="model"
              disabled={!canSelectModel}
              emptyLabel={props.hasRealHandle ? "No authed models" : "Pi model"}
              label="Model"
              onChange={props.onModelChange}
              options={models.map((model) => ({ label: `${model.name} · ${model.provider}`, value: `${model.provider}/${model.id}` }))}
              value={currentModelValue}
            />
            <ComposerSelect
              className="thinking"
              disabled={!canSelectThinking}
              emptyLabel="off"
              label="Think"
              onChange={props.onThinkingChange}
              options={(props.modelOptions?.availableThinkingLevels ?? ["off"]).map((level) => ({ label: level, value: level }))}
              value={props.modelOptions?.currentThinkingLevel ?? "off"}
            />
          </div>
          <div className="composer-controls">
            {props.isCompacting && props.hasRealHandle ? <button className="abort-button" onClick={props.onAbortCompaction} title="Abort compaction" type="button">Abort compact</button> : null}
            {props.isBusy && props.hasRealHandle && !props.isCompacting ? <button className="abort-button" onClick={props.onAbort} title="Abort the running Pi turn" type="button">Abort</button> : null}
            <button className="mode-button" onClick={() => void attachImagesFromPicker()} title="Attach images" type="button">Attach</button>
            <button className="send-button" disabled={props.disabled || props.isCompacting || (localDraft.trim().length === 0 && mentionChipPaths.length === 0 && imageAttachments.length === 0)} onClick={submitComposer} title={props.isCompacting ? "Wait for compaction to finish" : props.isBusy && props.hasRealHandle ? "Queue this as a follow-up" : "Send prompt to Pi"} type="button">
              {props.isBusy && props.hasRealHandle && !props.isCompacting ? "Follow up" : "Send"}
            </button>
          </div>
        </div>
        {props.sessionStats ? <ComposerStats canCompact={props.hasRealHandle && !props.isBusy} isCompacting={props.isCompacting} summary={props.sessionStats} onCompact={props.onCompact} /> : null}
      </div>
    </footer>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
    };
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toString()} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toString()} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function activeMentionToken(text: string, cursor: number): { start: number; query: string } | undefined {
  const beforeCursor = text.slice(0, cursor);
  const match = /(^|\s)@([^\s]*)$/.exec(beforeCursor);
  if (!match) return undefined;
  return { start: beforeCursor.length - (match[2]?.length ?? 0) - 1, query: match[2] ?? "" };
}

function activeMentionQuery(text: string, cursor: number): string | undefined {
  return activeMentionToken(text, cursor)?.query;
}

function findFileMentionSuggestions(files: GpiProjectFileEntry[], query: string): GpiProjectFileEntry[] {
  const normalizedQuery = query.toLowerCase();
  const exact: GpiProjectFileEntry[] = [];
  const namePrefix: GpiProjectFileEntry[] = [];
  const pathPrefix: GpiProjectFileEntry[] = [];
  const contains: GpiProjectFileEntry[] = [];

  for (const file of files) {
    if (normalizedQuery.length === 0) {
      namePrefix.push(file);
    } else {
      const name = file.name.toLowerCase();
      const path = file.path.toLowerCase();
      if (name === normalizedQuery) exact.push(file);
      else if (name.startsWith(normalizedQuery)) namePrefix.push(file);
      else if (path.startsWith(normalizedQuery)) pathPrefix.push(file);
      else if (path.includes(normalizedQuery)) contains.push(file);
    }
    if (exact.length + namePrefix.length + pathPrefix.length + contains.length >= 24) break;
  }

  return [...exact, ...namePrefix, ...pathPrefix, ...contains].slice(0, 8);
}

function workflowButtonTitle(label: string, hasSeparatePlanButton: boolean): string {
  if (label === "Initialize") return "Initialize continuity for this session";
  if (label === "Plan") return "Ask Pi to create or refine the active continuity queue";
  if (label === "Start") return hasSeparatePlanButton ? "Continue executing the active queue; use Plan to add or refine tasks first" : "Start executing the planned continuity queue";
  if (label === "End") return "End and archive continuity state";
  return label;
}

function ComposerStats(props: { canCompact: boolean; isCompacting: boolean; summary: string; onCompact: () => void }) {
  const stats = parseSessionStatsSummary(props.summary);
  return (
    <div className="composer-stats-bar" title={props.summary}>
      <span className="composer-stats-label">Session stats</span>
      {stats.messages ? <span><strong>{stats.messages}</strong> messages</span> : null}
      {stats.tools ? <span><strong>{stats.tools}</strong> tools</span> : null}
      {stats.tokens ? <span><strong>{stats.tokens}</strong> tokens</span> : null}
      {stats.cost ? <span><strong>${stats.cost}</strong></span> : null}
      {stats.context ? (
        <span className="composer-context-meter">
          <span className="composer-context-track"><span style={{ width: `${stats.context.percent.toString()}%` }} /></span>
          <strong>{stats.context.used}/{stats.context.limit}</strong> context · {stats.context.percentLabel}
        </span>
      ) : null}
      {!stats.hasStructuredParts ? <span>{props.summary}</span> : null}
      <button className="composer-stats-compact" disabled={!props.canCompact || props.isCompacting} onClick={props.onCompact} title={props.isCompacting ? "Compaction is running" : "Compact this Pi session"} type="button">
        {props.isCompacting ? "Compacting" : "Compact"}
      </button>
    </div>
  );
}

function parseSessionStatsSummary(summary: string): {
  messages: string | undefined;
  tools: string | undefined;
  tokens: string | undefined;
  cost: string | undefined;
  context: { used: string; limit: string; percent: number; percentLabel: string } | undefined;
  hasStructuredParts: boolean;
} {
  const messages = matchStat(summary, /messages\s+(\d+)/i);
  const tools = matchStat(summary, /tools\s+(\d+)/i);
  const tokens = matchStat(summary, /tokens\s+(\d+)/i);
  const cost = matchStat(summary, /cost\s+([0-9.]+)/i);
  const contextMatch = /context:\s*(\d+)\/(\d+)\s*\(([^)]+)%\)/i.exec(summary);
  const percent = contextMatch ? Number.parseFloat(contextMatch[3] ?? "0") : 0;
  return {
    messages,
    tools,
    tokens,
    cost,
    context: contextMatch ? { used: contextMatch[1] ?? "0", limit: contextMatch[2] ?? "0", percent: Math.max(0, Math.min(100, percent)), percentLabel: `${formatCompactPercent(percent)}%` } : undefined,
    hasStructuredParts: Boolean(messages || tools || tokens || cost || contextMatch),
  };
}

function matchStat(summary: string, pattern: RegExp): string | undefined {
  return pattern.exec(summary)?.[1];
}

function formatCompactPercent(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value < 10 ? value.toFixed(1) : value.toFixed(0);
}

function latestSessionStatsSummary(events: TimelineEvent[]): string | undefined {
  return [...events].reverse().find((event): event is Extract<TimelineEvent, { kind: "stats" }> => event.kind === "stats")?.summary;
}

function ComposerSelect(props: {
  className: string;
  disabled: boolean;
  emptyLabel: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = props.options.find((option) => option.value === props.value);
  const displayLabel = selectedOption?.label ?? props.emptyLabel;

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`composer-select-pill ${props.className} ${open ? "open" : ""}`} ref={rootRef}>
      <span>{props.label}</span>
      <button disabled={props.disabled} onClick={() => setOpen((current) => !current)} title={`${props.label}: ${displayLabel}`} type="button">
        <strong>{displayLabel}</strong>
        <span className="select-chevron">⌄</span>
      </button>
      {open && !props.disabled ? (
        <div className="composer-select-menu">
          {props.options.length === 0 ? <div className="composer-select-empty">{props.emptyLabel}</div> : null}
          {props.options.map((option) => (
            <button
              className={option.value === props.value ? "active" : ""}
              key={option.value}
              onClick={() => {
                props.onChange(option.value);
                setOpen(false);
              }}
              title={`Select ${option.label}`}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SessionInspector(props: {
  compactionOptions: GpiCompactionOptions | undefined;
  details: string[];
  hasRealHandle: boolean;
  project: GpiProject | undefined;
  projectEditName: string;
  projectEditPath: string;
  projectId: string | undefined;
  renameDraft: string;
  selectedSession: GpiSessionSummary | undefined;
  selectedSessionArchived: boolean;
  onAbortCompaction: () => void;
  onArchive: () => void;
  onChooseProjectEditPath: () => void;
  onClose: () => void;
  onCompact: () => void;
  onProjectEditNameChange: (value: string) => void;
  onProjectEditPathChange: (value: string) => void;
  onRemoveProject: () => void;
  onRename: () => void;
  onRenameDraftChange: (value: string) => void;
  onRestore: () => void;
  onSetAutoCompaction: (enabled: boolean) => void;
  onUpdateProject: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"tools" | "files" | "logs">("tools");
  const inspectorItems = useMemo(() => categorizeInspectorDetails(props.details), [props.details]);
  const visibleItems = inspectorItems[activeTab].slice().reverse();

  return (
    <aside className="session-inspector">
      <div className="inspector-header">
        <div>
          <span className="eyebrow">Inspector</span>
          <h2>{props.selectedSession ? "Tools & files" : "No session"}</h2>
        </div>

      </div>
      {props.selectedSession ? (
        <div className="session-management">
          <input aria-label="Session title" onChange={(event) => props.onRenameDraftChange(event.target.value)} value={props.renameDraft} />
          <div className="session-management-actions">
            <button disabled={props.renameDraft.trim().length === 0 || props.renameDraft === props.selectedSession.title} onClick={props.onRename} type="button">
              Rename
            </button>
            {props.selectedSessionArchived ? <button onClick={props.onRestore} type="button">Restore</button> : <button onClick={props.onArchive} type="button">Archive</button>}
          </div>
          <div className="compaction-controls">
            <div>
              <strong>Compaction</strong>
              <small>{props.hasRealHandle ? props.compactionOptions?.isCompacting ? "Running" : "Pi ready" : "Open a Pi session"}</small>
            </div>
            <div className="compaction-actions">
              {props.compactionOptions?.isCompacting ? (
                <button disabled={!props.hasRealHandle} onClick={props.onAbortCompaction} type="button">Abort</button>
              ) : (
                <button disabled={!props.hasRealHandle} onClick={props.onCompact} type="button">Compact</button>
              )}
              <button className={props.compactionOptions?.autoCompactionEnabled ? "active" : ""} disabled={!props.hasRealHandle} onClick={() => props.onSetAutoCompaction(!props.compactionOptions?.autoCompactionEnabled)} type="button">
                Auto {props.compactionOptions?.autoCompactionEnabled ? "on" : "off"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {props.project ? (
        <form
          className="session-management project-management"
          onSubmit={(event) => {
            event.preventDefault();
            props.onUpdateProject();
          }}
        >
          <span className="eyebrow">Project</span>
          <input aria-label="Selected project name" onChange={(event) => props.onProjectEditNameChange(event.target.value)} placeholder="Project name" value={props.projectEditName} />
          <div className="project-path-row">
            <input aria-label="Selected project path" onChange={(event) => props.onProjectEditPathChange(event.target.value)} placeholder="C:/path/to/project" value={props.projectEditPath} />
            <button onClick={props.onChooseProjectEditPath} type="button">Browse</button>
          </div>
          <div className="session-management-actions">
            <button disabled={props.projectEditName.trim().length === 0 || props.projectEditPath.trim().length === 0} type="submit">Save project</button>
            <button className="danger-menu-button" onClick={props.onRemoveProject} type="button">Remove</button>
          </div>
        </form>
      ) : null}
      <div className="inspector-tabs">
        <button className={activeTab === "tools" ? "active" : ""} onClick={() => setActiveTab("tools")} type="button">Tools</button>
        <button className={activeTab === "files" ? "active" : ""} onClick={() => setActiveTab("files")} type="button">Files</button>
        <button className={activeTab === "logs" ? "active" : ""} onClick={() => setActiveTab("logs")} type="button">Logs</button>
      </div>
      <div className="work-log">
        {activeTab === "files" && visibleItems.length > 0 ? <FileTree items={inspectorItems.files} projectId={props.projectId} /> : null}
        {visibleItems.length === 0 ? <div className="inspector-empty">No {activeTab} yet.</div> : null}
        {visibleItems.map((item, index) => (
          <InspectorCard item={item} key={`${item.raw}-${index.toString()}`} />
        ))}
      </div>
    </aside>
  );
}

type FileTreeEntry = {
  id: string;
  path: string;
  diff: string | undefined;
  status: "created" | "modified" | "deleted" | "confirmed" | "session" | "unknown";
  source: string;
};

type InspectorItem = {
  kind: "tool" | "file" | "log";
  title: string;
  meta: string;
  raw: string;
  tone: "neutral" | "ok" | "error" | "file";
};

function FileTree(props: { items: InspectorItem[]; projectId: string | undefined }) {
  const entries = buildFileTreeEntries(props.items);
  const [diffs, setDiffs] = useState<Record<string, { diff: string; kind: "git" | "created" | "unavailable"; message: string | undefined }>>({});

  useEffect(() => {
    if (!window.gpi || !props.projectId) return;
    let cancelled = false;
    for (const entry of entries) {
      if (entry.status === "session" || diffs[entry.id] || entry.diff) continue;
      void window.gpi.getFileDiff(props.projectId, entry.path).then((result) => {
        if (cancelled) return;
        setDiffs((current) => ({ ...current, [entry.id]: { diff: result.diff, kind: result.kind, message: result.message } }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [diffs, entries, props.projectId]);

  return (
    <section className="file-tree-panel">
      <div className="file-tree-header">
        <strong>Changed files</strong>
        <span>{entries.length.toString()} known</span>
      </div>
      {entries.length === 0 ? <div className="inspector-empty">No file paths detected yet.</div> : null}
      {entries.map((entry) => {
        const diff = entry.diff ? { diff: entry.diff, kind: "git" } : diffs[entry.id];
        return <LazyFileTreeDiffDetails diff={diff} entry={entry} key={entry.id} />;
      })}
      <div className="diff-gap-note">
        Diffs are real git/untracked-file diffs only. GPi does not synthesize diffs from insufficient tool args.
      </div>
    </section>
  );
}

function LazyFileTreeDiffDetails(props: { diff: { diff?: string; kind?: string; message?: string } | undefined; entry: FileTreeEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details className="file-tree-entry" onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary className="file-tree-row">
        <span className={`file-tree-status ${props.entry.status}`}>{props.entry.status}</span>
        <code>{props.entry.path}</code>
        <small>{props.diff?.kind === "git" || props.diff?.kind === "created" ? "diff ready" : props.entry.source}</small>
      </summary>
      {expanded ? props.diff?.diff ? <DiffPreview diff={props.diff.diff} /> : <div className="diff-gap-note">{diffMessage(props.diff)}</div> : null}
    </details>
  );
}

function diffMessage(diff: unknown): string {
  if (typeof diff === "object" && diff !== null && "message" in diff && typeof diff.message === "string") return diff.message;
  return "Diff unavailable for this file.";
}

function DiffPreview(props: { diff: string }) {
  return (
    <pre className="diff-preview">
      {truncateInspectorText(props.diff).split("\n").map((line, index) => (
        <span className={diffLineClassName(line)} key={`${index.toString()}-${line.slice(0, 12)}`}>{line || " "}</span>
      ))}
    </pre>
  );
}

function InspectorCard(props: { item: InspectorItem }) {
  const preview = truncateInspectorText(props.item.raw);
  const isTruncated = preview !== props.item.raw;
  return (
    <details className={`inspector-card ${props.item.tone}`}>
      <summary>
        <span className="work-dot" />
        <span className="inspector-card-copy">
          <strong>{props.item.title}</strong>
          <small>{props.item.meta}</small>
        </span>
        <MessageCopyButton label="Copy" text={props.item.raw} />
      </summary>
      <pre>{preview}</pre>
      {isTruncated ? <div className="inspector-card-note">Preview truncated. Copy includes full output.</div> : null}
    </details>
  );
}

function categorizeInspectorDetails(details: string[]): Record<"tools" | "files" | "logs", InspectorItem[]> {
  return details.reduce<Record<"tools" | "files" | "logs", InspectorItem[]>>(
    (groups, detail) => {
      const item = parseInspectorDetail(detail);
      if (item.kind === "tool") groups.tools.push(item);
      if (item.kind === "file") groups.files.push(item);
      if (item.kind === "log") groups.logs.push(item);
      return groups;
    },
    { tools: [], files: [], logs: [] },
  );
}

function parseInspectorDetail(detail: string): InspectorItem {
  if (detail.startsWith("tool started:")) {
    const toolName = detail.replace("tool started:", "").trim().split(" ")[0] ?? "tool";
    return { kind: "tool", title: toolName, meta: "started", raw: detail, tone: "neutral" };
  }
  if (detail.startsWith("tool finished:")) {
    const isError = detail.includes(" error");
    const toolName = detail.replace("tool finished:", "").trim().split(" ")[0] ?? "tool";
    const duration = detail.match(/in \d+ms/)?.[0] ?? (isError ? "error" : "finished");
    return { kind: "tool", title: toolName, meta: isError ? `failed • ${duration}` : `ok • ${duration}`, raw: detail, tone: isError ? "error" : "ok" };
  }
  if (detail.startsWith("args:")) return { kind: "tool", title: "Arguments", meta: "tool input", raw: detail, tone: "neutral" };
  if (detail.startsWith("result:")) return { kind: "tool", title: "Result", meta: "tool output", raw: detail, tone: detail.includes("error") ? "error" : "ok" };
  if (detail.startsWith("stats:")) return { kind: "log", title: "Session stats", meta: "usage/context", raw: detail, tone: "neutral" };
  if (detail.startsWith("diff:")) return { kind: "file", title: detail.split("\n")[0]?.replace("diff:", "").trim() ?? "Diff", meta: "real tool diff", raw: detail, tone: "file" };
  if (detail.startsWith("file ") || detail.startsWith("file confirmed:")) {
    const path = detail.includes(":") ? detail.split(":").slice(1).join(":").trim() : detail;
    return { kind: "file", title: path, meta: detail.startsWith("file confirmed:") ? "confirmed" : "hint", raw: detail, tone: "file" };
  }
  if (detail.includes("session file:") || detail.startsWith("imported Pi session:")) return { kind: "file", title: "Session file", meta: "Pi history", raw: detail, tone: "file" };
  if (detail.startsWith("error:")) return { kind: "log", title: "Error", meta: "action required • copy details", raw: detail, tone: "error" };
  return { kind: "log", title: detail.split(" - ")[0] ?? "Log", meta: "event", raw: detail, tone: "neutral" };
}

function buildFileTreeEntries(items: InspectorItem[]): FileTreeEntry[] {
  const entries = items.flatMap((item, index) => {
    const entry = parseFileTreeEntry(item, index);
    return entry ? [entry] : [];
  });
  const latestByPath = new Map<string, FileTreeEntry>();
  for (const entry of entries) latestByPath.set(entry.path, entry);
  return [...latestByPath.values()];
}

function parseFileTreeEntry(item: InspectorItem, index: number): FileTreeEntry | undefined {
  const idSuffix = `${index.toString()}-${hashString(item.raw)}`;
  if (item.raw.startsWith("diff:")) {
    const [header, ...diffLines] = item.raw.split("\n");
    const path = header?.replace("diff:", "").trim() ?? "unknown";
    return { id: `diff-${idSuffix}`, path, diff: diffLines.join("\n"), status: "modified", source: "Pi tool diff" };
  }
  if (item.raw.includes("session file:") || item.raw.startsWith("imported Pi session:")) {
    const path = item.raw.split(":").slice(1).join(":").trim();
    return { id: `session-${idSuffix}`, path, diff: undefined, status: "session", source: "Pi history" };
  }
  const fileMatch = item.raw.match(/^file (?<status>created|modified|deleted|renamed|unknown): (?<path>.+?)(?: \((?<source>.+)\))?$/);
  if (fileMatch?.groups) {
    return {
      id: `file-${idSuffix}`,
      path: fileMatch.groups.path,
      diff: undefined,
      status: fileMatch.groups.status === "renamed" ? "modified" : (fileMatch.groups.status as FileTreeEntry["status"]),
      source: fileMatch.groups.source ?? "Pi tool hint",
    };
  }
  const confirmedMatch = item.raw.match(/^file confirmed: (?<path>.+)$/);
  if (confirmedMatch?.groups) return { id: `confirmed-${idSuffix}`, path: confirmedMatch.groups.path, diff: undefined, status: "confirmed", source: "Pi tool result" };
  return undefined;
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(36);
}

function diffLineClassName(line: string): string {
  if (line.startsWith("+++ ") || line.startsWith("--- ") || line.startsWith("diff --git") || line.startsWith("@@")) return "diff-line meta";
  if (line.startsWith("+")) return "diff-line added";
  if (line.startsWith("-")) return "diff-line removed";
  return "diff-line context";
}

function truncateInspectorText(text: string): string {
  if (text.length <= 900) return text;
  return `${text.slice(0, 900)}\n\n[Output truncated]`;
}

function isWorkDetail(detail: string): boolean {
  return detail.startsWith("tool ") || detail.startsWith("args:") || detail.startsWith("result:") || detail.startsWith("file ") || detail.startsWith("stats:") || detail.startsWith("Pi ");
}

function summarizeWorkDetail(detail: string): string {
  const summary = detail.replace(/^args:/, "Args:").replace(/^result:/, "Result:").replace(/^tool started:/, "Started").replace(/^tool finished:/, "Finished");
  if (summary.length <= 160) return summary;
  return `${summary.slice(0, 160)}...`;
}

function StatusBadge(props: { status: SessionStatus }) {
  return <span className={`status-badge ${props.status}`}>{statusLabels[props.status]}</span>;
}

function workflowSkillsInstalled(status: WorkflowSkillsStatus): boolean {
  return status.skills.every((skill) => skill.status === "installed");
}

function planModeOnboardingSeen(): boolean {
  return window.localStorage.getItem("gpi.planModeOnboardingSeen") === "true";
}

function markPlanModeOnboardingSeen(): void {
  window.localStorage.setItem("gpi.planModeOnboardingSeen", "true");
}

function commandPaletteItem(command: PaletteCommand, label: string, meta: string): QuickSwitcherItem {
  return { kind: "command", id: `command:${command}`, command, label, meta };
}

function buildQuickSwitcherItems(
  projects: GpiProject[],
  sessions: GpiSessionSummary[],
  archivedSessions: Record<string, boolean>,
  query: string,
  showArchivedSessions: boolean,
  mode: "commands" | "switcher",
  context: { hasSelectedProject: boolean; hasSelectedSession: boolean; selectedSessionArchived: boolean; selectedSessionCanCompact: boolean; workflowSkillsInstalled: boolean },
): QuickSwitcherItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  const commandItems = [
    commandPaletteItem("add-project", "Add project", "Choose a local folder and add it to GPi"),
    commandPaletteItem("take-plan-onboarding", "Take Plan Onboarding", "Replay the full Continuity Mode onboarding"),
    !context.workflowSkillsInstalled ? commandPaletteItem("install-workflow-skills", "Install workflow skills", "Install GPi continuity skills after preview") : undefined,
    context.hasSelectedSession && context.workflowSkillsInstalled ? commandPaletteItem("initialize-continuity", "Initialize continuity", "Send /init-cont once with optional composer context") : undefined,
    context.hasSelectedSession && context.workflowSkillsInstalled ? commandPaletteItem("plan-continuity", "Plan queue", "Send /plan-cont once") : undefined,
    context.hasSelectedSession && context.workflowSkillsInstalled ? commandPaletteItem("start-continuity", "Start queue", "Send /start-cont once") : undefined,
    context.hasSelectedSession && context.workflowSkillsInstalled ? commandPaletteItem("finish-continuity", "End continuity", "Send /end-cont once") : undefined,
    context.hasSelectedProject ? commandPaletteItem("new-pi-session", "New Session", "Start a new Pi chat in the selected project") : undefined,
    context.hasSelectedProject ? commandPaletteItem("import-pi-sessions", "Import Pi sessions", "Discover existing Pi sessions for this project") : undefined,
    commandPaletteItem("next-attention", "Next attention session", "Jump to the next waiting/error/running session"),
    commandPaletteItem("toggle-archived", showArchivedSessions ? "Hide archived sessions" : "Show archived sessions", "Toggle archived sessions in the sidebar"),
    context.hasSelectedSession && context.selectedSessionArchived ? commandPaletteItem("restore-selected-session", "Restore selected session", "Show current archived session again") : undefined,
  ].filter((item): item is QuickSwitcherItem => item !== undefined);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const projectItems: QuickSwitcherItem[] = projects.map((project) => ({
    kind: "project",
    id: `project:${project.id}`,
    project,
    label: project.name,
    meta: project.path,
  }));
  const sessionItems: QuickSwitcherItem[] = sessions
    .filter((session) => showArchivedSessions || !archivedSessions[session.id])
    .map((session) => {
      const project = projectById.get(session.projectId);
      return {
        kind: "session",
        id: `session:${session.id}`,
        session,
        project,
        label: session.title,
        meta: `${project?.name ?? "Unknown project"} • ${originLabels[session.origin]} • ${statusLabels[session.status]} • ${session.lastActivity}`,
      };
    });

  const items = mode === "commands" ? commandItems : [...sessionItems, ...projectItems];
  return items.filter((item) => {
    if (normalizedQuery.length === 0) return true;
    return `${item.label} ${item.meta}`.toLowerCase().includes(normalizedQuery);
  });
}

function isCurrentQuickSwitcherItem(item: QuickSwitcherItem, selectedProjectId: string, selectedSessionId: string): boolean {
  if (item.kind === "project") return item.project.id === selectedProjectId;
  if (item.kind === "session") return item.session.id === selectedSessionId;
  return false;
}

function quickSwitcherKindLabel(item: QuickSwitcherItem): string {
  if (item.kind === "command") return "Action";
  if (item.kind === "project") return "Project";
  return statusLabels[item.session.status];
}

function sortSessionsByAttention(sessions: GpiSessionSummary[], _selectedSessionId: string | undefined, _selectionRanks: Record<string, number>): GpiSessionSummary[] {
  return sessions;
}

function sessionSortPriority(status: SessionStatus): number {
  const priority = attentionPriority.indexOf(status);
  if (priority !== -1) return priority;
  if (status === "completed") return 8;
  return 7;
}

function findNextAttentionSession(
  sessions: GpiSessionSummary[],
  archivedSessions: Record<string, boolean>,
  selectedSessionId: string,
): GpiSessionSummary | undefined {
  const candidates = sessions.filter((session) => !archivedSessions[session.id] && attentionPriority.includes(session.status));
  if (candidates.length === 0) return undefined;
  const currentIndex = candidates.findIndex((session) => session.id === selectedSessionId);
  const rotated = currentIndex === -1 ? candidates : [...candidates.slice(currentIndex + 1), ...candidates.slice(0, currentIndex + 1)];
  return rotated.sort((left, right) => attentionPriority.indexOf(left.status) - attentionPriority.indexOf(right.status))[0];
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select, [contenteditable='true'], [contenteditable='']");
}

function scrollTimelineToBottom(element: HTMLElement | null, behavior: ScrollBehavior = "auto", shouldCancel?: () => boolean): void {
  if (!element) return;

  const scroll = () => {
    if (shouldCancel?.()) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
  };

  scroll();
  window.requestAnimationFrame(scroll);
  window.setTimeout(scroll, 50);
  window.setTimeout(scroll, 180);
}

function isNearScrollBottom(element: HTMLElement): boolean {
  const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
  return distanceFromBottom < 96;
}

function previousIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return (index - 1 + length) % length;
}

function nextIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return (index + 1) % length;
}

function compactIdentifier(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}...${id.slice(-5)}`;
}

function projectNameFromPath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized.split("/").filter(Boolean).at(-1) ?? "Project";
}
