# GPi Linux Packaging Plan

## Goal

Ship GPi on Linux with the same core guarantees as Windows:

- Electron app launches reliably from an installed package.
- Pi.dev is assumed installed, but first-run onboarding still shows install commands.
- GPi can detect its own GitHub releases and guide the user to update.
- GPi can detect and update Pi with `pi update`.
- Continuity skills are bundled and available at runtime.

## Target artifacts

Initial Linux release should produce:

1. `GPi-linux-x64.tar.gz` — portable fallback, easiest to validate.
2. `gpi_<version>_amd64.deb` — Debian/Ubuntu primary installer.
3. Optional later: `gpi-<version>.AppImage` — distro-neutral desktop artifact.
4. Optional later: `gpi-<version>.x86_64.rpm` — Fedora/openSUSE/RHEL family.

## Architecture decisions

- Keep `@electron/packager` for the portable app directory.
- Add Linux package creation as a layer after `npm run package:linux`.
- Do not use Snap/Flatpak first: sandboxing complicates access to project directories, `~/.pi`, shell tools, and Pi subprocesses.
- Store Linux desktop metadata in `packaging/linux/`.
- Use GitHub Actions `ubuntu-latest` for Linux artifacts.
- Keep Windows and Linux release jobs independent so one platform failure does not block diagnosis of the other.

## Runtime paths to verify

Packaged Linux GPi must resolve:

- App main: `resources/app.asar/dist/main/main.js`
- Renderer: `resources/app.asar/dist/renderer/index.html`
- Preload: `resources/app.asar/dist/preload/preload.cjs`
- Worker: `resources/app.asar/dist/worker/pi-runtime-worker.js`
- Bundled continuity skills: `process.resourcesPath/skills/continuity/*/SKILL.md`
- User Pi skills: `~/.pi/agent/skills/*/SKILL.md`
- Workspace storage: Electron `app.getPath("userData")`

## Phase 1 — Portable Linux package

### Task L001 — Add Linux packager script

Description: create `scripts/package-linux.mjs` mirroring the fixed Windows packager.

Acceptance criteria:

- Builds `release/GPi-linux-x64/`.
- Uses a temporary minimal `.gpi-package/` folder.
- Includes `dist/`, `resources/`, `node_modules/`, and minimal `package.json`.
- Copies `resources/skills` as `extraResource`.
- Uses `platform: "linux"`, `arch: "x64"`.

Verification:

- `npm run package:linux`
- `release/GPi-linux-x64/GPi` exists.
- `release/GPi-linux-x64/resources/skills/continuity/init-cont/SKILL.md` exists.

Files likely touched:

- `scripts/package-linux.mjs`
- `package.json`

### Task L002 — Add tarball artifact script

Description: create a reproducible tarball from the packaged Linux app.

Acceptance criteria:

- `npm run archive:linux` creates `release/GPi-linux-x64-<version>.tar.gz`.
- Archive extracts to a runnable `GPi-linux-x64/GPi`.

Verification:

- Extract archive in a temp directory.
- Run `./GPi-linux-x64/GPi --enable-logging`.

Files likely touched:

- `scripts/archive-linux.mjs`
- `package.json`

## Phase 2 — Debian package

### Task L003 — Add Debian package metadata

Description: define Debian control metadata and desktop integration.

Acceptance criteria:

- `packaging/linux/deb/control` exists or generation script writes it.
- Package metadata includes name `gpi`, version, architecture `amd64`, maintainer, description.
- Dependencies include common Electron runtime libraries where needed, or document reliance on bundled Electron.

Files likely touched:

- `packaging/linux/deb/control.template`
- `scripts/package-deb.mjs`

### Task L004 — Add desktop entry and icon placeholders

Description: install desktop launcher metadata.

Acceptance criteria:

- `/usr/share/applications/gpi.desktop` included in `.deb`.
- `Exec=/opt/GPi/GPi %U` or equivalent.
- `Categories=Development;Utility;`.
- Icon path included. If no final icon exists, include placeholder generated from app assets or document as TODO.

Files likely touched:

- `packaging/linux/gpi.desktop`
- `packaging/linux/icons/`

### Task L005 — Build `.deb`

Description: create a script that stages files under `release/deb-root/` and runs `dpkg-deb --build`.

Acceptance criteria:

- `npm run installer:linux:deb` creates `release/gpi_<version>_amd64.deb`.
- Installs to `/opt/GPi`.
- Adds desktop entry.
- Uninstall removes app files and desktop entry.

Verification:

- `sudo apt install ./release/gpi_<version>_amd64.deb`
- Launch from terminal: `gpi` or `/opt/GPi/GPi` depending chosen symlink.
- Launch from app menu.
- `sudo apt remove gpi`.

Files likely touched:

- `scripts/package-deb.mjs`
- `package.json`
- `packaging/linux/`

## Phase 3 — GitHub Actions release matrix

### Task L006 — Add Linux CI packaging job

Description: extend release workflow with Linux artifact generation.

Acceptance criteria:

- Tag push runs Windows and Linux jobs.
- Linux job uploads tarball and `.deb` to GitHub Release.
- Existing Windows installer remains unchanged.

Verification:

- Push test tag.
- Release contains:
  - `GPi-Setup-<version>.exe`
  - `GPi-linux-x64-<version>.tar.gz`
  - `gpi_<version>_amd64.deb`

Files likely touched:

- `.github/workflows/release.yml`

### Task L007 — Add Linux CI smoke validation

Description: perform artifact structure checks in CI.

Acceptance criteria:

- CI checks `GPi` binary exists in package dir.
- CI checks bundled skills exist in `resources/skills/continuity`.
- CI checks `.deb` contents with `dpkg-deb --contents`.

Verification:

- Release workflow fails if expected files are missing.

Files likely touched:

- `.github/workflows/release.yml`

## Phase 4 — App updater behavior for Linux

### Task L008 — Platform-aware release asset selection

Description: update GPi updater to select platform-specific GitHub assets.

Acceptance criteria:

- Windows prefers `.exe` with `Setup` in name.
- Linux prefers `.deb` on Debian-like systems.
- Linux fallback is `.tar.gz`.
- The update button label remains `Update GPi`.
- The button opens the selected asset URL in the system browser.

Verification:

- Mock release assets in unit-testable function.
- Windows returns `.exe`.
- Linux returns `.deb` or `.tar.gz` fallback.

Files likely touched:

- `src/main/main.ts`
- `src/domain/types.ts`
- tests if extractor is separated.

### Task L009 — Linux update instructions in UI

Description: when Linux update asset is a `.deb`, show install command hint.

Acceptance criteria:

- Update panel can show: `Download, then run: sudo apt install ./gpi_<version>_amd64.deb`.
- Tarball fallback shows extraction hint.
- No auto-sudo or in-app package manager mutation in first implementation.

Files likely touched:

- `src/renderer/ui/App.tsx`
- `src/renderer/styles.css`

## Phase 5 — Linux context menu / open folder integration

### Task L010 — CLI folder argument support

Description: support launching GPi with a folder path argument on all platforms.

Acceptance criteria:

- `GPi /path/to/project` selects or creates project.
- Works when app is already running if single-instance lock is implemented.
- If no existing project matches, creates project from folder basename.

Files likely touched:

- `src/main/main.ts`
- `src/preload/preload.cts`
- `src/renderer/ui/App.tsx`
- `src/renderer/state/workspace-store.ts`

### Task L011 — Linux file manager integration plan

Description: add optional open-folder integration for common desktop environments.

Recommended staged approach:

1. `.desktop` file supports `MimeType=inode/directory` and `%U`.
2. Document how to set as handler where supported.
3. Later add scripts for Nautilus/Dolphin context menus if needed.

Acceptance criteria:

- Installed `.desktop` can receive folder URI/path.
- GPi opens/creates project for that folder.

Files likely touched:

- `packaging/linux/gpi.desktop`
- docs.

## Phase 6 — Linux runtime hardening

### Task L012 — Validate Pi discovery on Linux

Description: ensure GPi can find `pi` from packaged GUI environment.

Acceptance criteria:

- Searches PATH plus common locations:
  - `/usr/local/bin/pi`
  - `/usr/bin/pi`
  - `~/.npm-global/bin/pi`
  - `~/.bun/bin/pi`
  - pnpm global bin if discoverable
- `pi --version` works from GPi Settings.
- `pi update` works or returns actionable error.

Files likely touched:

- `src/main/main.ts`

### Task L013 — Linux smoke test matrix

Description: define manual and automated validation.

Manual validation targets:

- Ubuntu latest LTS.
- Debian stable.
- Fedora latest if RPM/AppImage is added.

Checks:

- Install app.
- First launch splash/onboarding.
- Add project folder.
- Create real Pi session.
- Send prompt.
- Continuity skills status.
- `Look for Updates`.
- Open release link externally.

## Release checklist for Linux

Before publishing Linux artifacts:

- [ ] `npm run check` passes.
- [ ] `npm run test:unit` passes.
- [ ] `npm run package:linux` passes.
- [ ] `npm run archive:linux` passes.
- [ ] `npm run installer:linux:deb` passes.
- [ ] Portable tarball launches on Ubuntu.
- [ ] `.deb` installs/uninstalls on Ubuntu.
- [ ] Bundled skills are found with no false conflicts.
- [ ] Renderer assets load from file URLs.
- [ ] Update panel chooses Linux artifact.

## Risks

- Linux GUI launch environments may have reduced PATH; Pi discovery needs robust fallback.
- Native Node modules inside Pi dependencies may need ASAR unpacking if loaded directly.
- `.deb` install path and user permissions need careful handling; app data must stay under user home.
- File manager context menu behavior varies by desktop environment.
- Auto-update should not attempt privileged package installs inside the app initially.

## Recommended implementation order

1. L001 package Linux app directory.
2. L002 tarball artifact.
3. L008 platform-aware updater asset selection.
4. L006 release workflow Linux artifact upload.
5. L003-L005 `.deb` package.
6. L012 Pi discovery hardening.
7. L010 folder argument support.
8. L011 desktop integration.
9. L013 manual smoke matrix.
