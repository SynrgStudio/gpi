# GPi Visual System

## Direction

Dark agent workspace with cockpit-grade operational clarity. Premium, calm, fast. More T3Code/Codex/Cursor/Raycast than DevOps dashboard.

Glass remains a subtle material, not the whole identity. The app should feel like a serious daily agent workspace: compact sidebar, clean chat timeline, powerful composer, contextual operational panels.

## Principles

- Content first; glass supports hierarchy, not noise.
- Motion communicates liveness, not decoration.
- Status color is scarce and meaningful.
- Text contrast stays high even with transparency.
- Streaming should feel smooth and stable.

## Tokens

### Color

```text
bg.base          #070A12
bg.panel         rgba(18, 24, 38, 0.72)
bg.panelStrong   rgba(24, 32, 50, 0.86)
bg.input         rgba(10, 14, 24, 0.82)
border.subtle    rgba(255,255,255,0.08)
border.strong    rgba(255,255,255,0.16)
text.primary     #F4F7FB
text.secondary   #AEB8C7
text.muted       #6F7A8A
accent           #8B7CFF
accent.soft      rgba(139,124,255,0.18)
success          #58D68D
warning          #F4C95D
error            #FF6B7A
info             #64D2FF
```

### Material

- default surface: neutral dark card, not heavy translucency
- glass blur only where it improves depth: 12-20px
- panel opacity should stay high enough for text clarity
- border: 1px hairline
- shadow: soft, small-to-medium, low opacity
- avoid stacking translucent layers over text
- subtle noise overlay is acceptable

### Radius

```text
radius.sm  8px
radius.md  12px
radius.lg  18px
radius.xl  24px
```

### Spacing

```text
space.1  4px
space.2  8px
space.3  12px
space.4  16px
space.6  24px
space.8  32px
```

### Typography

- UI: Inter, Geist Sans, or system sans
- Code: JetBrains Mono, Geist Mono, or system mono
- message text: 14-15px
- sidebar text: 13px
- metadata: 12px
- line height: 1.45-1.6 for chat

### Motion

- common transitions: 100-150ms
- layout transitions: 150-220ms
- active indicators: subtle pulse, 1.2-1.8s
- no bouncy animations for operational state

## Components

### Sidebar item

- glass/transparent row
- selected: accent soft background + stronger border
- hover: subtle lightening
- status dot/badge left or right
- last activity muted

### Status badge

- small pill or dot
- color mapped to state
- animated only for active states
- waiting/error states get priority contrast

### Message

- user: right or full-width compact card
- assistant: clean text block, minimal chrome
- streaming cursor/subtle shimmer
- tool markers inline but compact

### Tool call card

- tool name
- status
- duration when known
- compact summary
- expandable details

### Diff/file card

- file path
- kind: created/modified/deleted
- small stats if known
- click/select opens detail panel area

### Composer

- prominent bottom control surface, closer to T3Code/Codex than a plain input
- rounded dark card with clear focus ring using accent
- multiline prompt editor
- selected session target visible
- room for send/interrupt, model/runtime/mode controls, approvals and context chips
- disabled/queued state explicit

## Perceived latency rules

- Show shell immediately.
- Acknowledge sent prompt immediately.
- Move session to `thinking` before first token.
- Show tool start immediately on event.
- Never leave user wondering whether send worked.
- Prefer skeleton/placeholder over blank panels.
- Keep session switching synchronous from local cached state.

## Anti-clutter rules

- No giant logs in main chat.
- No saturated rainbow statuses.
- No permanent heavy borders everywhere.
- No auto-opening panels unless attention is required.
- No jumping layout during streaming.

## First prototype visual target

Mock data should show:

- 3 projects
- 6-8 sessions
- at least one streaming, one running tool, one waiting input, one error
- selected chat with streaming assistant response
- right panel with two tool cards and one file change card

If a screenshot reads as "beautiful cockpit for agents" within 2 seconds, the direction is right.
