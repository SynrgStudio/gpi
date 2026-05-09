import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GpiPiEvent } from "../src/bridge/pi-bridge.js";
import type { GpiSessionSummary, WorkspaceState } from "../src/domain/types.js";
import {
  addOptimisticRealSession,
  archiveSessionInWorkspace,
  hydrateWorkspace,
  initialWorkspace,
  reducePiEvent,
  removeProjectFromWorkspace,
  replaceOptimisticSession,
} from "../src/renderer/state/workspace-store.js";

function workspaceWithProject(sessionStatus: GpiSessionSummary["status"] = "idle"): WorkspaceState {
  const session: GpiSessionSummary = {
    id: "session-a",
    projectId: "project-a",
    title: "Session A",
    status: sessionStatus,
    lastActivity: "Running before restart",
    origin: "real",
  };
  return {
    ...initialWorkspace,
    selectedProjectId: "project-a",
    selectedSessionId: session.id,
    projects: [{ id: "project-a", name: "Project A", path: "C:/project-a", sessionIds: [session.id] }],
    sessions: [session],
    messages: { [session.id]: [] },
    chatMessages: { [session.id]: [] },
    drafts: { [session.id]: "" },
    details: { [session.id]: [] },
    backendHandles: {},
    sessionFiles: { [session.id]: "C:/Users/example/.pi/session.jsonl" },
    archivedSessions: {},
    sessionSelectionRanks: {},
  };
}

describe("workspace store reducers", () => {
  it("hydrates persisted active sessions as idle", () => {
    const hydrated = hydrateWorkspace(workspaceWithProject("running_tool"));
    assert.equal(hydrated.sessions[0]?.status, "idle");
    assert.equal(hydrated.sessions[0]?.lastActivity, "Restored after restart");
  });

  it("replaces optimistic session ids across records", () => {
    const optimistic: GpiSessionSummary = {
      id: "temp-session",
      projectId: "project-a",
      title: "Connecting",
      status: "connecting",
      lastActivity: "Connecting",
      origin: "real",
    };
    const withOptimistic = addOptimisticRealSession(workspaceWithProject(), "project-a", optimistic, ["created"]);
    const replaced = replaceOptimisticSession(withOptimistic, "temp-session", "real-session", {
      backendHandle: "handle-a",
      sessionFile: "C:/Users/example/.pi/real.jsonl",
      readyMs: 42,
    });

    assert.equal(replaced.selectedSessionId, "real-session");
    assert.ok(replaced.projects[0]?.sessionIds.includes("real-session"));
    assert.equal(replaced.backendHandles["real-session"], "handle-a");
    assert.equal(replaced.sessionFiles["real-session"], "C:/Users/example/.pi/real.jsonl");
    assert.equal(replaced.details["temp-session"], undefined);
  });

  it("stores assistant response metadata from Pi text deltas", () => {
    const workspace = workspaceWithProject();
    const event: GpiPiEvent = {
      type: "text_delta",
      sessionId: "session-a",
      delta: "hello",
      responseMeta: "GPT-5.5 · medium",
    };

    const reduced = reducePiEvent(workspace, event);
    assert.equal(reduced.chatMessages["session-a"]?.[0]?.role, "assistant");
    assert.equal(reduced.chatMessages["session-a"]?.[0]?.text, "hello");
    assert.equal(reduced.chatMessages["session-a"]?.[0]?.responseMeta, "GPT-5.5 · medium");
    assert.equal(reduced.timelineEvents["session-a"]?.[0]?.kind, "assistant_message");
    assert.equal(reduced.timelineEvents["session-a"]?.[0]?.turnId, undefined);
  });

  it("maps tool, diff, stats, compaction and error events to typed timeline events", () => {
    const workspace = workspaceWithProject();
    const started = reducePiEvent(workspace, {
      type: "tool_started",
      sessionId: "session-a",
      toolCallId: "tool-1",
      toolName: "edit",
      argsSummary: "path: note.md",
      fileChanges: [{ path: "note.md", kind: "modified", source: "pi-tool-args" }],
    });
    const finished = reducePiEvent(started, {
      type: "tool_finished",
      sessionId: "session-a",
      toolCallId: "tool-1",
      toolName: "edit",
      isError: false,
      durationMs: 12,
      resultSummary: "ok",
      fileChanges: [{ path: "note.md", kind: "modified", source: "pi-tool-args" }],
      diffs: [{ path: "note.md", diff: "--- note.md\n+++ note.md\n+hello" }],
    });
    const withStats = reducePiEvent(finished, { type: "session_stats", sessionId: "session-a", summary: "stats: total 1" });
    const withCompaction = reducePiEvent(withStats, {
      type: "compaction_changed",
      sessionId: "session-a",
      options: { isCompacting: false, autoCompactionEnabled: true },
      summary: "already compacted; nothing new to compact",
    });
    const withError = reducePiEvent(withCompaction, { type: "error", sessionId: "session-a", message: "boom" });

    const events = withError.timelineEvents["session-a"] ?? [];
    assert.equal(events.some((event) => event.kind === "tool" && event.status === "finished"), true);
    assert.equal(events.some((event) => event.kind === "file_change" && event.path === "note.md"), true);
    assert.equal(events.some((event) => event.kind === "diff" && event.path === "note.md"), true);
    assert.equal(events.some((event) => event.kind === "stats"), true);
    assert.equal(events.some((event) => event.kind === "compaction" && event.status === "info"), true);
    assert.equal(events.some((event) => event.kind === "error" && event.message === "boom"), true);
  });

  it("removes a project without deleting unrelated workspace records", () => {
    const workspace = workspaceWithProject();
    const otherSession: GpiSessionSummary = {
      id: "session-b",
      projectId: "project-b",
      title: "Session B",
      status: "idle",
      lastActivity: "Idle",
      origin: "local",
    };
    const expanded: WorkspaceState = {
      ...workspace,
      projects: [...workspace.projects, { id: "project-b", name: "Project B", path: "C:/project-b", sessionIds: [otherSession.id] }],
      sessions: [...workspace.sessions, otherSession],
      messages: { ...workspace.messages, [otherSession.id]: ["keep"] },
      chatMessages: { ...workspace.chatMessages, [otherSession.id]: [{ id: "m", role: "user", text: "keep" }] },
      drafts: { ...workspace.drafts, [otherSession.id]: "draft" },
      details: { ...workspace.details, [otherSession.id]: ["detail"] },
    };

    const reduced = removeProjectFromWorkspace(expanded, "project-a");
    assert.deepEqual(reduced.projects.map((project) => project.id), ["project-b"]);
    assert.deepEqual(reduced.sessions.map((session) => session.id), ["session-b"]);
    assert.equal(reduced.messages["session-a"], undefined);
    assert.deepEqual(reduced.messages["session-b"], ["keep"]);
    assert.equal(reduced.selectedProjectId, "project-b");
  });

  it("archives selected session and selects a visible fallback", () => {
    const workspace = workspaceWithProject();
    const fallback: GpiSessionSummary = {
      id: "session-b",
      projectId: "project-a",
      title: "Session B",
      status: "idle",
      lastActivity: "Idle",
      origin: "local",
    };
    const expanded: WorkspaceState = {
      ...workspace,
      projects: [{ ...workspace.projects[0]!, sessionIds: ["session-a", "session-b"] }],
      sessions: [...workspace.sessions, fallback],
    };

    const archived = archiveSessionInWorkspace(expanded, "session-a");
    assert.equal(archived.archivedSessions["session-a"], true);
    assert.equal(archived.selectedSessionId, "session-b");
  });
});
