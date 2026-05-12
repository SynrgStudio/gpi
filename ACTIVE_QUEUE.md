---
continuity_session: CONT-2026-05-10-1630-gpi-roadmap
created_at: 2026-05-10 16:30
updated_at: 2026-05-12 05:35
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

Status: partial
Claimed by: pi
Started: 2026-05-12 05:15
Last update: 2026-05-12 05:35
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
Next:
- Manual validation in git/no-git/dirty projects.

### T029 — Render git status badge in the session header

Status: partial
Claimed by: pi
Started: 2026-05-12 05:20
Last update: 2026-05-12 05:35
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
- Added session-header badge with placeholder colored dot and git branch/sync/dirty label.
- Validation: `npm run check`.
Next:
- Manual visual validation and future Git diamond SVG swap.

### T030 — Add project context hover/click popover

Status: partial
Claimed by: pi
Started: 2026-05-12 05:25
Last update: 2026-05-12 05:35
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
- Added hover/click popover with refresh action, git summary, working-tree counts, last commit, and context files.
- Validation: `npm run check`.
Next:
- Manual hover/click/outside/Esc validation.

### T031 — Add project context recovery and polish pass

Status: partial
Claimed by: pi
Started: 2026-05-12 05:30
Last update: 2026-05-12 05:35
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
Next:
- Manual inspection of available git states and SVG asset swap if provided.
