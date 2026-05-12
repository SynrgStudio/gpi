---
continuity_session: CONT-2026-05-10-1630-gpi-roadmap
created_at: 2026-05-10 16:30
updated_at: 2026-05-11 23:45
status: active
goal: Complete GPi roadmap items for file mentions, project file tree, Windows Open in GPi context menu, startup splash, Linux packaging, updater validation, and workflow polish.
---

# STATE

## Current status

T001 through T009 and T012 are done. File listing, read-only file panel, click-to-mention, autocomplete, and mention prompt context are implemented. Next executable task is T010 Windows Open in GPi context-menu installer option.

## Last checkpoint

2026-05-11 23:45 — Completed T006-T009 file mentions flow.

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

## Next recommended step

Manual validation: browse project files, click a file to insert `@path`, type `@` for autocomplete, send a prompt and confirm Pi receives mentioned file paths. Then continue with T010 if accepted.

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
