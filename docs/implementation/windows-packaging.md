# Windows packaging plan

GPi packages as a local Electron desktop app for Windows first.

## Current packaging stance

Packaging is configured/documented, but the coding agent should not run production build/package commands unless the user explicitly asks. Project rules currently forbid running `npm run build`, and packaging necessarily depends on a production renderer build.

## Target output

Initial target:

- Windows x64 portable package first.
- Installer can come later after the portable artifact is validated.
- App data remains in Electron `app.getPath("userData")` (`%APPDATA%/gpi` by default).

## Required preflight

From repo root:

```powershell
npm run check
npm run test:unit
npm run compile:electron
```

Manual real-Pi validation should be run before packaging release candidates:

```text
docs/implementation/manual-real-pi-validation.md
```

## Proposed package command

When packaging is enabled, use a command that performs:

```powershell
npm run build
# then package Electron output for Windows portable distribution
```

Suggested future script names:

```json
{
  "scripts": {
    "package:win": "npm run build && electron-builder --win portable",
    "package:win:dir": "npm run build && electron-builder --win dir"
  }
}
```

Do not add these as active scripts until `electron-builder` or an equivalent packager is installed and lockfile changes are accepted.

## Candidate packager

Use `electron-builder` unless a smaller package tool is preferred later.

Reasons:

- common Windows portable/installer support;
- straightforward Electron metadata;
- icon and artifact naming support;
- familiar debug surface.

Alternative: `@electron/packager` for a simpler unpacked directory only. This is acceptable if installer/portable support is deferred.

## Metadata to configure

Future package metadata should include:

```json
{
  "appId": "local.gpi.cockpit",
  "productName": "GPi",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**",
    "dist-renderer/**",
    "package.json"
  ],
  "win": {
    "target": ["portable"],
    "artifactName": "GPi-${version}-${arch}.${ext}"
  }
}
```

The final file globs depend on Vite output naming. Validate after the first package attempt.

## Icons/resources

Need before first polished package:

- `resources/icon.ico` for Windows.
- Optional `resources/icon.png` source.
- Verify icon displays in titlebar/taskbar/Explorer.

No placeholder icon should be treated as final branding.

## Logs and debug mode

Runtime data/log locations:

- Workspace JSON: Electron user data folder via `WorkspaceStorage`.
- Main-process console logs: terminal in dev mode; packaged app needs either file logging or explicit troubleshooting instructions.

Recommended future debug flag:

```powershell
$env:GPI_DEBUG="1"
GPi.exe
```

When `GPI_DEBUG=1`, GPi should eventually write bridge/session lifecycle logs to a file under user data, for example:

```text
%APPDATA%\gpi\logs\gpi.log
```

This file logger is not implemented yet and should not block the first packaging spike.

## Manual package validation

After packaging, validate:

- [ ] App launches from packaged artifact.
- [ ] Preload API is available.
- [ ] Main process can create/open Pi SDK sessions.
- [ ] Workspace persists under user data.
- [ ] Vite dev server is not required.
- [ ] Renderer assets load offline.
- [ ] Model/thinking controls load for a real session.
- [ ] File diffs still work.
- [ ] Compaction controls still work.
- [ ] Native menu bar remains hidden.
- [ ] Closing/reopening app restores idle state correctly.

## Known blockers before marking packaging done

- A real package command must be added with an installed packager.
- A Windows package artifact must be produced manually or by explicit user request.
- Packaged app must be opened and validated.
- Icon resources should be added before a user-facing release.
