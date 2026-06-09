# Dot Grid "Water Blob" Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mouse-following radial glow with an interactive dot-grid "water blob" background whose every visual parameter is live-tunable through a central store.

**Architecture:** A `"use client"` React component (`DotGrid`) renders one fixed full-viewport `<canvas>` at `z-index: 0` and runs a `requestAnimationFrame` loop. Each frame it reads parameters from a framework-agnostic module store (`dotGridStore`) and the active theme from the `body` class, then draws the dot grid. A 6-point follower chain creates the velocity wake; an angular-noise edge makes the blob organic; brightness falls off topographically from the cursor. The store's `getParams`/`setParams`/`subscribe` API is the seam for a future hidden easter-egg panel (deferred).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Canvas 2D, CSS Modules. No test runner is installed; verification is `tsc --noEmit` + `eslint` + `next build` + manual browser checks.

**Spec:** `docs/superpowers/specs/2026-06-08-dot-grid-background-design.md`

**Branch:** `feature/dot-grid-background` (already checked out).

---

## On testing in this plan

The repo has **no test framework** (only `eslint`), and the deliverable is a visual,
interactive canvas effect whose correctness is judged by feel and by integration, not by
pure-logic assertions. Adding Vitest solely for a ~25-line store is scope creep (YAGNI).
Each task is therefore gated by:

- `npx tsc --noEmit` — type correctness
- `npm run lint` — lint/style
- `npm run build` — production build succeeds
- explicit **manual browser checks** with exact expected behavior

If a test runner is added to this repo later, `dotGridStore` is the one unit-testable seam
(`setParams` merge + `subscribe` notification) and a test can be backfilled then.

---

## File Structure

| File | Responsibility |
|---|---|
| `components/DotGrid/dotGridStore.ts` (create) | Types, `DEFAULTS`, and the live param store (`getParams`/`setParams`/`subscribe`). Easter-egg TODO anchor. |
| `components/DotGrid/DotGrid.tsx` (create) | Client component: canvas, sizing/DPR, grid build, pointer ref, follower chain, draw loop, theme color, edge-case guards. |
| `components/DotGrid/DotGrid.module.css` (create) | `.dotCanvas` positioning (fixed, full-viewport, `z-index: 0`, no pointer events). |
| `app/page.tsx` (modify) | Remove the `.mouseHighlight` glow `<div>`; render `<DotGrid />`. Custom cursor untouched. |
| `app/page.module.css` (modify) | Remove the `.mouseHighlight` rule. |

---

## Task 1: Live parameter store

**Files:**
- Create: `components/DotGrid/dotGridStore.ts`

- [ ] **Step 1: Create the store with types, defaults, and API**

Create `components/DotGrid/dotGridStore.ts`:

```ts
// Central, live-tunable parameter store for the DotGrid background effect.
// A plain module singleton — framework-agnostic, no React re-render cost.
// DotGrid.tsx reads getParams() every animation frame; a future hidden
// easter-egg control panel will call setParams() to tweak the live effect.

export type RGB = [number, number, number];

export interface DotGridParams {
	/** Blob size — reveal radius in CSS px. */
	radius: number;
	/** Grid spacing between dots in CSS px. */
	spacing: number;
	/** Irregular-edge amplitude (0 = clean circle, ~0.8 = very wobbly). */
	edgeNoise: number;
	/** Wake / trail length (0 = tight round blob, 1 = long streak). */
	wake: number;
	/** Distortion: how far dots displace away from the cursor, in px. */
	push: number;
	/** Dot growth multiplier near the cursor (1 = no growth). */
	grow: number;
	/** Per-frame ease toward target opacity (lower = longer fade trail). */
	fade: number;
	/** Topographic brightness falloff (0 = even light, 1 = bright core only). */
	falloff: number;
	/** Opacity of dots at rest, outside any blob (0 = hidden). */
	baseOpacity: number;
	/** Dot color on the dark theme. */
	colorDark: RGB;
	/** Dot color on the light theme. */
	colorLight: RGB;
}

export const DEFAULTS: DotGridParams = {
	radius: 365,
	spacing: 24,
	edgeNoise: 0.36,
	wake: 0.6,
	push: 24,
	grow: 3.8,
	fade: 0.28,
	falloff: 0.87,
	baseOpacity: 0,
	colorDark: [245, 235, 225], // cream
	colorLight: [135, 117, 100], // accent #877564
};

// TODO(dotgrid-easter-egg): expose setParams() to a hidden, discoverable control panel
// that tweaks the live effect; trigger + panel UI are TBD — see
// docs/superpowers/specs/2026-06-08-dot-grid-background-design.md §Deferred Work.
// Sibling: components/DotGrid/DotGrid.tsx

let params: DotGridParams = { ...DEFAULTS };
const subscribers = new Set<() => void>();

/** Current parameters. Read fresh each frame by the canvas loop. */
export function getParams(): DotGridParams {
	return params;
}

/** Merge a partial update and notify subscribers. Takes effect next frame. */
export function setParams(partial: Partial<DotGridParams>): void {
	params = { ...params, ...partial };
	subscribers.forEach((cb) => cb());
}

/** Subscribe to parameter changes; returns an unsubscribe function. */
export function subscribe(cb: () => void): () => void {
	subscribers.add(cb);
	return () => {
		subscribers.delete(cb);
	};
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/DotGrid/dotGridStore.ts
git commit -m "$(cat <<'EOF'
feat(dotgrid): add live-tunable parameter store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: DotGrid canvas component

**Files:**
- Create: `components/DotGrid/DotGrid.module.css`
- Create: `components/DotGrid/DotGrid.tsx`

- [ ] **Step 1: Create the CSS module**

Create `components/DotGrid/DotGrid.module.css`:

```css
.dotCanvas {
	position: fixed;
	inset: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
	pointer-events: none;
}
```

- [ ] **Step 2: Create the component**

Create `components/DotGrid/DotGrid.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import styles from "./DotGrid.module.css";
import { getParams, setParams } from "./dotGridStore";

interface Follower {
	x: number;
	y: number;
}
interface Dot {
	x: number;
	y: number;
	a: number; // current eased opacity
}

const FOLLOWER_COUNT = 6;
const HEAD_EASE = 0.35; // how fast the head follower tracks the pointer
const DOT_BASE_RADIUS = 1.1; // px, before growth
const MAX_DPR = 2;

function smoothstep(t: number): number {
	return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

// Cheap angular pseudo-noise (sum of sines) that evolves over time, giving the
// blob an irregular, wobbling, organic edge instead of a clean circle.
function edgeNoise(angle: number, t: number): number {
	return Math.sin(angle * 3 + t) * 0.5 + Math.sin(angle * 5 - t * 1.3 + 1.7) * 0.3 + Math.sin(angle * 2 + t * 0.6 + 4.1) * 0.2;
}

export default function DotGrid() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Disable on reduced-motion and on devices without a fine pointer (touch),
		// matching how the custom cursor is already disabled on mobile.
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const finePointer = window.matchMedia("(pointer: fine)").matches;
		if (reduceMotion || !finePointer) return;

		const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		let dots: Dot[] = [];
		const followers: Follower[] = Array.from({ length: FOLLOWER_COUNT }, () => ({ x: -9999, y: -9999 }));
		const mouse = { x: -9999, y: -9999 };

		const buildGrid = () => {
			dots = [];
			const { spacing } = getParams();
			for (let y = spacing * 0.5; y < window.innerHeight; y += spacing) {
				for (let x = spacing * 0.5; x < window.innerWidth; x += spacing) {
					dots.push({ x, y, a: 0 });
				}
			}
		};

		const resize = () => {
			canvas.width = Math.floor(window.innerWidth * dpr);
			canvas.height = Math.floor(window.innerHeight * dpr);
			canvas.style.width = `${window.innerWidth}px`;
			canvas.style.height = `${window.innerHeight}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			buildGrid();
		};

		const onMouseMove = (e: MouseEvent) => {
			mouse.x = e.clientX;
			mouse.y = e.clientY;
		};
		const onMouseLeave = () => {
			mouse.x = -9999;
			mouse.y = -9999;
		};

		let rafId = 0;

		const frame = (ts: number) => {
			const t = ts * 0.001;
			const p = getParams();
			const isDark = document.body.classList.contains("dark");
			const [cr, cg, cb] = isDark ? p.colorDark : p.colorLight;

			ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

			// Initialize the follower chain to the pointer on first real frame.
			if (followers[0].x < -9000) {
				for (const f of followers) {
					f.x = mouse.x;
					f.y = mouse.y;
				}
			}
			// Head tracks the pointer; each tail follower trails the previous one.
			// Higher wake => smaller tailEase => longer streak when moving fast.
			followers[0].x += (mouse.x - followers[0].x) * HEAD_EASE;
			followers[0].y += (mouse.y - followers[0].y) * HEAD_EASE;
			const tailEase = 0.55 - p.wake * 0.42;
			for (let i = 1; i < FOLLOWER_COUNT; i++) {
				followers[i].x += (followers[i - 1].x - followers[i].x) * tailEase;
				followers[i].y += (followers[i - 1].y - followers[i].y) * tailEase;
			}

			const R = p.radius;
			const head = followers[0];
			const tailFloor = 1 - p.falloff * 0.9;

			for (const d of dots) {
				// Soft union over followers: reveal = 1 - prod(1 - f_i).
				let inv = 1;
				for (let i = 0; i < FOLLOWER_COUNT; i++) {
					const f = followers[i];
					const dx = d.x - f.x;
					const dy = d.y - f.y;
					const dist = Math.hypot(dx, dy);
					const angle = Math.atan2(dy, dx);
					// Taper radius down the tail so the wake forms a teardrop;
					// modulate by angular noise for the irregular edge.
					const ri = R * (1 - 0.1 * i) * (1 + p.edgeNoise * edgeNoise(angle, t));
					if (dist < ri) {
						inv *= 1 - smoothstep(1 - dist / ri);
					}
				}
				const reveal = 1 - inv;

				// Topographic brightness: peak under the cursor head, dim outward.
				const distHead = Math.hypot(d.x - head.x, d.y - head.y);
				const headProx = smoothstep(1 - distHead / R);
				const target = Math.max(p.baseOpacity, reveal * (tailFloor + (1 - tailFloor) * headProx));

				let ox = 0;
				let oy = 0;
				let grow = 1;
				if (target > 0.01) {
					const dist = distHead || 0.0001;
					const force = p.push * (reveal > p.baseOpacity ? reveal : 0);
					ox = ((d.x - head.x) / dist) * force;
					oy = ((d.y - head.y) / dist) * force;
					grow = 1 + (p.grow - 1) * target;
				}

				// Ease toward target for the trailing fade.
				d.a += (target - d.a) * p.fade;
				if (d.a < 0.002) continue;

				ctx.beginPath();
				ctx.arc(d.x + ox, d.y + oy, DOT_BASE_RADIUS * grow, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(${cr},${cg},${cb},${d.a})`;
				ctx.fill();
			}

			rafId = requestAnimationFrame(frame);
		};

		const start = () => {
			if (!rafId) rafId = requestAnimationFrame(frame);
		};
		const stop = () => {
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
		};
		const onVisibility = () => {
			if (document.hidden) stop();
			else start();
		};

		resize();
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseleave", onMouseLeave);
		window.addEventListener("resize", resize);
		document.addEventListener("visibilitychange", onVisibility);
		start();

		// Dev-only console bridge so the live params can be tuned before the
		// easter-egg panel exists (e.g. `window.dotGrid.setParams({ radius: 120 })`).
		// TODO(dotgrid-easter-egg): live param reads already flow through getParams();
		// the panel will call setParams() — anchor: components/DotGrid/dotGridStore.ts
		if (process.env.NODE_ENV !== "production") {
			(window as unknown as { dotGrid?: unknown }).dotGrid = { getParams, setParams };
		}

		return () => {
			stop();
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseleave", onMouseLeave);
			window.removeEventListener("resize", resize);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, []);

	return <canvas ref={canvasRef} className={styles.dotCanvas} aria-hidden="true" />;
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors for `components/DotGrid/*`.

- [ ] **Step 4: Commit**

```bash
git add components/DotGrid/DotGrid.tsx components/DotGrid/DotGrid.module.css
git commit -m "$(cat <<'EOF'
feat(dotgrid): add canvas component for water-blob effect

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Integrate into the page (replace the glow)

**Files:**
- Modify: `app/page.tsx` (import + replace the `.mouseHighlight` div)
- Modify: `app/page.module.css` (remove the `.mouseHighlight` rule, lines ~11-20)

- [ ] **Step 1: Import DotGrid in `app/page.tsx`**

Find the existing import block (around line 11-12):

```tsx
import Navbar from "@/components/NavBar/Navbar";
import Footer from "@/components/Footer/Footer";
```

Replace with:

```tsx
import Navbar from "@/components/NavBar/Navbar";
import Footer from "@/components/Footer/Footer";
import DotGrid from "@/components/DotGrid/DotGrid";
```

- [ ] **Step 2: Replace the glow div with `<DotGrid />`**

Find this block in the returned JSX (around lines 217-222):

```tsx
			<div
				className={styles.mouseHighlight}
				style={{
					background: isDark ? `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(245, 235, 225, 0.15), transparent 80%)` : `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(135, 117, 100, 0.35), transparent 80%)`,
				}}
			/>
```

Replace the entire block with:

```tsx
			<DotGrid />
```

Leave the `customCursor` div and everything else unchanged. (`mousePosition` is still
used by the custom cursor, so keep its state and the page's `mousemove` handler.)

- [ ] **Step 3: Remove the `.mouseHighlight` rule from `app/page.module.css`**

Delete this rule (around lines 11-20):

```css
.mouseHighlight {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	z-index: 0;
	transition: background 0.1s ease;
}
```

- [ ] **Step 4: Typecheck, lint, and build**

Run: `npx tsc --noEmit`
Expected: no errors. (In particular, `isDark` is still referenced by the theme toggle, so no "unused variable" error should appear; if your linter flags `mousePosition` usage, confirm the custom cursor still reads it.)

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build completes successfully.

- [ ] **Step 5: Manual browser check**

Run: `npm run dev`, open `http://localhost:3000`.

Verify:
- The old radial glow is gone; instead, moving the mouse reveals a grid of dots in an organic blob around the cursor.
- Dragging fast produces a trailing wake; slowing down relaxes it to a rounder blob; leaving an area fades the dots out.
- Dots are brightest directly under the cursor and dim toward the edges/wake (topographic).
- The custom hand cursor still renders, on top of the effect, and still swaps icons on hover/click.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/page.module.css
git commit -m "$(cat <<'EOF'
feat(dotgrid): replace mouse glow with dot-grid background

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Full verification pass (manual, no code)

No code changes. With `npm run dev` running at `http://localhost:3000`, confirm each
acceptance criterion from the spec.

- [ ] **Theme:** Toggle to light mode. Dots switch from cream to accent (`#877564`) and
  remain visible on the `#f5ebe1` background. Toggle back to dark — dots are cream again.
  (If the accent reads too faint on light, note it for a follow-up; the value lives in
  `DEFAULTS.colorLight`.)

- [ ] **Reduced motion:** In DevTools, emulate `prefers-reduced-motion: reduce`
  (Rendering tab → "Emulate CSS media feature prefers-reduced-motion"). Reload. The dot
  effect does not render and there are no console errors. (The page background is the plain
  theme color.)

- [ ] **Touch / coarse pointer:** In DevTools, toggle device toolbar to a mobile device
  (coarse pointer) and reload. The dot effect does not render; no console errors.

- [ ] **Tab visibility:** Switch to another tab for a few seconds, then return. The effect
  resumes smoothly (the loop paused while hidden).

- [ ] **Live tuning bridge:** In the console run
  `window.dotGrid.setParams({ radius: 120 })`. The blob shrinks immediately with no reload.
  Run `window.dotGrid.setParams({ spacing: 40 })` — note that spacing changes apply to
  newly built grids (trigger by resizing the window); the radius/opacity params apply
  instantly. Restore with `window.dotGrid.setParams(window.dotGrid.getParams())` or reload.

- [ ] **Resize:** Resize the browser window. The grid rebuilds to fill the new viewport
  with no visual breakage.

If all checks pass, the feature is complete. If any fail, fix inline and re-run the
relevant check before finishing the branch.

---

## Notes for the executor

- **Spacing changes need a grid rebuild.** `buildGrid()` runs on mount and on `resize`.
  A live `spacing` change via `setParams` only takes effect on the next rebuild — this is
  acceptable for now (the future panel can call a rebuild). Do not add a per-frame rebuild;
  it would thrash. All other params are read per frame and apply instantly.
- **Do not touch the custom cursor.** It has its own `mousePosition` React state and
  `mousemove` handler in `app/page.tsx`. `DotGrid` deliberately uses its own ref-based
  pointer listener so pointer movement never re-renders the page.
- **`isDark` stays in `page.tsx`** — it still drives the theme toggle and body class; the
  canvas reads the resulting `body.dark` / `body.light` class directly each frame.
