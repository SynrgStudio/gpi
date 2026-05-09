# Turn snapshots and revert

## Goal

GPi should provide IDE-style "revert to before this message" even though Pi does not expose that feature. GPi owns this capability by capturing file snapshots around each chat turn and associating those snapshots with the turn's Supercard.

This feature is independent of Git. Git projects can still benefit from Git diffs, but GPi must also work in non-git local folders.

## Product behavior

For each user prompt/follow-up, GPi creates a `turnId`. If that turn changes files and GPi can safely read the affected paths, the Supercard becomes revertible.

The first MVP action is:

- `Revert changes` for one turn.

The action means:

- restore every file changed by that turn to the state it had immediately before the turn;
- delete files that did not exist before the turn but were created by it;
- recreate files that existed before the turn but were deleted by it;
- refuse to apply if any current file changed after GPi captured the turn's final snapshot.

Future actions can build on the same model:

- selective per-file revert;
- revert through a range of turns;
- named checkpoints;
- overwrite-conflict flow.

## Non-goals for MVP

- Do not rely on Git history, `git checkout`, or patches as the only source of truth.
- Do not silently overwrite files that changed after the snapshot.
- Do not snapshot the entire project before every prompt.
- Do not try to revert provider/tool state, terminal commands, dependencies installed outside files, or external services.
- Do not offer an overwrite-anyway action in the first implementation.

## Domain model

Expected TypeScript shapes:

```ts
export type TurnSnapshotFileStatus = "created" | "modified" | "deleted";

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
```

`WorkspaceState` should only keep the lightweight `TurnSnapshotIndexEntry`. File contents and manifests live outside the primary workspace file.

## Storage layout

Use GPi-controlled local storage, not project files:

```text
<gpi-app-data>/snapshots/
  <projectId>/
    <sessionId>/
      <turnId>/
        manifest.json
        before/
          <content-hash-or-file-id>
        after/
          <content-hash-or-file-id>
```

Rules:

- Store paths in the manifest as project-relative `path` plus validated `absolutePath`.
- Store contents in separate blobs so manifest stays readable.
- Hash file contents with a stable algorithm such as SHA-256.
- Never write snapshot data into the user's project unless explicitly designed later.
- Workspace persistence stores only the snapshot index.

## Capture flow

### 1. Turn starts

When GPi accepts a prompt/follow-up:

1. Create or reuse the existing `turnId`.
2. Create an in-memory snapshot accumulator for that turn.
3. Associate the user message event and future Supercard with that accumulator.

### 2. Candidate paths appear

Candidate paths can come from existing real signals:

- tool args that GPi already parses into `file_change` events;
- tool result file changes;
- before/after diff generation from T042;
- typed `diff` timeline events.

GPi should prefer existing diff/file-change infrastructure over a global filesystem watcher.

For each candidate path:

1. Validate that it resolves inside the project root.
2. If this is the first time the path appears in the turn, capture `before`:
   - exists flag;
   - content blob if it exists and is safely readable;
   - hash and size.
3. Track later changes without replacing the original `before`.

### 3. Turn settles

When the run reaches final assistant text/agent end, or after a short file-settle delay:

1. Capture `after` for each path in the accumulator.
2. Compute status:
   - `created`: `existsBefore=false`, `existsAfter=true`;
   - `deleted`: `existsBefore=true`, `existsAfter=false`;
   - `modified`: both exist and hashes differ.
3. Drop entries where before and after are identical.
4. Persist the manifest and content blobs.
5. Add/update the workspace snapshot index for that `turnId`.

If capture fails for a path, store a capture error and do not claim that path is safely revertible.

## Revert flow

When the user chooses `Revert changes` from a Supercard:

1. Load the manifest.
2. For every file entry, read current state and hash.
3. Compare current state against the saved `after` state:
   - current exists must match `existsAfter`;
   - current hash must match `hashAfter` when the after file exists.
4. If any file differs, return a conflict result and do not mutate any file.
5. If all files match, apply changes:
   - `created`: delete current file;
   - `modified`: write `contentBefore`;
   - `deleted`: recreate `contentBefore`.
6. Emit a timeline/system event for success or conflict.

The MVP is all-or-nothing. Partial apply would be harder to reason about and risk losing user work.

## Conflict behavior

A conflict means the file no longer matches the `after` snapshot that GPi would be undoing.

Examples:

- user manually edited the file after the turn;
- another agent changed the same file;
- a later GPi turn modified the file;
- file was deleted or recreated externally.

MVP behavior:

- block revert;
- show which files conflict;
- explain that GPi will not overwrite newer work;
- allow user to manually inspect or ask Pi to resolve.

No overwrite-anyway button in MVP.

## UI integration

Supercard summary or expanded body can show `Revert changes` only when:

- a snapshot index exists for the Supercard `turnId`;
- snapshot has at least one safely captured file;
- no capture-only error makes the whole turn ambiguous.

Confirmation modal should show:

- prompt/turn timestamp;
- changed file count;
- file list grouped by created/modified/deleted;
- clear copy: "Reverts files to the state before this message.";
- conflict warnings when preflight fails.

## Relationship to Git

Git can be useful for human inspection but is not required:

- In Git projects, GPi may still show Git/current-file diffs.
- Revert uses GPi snapshots, not `git checkout`.
- This avoids unintentionally reverting unrelated uncommitted user work.

## Safety rules

- Validate all paths against the project root before reading/writing.
- Do not follow unsafe paths outside the project.
- Do not snapshot huge files blindly; future implementation may set a size cap and mark files as not safely revertible.
- Do not mutate if any file conflicts.
- Keep snapshot errors visible but non-fatal to the agent run.

## Revert-safe prompt policy

GPi can improve snapshot reliability with an optional `Revert-safe edits` setting. When enabled, GPi prefixes prompts with a transparent instruction that asks Pi to prefer read/edit/write file tools for basic edits and to declare expected file paths before shell mutations.

This is not a system prompt change and not a hard bash ban. It is a user-controlled priority policy. The original user prompt remains visible in chat, while Pi receives the augmented prompt.

See `docs/product/revert-safe-edits.md` for exact copy.

## Open limits

- Binary files need explicit policy. MVP can skip them or store bytes with size caps.
- Very large text files may need max-size limits.
- External side effects from commands cannot be reverted.
- Range revert needs dependency ordering and conflict UX; defer until single-turn revert is proven.
