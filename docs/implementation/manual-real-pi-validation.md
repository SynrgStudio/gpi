# Manual real Pi validation checklist

This checklist validates GPi against a real local Pi SDK session. It avoids provider benchmarks and focuses on product-critical flows.

## Prerequisites

- Windows desktop environment with GPi runnable via Electron dev mode.
- Pi credentials configured for at least one provider/model.
- A local project folder with safe throwaway files.
- Optional: a git repository project for true git diffs; non-git projects should still show safe before/after tool diffs when GPi observes file edits.

Recommended project:

```powershell
mkdir C:\gpi-validation -Force
cd C:\gpi-validation
"# GPi validation" | Out-File README.md -Encoding utf8
```

Start GPi in the usual development flow:

```powershell
npm run dev:electron
```

## Pass/fail convention

For each step, record:

```text
[ ] pass
[ ] fail: <what happened>
```

A failed item should include screenshot, session id and approximate time.

## 1. Startup and workspace restore

- [ ] GPi opens without native Windows menu bar.
- [ ] Previously persisted active/running sessions restore as idle, not forced follow-up mode.
- [ ] Existing projects and sessions appear in the left sidebar.
- [ ] Selecting a persisted real/imported session auto-reopens the Pi SDK handle.
- [ ] Composer shows `Send` when idle and `Follow up` only while a live handle is busy.

## 2. Project management

- [ ] Add a project with a valid path.
- [ ] Invalid project paths are rejected with a friendly GPi error.
- [ ] Rename the project from the sidebar action menu.
- [ ] Change the project path to another valid folder.
- [ ] Remove a project through `Remove project`.
- [ ] Custom GPi confirmation appears, not native Windows confirm.
- [ ] Removing a project does not delete filesystem contents.
- [ ] After removal, GPi selects a valid fallback project/session.
- [ ] Restart GPi and confirm project edits/removal persisted.

## 3. Real session creation/opening

- [ ] Create a new real Pi session.
- [ ] Session appears immediately in sidebar.
- [ ] Session handle becomes ready without blocking UI.
- [ ] Session file is persisted and shown as history persisted.
- [ ] Restart GPi, select the session, and confirm it reopens.

## 4. Prompt and streaming feel

Prompt:

```text
Respond with exactly: hola GPi
```

- [ ] Composer clears immediately after Send.
- [ ] User message appears immediately.
- [ ] Assistant response streams/appears in correct order.
- [ ] Timeline order is user message -> work/activity if any -> assistant response.
- [ ] Response metadata shows the model/thinking snapshot used for that run.

## 5. Model and thinking controls

- [ ] Model dropdown opens with GPi custom menu styling.
- [ ] Thinking dropdown opens with GPi custom menu styling.
- [ ] Selecting an unavailable model fails through Pi when used, proving real Pi validation.
- [ ] Changing thinking level affects future response metadata, not previous messages.
- [ ] Previous assistant messages keep their original model/thinking metadata after dropdown changes.

## 6. File edit and real diffs

Ask Pi to edit a safe file:

```text
Create tmp-gpi-validation.md with three short paragraphs. Then tell me what changed.
```

Then ask:

```text
Remove the second paragraph from tmp-gpi-validation.md.
```

- [ ] Changed files block appears in the chat timeline between work and final response.
- [ ] Diff is not inside the collapsing work block.
- [ ] Additions are green.
- [ ] Removals are red.
- [ ] Context lines are neutral.
- [ ] Deleting a paragraph shows a small real before/after diff, not a whole-file snapshot.
- [ ] Files tab also shows the changed file and diff.
- [ ] Repeated changes do not flood old diffs into new turns.

## 7. Follow-up and abort

During a longer response/tool run:

- [ ] Sending while busy queues as follow-up.
- [ ] Abort button appears only for live busy real sessions.
- [ ] Abort stops the selected run and does not affect unrelated sessions.
- [ ] After abort, composer returns to idle/send state.

## 8. Compaction controls

In Inspector:

- [ ] Compaction panel is visible for live real Pi sessions.
- [ ] `Auto on/off` toggles without fake UI state.
- [ ] `Compact` triggers real Pi `session.compact()`.
- [ ] Compaction lifecycle appears in Logs as `compaction:` entries.
- [ ] Running compaction can show/allow Abort when applicable.
- [ ] Running Compact again after no new content shows friendly `already compacted; nothing new to compact`, not a scary global error.

## 9. Session list operations

- [ ] Project collapse/expand chevron rotates cleanly.
- [ ] Collapsed project shows inline session summary/dots.
- [ ] Active selected session remains in list position and gets left marker.
- [ ] Active selected session does not show trash button.
- [ ] Non-selected sessions show trash button on hover.
- [ ] Removing a chat shows custom GPi confirmation, not native Windows confirm.
- [ ] Removing several chats near the bottom does not cause disruptive scroll jumps.
- [ ] Removing/archiving chat does not delete Pi session file from disk.

## 10. Import existing Pi sessions

- [ ] Import Pi sessions scans selected project.
- [ ] New imported sessions appear once, without duplicates on repeated import.
- [ ] Imported session title is compact enough for sidebar.
- [ ] Imported session preview is readable.
- [ ] Selecting/imported persisted session reopens handle when needed.

## 11. Multi-session sanity

- [ ] Create/open at least two real sessions in the same project.
- [ ] Start work in one session, switch to another, send prompt.
- [ ] Events, messages and diffs stay associated with the correct session.
- [ ] Aborting one session does not abort the other.
- [ ] Sidebar status reflects each session independently.

## 12. Persistence after restart

- [ ] Draft text persists per session.
- [ ] Projects persist.
- [ ] Session list persists.
- [ ] Archived/removed chats stay hidden unless Show archived is enabled.
- [ ] Stale running/tool states do not persist as active after restart.
- [ ] Model/thinking controls load after handle reopen.

## Known acceptable gaps

- Extension approval UI is intentionally not fake-implemented yet.
- Packaging validation is separate from this dev-mode checklist.
- Model/thinking effectiveness beyond Pi accepting the setting will need future benchmark tests.

## Result summary

```text
Date:
GPi commit/build:
Pi package version:
Provider/model used:
Project path:
Result: pass | fail
Failures:
Follow-up issues:
```
