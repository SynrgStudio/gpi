import type { GpiPiEvent } from "../../bridge/pi-bridge.js";
import type { ChatMessage, GpiDiscoveredSession, GpiSessionSummary, SessionDetails, SessionFiles, SessionMessages, SessionStatus, SessionTimelineEvents, TimelineEvent, TimelineEventBase, TurnSnapshotIndexEntry, WorkspaceState } from "../../domain/types.js";

export const initialWorkspace: WorkspaceState = {
  storageVersion: 1,
  selectedProjectId: "gpi",
  selectedSessionId: "sdk-bridge",
  projects: [
    { id: "gpi", name: "GPi", path: "C:/gpi", sessionIds: ["vision", "sdk-bridge", "visual-shell"] },
    { id: "pi", name: "Pi", path: "C:/pi", sessionIds: ["tui-polish", "rpc-events"] },
    { id: "zettel", name: "Zettelkasten", path: "D:/zettel", sessionIds: ["telegram-pipeline"] },
  ],
  sessions: [
    { id: "vision", projectId: "gpi", title: "Product vision", status: "completed", lastActivity: "Vision docs ready", origin: "mock" },
    { id: "sdk-bridge", projectId: "gpi", title: "SDK bridge spike", status: "running_tool", lastActivity: "Reading Pi SDK docs", origin: "mock" },
    { id: "visual-shell", projectId: "gpi", title: "Glass shell", status: "streaming", lastActivity: "Rendering cockpit", origin: "mock" },
    { id: "tui-polish", projectId: "pi", title: "TUI polish", status: "waiting_input", lastActivity: "Needs direction", origin: "mock" },
    { id: "rpc-events", projectId: "pi", title: "RPC events", status: "idle", lastActivity: "Idle", origin: "mock" },
    { id: "telegram-pipeline", projectId: "zettel", title: "Telegram pipeline", status: "error", lastActivity: "Anytype relation mismatch", origin: "mock" },
  ],
  messages: {
    "sdk-bridge": [
      "Necesitamos una cabina hermosa para manejar varias sesiones de Pi.",
      "GPi arranca como cockpit multi-proyecto: sidebar vivo, chat central, panel operativo y un input que siempre se siente listo.",
    ],
  },
  chatMessages: {},
  drafts: {},
  details: {
    "sdk-bridge": ["read docs/sdk.md — completed", "write docs/adr/0001-gpi-architecture.md — completed"],
  },
  timelineEvents: {},
  backendHandles: {},
  sessionFiles: {},
  archivedSessions: {},
  sessionSelectionRanks: {},
  turnSnapshots: {},
  settings: { revertSafeEditsEnabled: false, piInstallOnboardingSeen: false },
};

export function hydrateWorkspace(persisted: Partial<WorkspaceState> | undefined): WorkspaceState {
  if (!persisted) return initialWorkspace;

  const sessionFiles = persisted.sessionFiles ?? initialWorkspace.sessionFiles;
  const sessions = (persisted.sessions ?? initialWorkspace.sessions).map((session) => hydrateSessionOrigin(session, sessionFiles));
  const messages = persisted.messages ?? initialWorkspace.messages;
  return {
    ...initialWorkspace,
    ...persisted,
    storageVersion: 1,
    sessions,
    messages,
    chatMessages: persisted.chatMessages ?? migrateLegacyMessages(messages),
    drafts: sanitizeImportedSessionDrafts(persisted.drafts ?? initialWorkspace.drafts, sessions, messages),
    details: persisted.details ?? initialWorkspace.details,
    timelineEvents: persisted.timelineEvents ?? initialWorkspace.timelineEvents,
    backendHandles: initialWorkspace.backendHandles,
    sessionFiles,
    archivedSessions: persisted.archivedSessions ?? initialWorkspace.archivedSessions,
    sessionSelectionRanks: persisted.sessionSelectionRanks ?? initialWorkspace.sessionSelectionRanks,
    turnSnapshots: persisted.turnSnapshots ?? initialWorkspace.turnSnapshots,
    settings: { ...initialWorkspace.settings, ...persisted.settings },
  };
}

export function updateRevertSafeEditsSetting(workspace: WorkspaceState, enabled: boolean): WorkspaceState {
  return { ...workspace, settings: { ...workspace.settings, revertSafeEditsEnabled: enabled } };
}

export function markRevertSafeTurn(workspace: WorkspaceState, _sessionId: string): WorkspaceState {
  return workspace;
}

export function markPiInstallOnboardingSeen(workspace: WorkspaceState): WorkspaceState {
  return { ...workspace, settings: { ...workspace.settings, piInstallOnboardingSeen: true } };
}

export function appendRevertResultEvent(workspace: WorkspaceState, sessionId: string, message: string, tone: "success" | "warning"): WorkspaceState {
  return { ...workspace, timelineEvents: appendSystemTimelineEvent(workspace.timelineEvents, sessionId, message, "gpi", tone) };
}

export function addTurnSnapshotIndexEntry(workspace: WorkspaceState, entry: TurnSnapshotIndexEntry): WorkspaceState {
  return {
    ...workspace,
    turnSnapshots: {
      ...workspace.turnSnapshots,
      [entry.sessionId]: {
        ...(workspace.turnSnapshots[entry.sessionId] ?? {}),
        [entry.turnId]: entry,
      },
    },
  };
}

export function toPersistedWorkspace(workspace: WorkspaceState): WorkspaceState {
  return {
    ...workspace,
    backendHandles: {},
  };
}

export function selectSessionInWorkspace(workspace: WorkspaceState, session: GpiSessionSummary): WorkspaceState {
  return {
    ...workspace,
    selectedProjectId: session.projectId,
    selectedSessionId: session.id,
    sessionSelectionRanks: { ...workspace.sessionSelectionRanks, [session.id]: nextSelectionRank(workspace.sessionSelectionRanks) },
  };
}

export function selectProjectInWorkspace(workspace: WorkspaceState, projectId: string): WorkspaceState {
  const project = workspace.projects.find((candidate) => candidate.id === projectId);
  if (!project) return workspace;

  return {
    ...workspace,
    selectedProjectId: project.id,
    selectedSessionId: firstVisibleSessionId(project.sessionIds, workspace.archivedSessions),
  };
}

export function renameSessionInWorkspace(workspace: WorkspaceState, sessionId: string, title: string): WorkspaceState {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) return workspace;

  return {
    ...workspace,
    sessions: workspace.sessions.map((session) => (session.id === sessionId ? { ...session, title: trimmedTitle } : session)),
  };
}

export function archiveSessionInWorkspace(workspace: WorkspaceState, sessionId: string): WorkspaceState {
  const session = workspace.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) return workspace;
  const project = workspace.projects.find((candidate) => candidate.id === session.projectId);
  const archivedSessions = { ...workspace.archivedSessions, [sessionId]: true };

  return {
    ...workspace,
    archivedSessions,
    selectedSessionId: workspace.selectedSessionId === sessionId && project ? firstVisibleSessionId(project.sessionIds, archivedSessions) : workspace.selectedSessionId,
  };
}

export function restoreSessionInWorkspace(workspace: WorkspaceState, sessionId: string): WorkspaceState {
  return {
    ...workspace,
    archivedSessions: { ...workspace.archivedSessions, [sessionId]: false },
    selectedSessionId: sessionId,
    sessionSelectionRanks: { ...workspace.sessionSelectionRanks, [sessionId]: nextSelectionRank(workspace.sessionSelectionRanks) },
  };
}

export function addProjectToWorkspace(workspace: WorkspaceState, project: { id: string; name: string; path: string }): WorkspaceState {
  return {
    ...workspace,
    selectedProjectId: project.id,
    selectedSessionId: "",
    projects: [...workspace.projects, { ...project, sessionIds: [] }],
  };
}

export function updateProjectInWorkspace(workspace: WorkspaceState, projectId: string, updates: { name: string; path: string }): WorkspaceState {
  const name = updates.name.trim();
  const path = updates.path.trim();
  if (name.length === 0 || path.length === 0) return workspace;
  return {
    ...workspace,
    projects: workspace.projects.map((project) => (project.id === projectId ? { ...project, name, path } : project)),
  };
}

export function removeProjectFromWorkspace(workspace: WorkspaceState, projectId: string): WorkspaceState {
  const project = workspace.projects.find((candidate) => candidate.id === projectId);
  if (!project) return workspace;
  const removedSessionIds = new Set(project.sessionIds);
  const projects = workspace.projects.filter((candidate) => candidate.id !== projectId);
  const fallbackProject = projects[0];
  return {
    ...workspace,
    selectedProjectId: workspace.selectedProjectId === projectId ? fallbackProject?.id ?? "" : workspace.selectedProjectId,
    selectedSessionId: workspace.selectedProjectId === projectId ? firstVisibleSessionId(fallbackProject?.sessionIds ?? [], workspace.archivedSessions) : workspace.selectedSessionId,
    projects,
    sessions: workspace.sessions.filter((session) => !removedSessionIds.has(session.id)),
    messages: removeRecordKeys(workspace.messages, removedSessionIds),
    chatMessages: removeRecordKeys(workspace.chatMessages, removedSessionIds),
    drafts: removeRecordKeys(workspace.drafts, removedSessionIds),
    details: removeRecordKeys(workspace.details, removedSessionIds),
    timelineEvents: removeRecordKeys(workspace.timelineEvents, removedSessionIds),
    backendHandles: removeRecordKeys(workspace.backendHandles, removedSessionIds),
    sessionFiles: removeRecordKeys(workspace.sessionFiles, removedSessionIds),
    archivedSessions: removeRecordKeys(workspace.archivedSessions, removedSessionIds),
    sessionSelectionRanks: removeRecordKeys(workspace.sessionSelectionRanks, removedSessionIds),
  };
}

export function importProjectSessions(workspace: WorkspaceState, projectId: string, discoveredSessions: GpiDiscoveredSession[]): WorkspaceState {
  const knownSessionFiles = new Set(Object.values(workspace.sessionFiles));
  const imported = discoveredSessions.filter((session) => !knownSessionFiles.has(session.path));
  const sessionsNeedingPreview = discoveredSessions.filter((session) => {
    const existingSessionId = sessionIdForFile(workspace.sessionFiles, session.path) ?? session.id;
    return (workspace.messages[existingSessionId] ?? []).length === 0;
  });
  if (imported.length === 0 && sessionsNeedingPreview.length === 0) return workspace;

  const importedSummaries: GpiSessionSummary[] = imported.map((session) => ({
    id: session.id,
    projectId,
    title: compactSessionTitle(session.title || session.firstMessage || `Pi session ${session.id.slice(0, 8)}`),
    status: "idle",
    lastActivity: `${session.messageCount.toString()} messages`,
    origin: "imported",
  }));
  const importedIds = importedSummaries.map((session) => session.id);
  const importedFiles = Object.fromEntries(imported.map((session) => [session.id, session.path]));
  const previewMessages = Object.fromEntries(
    sessionsNeedingPreview.map((session) => [sessionIdForFile(workspace.sessionFiles, session.path) ?? session.id, [formatImportedSessionTranscript(session)]]),
  );

  return {
    ...workspace,
    selectedProjectId: projectId,
    selectedSessionId: importedIds[0] ?? workspace.selectedSessionId,
    projects: workspace.projects.map((project) =>
      project.id === projectId ? { ...project, sessionIds: [...project.sessionIds, ...importedIds.filter((id) => !project.sessionIds.includes(id))] } : project,
    ),
    sessions: [...workspace.sessions, ...importedSummaries.filter((summary) => !workspace.sessions.some((session) => session.id === summary.id))],
    messages: { ...workspace.messages, ...previewMessages },
    chatMessages: { ...workspace.chatMessages, ...chatMessagesFromLegacy(previewMessages) },
    drafts: { ...workspace.drafts, ...Object.fromEntries(importedIds.map((sessionId) => [sessionId, ""])) },
    details: {
      ...workspace.details,
      ...Object.fromEntries(imported.map((session) => [session.id, [`imported Pi session: ${session.path}`, `cwd: ${session.cwd}`]])),
    },
    sessionFiles: { ...workspace.sessionFiles, ...importedFiles },
  };
}

export function addSessionToWorkspace(workspace: WorkspaceState, projectId: string, session: GpiSessionSummary): WorkspaceState {
  return {
    ...workspace,
    selectedProjectId: projectId,
    selectedSessionId: session.id,
    sessions: [...workspace.sessions, session],
    projects: workspace.projects.map((project) => (project.id === projectId ? { ...project, sessionIds: [...project.sessionIds, session.id] } : project)),
    messages: { ...workspace.messages, [session.id]: workspace.messages[session.id] ?? [] },
    chatMessages: { ...workspace.chatMessages, [session.id]: workspace.chatMessages[session.id] ?? [] },
    details: { ...workspace.details, [session.id]: workspace.details[session.id] ?? [] },
    timelineEvents: { ...workspace.timelineEvents, [session.id]: workspace.timelineEvents[session.id] ?? [] },
  };
}

export function addOptimisticRealSession(
  workspace: WorkspaceState,
  projectId: string,
  session: GpiSessionSummary,
  details: string[],
): WorkspaceState {
  return {
    ...addSessionToWorkspace(workspace, projectId, session),
    details: { ...workspace.details, [session.id]: details },
  };
}

export function replaceOptimisticSession(
  workspace: WorkspaceState,
  temporarySessionId: string,
  realSessionId: string,
  options: { backendHandle: string; sessionFile: string | undefined; readyMs: number },
): WorkspaceState {
  const temporaryDetails = workspace.details[temporarySessionId] ?? [];
  const temporaryMessages = workspace.messages[temporarySessionId] ?? [];
  const temporaryDraft = workspace.drafts[temporarySessionId] ?? "";
  const updatedSessions = workspace.sessions.map((session) =>
    session.id === temporarySessionId ? { ...session, id: realSessionId, status: "idle", lastActivity: "Pi SDK session ready", origin: "real" } satisfies GpiSessionSummary : session,
  );

  return {
    ...workspace,
    selectedSessionId: realSessionId,
    sessions: updatedSessions,
    projects: workspace.projects.map((project) => ({
      ...project,
      sessionIds: project.sessionIds.map((sessionId) => (sessionId === temporarySessionId ? realSessionId : sessionId)),
    })),
    messages: replaceRecordKey(workspace.messages, temporarySessionId, realSessionId, temporaryMessages),
    chatMessages: replaceRecordKey(workspace.chatMessages, temporarySessionId, realSessionId, workspace.chatMessages[temporarySessionId] ?? []),
    drafts: replaceRecordKey(workspace.drafts, temporarySessionId, realSessionId, temporaryDraft),
    details: replaceRecordKey(workspace.details, temporarySessionId, realSessionId, [
      ...temporaryDetails,
      `Pi SDK handle ready in ${options.readyMs.toString()}ms`,
      options.sessionFile ? `session file: ${options.sessionFile}` : "session file unavailable",
    ]),
    timelineEvents: replaceRecordKey(workspace.timelineEvents, temporarySessionId, realSessionId, workspace.timelineEvents[temporarySessionId] ?? []),
    backendHandles: { ...removeRecordKey(workspace.backendHandles, temporarySessionId), [realSessionId]: options.backendHandle },
    sessionFiles: options.sessionFile
      ? { ...removeRecordKey(workspace.sessionFiles, temporarySessionId), [realSessionId]: options.sessionFile }
      : removeRecordKey(workspace.sessionFiles, temporarySessionId),
  };
}

export function updateDraftInWorkspace(workspace: WorkspaceState, sessionId: string, value: string): WorkspaceState {
  return { ...workspace, drafts: { ...workspace.drafts, [sessionId]: value } };
}

export function markPromptAccepted(workspace: WorkspaceState, sessionId: string, prompt: string, detail: string, lastActivity: string): WorkspaceState {
  return {
    ...workspace,
    sessions: updateSessionStatus(workspace.sessions, sessionId, "thinking", lastActivity),
    messages: { ...workspace.messages, [sessionId]: [...(workspace.messages[sessionId] ?? []), prompt] },
    chatMessages: appendChatMessage(workspace.chatMessages, sessionId, "user", prompt),
    details: { ...workspace.details, [sessionId]: [...(workspace.details[sessionId] ?? []), detail] },
    timelineEvents: appendUserTimelineEvent(workspace.timelineEvents, sessionId, prompt, detail.startsWith("mock") ? "mock" : "gpi"),
    drafts: { ...workspace.drafts, [sessionId]: "" },
  };
}

export function markSessionReopening(workspace: WorkspaceState, sessionId: string): WorkspaceState {
  return {
    ...workspace,
    sessions: updateSessionStatus(workspace.sessions, sessionId, "thinking", "Reopening Pi session"),
    details: appendDetail(workspace.details, sessionId, "Reopening Pi SDK handle"),
  };
}

export function markSessionReopened(workspace: WorkspaceState, sessionId: string, backendHandle: string, sessionFile: string | undefined): WorkspaceState {
  return {
    ...workspace,
    sessions: updateSessionStatus(workspace.sessions, sessionId, "idle", "Pi SDK handle reopened"),
    backendHandles: { ...workspace.backendHandles, [sessionId]: backendHandle },
    sessionFiles: sessionFile ? { ...workspace.sessionFiles, [sessionId]: sessionFile } : workspace.sessionFiles,
    details: appendDetail(workspace.details, sessionId, "Pi SDK handle reopened"),
  };
}

export function markSessionError(workspace: WorkspaceState, sessionId: string, lastActivity: string, detail: string): WorkspaceState {
  return {
    ...workspace,
    sessions: updateSessionStatus(workspace.sessions, sessionId, "error", lastActivity),
    details: appendDetail(workspace.details, sessionId, detail),
  };
}

export function markSessionAborted(workspace: WorkspaceState, sessionId: string): WorkspaceState {
  return {
    ...workspace,
    sessions: updateSessionStatus(workspace.sessions, sessionId, "completed", "Run aborted by user"),
    details: appendDetail(workspace.details, sessionId, "abort requested by user"),
  };
}

export function applyMockEventToWorkspace(workspace: WorkspaceState, sessionId: string, status: SessionStatus, detail: string): WorkspaceState {
  return {
    ...workspace,
    sessions: updateSessionStatus(workspace.sessions, sessionId, status, detail),
    messages:
      status === "streaming"
        ? { ...workspace.messages, [sessionId]: [...(workspace.messages[sessionId] ?? []), "Mock bridge streaming response into the selected GPi session."] }
        : workspace.messages,
    chatMessages: status === "streaming" ? appendChatMessage(workspace.chatMessages, sessionId, "assistant", "Mock bridge streaming response into the selected GPi session.") : workspace.chatMessages,
    details: appendDetail(workspace.details, sessionId, detail),
    timelineEvents: status === "streaming" ? appendAssistantTimelineDelta(workspace.timelineEvents, sessionId, "Mock bridge streaming response into the selected GPi session.", "Mock model · thinking off", "mock") : appendSystemTimelineEvent(workspace.timelineEvents, sessionId, detail, "mock"),
  };
}

export function reducePiEvent(workspace: WorkspaceState, event: GpiPiEvent): WorkspaceState {
  switch (event.type) {
    case "status_changed":
      return { ...workspace, sessions: updateSessionStatus(workspace.sessions, event.sessionId, event.status, `Pi status: ${event.status}`) };
    case "run_phase":
      return { ...workspace, timelineEvents: appendRunPhaseTimelineEvent(workspace.timelineEvents, event) };
    case "thinking_delta":
      return { ...workspace, timelineEvents: appendRunPhaseDeltaTimelineEvent(workspace.timelineEvents, event.sessionId, "thinking", event.delta) };
    case "tool_call_delta":
      return { ...workspace, timelineEvents: appendRunPhaseDeltaTimelineEvent(workspace.timelineEvents, event.sessionId, "preparing_tool", event.delta) };
    case "timing_mark":
      return { ...workspace, details: appendDetail(workspace.details, event.sessionId, `timing: ${event.mark} at ${event.timestamp.toString()}`) };
    case "text_delta":
      return {
        ...workspace,
        messages: appendStreamingDelta(workspace.messages, event.sessionId, event.delta),
        chatMessages: appendAssistantDelta(workspace.chatMessages, event.sessionId, event.delta, event.responseMeta),
        timelineEvents: appendAssistantTimelineDelta(workspace.timelineEvents, event.sessionId, event.delta, event.responseMeta, "pi"),
      };
    case "tool_started":
      return {
        ...workspace,
        sessions: updateSessionStatus(
          workspace.sessions,
          event.sessionId,
          event.fileChanges.length > 0 ? "editing_files" : "running_tool",
          `Pi tool started: ${event.toolName}`,
        ),
        details: appendDetails(workspace.details, event.sessionId, [
          `tool started: ${event.toolName} (${event.toolCallId})`,
          event.argsSummary ? `args: ${event.argsSummary}` : undefined,
          ...event.fileChanges.map((fileChange) => `file ${fileChange.kind}: ${fileChange.path} (${fileChange.source})`),
        ]),
        timelineEvents: appendToolStartedTimelineEvent(workspace.timelineEvents, event),
      };
    case "tool_finished":
      return {
        ...workspace,
        details: appendDetails(workspace.details, event.sessionId, [
          `tool finished: ${event.toolName} ${event.isError ? "error" : "ok"}${event.durationMs === undefined ? "" : ` in ${event.durationMs.toString()}ms`}`,
          event.resultSummary ? `result: ${event.resultSummary}` : undefined,
          ...event.fileChanges.map((fileChange) => `file confirmed: ${fileChange.path}`),
          ...event.diffs.map((diff) => `diff: ${diff.path}\n${diff.diff}`),
        ]),
        timelineEvents: appendToolFinishedTimelineEvent(workspace.timelineEvents, event),
      };
    case "session_stats":
      return { ...workspace, details: appendDetail(workspace.details, event.sessionId, event.summary), timelineEvents: appendStatsTimelineEvent(workspace.timelineEvents, event.sessionId, event.summary) };
    case "compaction_changed":
      return {
        ...workspace,
        details: event.summary ? appendDetail(workspace.details, event.sessionId, `compaction: ${event.summary}`) : workspace.details,
        timelineEvents: event.summary ? appendCompactionTimelineEvent(workspace.timelineEvents, event.sessionId, event.summary) : workspace.timelineEvents,
      };
    case "error": {
      const next = markSessionError(workspace, event.sessionId, "Pi error", `error: ${event.message}`);
      return { ...next, timelineEvents: appendErrorTimelineEvent(next.timelineEvents, event.sessionId, event.message) };
    }
  }
}

function hydrateSessionOrigin(session: GpiSessionSummary, sessionFiles: SessionFiles): GpiSessionSummary {
  const origin = session.origin ?? (sessionFiles[session.id] ? "real" : "local");
  const title = origin === "imported" ? compactSessionTitle(session.title) : session.title;
  if ((origin === "real" || origin === "imported") && !sessionFiles[session.id]) {
    return { ...session, origin, title, status: "blocked", lastActivity: "Session file unavailable" };
  }
  if (isPersistedActiveStatus(session.status)) {
    return { ...session, origin, title, status: "idle", lastActivity: "Restored after restart" };
  }
  return { ...session, origin, title };
}

function isPersistedActiveStatus(status: SessionStatus): boolean {
  return status === "connecting" || status === "thinking" || status === "streaming" || status === "running_tool" || status === "editing_files";
}

function sanitizeImportedSessionDrafts(drafts: Record<string, string>, sessions: GpiSessionSummary[], messages: SessionMessages): Record<string, string> {
  const next = { ...drafts };
  for (const session of sessions) {
    if (session.origin !== "imported") continue;
    const draft = next[session.id]?.trim();
    if (!draft) continue;
    const sessionMessages = messages[session.id] ?? [];
    const draftLooksLikeImportedHistory = sessionMessages.some((message) => message.includes(draft.slice(0, 120)) || draft.includes(message.slice(0, 120)));
    if (draftLooksLikeImportedHistory) next[session.id] = "";
  }
  return next;
}

function compactSessionTitle(title: string): string {
  const normalized = title.replaceAll("\n", " ").replace(/\s+/g, " ").trim();
  if (normalized.length <= 72) return normalized;
  return `${normalized.slice(0, 69)}…`;
}

function sessionIdForFile(sessionFiles: Record<string, string>, sessionPath: string): string | undefined {
  return Object.entries(sessionFiles).find(([, path]) => path === sessionPath)?.[0];
}

function formatImportedSessionTranscript(session: GpiDiscoveredSession): string {
  const transcript = session.allMessagesText.trim();
  if (transcript.length === 0) return `Pi: Imported Pi session with ${session.messageCount.toString()} messages. Full transcript is empty or unavailable.`;
  return `Pi: Imported Pi session history (${session.messageCount.toString()} messages)\n\n${truncateText(transcript, 6_000)}`;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[Imported history truncated in GPi preview]`;
}

function firstVisibleSessionId(sessionIds: string[], archivedSessions: Record<string, boolean>): string {
  return sessionIds.find((sessionId) => !archivedSessions[sessionId]) ?? "";
}

function appendStreamingDelta(messages: SessionMessages, sessionId: string, delta: string): SessionMessages {
  const sessionMessages = messages[sessionId] ?? [];
  const lastMessage = sessionMessages.at(-1);
  const nextMessages = lastMessage?.startsWith("Pi: ")
    ? [...sessionMessages.slice(0, -1), `${lastMessage}${delta}`]
    : [...sessionMessages, `Pi: ${delta}`];
  return { ...messages, [sessionId]: nextMessages };
}

function appendChatMessage(messages: Record<string, ChatMessage[]>, sessionId: string, role: ChatMessage["role"], text: string, responseMeta?: string): Record<string, ChatMessage[]> {
  return { ...messages, [sessionId]: [...(messages[sessionId] ?? []), { id: `${sessionId}-${Date.now().toString()}-${Math.random().toString(36).slice(2)}`, role, text, responseMeta }] };
}

function appendAssistantDelta(messages: Record<string, ChatMessage[]>, sessionId: string, delta: string, responseMeta: string | undefined): Record<string, ChatMessage[]> {
  const sessionMessages = messages[sessionId] ?? [];
  const lastMessage = sessionMessages.at(-1);
  if (lastMessage?.role === "assistant") {
    return { ...messages, [sessionId]: [...sessionMessages.slice(0, -1), { ...lastMessage, text: `${lastMessage.text}${delta}`, responseMeta: lastMessage.responseMeta ?? responseMeta }] };
  }
  return appendChatMessage(messages, sessionId, "assistant", delta, responseMeta);
}

function migrateLegacyMessages(messages: SessionMessages): Record<string, ChatMessage[]> {
  return chatMessagesFromLegacy(messages);
}

function chatMessagesFromLegacy(messages: SessionMessages): Record<string, ChatMessage[]> {
  return Object.fromEntries(Object.entries(messages).map(([sessionId, sessionMessages]) => [sessionId, sessionMessages.map((message, index) => ({
    id: `${sessionId}-legacy-${index.toString()}`,
    role: message.startsWith("Pi: ") ? "assistant" : index % 2 === 0 ? "user" : "assistant",
    text: message.startsWith("Pi: ") ? message.slice(4) : message,
  } satisfies ChatMessage))]));
}

function appendUserTimelineEvent(events: SessionTimelineEvents, sessionId: string, text: string, source: TimelineEvent["source"]): SessionTimelineEvents {
  const base = createTimelineBase(events, sessionId, "user_message", undefined, source);
  return appendTimelineEvent(events, sessionId, { ...base, turnId: base.id, kind: "user_message", text });
}

function appendAssistantTimelineDelta(events: SessionTimelineEvents, sessionId: string, delta: string, responseMeta: string | undefined, source: TimelineEvent["source"]): SessionTimelineEvents {
  const sessionEvents = events[sessionId] ?? [];
  const lastEvent = sessionEvents.at(-1);
  if (lastEvent?.kind === "assistant_message" && lastEvent.streaming) {
    return { ...events, [sessionId]: [...sessionEvents.slice(0, -1), { ...lastEvent, text: `${lastEvent.text}${delta}`, responseMeta: lastEvent.responseMeta ?? responseMeta }] };
  }
  return appendTimelineEvent(events, sessionId, { ...createTimelineBase(events, sessionId, "assistant_message", currentTurnId(sessionEvents), source), kind: "assistant_message", text: delta, responseMeta, streaming: true });
}

function appendToolStartedTimelineEvent(events: SessionTimelineEvents, event: Extract<GpiPiEvent, { type: "tool_started" }>): SessionTimelineEvents {
  let next = appendTimelineEvent(events, event.sessionId, {
    ...createTimelineBase(events, event.sessionId, `tool-${event.toolCallId}`, currentTurnId(events[event.sessionId] ?? []), "pi"),
    kind: "tool",
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    status: "started",
    argsSummary: event.argsSummary || undefined,
  });
  for (const fileChange of event.fileChanges) {
    next = appendTimelineEvent(next, event.sessionId, {
      ...createTimelineBase(next, event.sessionId, `file-${event.toolCallId}-${fileChange.path}`, currentTurnId(next[event.sessionId] ?? []), "pi"),
      kind: "file_change",
      path: fileChange.path,
      status: fileChange.kind,
      origin: fileChange.source,
    });
  }
  return next;
}

function appendToolFinishedTimelineEvent(events: SessionTimelineEvents, event: Extract<GpiPiEvent, { type: "tool_finished" }>): SessionTimelineEvents {
  const sessionEvents = events[event.sessionId] ?? [];
  const toolIndex = sessionEvents.findIndex((candidate) => candidate.kind === "tool" && candidate.toolCallId === event.toolCallId);
  const finishedTool: TimelineEvent = {
    ...(toolIndex === -1 ? createTimelineBase(events, event.sessionId, `tool-${event.toolCallId}`, currentTurnId(sessionEvents), "pi") : sessionEvents[toolIndex]!),
    kind: "tool",
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    status: "finished",
    resultSummary: event.resultSummary || undefined,
    isError: event.isError,
    durationMs: event.durationMs,
  };
  let next: SessionTimelineEvents = {
    ...events,
    [event.sessionId]: toolIndex === -1 ? [...sessionEvents, finishedTool] : [...sessionEvents.slice(0, toolIndex), finishedTool, ...sessionEvents.slice(toolIndex + 1)],
  };
  for (const fileChange of event.fileChanges) {
    next = appendTimelineEvent(next, event.sessionId, {
      ...createTimelineBase(next, event.sessionId, `file-confirmed-${event.toolCallId}-${fileChange.path}`, currentTurnId(next[event.sessionId] ?? []), "pi"),
      kind: "file_change",
      path: fileChange.path,
      status: fileChange.kind === "unknown" ? "confirmed" : fileChange.kind,
      origin: "tool-result",
    });
  }
  event.diffs.forEach((diff, index) => {
    next = appendTimelineEvent(next, event.sessionId, {
      ...createTimelineBase(next, event.sessionId, `diff-${event.toolCallId}-${index.toString()}-${diff.path}`, currentTurnId(next[event.sessionId] ?? []), "pi"),
      kind: "diff",
      path: diff.path,
      diff: diff.diff,
      diffKind: "before-after",
    });
  });
  return next;
}

function appendRunPhaseTimelineEvent(events: SessionTimelineEvents, event: Extract<GpiPiEvent, { type: "run_phase" }>): SessionTimelineEvents {
  const sessionEvents = events[event.sessionId] ?? [];
  const turnId = currentTurnId(sessionEvents);
  const phaseIndex = findOpenRunPhaseIndex(sessionEvents, event.phase, turnId);
  if (event.status === "finished") {
    if (phaseIndex === -1) return events;
    const phase = sessionEvents[phaseIndex]!;
    if (phase.kind !== "run_phase") return events;
    return { ...events, [event.sessionId]: [...sessionEvents.slice(0, phaseIndex), { ...phase, status: "finished", endedAt: event.timestamp }, ...sessionEvents.slice(phaseIndex + 1)] };
  }
  if (phaseIndex !== -1) return events;
  return appendTimelineEvent(events, event.sessionId, {
    ...createTimelineBase(events, event.sessionId, `run-${event.phase}`, turnId, "pi"),
    kind: "run_phase",
    phase: event.phase,
    status: "started",
    startedAt: event.timestamp,
    text: "",
  });
}

function appendRunPhaseDeltaTimelineEvent(events: SessionTimelineEvents, sessionId: string, phaseName: "preparing_tool" | "thinking", delta: string): SessionTimelineEvents {
  const sessionEvents = events[sessionId] ?? [];
  const turnId = currentTurnId(sessionEvents);
  const phaseIndex = findOpenRunPhaseIndex(sessionEvents, phaseName, turnId);
  if (phaseIndex === -1) {
    const next = appendRunPhaseTimelineEvent(events, { type: "run_phase", sessionId, phase: phaseName, status: "started", timestamp: Date.now() });
    return appendRunPhaseDeltaTimelineEvent(next, sessionId, phaseName, delta);
  }
  const phase = sessionEvents[phaseIndex]!;
  if (phase.kind !== "run_phase") return events;
  return { ...events, [sessionId]: [...sessionEvents.slice(0, phaseIndex), { ...phase, text: `${phase.text ?? ""}${delta}` }, ...sessionEvents.slice(phaseIndex + 1)] };
}

function findOpenRunPhaseIndex(events: TimelineEvent[], phase: "preparing_tool" | "thinking" | "working", turnId: string | undefined): number {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.kind === "user_message" && event.turnId !== turnId) return -1;
    if (event?.kind === "run_phase" && event.phase === phase && event.status === "started" && event.turnId === turnId) return index;
  }
  return -1;
}

function appendStatsTimelineEvent(events: SessionTimelineEvents, sessionId: string, summary: string): SessionTimelineEvents {
  return appendTimelineEvent(events, sessionId, { ...createTimelineBase(events, sessionId, "stats", currentTurnId(events[sessionId] ?? []), "pi"), kind: "stats", summary });
}

function appendCompactionTimelineEvent(events: SessionTimelineEvents, sessionId: string, summary: string): SessionTimelineEvents {
  return appendTimelineEvent(events, sessionId, { ...createTimelineBase(events, sessionId, "compaction", currentTurnId(events[sessionId] ?? []), "pi"), kind: "compaction", status: compactionStatus(summary), summary });
}

function appendErrorTimelineEvent(events: SessionTimelineEvents, sessionId: string, message: string): SessionTimelineEvents {
  return appendTimelineEvent(events, sessionId, { ...createTimelineBase(events, sessionId, "error", currentTurnId(events[sessionId] ?? []), "pi"), kind: "error", message, recoverable: true });
}

function appendSystemTimelineEvent(events: SessionTimelineEvents, sessionId: string, message: string, source: TimelineEvent["source"], tone: "neutral" | "success" | "warning" = "neutral"): SessionTimelineEvents {
  return appendTimelineEvent(events, sessionId, { ...createTimelineBase(events, sessionId, "system", currentTurnId(events[sessionId] ?? []), source), kind: "system", message, tone });
}

function appendTimelineEvent(events: SessionTimelineEvents, sessionId: string, event: TimelineEvent): SessionTimelineEvents {
  return { ...events, [sessionId]: [...(events[sessionId] ?? []), event] };
}

function createTimelineBase(events: SessionTimelineEvents, sessionId: string, seed: string, turnId: string | undefined, source: TimelineEvent["source"]): TimelineEventBase {
  const order = nextTimelineOrder(events, sessionId);
  return { id: `${sessionId}-${order.toString()}-${sanitizeEventIdSeed(seed)}`, sessionId, turnId, createdAt: Date.now(), order, source };
}

function nextTimelineOrder(events: SessionTimelineEvents, sessionId: string): number {
  return Math.max(-1, ...(events[sessionId] ?? []).map((event) => event.order)) + 1;
}

function currentTurnId(events: TimelineEvent[]): string | undefined {
  return [...events].reverse().find((event) => event.kind === "user_message")?.turnId;
}

function sanitizeEventIdSeed(seed: string): string {
  return seed.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "event";
}

function compactionStatus(summary: string): Extract<TimelineEvent, { kind: "compaction" }>["status"] {
  const normalized = summary.toLowerCase();
  if (normalized.includes("already compacted") || normalized.includes("nothing new")) return "info";
  if (normalized.includes("started")) return "started";
  if (normalized.includes("aborted")) return "aborted";
  if (normalized.includes("failed")) return "failed";
  if (normalized.includes("finished") || normalized.includes("compacted")) return "finished";
  return "info";
}

function appendDetail(details: SessionDetails, sessionId: string, detail: string): SessionDetails {
  return { ...details, [sessionId]: [...(details[sessionId] ?? []), detail] };
}

function appendDetails(details: SessionDetails, sessionId: string, nextDetails: Array<string | undefined>): SessionDetails {
  return { ...details, [sessionId]: [...(details[sessionId] ?? []), ...nextDetails.filter((detail): detail is string => detail !== undefined)] };
}

function updateSessionStatus(sessions: GpiSessionSummary[], sessionId: string, status: SessionStatus, lastActivity: string): GpiSessionSummary[] {
  return sessions.map((session) => (session.id === sessionId ? { ...session, status, lastActivity } : session));
}

function replaceRecordKey<T>(record: Record<string, T>, oldKey: string, newKey: string, value: T): Record<string, T> {
  return { ...removeRecordKey(record, oldKey), [newKey]: value };
}

function nextSelectionRank(ranks: Record<string, number>): number {
  return Math.max(0, ...Object.values(ranks)) + 1;
}

function removeRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function removeRecordKeys<T>(record: Record<string, T>, keys: Set<string>): Record<string, T> {
  const next = { ...record };
  for (const key of keys) delete next[key];
  return next;
}
