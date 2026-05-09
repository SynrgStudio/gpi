# Parallel agents validation checklist

Validate WorkerPiRuntime before returning to heavy UI polish.

## Preflight

- Run GPi with compiled Electron code.
- Use at least two real projects or two real sessions in one project.
- Confirm real sessions use worker runtime in Electron logs.

## Session lifecycle

1. Create a new real session in project A.
2. Import/list existing sessions in project A.
3. Open an imported session.
4. Switch to project B and create/open a real session there.

Expected:
- UI remains responsive during create/open/list.
- Session cwd stays project-correct.
- Missing session files produce actionable errors, not loops.

## Parallel runs

1. Start a long prompt in session 1.
2. Immediately switch to session 2.
3. Start another long prompt.
4. Switch between both while they stream.

Expected:
- Both timelines stream independently.
- Sidebar statuses update independently.
- No text/tool events appear in the wrong session.
- Composer and sidebar hover remain responsive.

## Abort and recovery

1. Abort session 1 while session 2 continues.
2. Confirm session 2 is unaffected.
3. Start another prompt in session 1.

Expected:
- Abort is per session.
- Worker/session state recovers or reports a clear degraded/crashed state.

## Controls

For a worker-backed session:

- Change model.
- Change thinking level.
- Run compaction.
- Toggle auto-compaction.

Expected:
- Controls update from real Pi SDK state.
- Compaction events/stats remain session-scoped.
- No other session freezes.

## Crash/degraded behavior

If a worker crash can be simulated safely:

1. Kill one worker process.
2. Confirm GPi remains open.
3. Confirm affected session shows actionable error/degraded state.
4. Retry/open a new session.

Expected:
- Only that session degrades.
- Other sessions continue.

## Validation record

2026-05-08 manual validation by user:

- 2+ worker-backed real Pi sessions ran in parallel and completed successfully.
- Streaming, Working/Thinking/Preparing phases and final responses remained session-scoped.
- UI stayed responsive enough for normal cockpit use while parallel sessions ran.
- False prompt timeout was fixed before validation.
- Supercard grouping, live stream display and auto-collapse behavior were validated in real use.
- User reported WorkerPiRuntime parallel mode as working perfectly.

## Pass criteria

WorkerPiRuntime is ready as default when:

- 2+ real sessions can run simultaneously.
- Abort/retry are per-session.
- UI remains responsive during session open, streaming, model controls and compaction.
- Event routing is correct under parallel streaming.
- No startup or hover prewarm lag returns.
