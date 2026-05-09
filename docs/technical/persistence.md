# GPi Persistence

## Principle

Pi owns agent/session history. GPi owns GUI workspace metadata.

GPi should not duplicate Pi's JSONL conversation store except for derived UI caches that can be rebuilt.

## Data GPi persists

### Workspace state

- schema version
- projects
- selected project id
- selected session id
- layout preferences

### Project records

- id
- name
- local path
- collapsed/expanded sidebar state
- last opened timestamp

### Session records

- GPi session id
- project id
- display title override if any
- Pi session id
- Pi session file path
- last known status
- last activity summary
- last opened timestamp
- draft input text, if enabled

### UI caches

Optional and rebuildable:

- normalized message previews
- tool/file summaries
- last sidebar status snapshot

## Data Pi persists

- actual messages
- tool results
- branches
- compactions
- model/thinking changes
- session display names
- cwd metadata

## Data GPi must not persist

- provider API keys
- OAuth tokens
- auth secrets
- full duplicate agent history unless explicitly exported

Use Pi `AuthStorage` and model registry instead.

## Initial storage format

Use one JSON file for MVP/prototype:

```json
{
  "version": 1,
  "selectedProjectId": "project_1",
  "selectedSessionId": "session_1",
  "projects": [
    {
      "id": "project_1",
      "name": "gpi",
      "path": "C:/gpi",
      "expanded": true,
      "sessionIds": ["session_1"]
    }
  ],
  "sessions": [
    {
      "id": "session_1",
      "projectId": "project_1",
      "title": "Initial GPi planning",
      "piSessionId": "...",
      "piSessionFile": "...jsonl",
      "lastKnownStatus": "idle",
      "lastActivitySummary": "Completed planning",
      "draft": ""
    }
  ]
}
```

Use atomic writes: write temp file then rename.

## Location

Current implementation uses Electron `app.getPath("userData")/workspace.v1.json` via the main process.

The renderer does not write workspace files directly. It calls preload IPC methods:

- `loadWorkspace()`
- `saveWorkspace(workspace)`

For packaged app later, keep using OS app data directory unless migration requirements change.

## Recovery on app start

1. Load GPi workspace JSON.
2. Validate schema version.
3. Drop or mark missing project paths as unavailable, do not delete them.
4. For each available project path, call Pi `SessionManager.list(project.path)` to discover sessions.
5. Reconcile known GPi sessions with Pi session files.
6. Restore selected project/session if still valid; otherwise select first available session.
7. Lazily open live Pi handles only when user selects or starts a session.

## Reconciliation rules

- If GPi references a missing Pi session file, mark session `blocked` or `unavailable` in UI metadata until user resolves.
- If Pi has sessions not in GPi, show them in an import/discovered section later.
- Never delete Pi session files from reconciliation.
- Session title preference: GPi title override > Pi session name > first message summary > filename.

## Multi-session safety

Each session record is updated independently. The workspace file should be saved through a single persistence queue to prevent interleaved writes.

Current implementation:

- writes through Electron main process only
- writes to a temp file then renames to `workspace.v1.json`
- strips transient `backendHandles` before saving
- backs up corrupt/invalid JSON to `workspace.v1.json.corrupt-<timestamp>` and starts from default in-memory state

Remaining hardening:

- debounce frequent status/text writes
- add a write queue if concurrent save pressure appears
- flush on app close
- avoid writing on every text delta

## Migration

Include `version`. Future migrations should be explicit functions:

```text
v1 -> v2 -> v3
```

Unknown future versions should fail safe: preserve file, show error, do not overwrite.

## Validation checklist

- Restarting GPi preserves projects and sessions.
- Missing project paths do not crash app.
- Missing Pi session files do not get deleted.
- UI can rebuild live state from GPi workspace + Pi session files.
- Secrets are not written to GPi storage.
