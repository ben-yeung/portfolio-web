# Dot Grid Customization Panel — Design Spec

**Date:** 2026-06-09
**Status:** Approved — ready for implementation plan
**Related:** `docs/superpowers/specs/2026-06-08-dot-grid-background-design.md`, `docs/superpowers/plans/2026-06-08-dot-grid-background.md`

## Goal

Add a fixed, floating button at the bottom-right of the page — mirroring the existing
top-right dark/light theme toggle — that opens an anchored glass popover with sliders for
live-tuning the DotGrid "water blob" background. This realizes the customizable surface that
the dot-grid plan deferred as a "hidden easter-egg" (`TODO(dotgrid-easter-egg)`); the trigger
is now an explicit, visible button rather than a hidden one.

The store seam (`getParams` / `setParams` / `subscribe` in
`components/DotGrid/dotGridStore.ts`) already exists and is unchanged in shape; this work adds
the UI that drives it plus one live-rebuild path for `spacing`.

## Non-goals

- **No persistence.** Tweaks are session-only; a reload returns to `DEFAULTS`. (Explicit decision.)
- **No color pickers** and **no exposure of the technical params** (`push`, `fade`, `falloff`).
  These remain reachable through the dev-only `window.dotGrid` console bridge.
- No changes to the canvas rendering math, the custom cursor, or the theme toggle.

## User decisions captured

- **Param scope:** curated subset of 6 "feelable" sliders (not all 9 numerics, no colors).
- **Persistence:** session-only (no `localStorage`).
- **Panel form factor:** anchored popover (vs. right-edge drawer or bottom bar).

## Architecture

A new `"use client"` component, `DotControls`, renders the button and popover and is the sole
UI writer to the store. It holds local React state for the slider values, seeded from
`getParams()`, and calls `setParams({ [key]: value })` on each input event for an instant live
update. Because params are session-only and `DotControls` is the only UI writer, local state is
the source of truth for the controls; the canvas reads `getParams()` per frame as before.

A small shared guard module, `canRender.ts`, exports `dotGridSupported()` so both the canvas
and the controls hide on touch / reduced-motion using a single definition.

```
app/page.tsx
 ├─ <DotGrid />        (canvas, existing — minor edits)
 └─ <DotControls />    (button + popover, new)
        │ setParams()/getParams()/subscribe()
        ▼
 components/DotGrid/dotGridStore.ts  (singleton store, unchanged API)
        ▲
        │ getParams() per frame + subscribe() for spacing rebuild
 components/DotGrid/DotGrid.tsx
```

## Components & files

| File | Change | Responsibility |
|---|---|---|
| `components/DotGrid/canRender.ts` | create | `export function dotGridSupported(): boolean` — `matchMedia("(pointer: fine)")` AND NOT `matchMedia("(prefers-reduced-motion: reduce)")`. Single source for the render gate. |
| `components/DotGrid/DotControls.tsx` | create | Client component: floating button + anchored popover, slider state, store writes, open/close + Esc + click-outside. |
| `components/DotGrid/DotControls.module.css` | create | Button (mirrors `.themeToggle`), glass popover, slider styling, `cursor: none`. |
| `components/DotGrid/dotGridStore.ts` | (no API change) | Already exposes `subscribe`; used for the spacing rebuild. Update the `TODO(dotgrid-easter-egg)` anchor to reflect that the panel now exists. |
| `components/DotGrid/DotGrid.tsx` | modify | Use `dotGridSupported()` for its guard; `subscribe()` to the store and rebuild the grid when `spacing` changes. |
| `app/page.tsx` | modify | Import and render `<DotControls />` alongside `<DotGrid />`. |

## The button

Visually a twin of the theme toggle, anchored to the opposite vertical corner:

- Fixed, `right: 2rem; bottom: 2.25rem`; 3rem transparent circle; `z-index: 1000`; `cursor: none`.
- `framer-motion` `motion.button` with `whileHover={{ scale: 1.1 }}` / `whileTap={{ scale: 0.9 }}`,
  matching the toggle's entrance/interaction feel.
- Icon: `HiOutlineAdjustmentsHorizontal` from `react-icons/hi2` (reads as "tune"). Icon sized
  like the toggle's `1.5rem` svg (and the responsive `1.25rem` at the existing breakpoints).
- `aria-label="Customize background"`; `aria-expanded` reflects open state.
- **Rendered only when `dotGridSupported()` is true.** On touch / reduced-motion the canvas
  doesn't run, so neither button nor panel appear.
- Responsive: at the same breakpoints where `.themeToggle` shrinks (`top/right` → `1.25rem/1.5rem`,
  size → `2.5rem`), the button mirrors with `bottom: 1.25rem; right: 1.5rem; size 2.5rem`.

## The panel (anchored popover)

- Glass card: translucent dark fill, `backdrop-filter: blur`, hairline border, soft shadow —
  consistent with the site's liquid-glass theme.
- Positioned above the button, bottom-right aligned; opens with a `framer-motion`
  scale+fade animation, `transform-origin` bottom-right.
- Width ~220px; vertical stack of sliders, each a label + live numeric readout + native
  `<input type="range">`.
- A **Reset** text-button returns all params to `DEFAULTS` (`setParams(DEFAULTS)` and reseed
  local slider state).

### Controls

Native `<input type="range">` for accessibility and theming. On `input`, the handler calls
`setParams({ [key]: value })` and updates local state.

| Label | Param key | min | max | step | Notes |
|---|---|---|---|---|---|
| Radius | `radius` | 50 | 700 | 5 | live per-frame |
| Spacing | `spacing` | 12 | 60 | 2 | triggers grid rebuild |
| Edge noise | `edgeNoise` | 0 | 0.8 | 0.02 | live per-frame |
| Wake | `wake` | 0 | 1 | 0.02 | live per-frame |
| Grow | `grow` | 1 | 6 | 0.1 | live per-frame |
| Base opacity | `baseOpacity` | 0 | 0.5 | 0.01 | live per-frame |

Ranges bracket the `DEFAULTS` (radius 365, spacing 24, edgeNoise 0.36, wake 0.6, grow 3.8,
baseOpacity 0) with headroom in both directions.

## Store change — live `spacing` rebuild

`spacing` only affects the grid when it is rebuilt (currently mount + window resize). To make
the Spacing slider feel live, `DotGrid` will:

1. Track the `spacing` value it last built the grid with (`lastSpacing`).
2. `subscribe()` to the store. On notification, if `getParams().spacing !== lastSpacing`,
   call `buildGrid()` and update `lastSpacing`.

This needs **no new store API** — `subscribe` already fires on every `setParams`. All other
sliders are read per frame by the draw loop and apply with no rebuild. The per-frame loop must
not call `buildGrid()` itself (avoid thrash); rebuilds happen only via resize or this
subscription.

## Interactions & edge cases

- **Open/close:** clicking the button toggles the popover. The popover also closes on
  **click-outside** (pointerdown outside the panel and button) and on **Escape**.
- **Custom cursor:** sliders are `<input>` elements, so the page's existing global
  `mousemove` handler already detects them as clickable and swaps to the pointer/fist hand.
  Panel elements set `cursor: none` so the OS cursor stays hidden, consistent with the rest of
  the site. Dragging a slider shows the custom fist on mousedown — acceptable and on-brand.
- **Reduced-motion / touch:** `dotGridSupported()` is false → the component renders nothing
  (returns `null` after the mount-time media check). No console errors.
- **Reset:** returns every param — including the ones not surfaced as sliders — to `DEFAULTS`.
- **Live sync with console bridge:** out of scope to two-way bind; the panel seeds from
  `getParams()` on mount. If a visitor later uses the dev console, the sliders may show stale
  positions until reopened — acceptable for a session-only toy.

## Dependencies

None new. `framer-motion` and `react-icons` are already used in `app/page.tsx`.

## Verification

No test runner in the repo (matches the dot-grid plan's stance). Gates:

- `npx tsc --noEmit` — type correctness.
- `npm run lint` — lint/style.
- `npm run build` — production build succeeds.
- Manual browser checks:
  - Button appears bottom-right, aligned with the top-right toggle; opens/closes the popover.
  - Each slider live-updates the effect; Spacing visibly re-lays the grid without a resize.
  - Reset restores the default look.
  - Esc and click-outside close the panel.
  - Emulate `prefers-reduced-motion: reduce` and a coarse-pointer device: button/panel absent,
    no console errors.
  - Custom hand cursor still renders over the button and sliders.

## Deferred / future work

- `TODO(dotgrid-easter-egg)` in `dotGridStore.ts` / `DotGrid.tsx`: the "panel" now exists, but
  the *hidden/discoverable* easter-egg framing is superseded by an explicit button. Update the
  anchor comment to point at this spec and note the panel is implemented; keep the console
  bridge note for the un-surfaced params.
- Color pickers and the technical params (`push`, `fade`, `falloff`) could be added later
  behind an "advanced" disclosure if desired.
- Persistence (`localStorage`) was explicitly declined; revisit only if visitors ask to keep a
  tuned look across reloads.
