---
continuity_session: CONT-2026-05-10-1630-gpi-roadmap
created_at: 2026-05-10 16:30
updated_at: 2026-05-10 16:45
status: active
goal: Complete GPi roadmap items for file mentions, project file tree, Windows Open in GPi context menu, startup splash, Linux packaging, updater validation, and workflow polish.
---

# STATE

## Current status

T001 and T002 are done by user/manual validation. T003 is blocked until a future release exists for end-to-end updater validation. T004 is done: release workflow enforces changelog-backed notes and post-update modal reads release metadata instead of hardcoded notes.

## Last checkpoint

2026-05-10 17:10 — Completed release-backed post-update notes.

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
- GPi updater install flow needs installed-app end-to-end validation.

## Next recommended step

Continue with T005 — Add safe project file listing API.

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
