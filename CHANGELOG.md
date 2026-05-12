# Changelog

All notable GPi changes are documented here. Releases must move relevant entries from `[Unreleased]` into a versioned section before tagging.

## [Unreleased]

### Added

- None.

### Changed

- None.

### Fixed

- None.

### Packaging

- None.

### Known issues

- None.

## [0.0.10] - 2026-05-12
### Added

- Added composer image attachments with picker, paste, drag/drop, thumbnails, remove controls, and fullscreen preview.
- Added native Pi SDK image delivery for prompts and follow-ups.
- Added Pi runtime detection for the Pi CLI, pnpm, and npm with official install command selection.
- Added a Runtime settings section for Pi install/update status and explicit Pi install actions.
- Added a missing-Pi recovery path when creating Pi sessions.

### Changed

- Image attachments are stored under GPi user data and restored after app restart without embedding large base64 payloads in workspace JSON.
- Removed local-session creation and user-facing "real session" terminology; GPi now presents only Pi sessions.

### Fixed

- None.

### Packaging

- None.

### Known issues

- None.

## [0.0.9] - 2026-05-12
### Added

- Added a bounded project file listing IPC API for future file tree and @ mentions.
- Added a read-only project files panel with collapsible directories and click-to-add file mention chips.
- Added composer `@` file mention autocomplete with keyboard and mouse selection.
- Added prompt context injection for mentioned project files.
- Added an Interface settings section with a project file tree visibility toggle.

### Changed

- Project file mentions now render as removable composer chips instead of inline raw text.

### Fixed

- Fixed slow project file tree collapse/open behavior by keeping collapse state local to the panel.
- Fixed file mention insertion latency by updating the composer locally before workspace synchronization.
- Fixed project file tree refresh expanding previously collapsed directories.

### Packaging

- None.

### Known issues

- None.

## [0.0.8] - 2026-05-11

### Added

- Added a settings update indicator dot showing up-to-date, update available, stale, or unknown status.
- Added a glass startup splash screen using the GPi icon asset.
- Added packaged GPi logo assets for app/taskbar/start-menu icon usage.

### Changed

- None.

### Fixed

- Fixed continuity onboarding reopening every dev launch after installed skills are already current or the user closes it manually.

### Packaging

- None.

### Known issues

- None.

## [0.0.7] - 2026-05-11

### Added

- Added a composer session-stats Compact button for the selected real Pi session.

### Changed

- Composer status now shows Compacting during active compaction and exposes Abort compact.
- Session stats now refresh automatically after compaction events.

### Fixed

- Fixed compaction stats appearing stale until the next message.

### Packaging

- None.

### Known issues

- None.

## [0.0.6] - 2026-05-11

### Added

- Added release changelog workflow so GPi update notes stay aligned with GitHub Releases.
- Added release-backed post-update notes loaded from GitHub release metadata or local downloaded-update metadata.

### Changed

- Release automation now requires a versioned changelog entry before publishing.
- Post-update modal now renders release notes from release metadata instead of hardcoded app-version notes.

### Fixed

- Fixed future release notes being easy to forget by making release validation fail without matching changelog notes.

### Packaging

- Added scripts for preparing and validating release notes.
- Release workflow now publishes the changelog section as the GitHub Release body.

### Known issues

- Linux packaging is planned but not implemented yet.

## [0.0.5] - 2026-05-10

### Added

- Added in-app GPi update download and install flow.
- Added post-update notes modal shown once per app version.
- Added dual Plan/Start workflow behavior after continuity work has begun.
- Added interruptible timeline autoscroll with Jump to latest recovery.
- Added Linux packaging plan documentation.

### Changed

- Improved continuity onboarding copy for Plan refinement after execution starts.

### Fixed

- Fixed autoscroll forcing the user back to the bottom after manual upward scrolling.

### Packaging

- Released `GPi-Setup-0.0.5.exe`.

### Known issues

- Post-update notes are still hardcoded in app code until release-backed notes are wired in.

## [0.0.4] - 2026-05-10

### Fixed

- Fixed false workflow-skill conflicts caused by Windows newline conversion.

## [0.0.3] - 2026-05-10

### Fixed

- Fixed continuity state detection so initialized queues require Plan before Start when no `planned_at` exists.

## [0.0.2] - 2026-05-09

### Fixed

- Fixed packaged Windows runtime asset loading.
- Fixed bundled continuity skills path in installed builds.

## [0.0.1] - 2026-05-09

### Added

- Initial GPi Windows release.
- Added release packaging and Windows installer workflow.
