---
continuity_session: CONT-2026-05-10-1630-gpi-roadmap
created_at: 2026-05-10 16:30
updated_at: 2026-05-13 21:10
planned_at: 2026-05-13 03:45
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

Status: done
Claimed by: pi
Started: 2026-05-13 02:55
Last update: 2026-05-13 03:15
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
- Added optional `openwithgpi` Inno task and HKCU registry entries for folder and folder-background context menus.
- Direct Inno Setup compile succeeded and produced `release/installer/GPi-Setup-0.0.11.exe`.
- Validation: `npm run check`.
- User manually validated: installer/context menu works when opening a folder that already exists as a GPi project.
- User manually validated: context menu works when opening a folder that is not a repo and not yet a GPi project.

### T011 — Support launch/open folder argument in GPi

Status: done
Claimed by: pi
Started: 2026-05-13 03:00
Last update: 2026-05-13 03:15
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
- Added single-instance folder open request handling for first launch and second-instance activation.
- Existing projects are selected by normalized folder path and use the most recently selected visible session; unknown folders create a project named from the folder and no session.
- Invalid folder arguments surface as recoverable `Open in GPi failed` errors.
- Validation: `npm run check`.
- User manually validated: `Open in GPi` with GPi already running reuses the existing window.

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

### T018 — Add image attachment domain and bridge contracts

Status: done
Claimed by: pi
Started: 2026-05-12 02:12
Last update: 2026-05-12 02:35
Scope:
- Add GPi image attachment types for renderer/preload/main/bridge boundaries.
- Extend Pi bridge prompt/steer/followUp methods to accept image attachments.
- Map GPi image attachments to Pi SDK `ImageContent` (`type: "image"`, base64 `data`, `mimeType`).
- Preserve current text-only behavior when no images are attached.
DoD:
- TypeScript contracts support image attachments end-to-end.
- `SdkPiSessionHandle.prompt()` calls `session.prompt(text, { images })` when images exist.
- `steer()` and `followUp()` pass image arrays through to SDK.
- Mock bridge remains compatible.
Validation:
- npm run check
Files likely touched:
- src/bridge/pi-bridge.ts
- src/bridge/sdk-pi-bridge.ts
- src/bridge/mock-pi-bridge.ts
- src/domain/types.ts
Risk: medium
Depends on:
- none
Notes:
- SDK supports native images via `AgentSession.prompt(text, { images })`, `steer(text, images)`, and `followUp(text, images)`.
- Pi image type is `ImageContent { type: "image"; data: string; mimeType: string }` from `@earendil-works/pi-ai`.
- Added bridge/domain/protocol support for image arrays and mapped GPi image attachments to SDK `ImageContent[]`.

### T019 — Add safe image ingestion API

Status: done
Claimed by: pi
Started: 2026-05-12 02:12
Last update: 2026-05-12 03:05
Scope:
- Add main/preload APIs to ingest image files and clipboard image data for composer attachments.
- Validate supported MIME types (`image/png`, `image/jpeg`, `image/webp`, optionally `image/gif`).
- Enforce per-image, total-size, and count limits.
- Store pasted clipboard images under a controlled temp/userData attachment directory.
- Return lightweight metadata plus preview-safe URL/data for renderer display.
DoD:
- File-picker/drag/drop images can be converted into validated GPi image attachments.
- Clipboard image blobs can be saved and returned as attachments.
- Oversized/unsupported images return clear recoverable errors.
- Workspace JSON does not persist large base64 image data.
Validation:
- npm run check
- manual: attach png/jpg/webp, reject unsupported/oversized file
Files likely touched:
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/domain/types.ts
Risk: high
Depends on:
- T018
Notes:
- Prefer controlled temp files for clipboard images; do not keep large images inside persisted workspace state.
- Added picker/renderer-ingest APIs with MIME and 10MB per-image validation. Current implementation keeps attachments in composer-local memory and does not persist them to workspace JSON.
Next:
- Manual validation for picker/paste/drop and unsupported/oversized images.
- Temp-file lifecycle can be revisited in T022 if needed.

### T020 — Add composer image attachment UI

Status: done
Claimed by: pi
Started: 2026-05-12 02:12
Last update: 2026-05-12 03:05
Scope:
- Add attachment button to composer.
- Support drag/drop images onto composer.
- Support paste image from clipboard.
- Render image chips/cards with thumbnail, name/type/size, and remove affordance.
- Keep visual language aligned with current file mention chips, but image-specific.
DoD:
- User can add one or more images before sending.
- User can remove any image before sending.
- Invalid image errors are visible and non-destructive.
- Existing text input, file mention chips, and send flow keep working.
Validation:
- npm run check
- manual: attach via picker, drag/drop, paste, remove, send text-only regression
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: high
Depends on:
- T019
Notes:
- Keep interaction instant; avoid routing every thumbnail update through global workspace state.
- Added Attach button, drag/drop, paste handling, thumbnail cards, remove action, and inline errors.
Next:
- Manual UI/UX validation in GPi.

### T021 — Send composer images to Pi SDK

Status: done
Claimed by: pi
Started: 2026-05-12 02:12
Last update: 2026-05-12 03:05
Scope:
- Include selected image attachments when sending a normal prompt.
- Include images in follow-up/steer paths when the selected session is busy.
- Clear successfully sent image chips/cards after prompt acceptance.
- Ensure visible chat message indicates images were attached without dumping base64.
DoD:
- Pi receives native image attachments through SDK `ImageContent[]`.
- Text-only prompts continue to work exactly as before.
- Follow-up prompts can include images.
- User-visible transcript shows a concise attachment summary.
Validation:
- npm run check
- manual: send screenshot/image to a vision-capable model and confirm agent can reason about it
Files likely touched:
- src/renderer/ui/App.tsx
- src/bridge/pi-bridge.ts
- src/bridge/sdk-pi-bridge.ts
- src/bridge/worker-runtime-protocol.ts
- src/main/worker-pi-runtime.ts
Risk: high
Depends on:
- T018
- T020
Notes:
- This is the first real feedback point for image composer support.
- Composer sends selected images through preload/main/worker bridge to Pi SDK prompt/follow-up calls and records a concise visible transcript summary.
Next:
- Manual validation with a vision-capable model to confirm Pi reasons about the attached image.

### T022 — Harden image attachment lifecycle and release notes

Status: done
Claimed by: pi
Started: 2026-05-12 03:05
Last update: 2026-05-12 03:15
Scope:
- Add cleanup for old temp attachment files.
- Add user-facing limits/copy in settings or inline errors if needed.
- Add changelog entry for image attachments.
- Add small regression coverage if attachment reducers/helpers are extracted.
DoD:
- Old temp images are cleaned safely.
- Limits are documented in UI or errors.
- Changelog describes image composer support.
- No large image data is persisted in workspace storage.
Validation:
- npm run check
- targeted unit test if helpers are extracted
Files likely touched:
- src/main/main.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
- CHANGELOG.md
- test/* if helpers are extracted
Risk: medium
Depends on:
- T021
Notes:
- User validated paste, send, image transcript rendering, preview modal, and UI responsiveness.
- Added changelog notes.
- Persisted workspace storage strips image base64/preview data and retains only lightweight metadata.
- Added placeholder for historical image messages after app restart.
- Validation: `npm run check`.

### T023 — Add Pi runtime and package-manager detection

Status: done
Claimed by: pi
Started: 2026-05-12 03:25
Last update: 2026-05-12 03:50
Scope:
- Detect whether `pi` is available on PATH and capture resolved executable path/version.
- Detect official install package managers: `pnpm` and `npm` availability/versions.
- Extend existing update status with runtime installability details without running install commands.
- Surface missing npm/pnpm as a recoverable state.
DoD:
- GPi can distinguish Pi missing, Pi installed, Pi stale/current, and no package manager available.
- Detection reports preferred install command using `pnpm add -g @earendil-works/pi-coding-agent` when pnpm exists, otherwise `npm install -g @earendil-works/pi-coding-agent`.
- Detection is read-only and does not mutate the system.
Validation:
- npm run check
- manual: test with current machine where Pi exists; simulate command-not-found paths if practical
Files likely touched:
- src/main/main.ts
- src/domain/types.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
Risk: medium
Depends on:
- none
Notes:
- Official Pi install path is npm/pnpm global install, not a custom downloader.
- Added read-only runtime detection for `pi`, `pnpm`, and `npm` with resolved path/version/error details.
- `getUpdateStatus()` now reports preferred install command: `pnpm add -g @earendil-works/pi-coding-agent` when pnpm exists, otherwise `npm install -g @earendil-works/pi-coding-agent`.
- Manual validation on this machine: `pi --version` resolved to 0.74.0; `pnpm` missing; `npm --version` resolved to 10.9.7.
- Validation: `npm run check`.

### T024 — Add controlled Pi install command API

Status: partial
Claimed by: pi
Started: 2026-05-12 03:35
Last update: 2026-05-12 03:50
Scope:
- Add main-process API to install Pi using selected package manager.
- Run `pnpm add -g @earendil-works/pi-coding-agent` or `npm install -g @earendil-works/pi-coding-agent` via `execFile`/spawn argument arrays, not shell strings.
- Capture stdout/stderr and return a concise install result.
- Re-run runtime detection after install completes.
- Block install when Pi is already available unless explicitly requested by caller.
DoD:
- Missing Pi can be installed from GPi using official npm/pnpm command.
- Command, package manager, output, and error are returned for UI display.
- Failed installs are non-destructive and diagnosable.
Validation:
- npm run check
- manual: run only with user approval on a machine where install/update behavior is acceptable
Files likely touched:
- src/main/main.ts
- src/domain/types.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
Risk: high
Depends on:
- T023
Notes:
- Do not auto-run installs on startup; user must click/confirm.
- Added `gpi:install-pi` IPC/preload API using argument arrays for official pnpm/npm global install commands.
- API blocks install when Pi is already available unless caller explicitly forces install.
- API re-runs runtime detection after install/failure and returns command/output/error/runtime details.
Next:
- Manual install validation only after explicit user approval on a machine where global install mutation is acceptable.

### T025 — Add Runtime settings section for Pi install/update

Status: done
Claimed by: pi
Started: 2026-05-12 03:40
Last update: 2026-05-12 04:05
Scope:
- Add a `Runtime` settings section distinct from `Interface`, `Updates`, `Revert`, and `Onboarding`.
- Show Pi runtime status, resolved path, installed/latest versions, package-manager availability, and exact install/update command.
- Show `Install Pi` when Pi is missing and npm/pnpm is available.
- Show `Update Pi` when Pi is installed and stale.
- Show install/update logs and errors inline.
DoD:
- User can understand whether GPi can run Pi sessions without leaving Settings.
- Install and update actions are explicit and never run automatically.
- Missing package manager state explains that Node/npm or pnpm is required.
Validation:
- npm run check
- manual: inspect Runtime settings in installed/current Pi states
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T023
- T024
Notes:
- Future runtime toggles can live here, e.g. managed/system runtime choice.
- Added Runtime settings section showing Pi CLI, pnpm, npm, preferred install command, refresh, Install Pi, and Update Pi actions.
- Install action is explicit and uses the controlled install API; no automatic install runs on startup.
- User validated Settings → Runtime for the installed-Pi state; pnpm missing matches terminal behavior, npm/Pi detection works.

### T026 — Unify Pi update/install flow and diagnostics

Status: partial
Claimed by: pi
Started: 2026-05-12 04:05
Last update: 2026-05-12 04:25
Scope:
- Reuse Runtime settings state for existing Pi update button/status.
- Prefer `pi update` for installed Pi updates; keep npm/pnpm global install as missing-runtime path.
- Add clear fallback guidance when install succeeds but `pi` is not immediately on PATH.
- Add diagnostics copy for Windows PATH/session restart issues.
DoD:
- Settings no longer have contradictory Pi status/actions between Runtime and Updates.
- Update still works for already-installed Pi.
- Post-install PATH issues are surfaced with next steps instead of generic failure.
Validation:
- npm run check
- manual: update existing Pi; install missing Pi or simulate PATH issue if feasible
Files likely touched:
- src/main/main.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T025
Notes:
- Keep GPi app update flow separate from Pi runtime install/update flow.
- Runtime now owns Pi install/update actions; Updates keeps GPi app update separate and points runtime management to Runtime.
- Install results now return PATH/session-restart diagnostics if npm/pnpm reports success but `pi` is still not visible.
- Runtime copy includes Windows PATH refresh guidance.
- Validation: `npm run check`.
Next:
- Manual validation of `pi update` or a simulated post-install PATH issue when acceptable.

### T027 — Gate Pi session creation on Pi runtime readiness

Status: partial
Claimed by: pi
Started: 2026-05-12 04:15
Last update: 2026-05-12 04:25
Scope:
- When user creates a Pi session and runtime is missing/unusable, show a recovery card/dialog instead of a low-level SDK error.
- Offer `Install Pi` or `Open Runtime settings` from that recovery surface.
- Preserve existing behavior when Pi runtime is ready.
DoD:
- Missing Pi produces an actionable UI path.
- User can install Pi then retry session creation.
- Existing authenticated/working setups are unaffected.
Validation:
- npm run check
- manual: simulate missing Pi and attempt Pi session creation
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
- src/main/main.ts
Risk: medium
Depends on:
- T025
Notes:
- This closes the loop: GPi no longer requires users to know Pi installation steps before using the app.
- Pi session creation now checks runtime status before creating the optimistic session.
- Missing Pi shows an actionable dialog that opens Settings directly to Runtime, with the exact install command when npm/pnpm is available.
- Existing installed-Pi setups continue through the normal create-session path.
- Removed local-session creation and user-facing `real session` terminology; GPi now presents only Pi sessions.
- Legacy persisted local sessions are filtered during workspace hydration.
- Validation: `npm run check`; `npm run test:unit`.
Next:
- Manual validation by simulating missing Pi and attempting Pi session creation.

### T028 — Add read-only project context API

Status: done
Claimed by: pi
Started: 2026-05-12 05:15
Last update: 2026-05-13 03:30
Scope:
- Add a main-process API to collect read-only project context for the selected project.
- Detect whether the project is inside a git work tree.
- Collect git branch, detached HEAD state, upstream, ahead/behind counts, staged/modified/deleted/untracked/conflicted counts, clean/dirty status, and last commit summary.
- Detect context files: `AGENTS.md`, `README.md`/`README.*`, and `.pi/settings.json`.
- Return recoverable errors instead of throwing for missing git, non-git folders, or invalid project paths.
DoD:
- Renderer can request a bounded project context object for the selected project.
- Git detection is read-only and never mutates repository state.
- Non-git projects return `isRepo: false` with no fatal UI error.
- Context file detection is path-contained to the project root.
Validation:
- npm run check
- manual: project with git, project without git, dirty repo, missing context files
Files likely touched:
- src/domain/types.ts
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
Risk: medium
Depends on:
- none
Notes:
- Use a placeholder status dot in the UI at first; user plans to provide the original Git diamond SVG later.
- Suggested commands: `git rev-parse --is-inside-work-tree`, `git status --porcelain=v1 --branch`, `git log -1 --pretty=format:%h%x00%s%x00%an%x00%ct`.
- Implemented `gpi:get-project-context` IPC/preload API with git status and context-file detection.
- Validation: `npm run check`.
- User validated project context behavior in real GPi usage, including clean/dirty transitions and no-git/new-project display.

### T029 — Render git status badge in the session header

Status: done
Claimed by: pi
Started: 2026-05-12 05:20
Last update: 2026-05-13 03:30
Scope:
- Add a compact project-context badge in the chat/session header next to the session title area.
- Use a colored placeholder dot for now; leave structure ready to swap in the original Git diamond SVG.
- Encode status colors for no git, clean, dirty, ahead/behind, conflicted/error, and detached states.
- Refresh context when selected project changes and expose a manual refresh action in the popover.
DoD:
- Header shows current project git state without using composer/inputbox space.
- Badge is visually aligned with the existing GPi header style.
- Badge remains useful when there is no selected session but a project is selected.
- No-git state is visible but not alarming.
Validation:
- npm run check
- manual: switch projects, dirty/clean repo states, no-git folder
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T028
Notes:
- Header placement is intentional: git status belongs to the active project/session context, not the composer.
- Added session-header badge with Git logo and git branch/sync/dirty state.
- Validation: `npm run check`.
- User validated clean/dirty auto-refresh: deleting untracked files moved GPi from yellow changed state to green clean automatically.

### T030 — Add project context hover/click popover

Status: done
Claimed by: pi
Started: 2026-05-12 05:25
Last update: 2026-05-13 03:30
Scope:
- Add a GPi-styled popover anchored to the project-context badge.
- Show git branch, repo state, ahead/behind, upstream, staged/modified/deleted/untracked/conflicted counts, last commit, and context-file presence.
- Support hover preview and click-toggle/pin so the panel does not disappear while reading.
- Include `Refresh` action.
DoD:
- Popover presents the full git/context summary compactly.
- User can inspect the panel without moving focus to the composer.
- Missing git/context files are communicated clearly without scary errors.
Validation:
- npm run check
- manual: hover, click-toggle, refresh, outside click/Esc close
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T029
Notes:
- Visual reference: account/rate-limit style popover, but adapted to GPi glass surfaces.
- Added hover/click popover with git summary, working-tree counts, last commit, and context files.
- Removed manual refresh button in favor of automatic updates while visible/on project change.
- Validation: `npm run check`.
- User validated popover content and badge behavior in installed app usage.

### T031 — Add project context recovery and polish pass

Status: done
Claimed by: pi
Started: 2026-05-12 05:30
Last update: 2026-05-13 03:30
Scope:
- Add concise diagnostics for git command failures, invalid project paths, detached HEAD, conflicts, missing upstream, and no git repository.
- Ensure status copy avoids internal implementation terms.
- Add changelog entry for project context surface.
- Replace placeholder dot with original Git diamond SVG if user provides the asset before implementation; otherwise keep dot and leave asset swap note.
DoD:
- Project context surface is understandable in clean, dirty, no-git, detached, conflicted, and error states.
- Changelog documents the feature.
- Placeholder/SVG swap is isolated to a small component/style block.
Validation:
- npm run check
- manual: inspect all practical states available locally
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
- CHANGELOG.md
Risk: medium
Depends on:
- T030
Notes:
- This task completes T017's project context surface subset. Broader recovery cards can continue under T017 or future tasks.
- Added no-git/error/detached/conflict-aware badge tones and popover warnings.
- Split sync divergence and detached HEAD colors: blue for ahead/behind, violet for detached.
- Added changelog entry.
- Validation: `npm run check`.
- Replaced placeholder with Git logo asset and added README attribution.
- User accepted the project context surface as complete.

### T032 — Audit Pi SDK/runtime support for session tree and metadata

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Inspect Pi SDK/session manager/session JSONL types for tree nodes, parent IDs, active branch, labels, tokens, costs, context usage, queue semantics, fork/clone APIs, export/share APIs, context file loading, tool allowlists, models, skills, extensions, and packages.
- Document what can be implemented via SDK, what requires reading Pi session files, and what needs CLI/RPC fallback.
- Keep this as an implementation-enabling audit, not a UI task.
DoD:
- A concise implementation note exists with supported/unsupported Pi APIs for tree, session info, queue, context, tools, settings, and extensibility.
- Follow-up tasks have clear integration approach notes if discoveries change scope.
Validation:
- npm run check if code/docs build requires it; otherwise documentation-only review
Files likely touched:
- docs/implementation/future-pi-parity-roadmap.md
- docs/implementation/pi-sdk-parity-audit.md
Risk: medium
Depends on:
- none
Notes:
- This must happen before implementing tree/forks, read-only mode, tools visibility, extensions, or package manager features.

### T033 — Add session status/details data contract

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add domain/preload/main/renderer contracts for detailed session status without changing the current statusbar visual.
- Include current provider/model, thinking level, context usage, token/cache usage, cost, session ID, session file, message count, branch/node info if available, compaction status, auto-compaction status, and runtime handle status.
- Return partial data gracefully when Pi SDK does not expose a field.
DoD:
- Renderer can request a normalized session details object for the selected session.
- Missing fields show as unavailable rather than errors.
- No visual changes are made to the compact statusbar in this task.
Validation:
- npm run check
Files likely touched:
- src/domain/types.ts
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/bridge/sdk-pi-bridge.ts
Risk: medium
Depends on:
- T032
Notes:
- This powers the clickable statusbar popover.

### T034 — Add clickable statusbar session details popover

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Keep the existing composer/statusbar appearance unchanged.
- Make the statusbar clickable/focusable.
- Open a GPi-styled popover with granular session details from T033.
- Follow the visual behavior of the Git popover: hover/click safe, clear sections, no noisy permanent UI.
DoD:
- Clicking the existing statusbar opens detailed session info.
- Current statusbar text/layout remains visually consistent.
- Popover handles unavailable token/cost/context data cleanly.
Validation:
- npm run check
- manual: inspect statusbar popover in active, idle, imported, and no-session states
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T033
Notes:
- Do not add extra always-visible metrics to the statusbar.

### T035 — Add compact session titlebar menu

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add a small session menu in the session title/header area without cluttering the header.
- Include available actions: rename, show session info, open session file, open tree, compact, archive.
- Include disabled/coming-soon placeholders only if they are not confusing; otherwise add actions as tasks become ready.
DoD:
- Session menu opens from the titlebar/header.
- Existing rename/compact/archive functionality remains accessible.
- Menu does not duplicate large permanent buttons in the main UI.
Validation:
- npm run check
- manual: open menu, execute existing actions, no-session state
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: low
Depends on:
- none
Notes:
- Later tree/fork/export actions can attach to this menu.

### T036 — Add steering/follow-up queue domain model

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Represent queued user messages distinctly as steering or follow-up in workspace state and/or session runtime state.
- Preserve current prompt/follow-up behavior while adding explicit state for visible queued messages.
- Define how queued messages persist or are restored after abort/session reload.
DoD:
- Workspace/domain types can represent pending steering/follow-up messages.
- Reducers can add, edit, remove, activate, and clear queued messages.
- Existing text/image prompt flows remain compatible.
Validation:
- npm run check
- npm run test:unit if workspace reducers are changed
Files likely touched:
- src/domain/types.ts
- src/renderer/state/workspace-store.ts
- test/workspace-store.test.ts
Risk: high
Depends on:
- T032
Notes:
- Follow-up should be sticky and activate after the current run finishes; steering should affect the active run.

### T037 — Render sticky follow-up card while agent is busy

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Show queued follow-up as a sticky user card near the bottom of timeline/composer while the agent is running.
- Include edit/remove actions.
- Convert the follow-up into an active user message when Pi accepts it after the current run.
DoD:
- Follow-up card is visible but clearly pending.
- Follow-up does not appear as active timeline content until it is delivered.
- Editing/removing a pending follow-up works.
Validation:
- npm run check
- manual: queue follow-up during a long run, edit/remove, let it activate after completion
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
- src/renderer/state/workspace-store.ts
Risk: high
Depends on:
- T036
Notes:
- The card should feel like “next instruction”, not current-run steering.

### T038 — Add explicit steering message UX

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Let the user send steering while a session is busy.
- Render steering as a normal user message with a `Steering` label/badge.
- Preserve image attachment support where Pi supports steering images.
- Provide a clear toggle/action for users who do not remember Enter vs Alt+Enter semantics.
DoD:
- Steering messages are visually distinguishable from normal prompts and follow-ups.
- Steering can be sent during active runs without breaking existing follow-up behavior.
- Text-only and image steering paths continue to work where supported.
Validation:
- npm run check
- manual: send steering during active run and confirm agent receives it as current-run guidance
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
- src/bridge/pi-bridge.ts
- src/bridge/sdk-pi-bridge.ts
Risk: high
Depends on:
- T036
Notes:
- Steering changes what is happening now; follow-up waits.

### T039 — Add Pi session tree parsing/data model

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Parse Pi session JSONL tree entries into a normalized GPi tree model.
- Capture node ID, parent ID, role, summary text, timestamps, labels/bookmarks if present, active branch/current node, and children.
- Keep parsing read-only and resilient to unknown future record shapes.
DoD:
- GPi can produce a tree model for imported/real sessions with session files.
- Flat sessions still render as a single branch.
- Parse errors are recoverable and surfaced in session details/tree UI.
Validation:
- npm run check
- targeted unit tests for tree parsing if parser helper is extracted
Files likely touched:
- src/domain/types.ts
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/renderer/state/workspace-store.ts
- test/*
Risk: high
Depends on:
- T032
Notes:
- This is foundational for sidebar fork display, tree drawer, fork, clone, and export.

### T040 — Render nested branch/fork preview in left session list

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Show a compact nested tree/fork preview inside each expanded session item in the left sidebar.
- Keep it visually small and clean; do not turn the whole sidebar into a complex tree editor.
- Highlight the active branch/node.
DoD:
- Sessions with forks show nested branch structure in the sidebar.
- Sessions without forks remain visually simple.
- Clicking tree items can select/preview a node when T041/T042 support exists; otherwise keep read-only.
Validation:
- npm run check
- manual: session with forks, flat session, archived session, narrow sidebar
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: high
Depends on:
- T039
Notes:
- User explicitly wants fork structure visible inside the left session list.

### T041 — Add full session tree drawer

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add a drawer/modal for detailed session tree inspection.
- Include search/filter, active branch highlighting, node summaries, and clean empty/error states.
- Open from session titlebar menu and/or sidebar branch icon.
DoD:
- User can inspect the full tree without replacing the main timeline permanently.
- Drawer handles large trees with acceptable performance.
- Search/filter works for node text/labels.
Validation:
- npm run check
- manual: open drawer, search, inspect branches, close by Esc/outside/button
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: high
Depends on:
- T039
Notes:
- Keep active timeline focused on the selected branch.

### T042 — Add jump/fork/clone branch actions

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Implement tree actions when Pi SDK/CLI support is confirmed: jump to node/branch, fork from current point, fork from selected node, clone active branch.
- Add actions to session tree drawer and session titlebar menu.
- Preserve full history; never destructively rewrite session files.
DoD:
- User can jump to an existing branch/node when supported.
- User can fork/clone via GPi with clear confirmation and resulting session/branch selection.
- Unsupported actions are disabled with explanatory copy.
Validation:
- npm run check
- manual: fork from node, clone active branch, jump branch, verify original history preserved
Files likely touched:
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/renderer/ui/App.tsx
- src/domain/types.ts
Risk: high
Depends on:
- T041
Notes:
- This is the core Pi branching parity feature.

### T043 — Add branch/session export and copy actions

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add export/copy actions after tree/fork semantics are available.
- Support copy last assistant message.
- Support export current branch and export full session tree if Pi exposes or GPi can safely generate it.
- Defer public sharing unless Pi SDK/CLI support is clear.
DoD:
- Copy last assistant message works from session menu.
- Export current branch and full tree produce clear local files or explain unsupported state.
- Export does not mutate session state.
Validation:
- npm run check
- manual: copy last response, export branch/tree and inspect output
Files likely touched:
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/renderer/ui/App.tsx
Risk: medium
Depends on:
- T042
Notes:
- User agreed this comes after tree/forks.

### T044 — Add real Pi context-files chain API

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Detect the context files Pi actually considers: global `~/.pi/agent/AGENTS.md`, parent-chain `AGENTS.md`/`CLAUDE.md`, project `.pi/SYSTEM.md`, global system prompts, `APPEND_SYSTEM.md`, and `.pi/settings.json`.
- Keep the API read-only and path-contained for project paths.
- Distinguish loaded, present, missing, global, parent, project, and settings/system-prompt roles.
DoD:
- Renderer can request a structured context-files chain for the selected project.
- Results reflect Pi's loading model more accurately than the current simple context-file flags.
- Missing files are non-fatal and displayable.
Validation:
- npm run check
- manual: projects with parent AGENTS.md, CLAUDE.md, .pi/settings.json, and no context files
Files likely touched:
- src/domain/types.ts
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
Risk: medium
Depends on:
- T032
Notes:
- Current Git popover context file flags are partial; this adds a dedicated context popup data source.

### T045 — Add context files header popover

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add a clean context-files icon/popover in the session header/titlebar area.
- Show global, parent-chain, project, system prompt, append prompt, and settings files.
- Include open-file and reload actions if supported.
DoD:
- User can see what context files Pi sees without opening Settings.
- Popover is compact and visually consistent with Git popover.
- Missing files appear muted, not alarming.
Validation:
- npm run check
- manual: inspect context popover in projects with/without context files
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T044
Notes:
- This should sit near the Git/session header area, not in the composer.

### T046 — Audit tool allowlist/read-only session support

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Inspect Pi SDK/session creation options for tool allowlists, disabling write/edit/bash tools, and extension/custom tool visibility.
- Determine whether read-only mode can be enforced by SDK options, prompt policy only, or CLI/RPC fallback.
- Document exact limitations before adding user-facing safety claims.
DoD:
- Implementation note states whether read-only/custom tool modes are enforceable.
- Tasks T047/T048 have updated approach notes if needed.
Validation:
- documentation-only review; npm run check if docs tooling requires it
Files likely touched:
- docs/implementation/pi-sdk-parity-audit.md
Risk: high
Depends on:
- T032
Notes:
- Do not claim read-only safety unless tool restrictions are actually enforceable.

### T047 — Add read-only session mode

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add read-only option when creating a Pi session, if enforceable.
- Show a `Read-only` badge in the session header/status surfaces.
- Limit tools to safe read-only set such as read, grep, find, and ls when supported.
- Preserve existing full-access session creation as default.
DoD:
- User can create a read-only Pi session.
- Read-only sessions visibly communicate their restrictions.
- Write/edit/mutating tool paths are blocked by actual runtime/tool configuration or clearly marked unsupported if not enforceable.
Validation:
- npm run check
- manual: create read-only session, ask Pi to inspect files, ask Pi to edit and confirm it cannot
Files likely touched:
- src/domain/types.ts
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: high
Depends on:
- T046
Notes:
- Safety claims must be accurate.

### T048 — Add tools visibility surface

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Show available tools for the selected session: built-in, extension, package/custom tools where discoverable.
- Include enabled/disabled state, source, risk category, and last-used metadata if available.
- Surface this from session status popover/menu or Tools & Safety settings without cluttering main UI.
DoD:
- User can inspect what the agent can use in a session.
- Read-only/custom modes show restricted tools clearly.
- Unknown extension/custom tools are represented safely.
Validation:
- npm run check
- manual: full-access session, read-only session, session with extension tools if available
Files likely touched:
- src/domain/types.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T046
Notes:
- This supports trust and safety, not tool execution itself.

### T049 — Reorganize Settings into future-proof categories

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Refactor Settings navigation to support categories: Runtime, Updates, Interface, Sessions, Models, Scoped Models, Context, Skills, Extensions, Pi Packages, Tools & Safety, Keybindings, Continuity, Revert, Advanced.
- Move existing settings into the appropriate categories without changing behavior.
- Keep the settings UI clean for categories that are not implemented yet.
DoD:
- Existing Runtime/Updates/Interface/Revert/Continuity functionality still works.
- New category structure can host upcoming features without a large rewrite.
- Empty/future categories are hidden or clearly marked without noise.
Validation:
- npm run check
- manual: open each existing settings category and verify behavior
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- none
Notes:
- This can happen before specific Settings features if it reduces future churn.

### T050 — Add Scoped Models settings and composer filtering

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add a Scoped Models settings category with checkboxes for enabled models and enabled thinking levels.
- Persist scoped model/thinking preferences in workspace/settings or Pi settings if appropriate.
- Filter composer model selector to only show enabled scoped models and thinking levels.
DoD:
- User can enable/disable models and thinking levels in Settings.
- Composer model selector respects scoped selections.
- Existing model changing still works for enabled models.
Validation:
- npm run check
- manual: disable model/thinking levels and confirm composer selector changes
Files likely touched:
- src/domain/types.ts
- src/renderer/state/workspace-store.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: high
Depends on:
- T049
Notes:
- User explicitly wants Scoped Models as its own settings category.

### T051 — Add Pi Account & Providers settings surface

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add Settings category for Pi-owned auth/provider status and actions.
- Surface login/logout/config actions through Pi-supported flows where possible.
- If SDK support is limited, show clear instructions and safe open-directory/open-command actions rather than reimplementing auth.
DoD:
- User can find where to manage Pi provider/auth state from GPi.
- GPi does not store or mishandle provider secrets.
- Unsupported provider status appears as instructions, not broken controls.
Validation:
- npm run check
- manual: open settings, inspect provider/account surface, launch safe action if available
Files likely touched:
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T049
Notes:
- Pi remains the authority for auth.

### T052 — Add prompt templates discovery and runner UI

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Discover prompt templates from Pi-supported locations and/or documented config paths.
- Add UI to list, preview, fill variables, insert into composer, run now, and save current prompt as template if safe.
- Support `/template-name` style composer integration if practical.
DoD:
- User can browse prompt templates in GPi.
- Template variables can be filled before insertion/run.
- Running a template does not bypass normal composer/session behavior.
Validation:
- npm run check
- manual: create template, fill variable, insert/run from GPi
Files likely touched:
- src/domain/types.ts
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T049
Notes:
- Examples: review, refactor, tests, explain, release notes, debug, security review.

### T053 — Add Skills settings category

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Show all available Pi skills, not only GPi continuity skills.
- Group by bundled, global, project, and package skills.
- Add enable/disable toggles when Pi supports it, or reflect config status read-only if not.
- Preserve continuity skills as composer workflow controls.
DoD:
- User can inspect skill name, description, source, status, and conflicts/missing state.
- Enable/disable behavior is accurate and does not break continuity controls.
- Skill file open/reload actions are available where safe.
Validation:
- npm run check
- manual: inspect bundled/global/project skills and toggle if supported
Files likely touched:
- src/domain/types.ts
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T049
Notes:
- Continuity stays prominent because it is GPi workflow UX; other skills belong in Settings.

### T054 — Add Keybindings settings category

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add Keybindings settings list with action names, current shortcut, default shortcut, editable shortcut input, reset action, and conflict detection.
- Use configurable keybinding data, not hardcoded checks.
- Include GPi actions first; Pi keybindings can be surfaced later if SDK/config supports it.
DoD:
- User can view and edit GPi keybindings.
- Conflicts are detected before saving.
- Defaults can be restored per action.
Validation:
- npm run check
- manual: change shortcut, detect conflict, reset default
Files likely touched:
- src/domain/types.ts
- src/renderer/state/workspace-store.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: high
Depends on:
- T049
Notes:
- Follow project rule: no hardcoded key checks for new features.

### T055 — Audit Pi extensions exposure via SDK/runtime

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Inspect how Pi loads extensions and whether SDK/runtime exposes loaded extensions, contributed commands, tools, UI, errors, and enable/disable state.
- Identify safe read-only first implementation if runtime exposure is limited.
DoD:
- Extension implementation plan is documented with exact SDK/config source.
- Risks around arbitrary code and load errors are captured.
Validation:
- documentation-only review; npm run check if docs tooling requires it
Files likely touched:
- docs/implementation/pi-sdk-parity-audit.md
Risk: medium
Depends on:
- T032
Notes:
- User agreed extensions belong in scope, but implementation depends on SDK capabilities.

### T056 — Add Extensions settings category

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add Extensions settings surface showing name/source, enabled status, load status/errors, contributed tools, contributed commands, and UI contributions if available.
- Provide enable/disable controls only if supported safely.
DoD:
- User can inspect loaded/available extensions and errors.
- Extension-contributed tools/commands are visible where data exists.
- Unsupported controls are absent or clearly disabled.
Validation:
- npm run check
- manual: inspect settings with no extensions and with at least one extension if available
Files likely touched:
- src/domain/types.ts
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: medium
Depends on:
- T055
Notes:
- Do not execute/install third-party extension code without explicit user action.

### T057 — Add Pi Packages manager design and safety foundation

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Add package manager data contract and safety UI foundation for installed package listing and dangerous actions.
- Implement double-confirm modal pattern for install/update/remove actions involving third-party code.
- Show package source, resources, and security warning before any install/update/remove operation.
DoD:
- Pi Packages settings can show installed package data if available or a safe empty state.
- Double-confirm component exists and is reusable.
- High-risk extension/package warnings are clear.
Validation:
- npm run check
- manual: open Pi Packages settings, trigger/cancel double-confirm flow with a mock/no-op action
Files likely touched:
- src/domain/types.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: high
Depends on:
- T049
- T055
Notes:
- User wants strong safety, potentially two separate confirmation modals.

### T058 — Add Pi package install/update/remove actions

Status: pending
Claimed by:
Started:
Last update:
Scope:
- Wire Pi package commands for install, update, remove/list where safe and supported.
- Support global and project-local package operations if Pi exposes them.
- Require double confirmation before mutating package state.
- Capture stdout/stderr/status and refresh package list after operations.
DoD:
- User can install, update, and remove Pi packages from GPi with explicit double confirmation.
- Failed package operations are diagnosable and non-destructive.
- Project-local vs global operation is clear.
Validation:
- npm run check
- manual: run only with explicit approval using a safe test package or sandbox
Files likely touched:
- src/main/main.ts
- src/preload/preload.cts
- src/renderer/vite-env.d.ts
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: high
Depends on:
- T057
Notes:
- This mutates the Pi environment; do not run package installs automatically.

### T059 — Suppress live Preparing Tool Call argument rendering

Status: done
Claimed by: current-agent
Started: 2026-05-13 20:51
Last update: 2026-05-13 21:10
Scope:
- Stop rendering `preparing_tool` streamed argument text expanded by default while the run is active.
- Keep the phase card visible as a compact progress card with elapsed time and a count/summary when argument data exists.
- Preserve full streamed argument text in timeline state so it is inspectable after the phase finishes.
- Ensure thinking streams and assistant text streams keep their current behavior.
DoD:
- Active `Preparing tool call` cards stay collapsed/compact by default.
- The card no longer displays JSON/tool arguments character-by-character during streaming.
- After the phase finishes, expanding the card shows the captured argument stream.
- Existing tool started/finished cards still show args/result/duration and diffs.
Validation:
- npm run check
- manual: trigger a large `write` tool call and confirm preparing args are hidden during stream but available after completion
Files likely touched:
- src/renderer/ui/App.tsx
- src/renderer/styles.css
Risk: low
Depends on:
- none
Notes:
- This directly addresses the perceived GPi slowdown from live card rendering. It may reduce UI/render overhead, but not the model time spent generating tool-call arguments.
- Implemented compact active `Preparing tool call` rendering: live argument text is hidden while streaming, but preserved for expansion after preparation finishes.
- Added Settings → Interface → Developer mode to re-enable live tool-call stream rendering when explicit debugging transparency is needed.
- Validation: `npm run check` passed.
- User manually validated normal mode feels much faster and no longer pays the live stream UI cost.

### T060 — Throttle and cap run-phase delta state updates

Status: done
Claimed by: current-agent
Started: 2026-05-13 20:55
Last update: 2026-05-13 21:10
Scope:
- Add buffering/throttling for high-frequency `tool_call_delta` updates before they mutate renderer workspace/timeline state.
- Apply a safe display cap or summarized placeholder for very large preparing-tool streams while retaining full inspectable data where practical.
- Avoid breaking thinking stream rendering or final assistant message streaming.
- Measure whether fewer React state updates reduce lag during large write/edit tool calls.
DoD:
- Large tool-call argument streams do not cause per-character React updates.
- Preparing-tool cards update at a bounded cadence or only at phase end.
- Full or intentionally capped argument data is available after completion with clear copy if truncated.
- No regression in normal text/thinking stream behavior.
Validation:
- npm run check
- manual: compare large `write` before/after responsiveness and Run Work expansion behavior
Files likely touched:
- src/renderer/state/workspace-store.ts
- src/renderer/ui/App.tsx
- src/domain/types.ts
Risk: medium
Depends on:
- T059
Notes:
- This is the real performance pass after the UX-only collapse. The bridge may still receive deltas, but renderer updates should be batched.
- Implemented SDK bridge buffering for `toolcall_delta` events with a 120ms flush cadence and final flush at tool-call end/start boundaries.
- Normal mode now drops live non-final `tool_call_delta` events before reducing workspace state, avoiding React timeline updates for argument streaming.
- Developer mode keeps live throttled deltas visible for debugging.
- Validation: `npm run check` passed.
- User manually validated Developer mode off is much faster while expected model-side preparing time can still remain.

### T061 — Add tool-call stream performance instrumentation

Status: done
Claimed by: current-agent
Started: 2026-05-13 20:58
Last update: 2026-05-13 21:10
Scope:
- Add lightweight diagnostics around `toolcall_start`, `toolcall_delta`, `toolcall_end`, `tool_execution_start`, and renderer timeline updates.
- Capture delta count, byte count, elapsed preparing time, tool execution duration, and render/update cadence in debug/session details.
- Keep diagnostics hidden from normal chat UI unless a debug/details surface is opened.
DoD:
- GPi can distinguish model argument-generation time from UI/render overhead for a tool call.
- Diagnostics can explain cases like `Preparing tool call 35s` followed by `write 2ms`.
- Normal timeline remains uncluttered.
Validation:
- npm run check
- manual: run a large write/edit and inspect diagnostics/log details
Files likely touched:
- src/bridge/sdk-pi-bridge.ts
- src/renderer/state/workspace-store.ts
- src/renderer/ui/App.tsx
Risk: medium
Depends on:
- T060
Notes:
- Useful to validate whether collapsed/buffered rendering improves real latency or only perceived responsiveness.
- Added lightweight `tool_call_stream_stats` events with delta count, byte count, renderer update count, and preparing duration.
- Diagnostics are only reduced into session details when Developer mode is enabled, so normal work UI stays uncluttered.
- Validation: `npm run check` passed.
- User manually validated normal mode behavior. Developer diagnostics remain available behind the toggle for future debugging.
