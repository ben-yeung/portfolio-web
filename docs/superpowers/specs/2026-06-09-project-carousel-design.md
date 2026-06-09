# Project Cards — Two-Row Auto-Scrolling Carousel (Desktop)

**Date:** 2026-06-09
**Status:** Approved design, pending implementation plan
**Branch context:** built on `feature/dot-grid-controls-panel` (or a fresh branch off it)

## Summary

Replace the desktop projects grid with a **two-row horizontal auto-scrolling
carousel**. The projects are split in half across two rows that drift in
opposite directions, making better use of vertical space so visitors don't have
to scroll as far. The motion pauses and can be steered per-row with the cursor.

Below the desktop breakpoint, the **existing single-column stacked layout is
unchanged**.

## Goals

- Use horizontal space (and reduce vertical length) on desktop.
- Keep the current glass-card look and content exactly.
- Add a playful, readable interaction: auto-drift, pause-on-hover, edge-steer.
- Don't regress mobile/tablet, accessibility, or performance.

## Non-Goals

- No redesign of the card visuals, content, or data model.
- No touch/drag carousel on mobile — touch devices keep the stacked grid.
- No changes to other sections (hero, about, contact).

## Layout

- **Breakpoint:** carousel applies at **`min-width: 1025px`**. At `≤1024px` the
  existing single-column stacked grid renders unchanged (reuses the current
  `≤1024px` rule that already collapses the grid to one column).
- **Two rows**, full-bleed within the projects container:
  - **Row 1** = `projects.slice(0, Math.floor(n/2))` → first 3 of 7. Drifts **right**.
  - **Row 2** = `projects.slice(Math.floor(n/2))` → last 4 of 7. Drifts **left**.
  - The `floor(n/2)` split means row 1 ≤ row 2, and it auto-adapts if projects
    are added/removed later.
- **Card width:** `clamp(440px, 45vw, 720px)` → roughly **two cards visible**,
  with the next peeking in at the edges to signal more content.
- **Gap:** `1.75rem`. Cards reuse the existing glass surface, image wrapper,
  title/description/tech-badge styling.
- **Edge fade:** each row has a horizontal mask
  (`linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent)`) so
  cards melt out at the row's left/right instead of hard-cutting.

## Interaction Model (per-row)

All steering and pausing act **only on the row the cursor is vertically over**;
the other row keeps its idle drift.

| Cursor location (within a row)            | That row's behavior                                  |
|-------------------------------------------|------------------------------------------------------|
| Not over the row / outside the carousel   | Idle drift (row 1 →, row 2 ←)                         |
| Left edge zone (left ~18% of row width)   | Scrolls content rightward; speed ramps with proximity to the edge |
| Right edge zone (right ~18% of row width) | Scrolls content leftward; speed ramps with proximity to the edge  |
| Middle zone                               | Row **pauses** (so the cards are readable)           |

- A small **‹ / ›** arrow indicator lives **inside each row** and fades in only
  in the row being steered, brightening as the cursor nears the edge.
- **Seamless infinite loop:** each row's card set is duplicated enough times to
  always overflow the viewport; the transform offset wraps by exactly one
  set-width so there is no visible reset or empty gap.

### Tunable parameters (constants in `ProjectCarousel`)

| Param          | Value      | Meaning                                            |
|----------------|------------|----------------------------------------------------|
| `BASE`         | ~55 px/s   | Idle drift speed                                   |
| `BASE_REDUCED` | ~15 px/s   | Idle drift under `prefers-reduced-motion`          |
| `MAX_EDGE`     | ~620 px/s  | Max steer speed at the very edge                   |
| `EDGE_FRAC`    | 0.18       | Edge-zone width as a fraction of the row width     |
| card width     | `clamp(440px, 45vw, 720px)` | —                                 |
| gap            | `1.75rem`  | —                                                  |

(Values are starting points from the approved prototype; final tuning during
implementation.)

## Reduced Motion

Under `prefers-reduced-motion: reduce`, the carousel **stays interactive** — the
layout, per-row pause, and edge-steer gestures all work as normal — but the idle
auto-drift is slowed to `BASE_REDUCED` (~15 px/s) instead of stopping. This
honors the user's preference for calmer motion without removing the feature or
the ability to read every card. (Decision: per explicit user direction, we do
NOT fall back to the static grid under reduced motion.)

## Component Structure

```
app/page.tsx
 ├─ projects[]  (unchanged data)
 ├─ <ProjectCarousel projects={projects} />   // desktop, CSS-shown ≥1025px
 └─ <div className={styles.projectsGrid}>      // mobile/tablet, CSS-shown ≤1024px
       {projects.map(p => <ProjectCard ... />)}

components/ProjectCard/ProjectCard.tsx          // extracted from inline markup
components/ProjectCarousel/ProjectCarousel.tsx  // new client component
components/ProjectCarousel/ProjectCarousel.module.css
```

- **`ProjectCard`** — presentational. The current inline card JSX in `page.tsx`
  (link wrapper, image + overlay, title, description, tech badges) is extracted
  here verbatim and used by *both* the grid and the carousel, so the two
  layouts can never drift apart. Accepts the project object plus an optional
  `aria-hidden`/`inert` flag for cloned copies.
- **`ProjectCarousel`** — `"use client"`. Owns:
  - splitting `projects` into the two rows,
  - measuring one set's width and computing the clone count,
  - the `requestAnimationFrame` loop updating each row's `translateX`,
  - pointer tracking, per-row velocity (idle / edge / pause), and arrow hints,
  - `prefers-reduced-motion` detection,
  - `IntersectionObserver` to pause the rAF loop when the section is offscreen.

### Desktop/mobile toggle

The carousel and the grid are **both in the DOM**, toggled by a CSS media query
(`display`), to avoid hydration flash and SSR `matchMedia` issues:

- `.carousel { display: none } @media (min-width:1025px){ .carousel{display:block} .grid{display:none} }`
- `ProjectCarousel` guards its measurement/rAF: it only measures set-width and
  runs the loop when its container is actually visible (`offsetParent !== null`
  / non-zero width), and re-measures on resize (debounced). When hidden on
  mobile the loop is a no-op.

### Seamless-loop sizing algorithm

1. Render one base set of cards per row.
2. Measure the base set width via a ref (`scrollWidth`).
3. `copies = max(2, ceil(containerWidth / setWidth) + 1)`.
4. Render `copies` of the set; wrap offset modulo `setWidth`.
5. Recompute on resize (debounced) since `45vw` card width and viewport change
   the set width and required copy count.

## Accessibility

- **Cloned cards** (every copy beyond the first real set) get `aria-hidden` and
  `inert` so screen-reader and keyboard users encounter each project link only
  once.
- **Keyboard focus** on a real card pauses that card's row (same mechanism as
  hover-pause) so focused content holds still.
- Reduced-motion handled as above (slowed, not removed).
- The `<a>` semantics, `aria-label`s, and tab order of the real card set are
  preserved from the current implementation.

## Performance

- Animation is **transform-only** (`translateX`) with `will-change: transform`,
  so it runs on the compositor.
- The rAF loop is paused by `IntersectionObserver` when the projects section is
  out of view, and never runs on mobile (container hidden).
- Resize handling is debounced.

## Testing / Verification

Manual verification at desktop (`≥1025px`) and mobile (`≤1024px`):

- [ ] Desktop shows two rows; row 1 drifts right, row 2 drifts left; loop is seamless (no jump/gap).
- [ ] Hovering a row's middle pauses **only** that row; the other keeps moving.
- [ ] Edge zones steer **only** the hovered row; speed ramps toward the edge; ‹/› arrow shows in that row.
- [ ] Two cards visible (third peeking) across common desktop widths (1280/1440/1920) with no empty gaps in the loop.
- [ ] `≤1024px` renders the existing single-column stacked cards, unchanged.
- [ ] `prefers-reduced-motion` slows the drift but keeps pause + edge-steer working.
- [ ] Keyboard tab reaches each project once (clones inert); focusing a card pauses its row.
- [ ] Light and dark themes both look correct (glass tokens reused).

## Open Questions

None outstanding. Parameter values (`BASE`, `MAX_EDGE`, `EDGE_FRAC`, speeds) are
final-tunable during implementation against the approved prototype feel.
