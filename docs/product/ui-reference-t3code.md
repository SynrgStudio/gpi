# UI Reference: T3Code / Codex-style Agent Workspace

## Source reviewed

- Repository: `https://github.com/pingdotgg/t3code`
- Local clone inspected: `C:/Users/dnaon/AppData/Local/Temp/t3code`
- Key files inspected:
  - `apps/web/src/components/AppSidebarLayout.tsx`
  - `apps/web/src/components/Sidebar.tsx`
  - `apps/web/src/components/ChatView.tsx`
  - `apps/web/src/components/chat/ChatComposer.tsx`
  - `apps/web/src/components/chat/MessagesTimeline.tsx`
  - `apps/web/src/index.css`

## Direction change for GPi

GPi should keep the cockpit metaphor, but the first serious visual pass should intentionally land very close to a Codex/T3Code-style agent workspace:

- sober dark product UI instead of heavy glass dashboard
- persistent compact sidebar
- clean chat timeline as the main surface
- powerful bottom composer as the cockpit control surface
- contextual/collapsible operational panels instead of always-visible raw detail lists

This does not mean copying T3Code code, assets, branding or names. It does mean aiming for a highly similar product pattern, layout density, visual hierarchy and interaction feel so GPi starts from a proven agent-app baseline that can later be customized into its own identity.

Target bar for T031: if a user squints, GPi should feel like the same class of app as T3Code/Codex, not merely a dashboard inspired by it.

## Fidelity target

T031 should be deliberately close in these areas:

- left thread/project sidebar density and selected-row treatment
- neutral dark token system with card/background/border/muted surfaces
- compact top header rather than ornate dashboard chrome
- markdown-first assistant timeline with minimal chrome
- right-aligned user message bubbles
- compact work/tool entries in the timeline or secondary surface
- large rounded bottom composer as the main control surface
- subtle hover actions and metadata
- contextual secondary panels instead of a permanent raw event dashboard

T031 should avoid similarity in these areas:

- T3Code logo/name/branding/assets
- exact source code or component copies
- provider/model systems GPi does not need yet
- T3Code-specific routes/settings/worktree behaviors

## Patterns to adopt

### Shell

- Full-height app layout with left sidebar and main chat column.
- Sidebar can remain visible and later become resizable/collapsible.
- Top bar is compact and operational: project, session, model/bridge/runtime status.
- Main content prioritizes chat and composer over ornamental panels.

### Sidebar

- Dense project/session rows.
- Strong selected state, but not loud.
- Status pills/dots and last activity summaries.
- Sorting/grouping/search later.
- Sessions needing attention should be easy to jump to.

### Chat timeline

- User messages as compact right-aligned bubbles/cards.
- Assistant messages as markdown-first text blocks with minimal chrome.
- Tool/work activity as compact inline timeline entries, not giant cards in the chat.
- Completion dividers and small metadata are useful when they reduce ambiguity.
- Copy/revert/actions can appear on hover.

### Composer

The composer should become a primary product surface:

- larger rounded container at the bottom
- multiline prompt editor
- send/interrupt control
- session target clarity
- mode/model/runtime controls later
- pending approval/user input banners above or inside composer
- context/attachment chips later

### Detail surfaces

- Replace raw always-visible detail list with contextual surfaces:
  - Tools
  - Files
  - Diffs
  - Logs
  - Terminal/context later
- Prefer collapsible/right sheet behavior over permanent dashboard clutter.

## Visual tokens

Move from saturated glass toward neutral dark tokens:

- `background`: near-neutral black
- `card`: slightly lifted dark surface
- `border`: low-alpha white/neutral hairline
- `muted`: low-contrast metadata
- `primary`: scarce accent for send/focus/attention
- subtle noise overlay is acceptable
- transitions should be short and quiet

Glass remains allowed as a subtle material layer, not the main identity.

## Anti-goals

- Do not clone T3Code source or branding.
- Do not add complex provider/model/plugin systems just for visual parity.
- Do not turn GPi into a full IDE.
- Do not keep a raw event dashboard as the primary UI.

## Implementation implication

Before adding more workflow features on top of the current shell, GPi should do a visual/interaction pivot:

1. establish neutral token system
2. reshape layout into sidebar + chat column + strong composer
3. make the right panel contextual/collapsible
4. convert messages into a proper timeline
5. only then continue project/session feature work
