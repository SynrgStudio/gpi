---
continuity_session: CONT-2026-05-10-1630-gpi-roadmap
created_at: 2026-05-10 16:30
updated_at: 2026-05-13 21:10
status: active
goal: Complete GPi roadmap items for file mentions, project file tree, Windows Open in GPi context menu, startup splash, Linux packaging, updater validation, and workflow polish.
---

# STATE

## Current status

T001 through T012, T018-T023, T025, T028-T031, and T059-T061 are done. T024, T026, and T027 remain partial pending manual global-install/update/missing-runtime validation. Linux packaging tasks T013-T016 remain pending. Pi parity/cockpit tasks T032-T058 cover session tree/forks, statusbar details popover, steering/follow-up UX, session menu, context files, read-only/tools safety, Settings expansion, scoped models, templates, skills, extensions, keybindings, and Pi Packages. Tool-call streaming performance is validated: normal mode avoids live tool-call stream UI cost, while Developer mode keeps stream/debug visibility available.

## Last checkpoint

2026-05-13 21:10 — User validated Developer mode off feels much faster; T059-T061 marked done.

## Active continuity session

CONT-2026-05-10-1630-gpi-roadmap

## Active goal

Complete GPi roadmap items for file mentions, project file tree, Windows Open in GPi context menu, startup splash, Linux packaging, updater validation, and workflow polish.

## Validation status

- `npm run check` passed after Windows Open in GPi changes.
- Direct Inno Setup compile succeeded and produced `release/installer/GPi-Setup-0.0.11.exe`.
- `npm run installer:win` timed out in the harness after packaging, but direct package/check plus direct installer compile succeeded.

## Known blockers

- Linux packaging tasks require Linux runner/host validation.
- Image attachment final validation requires a vision-capable configured model.
- Pi install command should only be run after explicit user click/approval; package-manager/global install behavior may affect local PATH.

## Next recommended step

Next executable task by queue order remains T013 Linux packaging. If prioritizing the Pi parity roadmap, first executable task is T032 — Audit Pi SDK/runtime support for session tree and metadata.

## Log

### 2026-05-10 16:30 — init-cont

- Created `AUTONOMOUS_EXECUTION.md`.
- Created `ACTIVE_QUEUE.md` with base task queue.
- Created `STATE.md`.
- Preserved current repo state; no commit/push performed.

### 2026-05-10 16:45 — plan-cont

- Added `planned_at` to `ACTIVE_QUEUE.md` front matter.
- Reworked queue from 9 broad tasks into 17 ordered, dependency-aware tasks.
- Split file mentions into file API, file tree UI, click-to-mention, autocomplete, and prompt-context tasks.
- Split Linux support into portable/tarball, Debian package, release workflow, and platform-aware updater tasks.
- Kept validation/hardening tasks for recently implemented workflow/autoscroll/updater changes at the front.

### 2026-05-10 16:50 — queue reorganization

- Marked T001 done: workflow controls confirmed working by user.
- Marked T002 done: interruptible autoscroll confirmed working by user.
- Marked T003 blocked: updater validation requires a future newer release.
- Set next recommended task to T004.

### 2026-05-10 17:00 — T004 partial

- Added `CHANGELOG.md` with versioned release notes.
- Added `scripts/validate-release-notes.mjs` to fail releases without matching changelog section.
- Added `scripts/prepare-release.mjs` for local version/changelog preparation.
- Updated release workflow to use changelog section as GitHub Release body.
- Updated README release instructions.
- Validation: `node scripts/validate-release-notes.mjs 0.0.5 /tmp/release-notes.md`; `npm run check`.

### 2026-05-10 17:10 — T004 complete

- Extended update status with GitHub release name/body.
- Added IPC/preload API to fetch release notes for an installed version.
- Saved release metadata beside downloaded installers for offline post-update display.
- Replaced hardcoded modal notes with release body/local metadata rendering.
- Validation: `npm run check`.

### 2026-05-11 15:55 — splash/icon partial

- Added renderer splash overlay using `GPiIcon.svg`.
- Added packaged app icon assets from `GPiLogo.png`.
- Added settings update indicator dot.
- Validation: `npm run check`.
- Remaining: package/install validation for Windows icon and splash.

### 2026-05-11 23:10 — start-cont T005

- User confirmed T003 updater validation and T012 splash/icon are working; marked both done.
- Claimed T005 to implement safe project file listing API.

### 2026-05-11 23:20 — T005 done

- Added domain types for project file entries/listing.
- Added `gpi:list-project-files` main IPC handler.
- Added bounded traversal with max depth, max entries, symlink skipping, project-relative paths, and heavy directory exclusions.
- Exposed API through preload and renderer typings.
- Updated changelog.
- Validation: `npm run check`.

### 2026-05-11 23:45 — T006-T009 done

- Added right-side read-only project files panel with loading/error/truncated states and refresh.
- Clicking a file inserts `@path` into the selected session draft.
- Composer detects active `@` tokens and shows fuzzy file suggestions with keyboard/mouse selection.
- Mentioned file paths are validated against the project file list and sent to Pi as prompt context under `[GPi Mentioned Project Files]`.
- Validation: `npm run check`.

### 2026-05-12 01:55 — plan-cont image attachments

- Verified Pi SDK supports native image attachments.
- `AgentSession.prompt(text, { images })`, `steer(text, images)`, and `followUp(text, images)` accept `ImageContent[]`.
- Added T018-T022 for image attachment contracts, ingestion, composer UI, SDK sending, and lifecycle hardening.
- No implementation performed.

### 2026-05-12 02:05 — plan-cont Pi Runtime Manager

- User clarified official Pi installation is npm/pnpm global install.
- Added T023-T027 for detecting Pi/npm/pnpm, installing Pi via official commands, adding Runtime settings UI, unifying diagnostics, and gating real session creation with actionable recovery.
- No implementation performed.

### 2026-05-12 02:35 — start-cont T018-T021 image attachments

- Added `GpiImageAttachment` contracts and native SDK image mapping.
- Extended direct and worker Pi bridge prompt/follow-up/steer paths to carry `ImageContent[]`.
- Added image attachment picker and renderer ingest APIs with MIME/size validation.
- Added composer Attach button, paste, drag/drop, thumbnail cards, remove action, and inline attachment errors.
- Send flow now passes images to Pi and shows a concise transcript summary without base64.
- Validation: `npm run check`.

### 2026-05-12 03:15 — T019-T022 done

- User validated image paste, send-to-agent behavior, transcript image rendering, modal preview, close controls, and UI responsiveness.
- Marked T019-T021 done based on validation.
- Added changelog entries for image composer support.
- Added persistence hardening: `toPersistedWorkspace()` strips image base64 and preview data from chat/timeline state before saving.
- Added historical placeholder for image messages after app restart when preview data is intentionally not retained.
- Validation: `npm run check`.

### 2026-05-12 03:50 — start-cont T023-T025 Pi Runtime Manager

- T023 done: added read-only detection for `pi`, `pnpm`, and `npm`, including resolved path, version, and error details.
- `getUpdateStatus()` now reports Pi runtime installability and preferred official install command.
- Manual detection check on this machine: Pi 0.74.0 exists; pnpm missing; npm 10.9.7 exists, so npm global install is the fallback command.
- T024 partial: added controlled `gpi:install-pi` IPC/preload API with explicit force guard, official npm/pnpm argument-array commands, output/error capture, and post-run detection.
- T025 partial: added Runtime settings section with Pi CLI, pnpm, npm, preferred install command, Refresh Runtime, Install Pi, and Update Pi actions.
- Added changelog entries for runtime detection/settings.
- Validation: `npm run check`.
- Pending manual validation: inspect Runtime settings and only run Install Pi after explicit approval because it mutates global npm/pnpm state.

### 2026-05-12 04:25 — T026-T027 runtime recovery

- User validated Runtime settings for installed Pi: Pi/npm detected correctly and pnpm missing matches terminal behavior.
- Marked T025 done.
- T026 partial: moved Pi runtime actions to Runtime, kept app update flow separate, added Windows PATH/session restart guidance, and made install success conditional on `pi` being visible after install.
- T027 partial: Pi session creation now checks Pi runtime before creating the optimistic session; missing Pi shows a recovery dialog that opens Runtime settings with the exact install command when available.
- Added changelog entry for missing-Pi recovery.
- Validation: `npm run check`.
- Removed local-session creation and user-facing `real session` terminology; GPi now presents only Pi sessions.
- Legacy persisted local sessions are filtered during workspace hydration.
- Validation: `npm run check`; `npm run test:unit`.
- Pending manual validation: sandbox Install Pi, simulate missing Pi, and optionally validate `pi update`.
- User chose to leave T024/T026/T027 pending for later because there is no time to test global install/update/missing-runtime behavior now.

### 2026-05-12 05:05 — plan-cont project context surface

- Added T028-T031 for the session-header git/project context surface.
- Planned read-only project context API for git status, branch, upstream, ahead/behind, working tree counts, last commit, and context-file detection.
- Planned header placement beside the session title/context area, not the composer input.
- Planned placeholder colored dot first, with structure ready to swap to the original Git diamond SVG when user provides asset.
- Planned hover/click popover with GPi styling and refresh action.
- No implementation performed.

### 2026-05-12 05:35 — start-cont T028-T031 project context surface

- Added `gpi:get-project-context` read-only IPC/preload API.
- Added git status detection: repo/no repo, branch/detached, upstream, ahead/behind, staged/modified/deleted/untracked/conflicted counts, clean state, last commit.
- Added context file detection for `AGENTS.md`, `README*`, and `.pi/settings.json`.
- Added session-header project context badge using a placeholder colored dot prepared for future Git diamond SVG replacement.
- Split badge colors so ahead/behind uses blue and detached HEAD uses violet.
- Added hover/click project context popover with Refresh action, git summary, counts, last commit, and context files.
- Added changelog entry.
- Validation: `npm run check`.
- T028-T031 were later accepted after manual validation in real use.

### 2026-05-13 03:05 — start-cont T010-T011 Windows Open in GPi

- Added optional Inno Setup `openwithgpi` task for Windows Explorer integration.
- Added HKCU registry entries for folder and folder-background right-click menus.
- Context-menu command passes the selected folder path to `GPi.exe`.
- Added single-instance handling: first launch consumes a folder argument; second launch forwards the folder request to the running GPi window.
- Renderer opens existing projects by normalized path and selects the most recently selected visible session.
- Unknown folders create a new project named from the folder basename with no sessions, leaving the user at the create-session state.
- Invalid folder arguments show a recoverable `Open in GPi failed` error.
- Added changelog entries.
- Validation: `npm run check`; direct Inno Setup compile produced `release/installer/GPi-Setup-0.0.11.exe`.
- User manually validated: right-click `Open in GPi` works for an existing GPi project.
- User manually validated: right-click `Open in GPi` works for a folder that is not a repo and not yet a GPi project, creating an empty project with the folder name.
- User manually validated: using `Open in GPi` while GPi is already open reuses the same existing window.
- T010 and T011 marked done.

### 2026-05-13 03:30 — project context surface accepted

- User asked to leave T024/T026/T027 pending for later manual validation.
- Marked T028-T031 done after real usage validation of the Git badge/popover, clean/dirty auto-refresh, no-git/new-project behavior, and Git logo presentation.
- Next recommended implementation area is Linux packaging T013-T016.

### 2026-05-13 03:45 — plan-cont Pi parity/cockpit roadmap

- Read `docs/implementation/future-pi-parity-roadmap.md` and converted the agreed future implementation direction into executable queue tasks T032-T058.
- Planned session cockpit work: session details/statusbar popover, session titlebar menu, steering/follow-up queue UX.
- Planned Pi tree/fork parity: SDK audit, session tree parsing, nested sidebar branch preview, full tree drawer, jump/fork/clone actions, export/copy after tree semantics.
- Planned context/safety work: real Pi context-files chain popup, read-only session mode, tools visibility.
- Planned Settings expansion: future-proof categories, Scoped Models, Pi Account & Providers, Prompt Templates, Skills, Keybindings.
- Planned extensibility/package work: SDK audit for extensions, Extensions settings, Pi Packages with double-confirm safety foundation and package install/update/remove actions.
- Preserved existing done/partial/pending task statuses and did not renumber prior tasks.

### 2026-05-13 20:50 — plan-cont Preparing Tool Call streaming performance

- Inspected current GPi event path for `toolcall_delta`: SDK bridge emits deltas, workspace appends them to the open `preparing_tool` run phase, and `TimelineRunPhaseEvent` auto-expands active cards and renders the full `stream` detail.
- Added T059 to keep active Preparing Tool Call cards compact/collapsed while preserving captured args for later inspection.
- Added T060 to throttle/buffer high-frequency tool-call delta state updates and avoid per-character React rendering.
- Added T061 to add lightweight diagnostics distinguishing model-side tool argument generation time from GPi UI/render overhead.
- No implementation performed.

### 2026-05-13 21:02 — start-cont T059-T061 Preparing Tool Call streaming

- Implemented T059 in `src/renderer/ui/App.tsx`: active `Preparing tool call` cards no longer expand/render streamed argument JSON live; they show compact progress and keep captured args inspectable after preparation finishes.
- Implemented T060 in `src/bridge/sdk-pi-bridge.ts`: `toolcall_delta` events are buffered and flushed every 120ms plus at tool-call boundaries, reducing renderer state updates during large write/edit argument generation.
- Implemented T061 across `src/bridge/pi-bridge.ts`, `src/bridge/sdk-pi-bridge.ts`, and `src/renderer/state/workspace-store.ts`: added hidden session-detail diagnostics for tool-call delta count, byte count, flush/render update count, and preparing duration.
- Validation: `npm run check` passed.
- Marked T059-T061 partial because manual validation with a large GPi write/edit stream is still required.

### 2026-05-13 21:06 — start-cont Developer mode for tool-call streams

- Added `developerMode` workspace setting, persisted with existing settings hydration.
- Added Settings → Interface → Developer mode toggle.
- Normal mode now ignores live non-final `tool_call_delta` and tool-call diagnostic events before reducing workspace state, keeping the UI light during Preparing Tool Call.
- Developer mode preserves live throttled tool-call stream rendering and diagnostics for debugging.
- Final tool-call summary still reaches the timeline in normal mode so Run Work remains inspectable after the tool call completes.
- Validation: `npm run check` passed.

### 2026-05-13 21:10 — T059-T061 manual validation accepted

- User validated GPi feels much faster with Developer mode off.
- Remaining 15s Preparing Tool Call durations are expected model-side argument generation time and can also happen in Pi.
- Marked T059-T061 done.
