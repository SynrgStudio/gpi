---
continuity_session: CONT-2026-05-10-1630-gpi-roadmap
created_at: 2026-05-10 16:30
updated_at: 2026-05-12 04:40
status: active
goal: Complete GPi roadmap items for file mentions, project file tree, Windows Open in GPi context menu, startup splash, Linux packaging, updater validation, and workflow polish.
---

# STATE

## Current status

T001 through T009, T012, T018-T023, and T025 are done. T024, T026, and T027 are implemented but marked partial pending manual global-install/update/missing-runtime validation. Native image attachments are implemented, manually validated, and hardened for persistence. Existing roadmap tasks T010-T17 remain pending.

## Last checkpoint

2026-05-12 04:25 — Unified runtime diagnostics and added missing-Pi real-session recovery.

## Active continuity session

CONT-2026-05-10-1630-gpi-roadmap

## Active goal

Complete GPi roadmap items for file mentions, project file tree, Windows Open in GPi context menu, startup splash, Linux packaging, updater validation, and workflow polish.

## Validation status

- Not run after `/plan-cont`; markdown-only queue/state update.
- Last known validation before planning: `npm run check` passed after updater/autoscroll/workflow changes.

## Known blockers

- Windows context menu tasks require local installer/manual validation.
- Linux packaging tasks require Linux runner/host validation.
- Image attachment final validation requires a vision-capable configured model.
- Pi install command should only be run after explicit user click/approval; package-manager/global install behavior may affect local PATH.

## Next recommended step

Manual validation: simulate missing Pi and attempt Pi session creation; validate Pi install in sandbox; optionally validate `pi update` on a machine where updating global Pi is acceptable. Next implementation area after validation: T010 Windows context menu.

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
