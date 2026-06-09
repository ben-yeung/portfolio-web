# Dot Grid "Water Blob" Background — Design Spec

**Date:** 2026-06-08
**Status:** Approved (design), pending implementation plan

## Summary

Replace the current mouse-following radial glow (`.mouseHighlight` in `app/page.tsx`)
with an interactive dot-grid background. A grid of dots is hidden at rest; within an
organic, irregular "blob" around the cursor the dots are revealed, brighten toward the
cursor (topographic falloff), displace away from it, and grow. Fast cursor motion
stretches the blob into a trailing wake ("dragging through water"); slowing down lets it
relax to a rounder blob. Dots fade out smoothly as the cursor leaves.

The effect is built around a **central, live-tunable parameter store** so every visual
parameter can be mutated on the running canvas with no reload. This is a deliberate seam:
a later phase will expose those parameters through a **hidden easter-egg control panel**
(discoverable; trigger TBD). The panel and its trigger are out of scope for this spec but
the architecture must support them.

A validated interactive prototype lives at
`.superpowers/brainstorm/1907-1780971171/content/prototype-v2.html` and is the source of
truth for the feel and the default parameter values below.

## Goals

- Replace the glow backlit effect with the dot-grid water-blob effect.
- Match the validated prototype's behavior and default values.
- Keep the existing custom hand-icon cursor system (`FaRegHand` / `FaRegHandPointer` /
  `FaRegHandBackFist`) completely unchanged.
- Make all visual parameters live-tunable through a store API, ready for a future panel.
- Theme-aware (dark + light), performant, and respectful of reduced-motion / touch.

## Non-Goals

- The easter-egg control panel UI and its trigger (deferred; inline TODO stubs only).
- Persisting user-tweaked parameters across sessions.
- Changing the custom cursor, navbar, or any other existing behavior.

## Behavior

For each animation frame:

1. A `mousemove` listener writes the raw pointer position to a ref (no React state, so
   the page does not re-render on pointer movement).
2. A chain of 6 "follower" points advances: the head eases toward the pointer; each
   subsequent follower eases toward the previous one. The chain spreads into a streak when
   the pointer moves fast (wake) and converges when it slows.
3. Each dot's reveal value is the **soft union** over followers:
   `reveal = 1 - Π(1 - fᵢ)`, where each `fᵢ = smoothstep(1 - dist/rᵢ)` and `rᵢ` is the
   follower's radius modulated by **angular pseudo-noise** (cheap sum of sines, evolving
   over time) to give an irregular, wobbling, organic edge. Tail followers taper
   (`rᵢ = R·(1 - 0.10·i)`) so the wake forms a teardrop.
4. **Topographic brightness:** brightness peaks at the cursor head and falls off with
   distance — `target = reveal · (tailFloor + (1 - tailFloor)·headProx)`, where
   `headProx = smoothstep(1 - distHead/R)` and `tailFloor = 1 - falloff·0.9`. At
   `falloff = 0` the blob is evenly lit; near `1` only the dots nearest the cursor glow.
5. Each dot's drawn opacity eases toward its target (`opacity += (target - opacity)·fade`),
   producing the trailing fade-out as the cursor leaves.
6. Dots are drawn displaced away from the cursor head (scaled by `push` × reveal) and grown
   (`1 + (grow - 1)·target`).

At rest (no recent pointer / pointer left the window) all dots ease to hidden.

## Parameters & Defaults

The store holds these defaults (validated in the prototype). Names are the implementation
keys; prototype labels in parentheses.

| Key            | Prototype label        | Default              |
|----------------|------------------------|----------------------|
| `radius`       | Blob size              | `365`                |
| `spacing`      | Dot spacing            | `24`                 |
| `edgeNoise`    | Edge irregularity      | `0.36`               |
| `wake`         | Wake / trail length    | `0.6`                |
| `push`         | Distortion (push)      | `24`                 |
| `grow`         | Dot grow near cursor   | `3.8`                |
| `fade`         | Fade trail             | `0.28`               |
| `falloff`      | Topographic falloff    | `0.87`               |
| `baseOpacity`  | Base dots at rest      | `0` (hidden)         |
| `colorDark`    | Dot color (dark theme) | `[245, 235, 225]` (cream) |
| `colorLight`   | Dot color (light theme)| `[135, 117, 100]` (accent `#877564`) |

Derived constants (not exposed as params unless needed later): follower count = 6, head
ease = 0.35, tail ease = `0.55 - wake·0.42`, dot base radius = `1.1px`, DPR cap = 2.

## Architecture

### New files

**`components/DotGrid/dotGridStore.ts`** — the live-tunable config store. A plain module
singleton, framework-agnostic, zero re-render cost.

- `export const DEFAULTS: DotGridParams` — the table above.
- `getParams(): DotGridParams` — current values; read by the canvas each frame.
- `setParams(partial: Partial<DotGridParams>): void` — merge + notify subscribers.
- `subscribe(cb: () => void): () => void` — for the future panel to reflect external changes.
- `TODO(dotgrid-easter-egg)` anchor stub (see Deferred Work).

**`components/DotGrid/DotGrid.tsx`** — `"use client"` component owning the effect.

- Renders a single fixed full-viewport `<canvas class={styles.dotCanvas}>`.
- On mount (`useEffect`): sets up canvas sizing (DPR-capped), builds the dot grid,
  attaches `mousemove`/`mouseleave` (→ ref), `resize` (rebuild grid), and the rAF loop.
- Reads `getParams()` each frame; reads active theme color from the `dark`/`light` body
  class (same signal the existing theme toggle drives).
- Cleans up listeners and cancels the rAF on unmount.

### Changes to existing files

**`app/page.tsx`**
- Remove the `.mouseHighlight` `<div>` (the radial-gradient glow).
- Render `<DotGrid />` in its place (behind all content).
- Leave the custom cursor block and `mousePosition` state untouched — the cursor still uses
  `mousePosition`; `DotGrid` tracks the pointer independently via its own ref listener.

**`app/page.module.css`**
- Remove the `.mouseHighlight` rule.
- Add `.dotCanvas { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0;
  pointer-events: none; }` (the canvas sits where the glow was, behind content; the custom
  cursor stays at `z-index: 10000`).

## Data Flow

```
mousemove ──► mouseRef {x,y}            (raw; no React state)
                  │
   rAF loop ──────┤  read getParams()   ◄── dotGridStore (DEFAULTS, live-mutable)
                  │  read theme color   ◄── body.dark / body.light class
                  │
                  ├─ advance 6-point follower chain toward mouseRef   (wake)
                  ├─ per dot: soft-union field over followers,
                  │     angular-noise edge  → reveal
                  ├─ topographic brightness = reveal × falloff(headProx)
                  ├─ ease dot opacity toward target                   (fade trail)
                  └─ draw dot (displaced + grown)
```

A parameter change via `setParams()` is picked up on the next frame — no reload, no
remount. This is exactly what the future easter-egg panel requires.

## Theming

The store carries both `colorDark` and `colorLight`. `DotGrid` selects the active color
from the current body theme class, matching the existing toggle. Light mode starts at the
accent `#877564` (the color the current light-mode glow already uses); revisit if it reads
too faint on the `#f5ebe1` background.

## Performance & Edge Cases

- **DPR capped at 2**; the dot grid is rebuilt on `resize`.
- **`prefers-reduced-motion: reduce`** → effect disabled: no rAF loop, canvas renders
  nothing.
- **No fine pointer** (`(pointer: fine)` fails — touch devices) → effect disabled, matching
  how the custom cursor is already disabled on mobile.
- **Tab hidden** (`visibilitychange`) → pause the rAF loop; resume on visible.
- Pointer math uses `hypot`/`atan2` per dot per follower (~3,600 dots × 6 at 1080p) — well
  within 60fps budget on Canvas 2D; no offscreen/worker rendering needed.

## Deferred Work

**Hidden easter-egg control panel** — a discoverable panel exposing the parameter sliders,
mutating the effect live via `setParams()`. Trigger and panel UI are TBD and out of scope
here. The store's `getParams` / `setParams` / `subscribe` API is the entire integration
surface, so the panel is drop-in later. The prototype's slider panel
(`.superpowers/brainstorm/1907-1780971171/content/prototype-v2.html`) is a UI reference.

Linked inline TODO stubs (greppable as one unit):

- **Anchor** — `components/DotGrid/dotGridStore.ts`:
  `TODO(dotgrid-easter-egg): expose setParams() to a hidden, discoverable control panel
  that tweaks the live effect; trigger + panel UI TBD — see
  docs/superpowers/specs/2026-06-08-dot-grid-background-design.md §Deferred Work.
  Sibling: components/DotGrid/DotGrid.tsx`
- **Sibling** — `components/DotGrid/DotGrid.tsx`:
  `TODO(dotgrid-easter-egg): live param reads already flow through dotGridStore.getParams();
  panel will call setParams() — anchor: components/DotGrid/dotGridStore.ts`

## Testing / Verification

This is a visual, interactive effect with no pure-logic seams worth heavy unit testing.
Verification is primarily manual against the prototype:

- Effect replaces the glow; dots hidden at rest, revealed in a blob around the cursor.
- Fast drag produces a wake; slowing relaxes to a rounder blob; leaving fades dots out.
- Brightness peaks under the cursor (topographic), dims toward edges/wake.
- Dark mode = cream dots; toggling to light mode swaps to accent and stays visible.
- Custom hand cursor unchanged and on top of the effect.
- Reduced-motion and touch/no-pointer: effect absent, no errors.
- `setParams({ radius: 120 })` from the console changes the live effect without reload.

Optionally, `dotGridStore` is plain logic and can carry a small unit test
(`getParams`/`setParams` merge + `subscribe` notification) if a test setup exists.
