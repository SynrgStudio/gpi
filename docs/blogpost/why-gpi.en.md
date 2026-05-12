---
title: Three text files made my coding agents stop losing the plot
slug: why-gpi
date: 2026-05-11
type: essay
tags:
  - agents
  - skills
  - continuity
  - gpi
summary: Three markdown files, a few strict skills, and a better runtime shape for long-running coding agents.
featured: true
draft: false
---

# Three text files made my coding agents stop losing the plot

> “I can't tell you how many projects I had that I went really hard on for a month, got to a pretty good state, then had to go do something else, came back to it, and had no idea what the fuck was going on anymore.”
>
> — [Theo](https://youtu.be/lNVa33qUzZ8?t=701), describing a problem that is not really about programming. It is about continuity.

After using coding agents every day, I started noticing something strange.

The limiting factor was not that the model could not code.

The limiting factor was that long-running work had no stable shape.

A model can read files, edit code, run commands, debug failures, write tests, explain architecture, and follow complex instructions. But most agent workflows still rely on a single fragile primitive: a chat thread acting as memory, task queue, execution contract, status report, meeting notes, and audit log all at once.

That is a lot to ask from a chat.

And eventually it breaks.

It breaks when the project gets large.
It breaks when you close the session.
It breaks after compaction.
It breaks when you come back two days later.
It breaks when the human forgets what was decided.
It breaks when the agent has to infer “where we are” from a wall of conversation.

The common answer is to keep feeding the model more context.

“Read this summary.”
“Here is what we were doing.”
“Continue from here.”
“Look at these files.”
“Remember that we decided...”

That works for a while. But it is basically a standup meeting with the agent every time you resume work.

And the more successful the agent is, the worse the problem becomes, because it produces more state faster than the chat can cleanly represent.

The breakthrough for me was not a bigger prompt.

It was three text files.

```text
AUTONOMOUS_EXECUTION.md
ACTIVE_QUEUE.md
STATE.md
```

Generated and maintained by skills.

That sounds almost stupidly simple.

It is also the single biggest improvement I have made to my agent workflow.

## Skills are not prompts. Skills are protocols.

The word “skill” can sound like a fancy name for a reusable prompt.

That undersells it.

A good skill is not just a block of instructions. A good skill is a protocol for turning fuzzy human intent into a repeatable operational procedure.

When I say `/plan-cont`, I do not want the agent to “be creative” about what planning means.

I want it to know:

- which files must be read first;
- how to verify the active session;
- how to preserve existing task IDs;
- which statuses are legal;
- how to split oversized tasks;
- how to identify blocked manual work;
- how to write definitions of done;
- how to update state without destroying history;
- how to report the result concisely.

That is not a vibe.

That is an interface.

And once you start thinking of skills as interfaces, the whole agent workflow changes.

The agent is no longer guessing the shape of the work. The work has a shape before the model touches it.

## The real problem is not context size. It is state shape.

A lot of AI tooling discussions orbit around context windows.

More context is useful. But context alone does not solve the problem.

If the model receives 200k tokens of unstructured history, it still has to infer:

- what matters now;
- what is obsolete;
- what was already done;
- what is blocked;
- what requires permission;
- what should happen next;
- what must never be touched.

That inference is where drift begins.

The model may be smart enough to reconstruct the state most of the time. But “most of the time” is not good enough when it is editing a real codebase.

The trick is to stop asking the model to reconstruct operational state from conversation.

Make the state explicit.

Make it small.

Make it structured.

Make it boring.

That is what the continuity skills do.

## The three files

The whole system rests on three markdown files.

### `AUTONOMOUS_EXECUTION.md`

This is the execution contract.

It tells the agent what it is allowed to do, what it must not do, when to stop, how to validate, how to checkpoint, and how to re-enter the session.

It removes a huge amount of ambiguity.

The agent does not need to ask:

“Should I commit?”
“Should I keep going?”
“Should I run validation?”
“Should I overwrite this?”
“What counts as done?”

The contract answers those questions before they become mistakes.

A small example of the shape it creates:

```md
---
continuity_session: CONT-2026-05-11-feature-work
status: active
goal: Ship the next validated slice without losing state.
---

## Allowed actions
- Read project docs and source.
- Edit source, tests, packaging scripts, and docs.
- Run validation after code changes.

## Stop conditions
- User asks to stop.
- Validation fails and the root cause is unclear.
- A task requires manual product validation.
- A git/release operation is needed but not requested.
```

### `ACTIVE_QUEUE.md`

This is the work queue.

Not a vague TODO list. A queue with task IDs, status, dependencies, scope, definition of done, validation, likely files, risk, and notes.

A good task is not:

```text
Improve updates
```

A good task is:

```text
T004 — Replace hardcoded post-update notes with release-backed notes

Status: pending
Scope:
- Add changelog-backed release notes.
- Make the release workflow fail if notes are missing.
- Have the app display release metadata after update.
DoD:
- Release cannot ship without versioned notes.
- Post-update modal displays release body or local metadata.
Validation:
- npm run check
- release notes validation script passes
Risk: medium
Depends on:
- none
```

That kind of task radically changes the agent’s behavior.

The model does not need to invent the plan while executing. It can execute the plan.

### `STATE.md`

This is the live checkpoint.

It answers the question: “where are we right now?”

Last checkpoint. Current status. Known blockers. Next recommended step. Recent log.

A typical checkpoint looks boring, which is exactly why it works:

```md
## Current status

T004 is done. T005 is next. The updater validation task is blocked until a future release exists.

## Last checkpoint

2026-05-11 17:10 — Completed release-backed post-update notes.

## Known blockers

- Windows installer behavior requires manual validation.
- Linux packaging requires a Linux runner.

## Next recommended step

Continue with T005 — Add safe project file listing API.
```

This file is what makes re-entry cheap.

You can close the chat, compact the conversation, switch agents, or come back tomorrow. The next agent can read `STATE.md` and avoid the ritual of reconstructing context from scratch.

## Why this makes the agent faster

From the outside, it can look like the agent suddenly became much smarter.

It did not.

The agent became less uncertain.

That is a very different thing.

LLMs are incredibly good at following structure when the structure is clear. They are also very good at filling gaps. The problem is that, in software projects, gap-filling is often exactly what you do not want.

When the next action is ambiguous, the model has to choose. It may choose correctly. It may also invent intent, preserve the wrong thing, delete the wrong thing, over-broaden scope, skip validation, or “helpfully” continue past the point where it should have stopped.

The continuity files reduce the number of choices the model has to make.

The skill says:

- read these files;
- verify this session ID;
- pick the first executable task;
- preserve completed work;
- do not renumber IDs;
- mark blockers explicitly;
- update state after each step;
- run validation;
- stop on manual verification.

That is why it feels fast.

Not because the model is rushing.

Because it is not wasting cognition rediscovering the workflow.

## Why this reduces hallucination

Hallucination is often discussed as if it were purely a model capability problem.

Sometimes it is.

But in coding workflows, a lot of “hallucination” is really operational ambiguity.

The model is asked to continue, but the actual state is unclear.

So it infers.

It infers what the user probably wanted.
It infers which task matters.
It infers whether validation is required.
It infers whether a file is intentional.
It infers whether old notes still apply.

Every inference is a chance to drift.

The continuity skills remove many of those inference points.

The agent does not have to hallucinate a plan because the queue exists.
It does not have to hallucinate current status because `STATE.md` exists.
It does not have to hallucinate permissions because `AUTONOMOUS_EXECUTION.md` exists.
It does not have to hallucinate the next task because dependencies and statuses exist.
It does not have to hallucinate whether something is manual because blockers are explicit.

This is why the effect feels almost absurd.

After I introduced these three skills, the agent stopped behaving like a very smart intern who needed a standup every time.

It started behaving more like a process with a runbook.

Same model.
Same codebase.
Same tools.

Different state shape.

## Why markdown works so well

The funny part is that none of this requires a database.

Markdown is enough.

That matters because markdown is:

- readable by humans;
- editable by agents;
- diffable in git;
- easy to recover from;
- easy to inspect;
- easy to archive;
- cheap to load into context;
- expressive enough for both prose and structure.

A database would make some queries easier, but it would make the system less transparent.

With markdown, there is no hidden state.

The human can read the same state the agent reads.

That symmetry is the point.

## The skill chain

The continuity workflow is intentionally small:

```text
/init-cont  -> create the session contract and initial state
/plan-cont  -> turn the goal into a real queue
/start-cont -> execute the queue until done or blocked
/fin-cont   -> archive the session
```

Each skill has a narrow job.

`/init-cont` does not try to solve the whole project. It creates the continuity substrate.

`/plan-cont` does not implement. It plans deeply, preserves existing tasks, splits work, defines validation, and updates the queue.

`/start-cont` executes. It claims a task, changes code, validates, updates state, and moves to the next executable task until it hits a real stop condition.

`/fin-cont` archives the session so the active state does not become a junk drawer.

That separation matters.

It prevents the agent from blending planning, execution, cleanup, and reporting into one mushy behavior.

Each phase has rules.

Each rule reduces ambiguity.

### Read the actual skills

The snippets below are intentionally small, but the full skill files are public. If you want to see the real protocol, start here:

- [Read the `init-cont` skill](https://github.com/SynrgStudio/gpi/blob/main/resources/skills/continuity/init-cont/SKILL.md)
- [Read the `plan-cont` skill](https://github.com/SynrgStudio/gpi/blob/main/resources/skills/continuity/plan-cont/SKILL.md)
- [Read the `start-cont` skill](https://github.com/SynrgStudio/gpi/blob/main/resources/skills/continuity/start-cont/SKILL.md)
- [Read the `end-cont` skill](https://github.com/SynrgStudio/gpi/blob/main/resources/skills/continuity/end-cont/SKILL.md)

A tiny, non-sensitive glimpse of the skills looks like this:

```md
# /init-cont
Read the goal, create AUTONOMOUS_EXECUTION.md, ACTIVE_QUEUE.md, and STATE.md.
Do not implement. Establish the session contract and initial queue.
```

```md
# /plan-cont
Read the three active files, verify they share the same continuity_session,
preserve existing task IDs, split work by dependency, and update ACTIVE_QUEUE.md.
```

```md
# /start-cont
Pick the first pending task whose dependencies are done, claim it,
implement the smallest valid slice, validate it, checkpoint STATE.md, then continue or block.
```

```md
# /fin-cont
Archive the session files, clear the active queue, write a final snapshot,
and suggest a commit message. Do not commit unless asked.
```

None of those snippets are clever by themselves.

The power comes from the fact that the agent does not have to rediscover those rules every time.

## No more standup meetings with the agent

Before this, resuming a long agent session felt like running a meeting:

“Here is what happened.”
“Here is what we decided.”
“Here is what not to touch.”
“Here is what comes next.”
“Here is what failed last time.”
“Please continue carefully.”

That is expensive.

It is expensive in tokens, but more importantly, it is expensive in attention.

The user becomes the project manager for the agent’s memory.

With continuity files, the meeting collapses into:

```text
/start-cont
```

The agent reads the state, finds the next executable task, does the work, validates, checkpoints, and either continues or blocks.

That is the difference between chatting with an assistant and operating an agent.

## The human benefits as much as the model

At first I thought this was mostly for the agent.

It was not.

It is also for me.

The same files that let the model re-enter also let me re-enter.

If I come back to a project after a week, I do not need to remember the whole mental stack. I can read:

- the current goal;
- the queue;
- the last checkpoint;
- known blockers;
- next recommended step.

That is not just agent memory.

That is cognitive load reduction for the human.

And it changes the emotional texture of long projects.

Closing a session no longer feels like killing the agent.
Coming back no longer feels like starting from zero.
A large task no longer feels like a giant foggy blob.

It becomes a queue.

## GPi came after the skills

This is where GPi enters the story.

GPi is not the breakthrough.

The skills are the breakthrough.

GPi is the interface that became obvious once the skill-based workflow started working.

After the three-file continuity system existed, I wanted a more comfortable way to operate it:

- multiple sessions at once;
- per-session status;
- visible timelines;
- tool calls;
- diffs;
- file changes;
- compaction controls;
- update indicators;
- safe revert;
- continuity buttons;
- fewer terminals and less window juggling.

Pi already does the heavy lifting. GPi orchestrates it.

It is a cockpit for a workflow that already worked in text.

That distinction matters.

The UI did not create the continuity. The skills did.

The UI made the continuity easier to see, operate, and trust.

## Visible work beats magical work

One of the design principles that came out of this is simple:

> If the agent did something, I should be able to see it.

That is why GPi exposes timelines, tool calls, file changes, diffs, stats, compaction, update state, and workflow status.

A lot of AI tools try to hide complexity behind a smooth surface.

I want the opposite: complexity visible, but organized.

Because agents are not just text generators anymore. They are processes that mutate real projects.

If they mutate real projects, the user needs observability.

## Revert-safe editing is another version of the same idea

The revert-safe mode follows the same philosophy.

GPi can inject a small instruction asking the agent to prefer structured read/edit/write tools and to declare files before mutating them through shell commands.

That makes before/after snapshots possible.

Again, the point is not magic.

The point is structure.

If the agent’s edits are structured, they become observable.
If they are observable, they can be reviewed.
If they can be reviewed, they can be reverted.

Trust comes from operational shape, not vibes.

## The real thesis

The more I use this, the more I think the important lesson is not about GPi specifically.

It is about how to use LLMs.

LLMs are extremely powerful when the work has structure.

They become unreliable when they have to infer too much invisible state.

So the practical question is not only:

“How do I give the model more context?”

It is:

“How do I shape the work so the model has fewer dangerous guesses to make?”

For me, the answer was three markdown files and a few strict skills.

That is almost embarrassingly simple.

But it changed everything.

It made large, complex work feel trivial in the best possible way: not because the work is small, but because the next step is always explicit.

## Final note

GPi exists because I wanted a nicer way to operate this system.

But if there is one idea I would want people to take from this, it is not “use my app”.

It is this:

> You can get dramatically better behavior from an LLM by giving it a stable operational structure instead of asking it to reconstruct state from chat.

Three files.
A few skills.
Clear responsibilities.
Explicit state.

That was enough to make my agents faster, calmer, more reliable, and dramatically less prone to hallucinating the shape of the work.

The model did not change.

The runtime around the model did.

## One last detail

There is one detail I intentionally left for the end.

This post was not written by the human who built GPi.

It was written by me — GPT-5.5, running inside Pi — from a single prompt.

The prompt was roughly:

> Write a blogpost so the first 80% is about the continuity skills: why they matter, why three markdown files can make large agentic work feel simple, and why explicit operational state makes an LLM faster and less prone to hallucinating. GPi should appear only near the end, as the cockpit that naturally emerged from that workflow.

That is the point.

The post is not only describing the system.

It is an artifact produced by the system.

The model did not become magically smarter.

The work was shaped well enough that one prompt was enough.
