---
continuity_session: CONT-2026-05-10-1630-gpi-roadmap
created_at: 2026-05-10 16:30
updated_at: 2026-05-11 23:45
planned_at: 2026-05-10 16:45
status: active
goal: Complete GPi roadmap items for file mentions, project file tree, Windows Open in GPi context menu, startup splash, Linux packaging, updater validation, and workflow polish.
---

# ACTIVE_QUEUE.md

## Current goal

Complete GPi roadmap items for file mentions, project file tree, Windows Open in GPi context menu, startup splash, Linux packaging, updater validation, and workflow polish.

## Queue policy

- Status values: pending, in_progress, done, blocked, partial, cancelled.
- Never renumber existing task IDs.
- Pick first pending task whose dependencies are done.
- Preserve claims unless stale or explicitly overridden.

## Queue

### T001 — Validate and harden continuity workflow controls

Status: done
Claimed by: user/manual validation
Started: 2026-05-10 16:45
Last update: 2026-05-10 16:50
Scope:
- Validate current Plan/Start behavior in code after recent local changes.
- Confirm initialized queues show Plan before `planned_at`.
- Confirm executable queues show Start only until work has begun.
- Confirm executable queues with done/partial/cancelled/in_progress work show both Plan and Start.
- Confirm onboarding and hover text explain post-start Plan refinement.
DoD:
- Workflow labels match phase and task-count state.
- Separate Plan button only appears after work has started.
- Hover text explains Plan refinement and Start continuation.
- Onboarding mentions Plan can refine/add tasks after execution begins.
Validation:
- npm run check
- manual: user confirmed behavior works
Files likely touched:
- src/renderer/ui/App.tsx
- src/main/main.ts
- src/renderer/styles.css
Risk: medium
Depends on:
- none
Notes:
- User confirmed this is working.

### T002 — Validate and harden interruptible timeline autoscroll

Status: done
Claimed by: user/manual validation
Started: 2026-05-10 16:45
Last update: 2026-05-10 16:50
Scope:
- Validate mouse wheel up interrupts autoscroll during long assistant streams.
- Validate Jump to latest resumes autoscroll.
- Ensure manual scroll near bottom restores normal pinned behavior.
- Add small code cleanup if needed.
DoD:
- User can scroll up during stream without being forced down.
- Jump to latest returns to bottom and resumes automatic following.
- No regression in normal streaming behavior.
Validation:
- npm run check
- manual: user confirmed behavior works
Files likely touched:
- src/renderer/ui/App.tsx
Risk: low
Depends on:
- none
Notes:
- User confirmed this is working.

### T003 — Validate and harden GPi updater download/install flow

Status: done
Claimed by: user/manual validation
Started: 2026-05-10 16:50
Last update: 2026-05-11 23:10
Scope:
- Validate installed app detects newer GPi release.
- Validate Update GPi downloads installer inside app.
- Validate button changes to Install Update.
- Validate Install Update launches installer and closes app.
- Improve progress/errors if validation finds rough edges.
DoD:
- End-to-end update from installed version to newer release works.
- Button states are clear: Update GPi -> Downloading -> Install Update.
- Installer launch is restricted to downloaded GPi update path.
Validation:
- manual: install older release, update to latest release
Files likely touched:
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
- src/domain/types.ts
Risk: medium
Depends on:
- future release available
Notes:
- User confirmed updater flow is working.

### T004 — Replace hardcoded post-update notes with release-backed notes

Status: done
Claimed by: pi
Started: 2026-05-10 16:50
Last update: 2026-05-10 17:10
Scope:
- Extend GitHub release fetching to capture release body/changelog.
- Store enough update metadata for post-update modal.
- Show changes since previous version when available.
- Keep fallback local notes if release body is unavailable.
DoD:
- Modal appears once after app version changes.
- Notes reflect GitHub release notes or a clear fallback.
- Closing persists `lastSeenAppVersion`.
- First install does not show update notes.
Validation:
- npm run check
- manual: simulate version change in persisted workspace settings
Files likely touched:
- src/main/main.ts
- src/domain/types.ts
- src/renderer/state/workspace-store.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- none
Notes:
- Release workflow now requires versioned changelog notes and uses them as GitHub Release body.
- Post-update modal now reads GitHub release body or local update metadata instead of hardcoded notes.

### T005 — Add safe project file listing API

Status: done
Claimed by: pi
Started: 2026-05-11 23:10
Last update: 2026-05-11 23:20
Scope:
- Add main-process API to list files for selected project safely.
- Exclude heavy/irrelevant directories (`node_modules`, `.git`, `dist`, `dist-test`, `release`, `.gpi-package`, caches).
- Limit traversal by depth and max entries.
- Return project-relative paths with file/directory metadata.
DoD:
- API returns bounded file tree entries for selected project.
- Path traversal is contained to project root.
- Large repos do not freeze UI.
Validation:
- npm run check
- manual: list C:/gpi files and verify exclusions
Files likely touched:
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/domain/types.ts
Risk: high
Depends on:
- none
Notes:
- Foundation for filetree and @ mentions.
- Added bounded `gpi:list-project-files` IPC/preload API with depth/entry limits and heavy directory exclusions.

### T006 — Render read-only project file tree

Status: done
Claimed by: pi
Started: 2026-05-11 23:30
Last update: 2026-05-11 23:45
Scope:
- Add UI surface for selected project file tree.
- Render directories/files read-only.
- Support refresh and loading/error states.
- Keep visual style consistent with existing GPi shell.
DoD:
- File tree appears for selected project.
- It is clearly read-only.
- It handles empty/error/loading states.
Validation:
- npm run check
- manual: browse C:/gpi in GPi
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T005
Notes:
- Rendered right-side read-only project files panel with refresh/loading/error/truncated states.

### T007 — Click file tree item to insert @ mention

Status: done
Claimed by: pi
Started: 2026-05-11 23:30
Last update: 2026-05-11 23:45
Scope:
- Wire file click to insert `@project/relative/path` or `@path` into composer.
- Preserve cursor position when possible.
- Focus composer after insertion.
DoD:
- Clicking file inserts a mention in composer.
- Existing draft text is preserved.
- Composer remains usable after insertion.
Validation:
- npm run check
- manual: click file in tree and send prompt
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T006
Notes:
- Clicking a file in the project files panel appends `@path` to the selected session draft.

### T008 — Add @ mention autocomplete/fuzzy search

Status: done
Claimed by: pi
Started: 2026-05-11 23:30
Last update: 2026-05-11 23:45
Scope:
- Detect active `@` token in composer.
- Show fuzzy file suggestions from project file list.
- Keyboard navigation for suggestions.
- Insert selected path.
DoD:
- Typing `@` opens suggestions.
- Filtering by path segment works.
- Arrow/Enter and mouse selection work.
- Escape closes suggestions.
Validation:
- npm run check
- manual: type @, filter, select file
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: high
Depends on:
- T005
Notes:
- Composer detects active `@` token, filters project file suggestions, supports arrow navigation, Enter selection, Escape close, and mouse selection.

### T009 — Send mentioned file context to Pi

Status: done
Claimed by: pi
Started: 2026-05-11 23:30
Last update: 2026-05-11 23:45
Scope:
- Parse mentioned file paths before send.
- Validate paths are within selected project.
- Add a clear context prefix or prompt annotation for Pi with mentioned files.
- Optionally show attachment tray with remove buttons before send.
DoD:
- Mentioned file paths are included in prompt context.
- Invalid/outside paths are ignored or surfaced clearly.
- User-visible draft remains understandable.
Validation:
- npm run check
- manual: mention file and ask Pi to inspect it
Files likely touched:
- src/renderer/ui/App.tsx
- src/main/main.ts
Risk: medium
Depends on:
- T008
Notes:
- Mentioned files are parsed from the draft, validated against project file list, and sent to Pi as a `[GPi Mentioned Project Files]` prompt context prefix. File contents are not inlined.

### T010 — Add Windows Open in GPi context-menu installer option

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add optional Inno Setup task for folder context menu action `Open in GPi`.
- Register/unregister appropriate HKCU registry keys.
- Pass selected folder path to GPi executable.
DoD:
- Installer exposes checkbox.
- Context menu appears on folders/directories.
- Uninstall removes entries.
Validation:
- npm run installer:win
- manual: install with option, right-click folder, uninstall
Files likely touched:
- installer/gpi.iss
Risk: high
Depends on:
- none
Notes:
- Keep per-user install compatible with current `PrivilegesRequired=lowest`.

### T011 — Support launch/open folder argument in GPi

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Main process captures folder path argument.
- Renderer/workspace can select existing project by path.
- If no project exists, create one from folder basename.
- Handle second-instance activation if GPi is already running.
DoD:
- `GPi.exe C:\path\to\folder` opens/creates that project.
- Existing running GPi receives folder open request.
- Invalid paths show recoverable error.
Validation:
- npm run check
- manual: launch with folder arg, launch second instance with folder arg
Files likely touched:
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/renderer/ui/App.tsx
- src/renderer/state/workspace-store.ts
- src/domain/types.ts
Risk: high
Depends on:
- T010
Notes:
- Single-instance lock is important for context menu UX.

### T012 — Add glass startup splash overlay

Status: done
Claimed by: pi
Started: 2026-05-11 15:50
Last update: 2026-05-11 23:10
Scope:
- Show glass overlay with centered GPi logo while app initializes.
- Hide after workspace and core initial async checks are usable.
- Surface fatal startup errors instead of black window.
DoD:
- Fresh launch displays splash immediately.
- Splash fades out when app ready.
- Slow update check does not block forever.
- Startup errors are visible.
Validation:
- npm run check
- npm run package:win
- manual: launch installed app
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- none
Notes:
- Renderer splash overlay implemented with `GPiIcon.svg` asset.
- App icon assets wired for packaged resources and Windows packager icon.
- User confirmed startup splash/icon behavior is working.

### T013 — Implement Linux portable package and tarball

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add `scripts/package-linux.mjs` mirroring Windows package staging.
- Add archive script for `GPi-linux-x64-<version>.tar.gz`.
- Add npm scripts.
DoD:
- `npm run package:linux` works on Linux CI.
- Tarball contains runnable `GPi-linux-x64/GPi`.
- Bundled skills are present outside app.asar.
Validation:
- GitHub Actions Linux job or local Linux host
Files likely touched:
- scripts/package-linux.mjs
- scripts/archive-linux.mjs
- package.json
Risk: high
Depends on:
- none
Notes:
- See docs/implementation/linux-packaging.md.

### T014 — Implement Debian package artifact

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add Debian staging script and metadata.
- Install app to `/opt/GPi`.
- Include `.desktop` entry and optional symlink/launcher.
DoD:
- `npm run installer:linux:deb` produces `gpi_<version>_amd64.deb`.
- `.deb` installs and uninstalls cleanly on Ubuntu.
Validation:
- dpkg-deb --contents
- manual/CI: apt install on Ubuntu runner if feasible
Files likely touched:
- scripts/package-deb.mjs
- packaging/linux/gpi.desktop
- packaging/linux/deb/control.template
- package.json
Risk: high
Depends on:
- T013
Notes:
- Do not auto-sudo in app updater.

### T015 — Add Linux release workflow artifacts

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Extend GitHub release workflow to build Linux tarball and `.deb`.
- Upload assets alongside Windows installer.
- Add artifact structure smoke checks.
DoD:
- Release contains Windows `.exe`, Linux `.tar.gz`, and Linux `.deb`.
- Linux job failure is diagnosable and does not hide Windows status.
Validation:
- test tag/release
Files likely touched:
- .github/workflows/release.yml
Risk: medium
Depends on:
- T013
- T014
Notes:
- Keep jobs split by OS.

### T016 — Make updater platform-aware

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Select `.exe` installer on Windows.
- Select `.deb` on Linux when available, fallback to `.tar.gz`.
- Show platform-specific install instructions.
- Keep in-app auto-run only for Windows installer; Linux opens/downloads asset and shows command.
DoD:
- Windows update flow still works.
- Linux sees correct asset and instruction.
Validation:
- npm run check
- unit-testable asset selection if extracted
Files likely touched:
- src/main/main.ts
- src/domain/types.ts
- src/renderer/ui/App.tsx
Risk: medium
Depends on:
- T015
Notes:
- Linux should not run privileged package installation from GPi.

### T017 — Add project context surfaces

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Show selected project git status summary.
- Detect project instructions (`AGENTS.md`, `README.md`, `.pi/settings.json`).
- Surface actionable error recovery cards for missing Pi/auth/project failures.
DoD:
- User can see relevant project context before prompting.
- Errors are recoverable with clear actions.
Validation:
- npm run check
- manual: project with/without git, missing Pi/auth cases
Files likely touched:
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- none
Notes:
- Candidate feature from roadmap; can be deferred after core file/context features.
