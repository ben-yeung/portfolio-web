# Liquid Glass Navbar — Design

**Date:** 2026-06-08
**Component:** `components/NavBar/Navbar.tsx`, `components/NavBar/Navbar.module.css`, `app/globals.css`

## Problem

The navbar reads as flat. Despite looking like a floating glass pill, its actual
styling (in `app/globals.css` under `body.dark nav` / `body.light nav`) is a fully
**opaque** pill whose background exactly matches the page background (`#18181b` dark,
`#f5ebe1` light), with only a 1px border and a faint shadow. There is no transparency
and no blur, so it never reads as glass.

## Goal

Make the navbar feel like genuine liquid glass — translucent, blurring/refracting
content that scrolls behind it, with a light-catching edge — while staying minimalist
and cheap to render.

## Decisions (settled during brainstorming)

- **Treatment:** Liquid glass (specular) — frosted blur plus a bright top edge that
  catches light. Chosen over plain frosted and heavier tinted-gradient variants.
- **Light-mode surface:** subtly **warm-tinted** (pulls in the `#877564` accent) rather
  than neutral white, to match the character of the dark surface. "Subtle" intensity.
- **Edge:** gradient-lit border (brightest top-left), applied in **both** themes.
- **Scroll:** always-on `backdrop-filter` — it genuinely blurs/refracts whatever scrolls
  behind it. No scroll listener, no reactive intensity change.
- **Hover:** the growing underline is replaced by a soft **glass pill highlight** that
  fades in behind the hovered item.

## Surface specification

### Dark mode
- background: `linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.02))`
- `backdrop-filter: blur(18px) saturate(170%)` (+ `-webkit-` prefix)
- shadow: `0 8px 32px rgba(0,0,0,.32)`, inset top `inset 0 1px 0 rgba(255,255,255,.30)`,
  inset bottom `inset 0 -1px 0 rgba(0,0,0,.15)`

### Light mode
- surface tint: `linear-gradient(180deg, rgba(245,235,225,.6), rgba(135,117,100,.14))`
- `backdrop-filter: blur(18px) saturate(150%)` (+ `-webkit-` prefix)
- shadow: `0 8px 30px rgba(0,0,0,.12)`, inset top `inset 0 1px 1px rgba(255,255,255,.7)`

### Gradient-lit border (both modes)
Implemented with the two-layer `background-clip` technique so a gradient wraps the border:

```css
border: 1px solid transparent;
background-image:
  <surface-gradient>,                    /* painted in padding box */
  <edge-gradient>;                       /* painted in border box  */
background-origin: border-box;
background-clip: padding-box, border-box;
```

- Light edge gradient: `linear-gradient(150deg, rgba(255,255,255,.95), rgba(255,255,255,.15) 45%, rgba(135,117,100,.25))`
- Dark edge gradient: `linear-gradient(150deg, rgba(255,255,255,.50), rgba(255,255,255,.10) 45%, rgba(255,255,255,.05))`

## Hover: glass pill highlight

- Replace the current `.navItem::after` underline with a `.navItem::before` pill:
  absolutely positioned, inset to roughly the item bounds, `border-radius` matching the
  rounded look, translucent fill (`rgba(255,255,255,.10)` dark / `rgba(255,255,255,.45)`
  light), `opacity: 0` → `1` on `:hover`, short ease transition.
- Text sits above the pill (`position: relative; z-index: 1` on the label / pill behind).
- Remove the `body.light nav a::after` accent-underline override (no longer applies).

## Architecture

- **`app/globals.css`** — replace the existing `body.dark nav` and `body.light nav` flat
  rules with the glass surface + gradient-border + shadow specs above. Remove
  `body.light nav a::after`. Keep using the existing theme-class scoping (`body.dark` /
  `body.light`) and `!important` only where needed to match current specificity.
- **`components/NavBar/Navbar.module.css`** — keep structural layout (fixed position,
  size, radius, flex, responsive breakpoints). Swap the `::after` underline for the
  `::before` hover pill geometry. The pill's translucent fill colors are theme-specific,
  so the color values live in `globals.css` (`body.dark`/`body.light` scoped); the module
  owns only geometry.
- **`components/NavBar/Navbar.tsx`** — no markup or logic changes. The scroll-to-section
  handler and framer-motion entrance animation are untouched.

## Fallback

Wrap a more-opaque background for browsers without backdrop-filter:

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  /* raise surface alpha so text stays legible without the blur */
}
```

## Performance

One fixed, small element with a single `backdrop-filter`. No JavaScript, no scroll
listeners, no React re-renders. The blur cost is bounded to the pill's footprint.

## Out of scope

- No changes to the entrance animation, nav items, or scroll behavior JS.
- No new dependencies.
- No mobile-menu / hamburger rework — responsive breakpoints stay as-is.
