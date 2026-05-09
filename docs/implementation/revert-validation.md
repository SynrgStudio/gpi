# Revert and Revert-safe edits validation

## Revert-safe prompt behavior

Validate with the same small file-editing task twice: once with `Revert-safe` off and once with it on.

### Toggle off

1. Disable `Revert-safe` in the composer.
2. Ask Pi to make a simple single-file edit.
3. Observe whether Pi chooses shell commands or file tools.

Expected:
- GPi sends the original prompt.
- No `Revert-safe edits enabled for this turn` timeline badge appears.

### Toggle on

1. Enable `Revert-safe` in the composer.
2. Ask Pi to make the same simple single-file edit.
3. Observe whether Pi reads the file and uses structured file edit/write tools, or declares paths before shell mutation.

Expected:
- User chat bubble still shows the original prompt.
- Timeline/Supercard includes `Revert-safe edits enabled for this turn`.
- Pi is biased toward read/edit/write tools for basic edits.
- If Pi uses shell anyway, it should state expected changed paths before mutation when following the policy.

## Snapshot validation

After a file-changing turn:

1. Inspect `%APPDATA%/gpi/snapshots`.
2. Confirm a manifest exists under project/session/turn.
3. Confirm workspace `turnSnapshots` contains an entry for the session/turn.
4. Confirm the manifest includes changed files with before/after blob paths.

Expected manifest properties:
- `projectPath` points at the local project root.
- Each file has a project-relative `path` and absolute `absolutePath`.
- `status` is one of `created`, `modified`, or `deleted`.
- `hashBefore`/`hashAfter` represent the captured before/after states where those states exist.
- `contentBeforePath`/`contentAfterPath` point at external blobs under `%APPDATA%/gpi/snapshots` where those states exist.

## Per-message revert validation

Use a Supercard with a `Revert changes` button. The button is shown only when GPi has a turn snapshot for that message.

### Modified file

1. Start with a file containing known text.
2. Enable `Revert-safe`.
3. Ask Pi to modify the file.
4. Open the run Supercard and click `Revert changes`.
5. Confirm the modal lists the file as `modified`.
6. Confirm the revert.

Expected:
- The file content returns to the exact before-message content.
- GPi emits a success timeline event.
- The revert works without Git.

Manual result, 2026-05-08:
- Passed in the real GPi app. User confirmed the revert button appeared and revert restored the file.

### Created file

1. Ask Pi to create a new file.
2. Open the run Supercard and click `Revert changes`.
3. Confirm the modal lists the file as `created`.
4. Confirm the revert.

Expected:
- The created file is deleted.
- GPi emits a success timeline event.

### Deleted file

1. Start with a disposable file containing known text.
2. Ask Pi to delete it.
3. Open the run Supercard and click `Revert changes`.
4. Confirm the modal lists the file as `deleted`.
5. Confirm the revert.

Expected:
- The deleted file is recreated with the exact before-message content.
- GPi emits a success timeline event.

### Multiple files in one turn

1. Ask Pi to change two or more disposable files in one prompt.
2. Open the run Supercard and click `Revert changes`.
3. Confirm all files are listed in the modal.
4. Confirm the revert.

Expected:
- All captured files revert together.
- GPi applies the revert all-or-nothing.

### Conflict after later edit

1. Produce a snapshot by asking Pi to edit a file.
2. Manually edit that same file after the snapshot.
3. Click `Revert changes` for the original Supercard.
4. Confirm the revert.

Expected:
- GPi compares the current content against the captured `hashAfter`.
- If the file changed after the snapshot, GPi blocks the revert.
- No files are mutated when any conflict exists.
- GPi emits a conflict timeline event listing the conflict count.

Manual result, 2026-05-08:
- Passed by storage smoke validation. Real-app conflict validation remains recommended before treating conflict UX as final.

## Safety model

GPi reverts file state for a user-message turn, not assistant text. Snapshots are GPi-owned and stored outside `workspace.v1.json` under `%APPDATA%/gpi/snapshots`.

The apply step is all-or-nothing:
- GPi first validates every captured file.
- A file that existed after the turn must still exist and match `hashAfter`.
- A file that did not exist after the turn must still not exist.
- If any validation fails, GPi returns conflicts and does not write or delete anything.

Apply behavior:
- `created`: remove the file.
- `modified`: write the captured before blob.
- `deleted`: recreate the captured before blob.

## Command-needed scenario

Ask Pi to run a formatter or project script where shell is appropriate.

Expected:
- Revert-safe mode should not prevent the command.
- The model should prefer declaring expected paths or scope first.
- GPi may mark snapshots partial if exact before-state cannot be captured.

## Known limitations

- Revert-safe mode is a prompt policy, not a guarantee.
- Broad shell commands may still affect undeclared files.
- Non-git command-only changes may still require watcher or explicit paths for perfect snapshots.
- Selective per-file revert is not implemented in the MVP.
- There is no overwrite-anyway path in the MVP.
