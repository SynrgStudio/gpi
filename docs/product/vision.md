# GPi Product Vision

## One-line thesis

Pi ya es buen motor; GPi es la cabina hermosa para manejarlo.

## Product idea

GPi is a local GUI/cockpit for Pi. It does not replace Pi's agent engine. It gives Pi a polished, fast, multi-session interface for daily work: projects on the left, active chats in the middle, operational detail on the right, and an input that always feels ready.

The product goal is not "make a new agent". The goal is:

> Make using Pi feel incredible, especially when supervising several Pi sessions at once.

## Why this is valuable

Pi already owns the hard backend surface:

- providers
- auth
- sessions
- tools
- context
- prompts
- skills
- agent loop
- execution

GPi can focus on the layer where current agent harnesses often feel weak:

- perceived latency
- visual polish
- cognitive flow
- everyday usability
- parallel supervision
- clear state and recovery
- beautiful interactions

The differentiator is feel. If GPi makes Pi feel instant, legible and pleasant, the GUI becomes more than decoration: it becomes the product surface.

## Target user

Initial target user:

- runs Pi locally
- works across multiple projects
- often has 2-5 agent sessions active
- wants to supervise agents without losing context
- values keyboard speed and low cognitive friction
- cares about polish, typography, animation and perceived latency

This is not initially an enterprise collaboration product. It is a power-user cockpit for local agent work.

## Foundational requirement: multi-project, multi-session

Multi-session is architecture, not a later feature.

GPi must assume from day zero that the user can have multiple projects and multiple Pi sessions/chats running at the same time. The sidebar is therefore not just navigation. It is the operational dashboard.

The sidebar must make it possible to answer in seconds:

- Which projects have active sessions?
- Which sessions are running?
- Which sessions are waiting for input or approval?
- Which sessions errored?
- Which sessions edited files or ran tools recently?
- Where should the user intervene next?

## Product principles

### 1. Pi is the engine

GPi should reuse Pi instead of duplicating it. Providers, auth, tool execution, prompts, skills and agent loop belong to Pi unless a future architectural decision says otherwise.

### 2. Cockpit, not generic chat app

A single chat view is insufficient. GPi is a control surface for local agents: project/session list, active run status, chat, tools, diffs and approvals.

### 3. Sidebar-first supervision

The left sidebar must show projects and their sessions with live status. It should be useful even before opening a specific chat.

### 4. Perceived latency is product quality

GPi should feel alive immediately:

- instant app shell
- immediate prompt acknowledgement
- smooth streaming
- visible tool state
- no ambiguous "frozen" state
- fast switching between sessions

### 5. Detail is available, not noisy

Tool calls, diffs, logs and context are important, but they should not clutter the main chat. The main surface should stay readable; operational detail can live in a side panel.

### 6. Beauty is functional

Glass, blur, spacing, typography, motion and status color are part of usability. The goal is premium and calm, not DevOps dashboard clutter.

## Core surfaces

- Project/session sidebar
- Chat view for selected session
- Input composer
- Right detail panel for tools, diffs, files, logs and context
- Status bar for project/model/branch/session/run state

## Initial status model

Sessions should expose a small set of visible states:

- idle
- thinking
- streaming
- running tool
- editing files
- waiting approval
- waiting input
- blocked
- error
- completed

These states drive sidebar badges, sort priority and attention cues.

## Non-goals for the initial product

GPi should not initially be:

- a new agent engine
- a provider abstraction layer
- a replacement for Pi auth/model/tool systems
- a cloud sync platform
- a marketplace
- a complex plugin system
- a collaborative multi-user product
- a full IDE or VS Code replacement
- an enterprise dashboard
- a browser automation product
- a complex multi-agent orchestration framework

These may be revisited later, but they are not MVP foundations.

## MVP success criteria

The first useful GPi should let the user:

1. Open a local app quickly.
2. See projects and sessions in a sidebar.
3. Open/switch between multiple sessions.
4. Send prompts to a selected session.
5. Watch streaming output.
6. See live status for other sessions without opening them.
7. Inspect tool calls and file changes without cluttering chat.
8. Resume enough local state to keep working daily.

If the user naturally wants to keep GPi open all day while several Pi sessions run, the product direction is correct.
