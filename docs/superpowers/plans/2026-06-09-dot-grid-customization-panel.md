# Dot Grid Customization Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed bottom-right gear button (a twin of the top-right theme toggle) that opens an anchored liquid-glass popover with six sliders for live-tuning the DotGrid background.

**Architecture:** A new `"use client"` `DotControls` component renders the button + popover and is the sole UI writer to the existing `dotGridStore` (`getParams`/`setParams`). A shared `canRender.ts` guard hides both the canvas and the controls on touch-only devices. `DotGrid` gains a `subscribe`-driven grid rebuild so the live `spacing` slider takes effect immediately; all other params already apply per frame.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, framer-motion (already a dep), react-icons (already a dep), CSS Modules. No test runner is installed; gates are `tsc --noEmit` + `eslint` + `next build` + manual browser checks.

**Spec:** `docs/superpowers/specs/2026-06-09-dot-grid-customization-panel-design.md`

**Branch:** `feature/dot-grid-controls` (already checked out).

---

## On testing in this plan

Same stance as the dot-grid plan: the repo has **no test framework** (only `eslint`), and the
deliverable is a visual, interactive control surface judged by feel and integration. Adding a
runner for this is scope creep (YAGNI). Each task is gated by:

- `npx tsc --noEmit` — type correctness
- `npm run lint` — lint/style
- `npm run build` — production build succeeds (run on integration tasks)
- explicit **manual browser checks** with exact expected behavior

The one pure-logic seam (`dotGridStore`) already exists and is unit-testable if a runner is
added later; this plan adds only UI + a `subscribe` wiring, neither of which is worth a bespoke
harness.

---

## File Structure

| File | Responsibility |
|---|---|
| `components/DotGrid/canRender.ts` (create) | Single `dotGridSupported()` predicate — the touch-only render gate shared by the canvas and the controls. |
| `components/DotGrid/DotControls.module.css` (create) | Button (base circle/position, mirrors `.themeToggle`), glass popover, slider + reset styling, responsive shrink. |
| `components/DotGrid/DotControls.tsx` (create) | Client component: button + anchored popover, slider state seeded from `getParams()`, `setParams` on input, open/close + Esc + click-outside, Reset. |
| `components/DotGrid/DotGrid.tsx` (modify) | Swap inline touch-only check for `dotGridSupported()`; `subscribe()` and rebuild the grid when `spacing` changes; retire the `dotgrid-easter-egg` TODO. |
| `components/DotGrid/dotGridStore.ts` (modify) | Retire the `dotgrid-easter-egg` TODO anchor; note the panel now exists; add a `dotgrid-advanced-controls` forward TODO. |
| `app/page.tsx` (modify) | Import and render `<DotControls />`. |

The button reuses the **global** `.themeToggle` class (`app/globals.css`) for its themed border
ring + color; the module class only supplies the base circle, bottom-right position, and svg
size. The panel reuses the shared liquid-glass tokens (`--glass-surface`, `--glass-edge`,
`--glass-inset`) and theme color tokens (`--text-primary`, `--accent-color`) so it matches the
navbar/cards and is automatically theme-aware (no per-theme selectors needed).

---

## Task 1: Shared render-gate module

**Files:**
- Create: `components/DotGrid/canRender.ts`

- [ ] **Step 1: Create the guard**

Create `components/DotGrid/canRender.ts`:

```ts
// Single source of truth for whether the DotGrid effect (and its controls) should run.
// The canvas is disabled only on true touch-only devices — the same media query that hides
// the custom cursor in app/page.module.css. Reduced-motion is deliberately NOT a gate: the
// canvas keeps the full fluid blob and only zeroes the dot displacement (push), so the
// controls should still appear and tune it.
export function dotGridSupported(): boolean {
	if (typeof window === "undefined" || !window.matchMedia) return false;
	return !window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/DotGrid/canRender.ts
git commit -m "$(cat <<'EOF'
feat(dotgrid): add shared touch-only render gate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire DotGrid to the shared gate + live spacing rebuild

**Files:**
- Modify: `components/DotGrid/DotGrid.tsx`

- [ ] **Step 1: Import the shared gate and `subscribe`**

In `components/DotGrid/DotGrid.tsx`, replace the import on line 5:

```tsx
import { getParams, setParams } from "./dotGridStore";
```

with:

```tsx
import { getParams, setParams, subscribe } from "./dotGridStore";
import { dotGridSupported } from "./canRender";
```

- [ ] **Step 2: Use the shared gate**

Replace the touch-only guard block (currently lines ~41-46):

```tsx
		// Disable entirely only on true touch-only devices — the same media query
		// that hides the custom cursor (app/page.module.css). Under reduced-motion we
		// do NOT disable; frame() keeps the full fluid blob + wake but turns off the
		// dot displacement (push) so nothing flies around.
		const isTouchOnly = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
		if (isTouchOnly) return;
```

with:

```tsx
		// Disable entirely only on true touch-only devices — shared with DotControls via
		// dotGridSupported(). Under reduced-motion we do NOT disable; frame() keeps the full
		// fluid blob + wake but turns off the dot displacement (push) so nothing flies around.
		if (!dotGridSupported()) return;
```

Leave the `const reduceMotion = ...` line directly below it unchanged.

- [ ] **Step 3: Track the spacing the grid was last built with**

Find the `let dots: Dot[] = [];` line (currently line ~50) and add a `lastSpacing` tracker
directly after it:

```tsx
		let dots: Dot[] = [];
		let lastSpacing = 0;
```

Then update `buildGrid` (currently lines ~54-62) to record it:

```tsx
		const buildGrid = () => {
			dots = [];
			const { spacing } = getParams();
			lastSpacing = spacing;
			for (let y = spacing * 0.5; y < window.innerHeight; y += spacing) {
				for (let x = spacing * 0.5; x < window.innerWidth; x += spacing) {
					dots.push({ x, y, a: 0 });
				}
			}
		};
```

- [ ] **Step 4: Rebuild the grid when `spacing` changes**

Find the `start();` call near the end of the effect (currently line ~187). Immediately after
it, add a store subscription:

```tsx
		start();

		// Live spacing changes (from DotControls) need a grid rebuild; every other param is
		// read per frame by the draw loop. subscribe() fires on each setParams().
		const unsubscribe = subscribe(() => {
			if (getParams().spacing !== lastSpacing) buildGrid();
		});
```

- [ ] **Step 5: Retire the easter-egg TODO on the dev bridge**

Replace the dev-bridge comment block (currently lines ~189-192):

```tsx
			// Dev-only console bridge so the live params can be tuned before the
			// easter-egg panel exists (e.g. `window.dotGrid.setParams({ radius: 120 })`).
			// TODO(dotgrid-easter-egg): live param reads already flow through getParams();
			// the panel will call setParams() — anchor: components/DotGrid/dotGridStore.ts
```

with:

```tsx
			// Dev-only console bridge for tuning the params the DotControls panel doesn't
			// surface (push / fade / falloff / colors), e.g. window.dotGrid.setParams({ push: 0 }).
			// TODO(dotgrid-advanced-controls): a panel "advanced" section could replace this —
			// anchor: components/DotGrid/dotGridStore.ts
```

- [ ] **Step 6: Unsubscribe on cleanup**

In the effect's cleanup `return () => { ... }` (currently lines ~197-206), add `unsubscribe();`
immediately after `stop();`:

```tsx
		return () => {
			stop();
			unsubscribe();
			window.removeEventListener("mousemove", onMouseMove);
			document.documentElement.removeEventListener("mouseleave", onMouseLeave);
			window.removeEventListener("resize", resize);
			document.removeEventListener("visibilitychange", onVisibility);
			if (process.env.NODE_ENV !== "production") {
				delete (window as unknown as { dotGrid?: unknown }).dotGrid;
			}
		};
```

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors for `components/DotGrid/*`.

- [ ] **Step 8: Commit**

```bash
git add components/DotGrid/DotGrid.tsx
git commit -m "$(cat <<'EOF'
feat(dotgrid): share render gate and rebuild grid on live spacing change

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: DotControls styles

**Files:**
- Create: `components/DotGrid/DotControls.module.css`

- [ ] **Step 1: Create the CSS module**

Create `components/DotGrid/DotControls.module.css`:

```css
/* Floating "customize background" button — a bottom-right twin of the theme toggle.
   The themed border ring + color come from the global `.themeToggle` class (app/globals.css),
   reused on the button; this module supplies the base circle, position, and svg size. */
.controlsToggle {
	position: fixed;
	bottom: 2.25rem;
	right: 2rem;
	width: 3rem;
	height: 3rem;
	border-radius: 50%;
	background: transparent;
	cursor: none;
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
}

.controlsToggle svg {
	width: 1.5rem;
	height: 1.5rem;
}

/* Anchored glass popover, sitting just above the button (button is 3rem tall at bottom 2.25rem,
   + ~0.75rem gap). Reuses the shared liquid-glass tokens so it matches the navbar/cards and is
   theme-aware automatically. */
.panel {
	position: fixed;
	right: 2rem;
	bottom: 6rem;
	width: 220px;
	padding: 0.9rem 1rem;
	border-radius: 14px;
	background-image: var(--glass-surface), var(--glass-edge);
	background-origin: border-box;
	background-clip: padding-box, border-box;
	border: 1px solid transparent;
	-webkit-backdrop-filter: blur(12px) saturate(160%);
	backdrop-filter: blur(12px) saturate(160%);
	box-shadow: 0 8px 30px rgba(0, 0, 0, 0.28), var(--glass-inset);
	color: var(--text-primary);
	cursor: none;
	z-index: 1001;
	transform-origin: bottom right;
}

.panelHeader {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 0.75rem;
}

.panelTitle {
	font-size: 0.7rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	opacity: 0.85;
}

.resetButton {
	background: transparent;
	border: none;
	color: var(--accent-color);
	font-size: 0.7rem;
	cursor: none;
	padding: 0;
}

.resetButton:hover {
	text-decoration: underline;
}

.row {
	display: block;
	margin: 0.6rem 0;
}

.rowLabel {
	display: flex;
	justify-content: space-between;
	font-size: 0.72rem;
	opacity: 0.8;
	margin-bottom: 0.3rem;
}

.rowValue {
	opacity: 0.7;
	font-variant-numeric: tabular-nums;
}

.slider {
	width: 100%;
	accent-color: var(--accent-color);
	cursor: none;
}

/* Mirror the theme toggle's responsive shrink (app/page.module.css @media max-width:768px). */
@media (max-width: 768px) {
	.controlsToggle {
		bottom: 1.25rem;
		right: 1.5rem;
		width: 2.5rem;
		height: 2.5rem;
	}

	.controlsToggle svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.panel {
		right: 1.5rem;
		bottom: 4.5rem;
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add components/DotGrid/DotControls.module.css
git commit -m "$(cat <<'EOF'
feat(dotgrid): add styles for the customization button and glass popover

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: DotControls component

**Files:**
- Create: `components/DotGrid/DotControls.tsx`

- [ ] **Step 1: Create the component**

Create `components/DotGrid/DotControls.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HiOutlineAdjustmentsHorizontal } from "react-icons/hi2";
import styles from "./DotControls.module.css";
import { getParams, setParams, DEFAULTS, type DotGridParams } from "./dotGridStore";
import { dotGridSupported } from "./canRender";

// The curated, "feelable" subset of params surfaced as sliders. All are numeric (the RGB
// color params and the technical push/fade/falloff are intentionally left to the dev bridge).
type NumericKey = "radius" | "spacing" | "edgeNoise" | "wake" | "grow" | "baseOpacity";

interface SliderDef {
	key: NumericKey;
	label: string;
	min: number;
	max: number;
	step: number;
	decimals: number;
}

const SLIDERS: SliderDef[] = [
	{ key: "radius", label: "Radius", min: 50, max: 700, step: 5, decimals: 0 },
	{ key: "spacing", label: "Spacing", min: 12, max: 60, step: 2, decimals: 0 },
	{ key: "edgeNoise", label: "Edge noise", min: 0, max: 0.8, step: 0.02, decimals: 2 },
	{ key: "wake", label: "Wake", min: 0, max: 1, step: 0.02, decimals: 2 },
	{ key: "grow", label: "Grow", min: 1, max: 6, step: 0.1, decimals: 1 },
	{ key: "baseOpacity", label: "Base opacity", min: 0, max: 0.5, step: 0.01, decimals: 2 },
];

type SliderValues = Record<NumericKey, number>;

// Snapshot the six surfaced params from the store into local slider state.
function readValues(): SliderValues {
	const p = getParams();
	return {
		radius: p.radius,
		spacing: p.spacing,
		edgeNoise: p.edgeNoise,
		wake: p.wake,
		grow: p.grow,
		baseOpacity: p.baseOpacity,
	};
}

export default function DotControls() {
	// Resolved on mount only — matchMedia is client-only, so we start false (matching SSR)
	// and flip to true after hydration to avoid a mismatch.
	const [supported, setSupported] = useState(false);
	const [open, setOpen] = useState(false);
	const [values, setValues] = useState<SliderValues>(() => readValues());
	const panelRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		setSupported(dotGridSupported());
	}, []);

	// While open: close on Escape or a pointerdown outside both the panel and the button.
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as Node;
			if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
			setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [open]);

	if (!supported) return null;

	const handleChange = (key: NumericKey, raw: string) => {
		const value = Number(raw);
		setValues((v) => ({ ...v, [key]: value }));
		setParams({ [key]: value } as Partial<DotGridParams>);
	};

	const handleReset = () => {
		setParams(DEFAULTS);
		setValues(readValues());
	};

	const handleToggle = () => {
		// Re-seed from the store on open in case the dev console bridge changed params.
		if (!open) setValues(readValues());
		setOpen((o) => !o);
	};

	return (
		<>
			<motion.button
				ref={buttonRef}
				type="button"
				className={`${styles.controlsToggle} themeToggle`}
				onClick={handleToggle}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.5 }}
				whileHover={{ scale: 1.1 }}
				whileTap={{ scale: 0.9 }}
				aria-label="Customize background"
				aria-expanded={open}
			>
				<HiOutlineAdjustmentsHorizontal />
			</motion.button>

			<AnimatePresence>
				{open && (
					<motion.div
						ref={panelRef}
						className={styles.panel}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						transition={{ duration: 0.18, ease: "easeOut" }}
						role="dialog"
						aria-label="Dot grid settings"
					>
						<div className={styles.panelHeader}>
							<span className={styles.panelTitle}>Dot Grid</span>
							<button type="button" className={styles.resetButton} onClick={handleReset}>
								Reset
							</button>
						</div>
						{SLIDERS.map((s) => (
							<label key={s.key} className={styles.row}>
								<span className={styles.rowLabel}>
									<span>{s.label}</span>
									<span className={styles.rowValue}>{values[s.key].toFixed(s.decimals)}</span>
								</span>
								<input type="range" className={styles.slider} min={s.min} max={s.max} step={s.step} value={values[s.key]} onChange={(e) => handleChange(s.key, e.target.value)} />
							</label>
						))}
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors. (In particular `HiOutlineAdjustmentsHorizontal` resolves from
`react-icons/hi2`, and `values[s.key]` is `number` because `s.key` is `NumericKey`.)

Run: `npm run lint`
Expected: no errors for `components/DotGrid/*`.

- [ ] **Step 3: Commit**

```bash
git add components/DotGrid/DotControls.tsx
git commit -m "$(cat <<'EOF'
feat(dotgrid): add DotControls button and slider popover

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Integrate into the page + retire the store TODO anchor

**Files:**
- Modify: `app/page.tsx` (import + render `<DotControls />`)
- Modify: `components/DotGrid/dotGridStore.ts` (retire `dotgrid-easter-egg` anchor)

- [ ] **Step 1: Import DotControls in `app/page.tsx`**

Find the DotGrid import (line 13):

```tsx
import DotGrid from "@/components/DotGrid/DotGrid";
```

Add the DotControls import directly below it:

```tsx
import DotGrid from "@/components/DotGrid/DotGrid";
import DotControls from "@/components/DotGrid/DotControls";
```

- [ ] **Step 2: Render `<DotControls />`**

Find `<DotGrid />` in the returned JSX (currently line ~218) and add `<DotControls />`
immediately after it:

```tsx
			<DotGrid />
			<DotControls />
```

Leave the custom cursor and theme toggle untouched. (No change is needed for the custom
cursor: the page's global `mousemove` handler already treats `<button>` and `<input>` as
clickable, so the hand cursor swaps over the button and sliders automatically.)

- [ ] **Step 3: Retire the `dotgrid-easter-egg` TODO in the store**

In `components/DotGrid/dotGridStore.ts`, replace the TODO block (currently lines ~47-50):

```ts
// TODO(dotgrid-easter-egg): expose setParams() to a hidden, discoverable control panel
// that tweaks the live effect; trigger + panel UI are TBD — see
// docs/superpowers/specs/2026-06-08-dot-grid-background-design.md §Deferred Work.
// Sibling: components/DotGrid/DotGrid.tsx
```

with:

```ts
// The live control panel now exists: components/DotGrid/DotControls.tsx surfaces a curated
// subset of these params (radius, spacing, edgeNoise, wake, grow, baseOpacity). The technical
// params (push, fade, falloff) and the dot colors are intentionally left off the panel — tune
// them via the dev-only window.dotGrid console bridge.
// Spec: docs/superpowers/specs/2026-06-09-dot-grid-customization-panel-design.md
// TODO(dotgrid-advanced-controls): optionally surface push/fade/falloff + color pickers behind
// an "advanced" disclosure in the panel. Siblings: components/DotGrid/DotControls.tsx,
// components/DotGrid/DotGrid.tsx
```

- [ ] **Step 4: Verify no stale easter-egg references remain**

Run: `grep -rn "dotgrid-easter-egg" components app docs`
Expected: no matches (all three former sites — store, DotGrid.tsx, and any plan text — are
now retired; the only TODO slug left for this area is `dotgrid-advanced-controls`).

- [ ] **Step 5: Typecheck, lint, and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build completes successfully.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/DotGrid/dotGridStore.ts
git commit -m "$(cat <<'EOF'
feat(dotgrid): mount DotControls and retire the easter-egg TODO

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Full verification pass (manual, no code)

No code changes. With `npm run dev` running at `http://localhost:3000`, confirm each
acceptance criterion from the spec.

- [ ] **Button placement & style:** A gear/sliders button appears at the bottom-right, the same
  size and distance-from-edge as the top-right theme toggle, with the same themed border ring
  and color in both light and dark mode. It fades in like the toggle.

- [ ] **Open/close:** Clicking the button opens the glass popover above it (scale+fade in).
  Clicking the button again closes it. Pressing **Escape** closes it. Clicking anywhere
  outside the popover (but not the button) closes it.

- [ ] **Live sliders:** With the popover open, drag each slider and watch the background:
  - **Radius** — blob grows/shrinks instantly.
  - **Spacing** — the dot grid visibly re-lays at the new density immediately (no window
    resize needed).
  - **Edge noise** — blob edge goes from clean to wobbly.
  - **Wake** — trailing streak lengthens/shortens as you move the mouse.
  - **Grow** — dots near the cursor swell more/less.
  - **Base opacity** — at-rest dots fade in across the whole viewport.
  Each slider's numeric readout updates as you drag.

- [ ] **Reset:** Click **Reset**. All sliders snap back to defaults (radius 365, spacing 24,
  edge 0.36, wake 0.6, grow 3.8, base opacity 0.00) and the background returns to its default
  look.

- [ ] **Theme:** Toggle light/dark. The button and popover restyle to match (glass tint, border,
  text color) and stay legible on both backgrounds.

- [ ] **Custom cursor:** The custom hand cursor still renders over the button and over the
  sliders, swapping to the pointer/fist as usual; no OS cursor appears.

- [ ] **Touch-only device:** In DevTools, toggle the device toolbar to a mobile device (coarse
  pointer) and reload. Neither the button nor the popover render (matching the canvas being
  disabled). No console errors.

- [ ] **Reduced motion:** In DevTools, emulate `prefers-reduced-motion: reduce` and reload. The
  button and popover **still** render, and the sliders still tune the (push-disabled) effect.
  No console errors.

- [ ] **Resize:** With the popover open, resize the window. The grid rebuilds to fill the new
  viewport; the popover stays anchored at the bottom-right; no visual breakage.

If all checks pass, the feature is complete. If any fail, fix inline and re-run the relevant
check before finishing the branch.

---

## Notes for the executor

- **Reduced-motion is NOT a render gate.** The canvas keeps running under reduced-motion (it
  only zeroes `push`), so `dotGridSupported()` checks *touch-only* (`(hover: none) and
  (pointer: coarse)`) and nothing else. Do not add a reduced-motion check to the gate.
- **The button reuses the global `themeToggle` class** (`app/globals.css`) for its themed
  border + color — that is intentional and is why `DotControls.module.css` does not set a
  border. Keep both class names on the button: `` `${styles.controlsToggle} themeToggle` ``.
- **Spacing is the only param needing a rebuild.** It is handled by the `subscribe` wiring in
  `DotGrid.tsx`; every other slider is read per frame by the draw loop. Do not add a per-frame
  rebuild — it would thrash.
- **Session-only by design.** No `localStorage`; a reload returns to `DEFAULTS`. This was an
  explicit product decision in the spec.
- **Do not touch the custom cursor or the theme toggle.** `DotControls` is additive.
```
