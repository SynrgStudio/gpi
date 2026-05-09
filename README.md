# GPi

GPi is a local glass cockpit GUI for Pi.

> Pi is the engine. GPi is the beautiful cockpit for managing multiple Pi projects and sessions.

Real Pi sessions are moving to WorkerPiRuntime so multiple agents can run in parallel without blocking the app.

## Workflow skills

GPi bundles optional continuity workflow skills under `resources/skills/continuity/`:

- `init-cont`
- `plan-cont`
- `start-cont`
- `end-cont`

These are product resources that power Continuity Mode: GPi's guided Install → Initialize → Plan → Start → End planning workflow. GPi installs the bundled skills into the user's Pi skills directory only after explicit user approval and preview.

The composer workflow button is one-shot, not a sticky mode:

- `Install` opens the workflow skill onboarding when skills are missing.
- `Initialize` sends `/init-cont` with optional composer context.
- `Plan` sends `/plan-cont` with optional composer refinement.
- `Start` sends `/start-cont` with optional scope.
- `End` sends `/end-cont`.

Pi executes the skills. GPi only guides the flow and sends visible commands.

Manual validation checklist: `docs/implementation/workflow-skills-validation.md`.

## Current status

Early scaffold. The project is intentionally mock-first before real Pi integration.

Chosen stack:

- Electron
- React
- TypeScript
- Node-side Pi SDK bridge migrating to WorkerPiRuntime

## MVP direction

GPi must support from the beginning:

- projects in a persistent sidebar
- multiple sessions/chats per project
- live status for non-selected sessions
- selected chat in the center
- tool/file/diff detail in a right panel
- a fast, keyboard-friendly input composer

## Non-goals for the MVP

- replacing Pi's agent engine
- duplicating provider/auth/tool/session systems
- cloud sync
- marketplace
- collaboration
- full IDE/editor scope
- cloud multi-agent orchestration; local multi-agent supervision is core

## Scripts

```bash
npm run check
npm run compile:electron
npm run dev:electron
```

`npm run check` type-checks the scaffold. `npm run compile:electron` refreshes Electron main/preload output. `npm run dev:electron` compiles Electron code, starts Vite, and launches Electron against the local dev server.

The agent does not run `npm run dev`, `npm run dev:electron`, or `npm run build` unless explicitly requested.

## Project structure

```text
src/
  bridge/      GPi↔Pi bridge interfaces and adapters
  domain/      project/session/status domain types
  main/        Electron main process
  preload/     Electron preload boundary
  renderer/    React UI shell
```

## Docs

- `docs/product/vision.md`
- `docs/product/mvp.md`
- `docs/product/ux-shell.md`
- `docs/product/visual-system.md`
- `docs/technical/pi-integration.md`
- `docs/technical/domain-model.md`
- `docs/technical/persistence.md`
- `docs/adr/0001-gpi-architecture.md`
- `docs/implementation/roadmap.md`
- `docs/implementation/manual-real-pi-validation.md`
- `docs/implementation/windows-packaging.md`
