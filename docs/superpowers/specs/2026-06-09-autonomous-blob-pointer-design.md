# Autonomous Blob Pointer — Design

**Date:** 2026-06-09
**Status:** Approved, ready for implementation plan
**Component:** `components/DotGrid/`, `app/page.tsx`

## Problem

The dot-grid background effect (`DotGrid.tsx`) is driven entirely by the mouse pointer:
a `mouse {x,y}` position feeds a 6-node follower chain, and dots reveal based on proximity.
On true touch-only devices there is no pointer, so the effect early-returns and never
runs — mobile visitors see a static background.

Two related desktop cursor bugs were noticed alongside this:

1. **Initial-position snap:** the custom cursor's position state starts at `{x:0, y:0}`,
   so the cursor paints in the top-left corner on load and snaps to the real pointer only
   after the first `mousemove`.
2. **Stuck-on-blur:** when the window loses focus / the mouse leaves the viewport, the
   custom cursor freezes in place (nothing hides it), while the blob slides off to `-9999`
   and disappears — an inconsistent, broken-looking state.

## Goal

Give mobile (and unfocused desktop) an **autonomous "virtual pointer"** — a slow floating
blob that drives the existing dot-grid effect by itself, for visual interest. Reuse the same
mechanism to make the desktop blur/focus transition graceful, and fix the two cursor bugs.

**Hard constraint:** the autonomous blob must never interfere with the user's touch, scroll,
taps, or clicks.

## Core architecture: a single pointer source, two modes

`DotGrid.tsx` keeps one effective pointer that the follower chain reads, driven by one of two
sources selected by a `mode`:

- **`pointer` mode** — the real mouse (desktop default, unchanged behavior).
- **`auto` mode** — an autonomous virtual pointer running the bounce motion below, **always
  seeded from the last known pointer position** so every handoff into `auto` is seamless
  (the blob continues from where the cursor was, never teleports).

The canvas **no longer early-returns** on touch-only devices. The effect (canvas + RAF loop)
always mounts; `dotGridSupported()` now only selects the *default mode*.

### Device detection — media query, never viewport width

The mobile-vs-desktop decision keys off the existing `dotGridSupported()` media query
`(hover: none) and (pointer: coarse)` — a true device-capability test, **not** a width
breakpoint. A desktop window resized to phone dimensions still reports `hover: hover` /
`pointer: fine` and therefore keeps full desktop behavior (mouse-driven, auto-on-blur).
Only genuine touch-only devices default to always-on autoplay.

> Do **not** swap this for a width breakpoint. `canRender.ts` / `dotGridSupported()` stays
> the single source of truth for "is this a touch-only device."

Note: a separate, pre-existing concern hides the desktop-only `DotControls` panel at mobile
*widths*. That is unrelated UI gating and stays as-is. The blob's mode is device-based only.
`dotGridSupported()` must continue to gate `DotControls` exactly as before (no regression).

## The motion

Nudged DVD bounce, very slow ("preview B" from brainstorming):

- Constant speed; the virtual pointer integrates position each frame and reflects off the
  viewport edges (with a small margin so the blob stays partly on-screen).
- On each edge hit, apply a **±~12° random angle nudge** to the velocity, then **renormalize
  to the constant speed**, so the path roams the full screen instead of locking into a single
  repeating diagonal.
- Speed/radius/nudge-amount live as named constants in `DotGrid.tsx` (e.g. `AUTO_SPEED`,
  `AUTO_NUDGE`). The brainstorming preview ran on a 300px canvas, so the **final speed must be
  tuned on a real full-screen device**; the dev `window.dotGrid` bridge is sufficient for
  tuning. No new control-panel UI in this scope (YAGNI).

## Behavior by context

### Mobile (touch-only devices)

- **Default:** `auto` mode runs from load — the blob bounces slowly on its own.
- **Touch nudge:** passive `touchstart` / `touchmove` listeners *read* coordinates only and
  ease the pointer toward the active touch while a finger is down. On `touchend` the blob
  resumes bouncing from that spot. Result: a tap nudges the blob, a drag moves it.
- **Reduced motion:** **no autonomous bounce.** The blob only follows touch (and rests at its
  last position when untouched). The dot displacement (`push`) stays disabled, matching the
  existing desktop reduced-motion behavior (`pushAmt = reduceMotion ? 0 : p.push`).

### Desktop (mouse devices)

- **Normal:** `pointer` mode, exactly as today.
- **On `blur` / mouse-leave:** switch to `auto` mode seeded at the last known position (replaces
  the current `onMouseLeave` behavior that sent the pointer to `-9999`). The blob smoothly
  continues into a slow bounce while the user is away.
- **On `focus` + first `mousemove`:** switch back to `pointer` mode; the real cursor fades
  back in.
- **Reduced motion:** on blur the blob **freezes** at its last position (no bounce), consistent
  with "don't auto-move."

### Mode-selection summary

| Context | Untouched / unfocused | Touch / mouse active |
|---|---|---|
| Mobile, normal motion | `auto` bounce | follow touch, resume bounce on release |
| Mobile, reduced motion | rest in place | follow touch |
| Desktop, normal motion | `auto` bounce (on blur/leave, seeded from last pos) | `pointer` (real mouse) |
| Desktop, reduced motion | freeze at last pos (on blur/leave) | `pointer` (real mouse) |

## Custom cursor fixes (`app/page.tsx`)

These coordinate with the blob purely by reacting to the same `blur` / `focus` / `mousemove`
events — no shared state required.

1. **Initial position:** add a "pointer has moved yet" guard (state, default `false`, set
   `true` on first real `mousemove`). The custom cursor renders hidden until then, removing the
   top-left snap on load.
2. **Stuck on blur:** hide the custom cursor on `blur` / window mouse-leave; show it again on
   `focus` + mouse move. This keeps the cursor in sync with the blob handoff: cursor gone →
   blob takes over; cursor back → blob yields.

## Non-interference guarantees

The blob can never block touch/clicks because:

- The canvas stays `z-index: -1` and `pointer-events: none` — behind all content and invisible
  to hit-testing.
- All new listeners are **passive observers** on `window`
  (`touchstart` / `touchmove` / `mousemove` / `blur` / `focus`) that only read coordinates.
  None call `preventDefault` or `stopPropagation`, so scrolling, link taps, and form input are
  unaffected.
- No new DOM nodes intercept input; the blob is pure canvas paint.

## Testing

- **Pure, unit-testable logic** (extract from the RAF/DOM so it can be tested headlessly):
  - The bounce step: `position += velocity`, edge reflection, angle nudge, renormalize to
    constant speed.
  - Mode selection: `given (device, reduced-motion, focus/touch state) → mode`.
- **Untested (visual):** the canvas draw loop itself.
- **Manual / on-device:**
  - Real touch device: blob autoplays; drag with finger moves it; **scroll and link taps still
    work**; reduce-motion enabled → no autoplay, follows touch only.
  - Desktop: blur shows a smooth handoff (no teleport, no stuck cursor); focus + move restores
    the cursor and yields the blob; a desktop window resized to narrow width keeps desktop
    behavior.
  - Regression: `DotControls` still gated by `dotGridSupported()` exactly as before.

## Out of scope (YAGNI)

- No new control-panel UI for the autonomous-motion params (tune via `window.dotGrid`).
- No tap-ripple / decorative touch effects beyond the nudge-follow behavior.
- No desktop "idle while focused" autoplay — `auto` only engages on blur/leave on desktop.
