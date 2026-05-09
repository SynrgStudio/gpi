# GPi performance validation checklist

Use this checklist after WorkerPiRuntime changes and before packaging or larger UI rewrites.

## Preconditions

- Run the Electron app with real Pi sessions.
- Use WorkerPiRuntime-backed sessions.
- Keep DevTools closed for baseline feel checks, then open DevTools only for diagnostics.
- Validate on Windows, because workspace persistence and filesystem events are most sensitive there.

## Scenarios

### 1. Startup and project switching

1. Start GPi with multiple saved projects and sessions.
2. Switch between at least three projects.
3. Expand/collapse project groups rapidly.

Expected:
- First paint feels immediate.
- No startup sweep/prewarm lag returns.
- Sidebar selection does not jump.
- Project switching does not block the composer.

### 2. Parallel worker sessions

1. Open two or more real Pi sessions.
2. Start long prompts in at least two sessions.
3. Switch between sessions while both are running.

Expected:
- Sidebar and composer remain responsive.
- Timelines stream independently.
- Supercards animate without jank.
- No cross-session text/tool/diff mixing.

### 3. Long streaming response

1. Ask for a long explanation with thinking enabled when supported.
2. Leave the viewport pinned to bottom.
3. Watch Working, Thinking, Preparing tool and final answer streaming.

Expected:
- Auto-scroll stays pinned while the user is already at the bottom.
- If the user scrolls up, GPi does not fight the user.
- Text deltas remain batched and smooth.
- Workspace save debounce prevents disk-write stutter.

### 4. Large diffs and tool outputs

1. Run a prompt that edits or creates large files.
2. Keep diff/tool cards closed.
3. Expand one large diff, then collapse it.
4. Expand several smaller diffs.

Expected:
- Closed diff/tool cards do not freeze the timeline.
- Diff preview mounts only when opened.
- Long diff lines wrap inside the card without horizontal overflow.
- Reopening the same diff does not refetch or recompute via IPC.

### 5. Persistence under event bursts

1. Run a long prompt that streams text and tool events.
2. Close and reopen GPi after the run finishes.
3. Repeat while closing shortly after a response starts.

Expected:
- Recent projects, sessions, messages, drafts and timeline state are preserved.
- No EPERM/rename/write-loop errors appear.
- Save failures are surfaced as actionable bridge errors.

### 6. Session management bursts

1. Create several real sessions in one project.
2. Archive/restore sessions.
3. Delete sessions from the GPi sidebar metadata.
4. Switch active sessions repeatedly.

Expected:
- Sidebar remains responsive.
- Selected session stays visually stable.
- Filesystem/Pi session files are not deleted by GPi metadata removal.

## Lightweight metrics to record manually

For each run, record:

- Project/session count at startup.
- Number of parallel active sessions.
- Approximate time to visible Working phase.
- Approximate time to first Thinking/text/tool event.
- Whether auto-scroll stayed pinned.
- Whether any UI operation felt blocked for more than 250ms.
- Whether workspace save or bridge errors appeared.

## Future benchmark candidates

Add automated or instrumented metrics only when a regression needs proof:

- Timeline event count by session.
- Largest diff size rendered.
- Workspace save debounce flush count per minute.
- Renderer long-task count during parallel streaming.
- Worker event burst size and coalescing latency.

## Pass criteria

Performance is acceptable for the current GPi cockpit when:

- Two or more real worker sessions can run in parallel without UI freezing.
- Closed large diff/tool cards do not noticeably affect scrolling.
- Workspace persistence no longer writes once per streaming delta.
- Auto-scroll remains correct for pinned-bottom streaming.
- No repeated storage, worker timeout, or cross-session routing errors appear.
