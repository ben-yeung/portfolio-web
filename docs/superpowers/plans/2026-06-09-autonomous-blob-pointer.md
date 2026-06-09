# Autonomous Blob Pointer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive the dot-grid background with an autonomous, slowly-bouncing "virtual pointer" on touch-only devices and on blurred desktop windows, and fix two custom-cursor bugs (top-left snap on load, stuck-on-blur).

**Architecture:** `DotGrid.tsx` keeps one effective pointer (`mouse`) that the follower chain reads, but selects its source via a `mode`: `"pointer"` (real mouse) or `"auto"` (a virtual pointer integrated by pure bounce math in a new `autoPointer.ts`). Touch-only devices default to `auto`; mouse devices default to `pointer` and fall back to `auto` on blur/mouse-leave, seeded at the blob's last position for a seamless handoff. The custom cursor in `app/page.tsx` gains a visibility flag so it stays hidden until the first real mouse move and hides again on blur.

**Tech Stack:** Next.js 16 / React 19, TypeScript, Canvas 2D, CSS Modules. No test runner in this project (per decision) — verification is `npm run lint`, `npm run build`, and an on-device manual matrix.

**Spec:** `docs/superpowers/specs/2026-06-09-autonomous-blob-pointer-design.md`

---

## File Structure

- **Create** `components/DotGrid/autoPointer.ts` — pure, DOM-free bounce motion for the virtual pointer (state type, tunable constants, `seedVelocity`, `createAutoState`, `bounceStep`). Isolated so the math is easy to read and tune.
- **Modify** `components/DotGrid/DotGrid.tsx` — remove the early-return; add `mode` + `auto` pointer state; resolve the active source into `mouse` each frame; register device-appropriate listeners (desktop blur/mouse-leave handoff; mobile passive touch follow).
- **Modify** `app/page.tsx` — add a `cursorVisible` flag; show on first `mousemove`, hide on `blur` / window mouse-leave; apply a hidden class to the custom-cursor element.
- **Modify** `app/page.module.css` — add `.cursorHidden` and an `opacity` transition so the cursor fades in/out.
- **Unchanged** `components/DotGrid/canRender.ts`, `dotGridStore.ts`, `DotControls.tsx` — `dotGridSupported()` keeps its meaning and still gates `DotControls`.

---

### Task 1: Pure virtual-pointer motion module

**Files:**
- Create: `components/DotGrid/autoPointer.ts`

- [ ] **Step 1: Create the module**

```ts
// Pure, DOM-free motion for the autonomous "virtual pointer" that drives the DotGrid
// effect when there is no real mouse to follow (touch-only devices, or a blurred desktop
// window). Kept free of React/canvas/RAF so the bounce math can be reasoned about — and
// tuned — in isolation. See spec:
// docs/superpowers/specs/2026-06-09-autonomous-blob-pointer-design.md

/**
 * Constant cruising speed of the virtual pointer, in CSS px per ~60fps frame.
 * Deliberately very slow ("ambient float"). TUNE ON A REAL FULL-SCREEN DEVICE via the
 * window.dotGrid bridge — the brainstorming preview ran on a 300px-wide canvas, so this
 * value will read differently across a full viewport.
 */
export const AUTO_SPEED = 0.4;

/** Max random turn applied to the velocity on each edge bounce, in radians (~±12°).
 *  Keeps the path from locking into a single repeating diagonal. */
export const AUTO_NUDGE = 0.42;

/** Inset from the viewport edge the pointer CENTER bounces within, in CSS px. 0 lets the
 *  center reach the very edge (half the blob spills off, exactly like a mouse at the edge). */
export const AUTO_MARGIN = 0;

export interface AutoState {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

/** A velocity vector of magnitude AUTO_SPEED at a random angle. rng injectable for determinism. */
export function seedVelocity(rng: () => number = Math.random): { vx: number; vy: number } {
	const angle = rng() * Math.PI * 2;
	return { vx: Math.cos(angle) * AUTO_SPEED, vy: Math.sin(angle) * AUTO_SPEED };
}

/** Build a fresh virtual-pointer state at (x, y) with a random initial heading. */
export function createAutoState(x: number, y: number, rng: () => number = Math.random): AutoState {
	const { vx, vy } = seedVelocity(rng);
	return { x, y, vx, vy };
}

/**
 * Advance one frame: move by velocity, reflect off the viewport edges, and on any edge hit
 * apply a small random turn (renormalized back to AUTO_SPEED so speed stays constant).
 * Mutates `s` in place.
 */
export function bounceStep(s: AutoState, width: number, height: number, rng: () => number = Math.random): void {
	s.x += s.vx;
	s.y += s.vy;

	const minX = AUTO_MARGIN;
	const maxX = width - AUTO_MARGIN;
	const minY = AUTO_MARGIN;
	const maxY = height - AUTO_MARGIN;

	let hit = false;
	if (s.x < minX) {
		s.x = minX;
		s.vx = Math.abs(s.vx);
		hit = true;
	} else if (s.x > maxX) {
		s.x = maxX;
		s.vx = -Math.abs(s.vx);
		hit = true;
	}
	if (s.y < minY) {
		s.y = minY;
		s.vy = Math.abs(s.vy);
		hit = true;
	} else if (s.y > maxY) {
		s.y = maxY;
		s.vy = -Math.abs(s.vy);
		hit = true;
	}

	if (hit) {
		const turn = (rng() - 0.5) * AUTO_NUDGE;
		const cos = Math.cos(turn);
		const sin = Math.sin(turn);
		const nx = s.vx * cos - s.vy * sin;
		const ny = s.vx * sin + s.vy * cos;
		const mag = Math.hypot(nx, ny) || 1;
		s.vx = (nx / mag) * AUTO_SPEED;
		s.vy = (ny / mag) * AUTO_SPEED;
	}
}
```

- [ ] **Step 2: Lint the new file**

Run: `npm run lint`
Expected: PASS (no errors). The module is pure TS with no React/DOM usage.

- [ ] **Step 3: Commit**

```bash
git add components/DotGrid/autoPointer.ts
git commit -m "feat(dotgrid): pure bounce-motion module for autonomous pointer"
```

---

### Task 2: Drive DotGrid from the virtual pointer

Replace the entire contents of `DotGrid.tsx`. The diff vs. today: import `autoPointer`; add `TOUCH_EASE`; replace the early-return with `touchOnly`; add `mode`/`auto`/`touch*` state; resolve the source into `mouse` at the top of `frame`; swap the single `onMouseMove`/`onMouseLeave` pair for device-appropriate listeners (desktop blur/leave handoff + mobile passive touch); mirror them in cleanup.

**Files:**
- Modify: `components/DotGrid/DotGrid.tsx` (full-file replace)

- [ ] **Step 1: Replace the file with the full implementation**

```tsx
"use client";

import { useEffect, useRef } from "react";
import styles from "./DotGrid.module.css";
import { getParams, setParams, subscribe } from "./dotGridStore";
import { dotGridSupported } from "./canRender";
import { AutoState, createAutoState, bounceStep } from "./autoPointer";

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
const TOUCH_EASE = 0.18; // how fast the virtual pointer slides toward an active touch
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

		// The effect now ALWAYS runs. dotGridSupported() no longer disables it — it only picks
		// the default pointer SOURCE: touch-only devices have no mouse, so they start in
		// autonomous "auto" mode; mouse devices start in "pointer" mode and only fall back to
		// auto on blur / mouse-leave. This is a device-capability test, NOT a width breakpoint —
		// a desktop window resized to phone size keeps full mouse behavior. Do not swap it for a
		// width media query. Under reduced-motion we keep the fluid blob + wake but disable the
		// dot displacement (push) AND the autonomous bounce — the blob then only moves to follow
		// a real pointer / touch.
		const touchOnly = !dotGridSupported();
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		let dots: Dot[] = [];
		let lastSpacing = 0; // owned by buildGrid(); the spacing-rebuild subscriber reads it
		const followers: Follower[] = Array.from({ length: FOLLOWER_COUNT }, () => ({ x: -9999, y: -9999 }));
		const mouse = { x: -9999, y: -9999 };

		// Pointer-source state. `mode` selects what drives `mouse` each frame; `auto` is the
		// virtual pointer integrated by the bounce motion; touch* tracks an active finger.
		let mode: "pointer" | "auto" = touchOnly ? "auto" : "pointer";
		let auto: AutoState = createAutoState(window.innerWidth / 2, window.innerHeight / 2);
		let touchActive = false;
		const touchPoint = { x: 0, y: 0 };

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

		const resize = () => {
			canvas.width = Math.floor(window.innerWidth * dpr);
			canvas.height = Math.floor(window.innerHeight * dpr);
			canvas.style.width = `${window.innerWidth}px`;
			canvas.style.height = `${window.innerHeight}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			buildGrid();
		};

		// --- Pointer-source event handlers -------------------------------------------------
		const onMouseMove = (e: MouseEvent) => {
			mouse.x = e.clientX;
			mouse.y = e.clientY;
			mode = "pointer"; // a real mouse reclaims control from the autonomous blob
		};
		// Desktop: when focus/pointer leaves, hand off to the autonomous blob, seeded at the
		// blob's CURRENT position so it continues smoothly instead of teleporting.
		const enterAuto = () => {
			if (touchOnly || mode === "auto") return;
			const lastX = followers[0].x < -9000 ? window.innerWidth / 2 : followers[0].x;
			const lastY = followers[0].y < -9000 ? window.innerHeight / 2 : followers[0].y;
			auto = createAutoState(lastX, lastY);
			mode = "auto";
		};
		const onMouseLeave = () => enterAuto();
		const onBlur = () => enterAuto();
		// Mobile: read touch coordinates only (passive, never preventDefault) so scrolling and
		// taps are unaffected. While a finger is down the blob eases toward it; on release it
		// resumes its autonomous bounce.
		const onTouch = (e: TouchEvent) => {
			const tch = e.touches[0];
			if (!tch) return;
			touchActive = true;
			touchPoint.x = tch.clientX;
			touchPoint.y = tch.clientY;
		};
		const onTouchEnd = () => {
			touchActive = false;
		};

		let rafId = 0;

		const frame = (ts: number) => {
			const t = ts * 0.001;
			const p = getParams();
			const isDark = document.body.classList.contains("dark");
			const [cr, cg, cb] = isDark ? p.colorDark : p.colorLight;

			ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

			// Resolve the active pointer source into `mouse` (the head target). In "pointer"
			// mode `mouse` is already maintained by onMouseMove, so nothing to do here.
			if (mode === "auto") {
				if (touchActive) {
					// Follow the finger.
					auto.x += (touchPoint.x - auto.x) * TOUCH_EASE;
					auto.y += (touchPoint.y - auto.y) * TOUCH_EASE;
				} else if (!reduceMotion) {
					// Autonomous slow bounce. (reduced-motion + no touch => hold last position.)
					bounceStep(auto, window.innerWidth, window.innerHeight);
				}
				mouse.x = auto.x;
				mouse.y = auto.y;
			}

			// Initialize the follower chain to the pointer on first real frame.
			if (followers[0].x < -9000) {
				for (const f of followers) {
					f.x = mouse.x;
					f.y = mouse.y;
				}
			}
			// Reduced-motion keeps the full fluid blob + trailing wake, but disables the
			// dot displacement (push) so dots reveal in place instead of flying around.
			const pushAmt = reduceMotion ? 0 : p.push;

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
					// Cheap bound: the largest possible ri is R * ~1.36 (head follower,
					// edge noise at +amplitude). Skip atan2/edgeNoise for dots that
					// cannot be inside this follower's blob.
					if (dist >= R * 1.5) continue;
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
					const headDist = distHead || 0.0001;
					const force = pushAmt * (reveal > p.baseOpacity ? reveal : 0);
					ox = ((d.x - head.x) / headDist) * force;
					oy = ((d.y - head.y) / headDist) * force;
					grow = 1 + (p.grow - 1) * target;
				}

				// Ease toward target for the trailing fade.
				d.a += (target - d.a) * p.fade;
				if (d.a < 0.002) continue;

				ctx.beginPath();
				ctx.arc(d.x + ox, d.y + oy, Math.max(0, DOT_BASE_RADIUS * grow), 0, Math.PI * 2);
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
		// Touch-only devices get passive touch listeners; mouse devices get the pointer +
		// blur/leave handoff listeners. Splitting by device keeps each platform's input model
		// clean and avoids attaching mouse handlers on phones (and vice versa).
		if (touchOnly) {
			window.addEventListener("touchstart", onTouch, { passive: true });
			window.addEventListener("touchmove", onTouch, { passive: true });
			window.addEventListener("touchend", onTouchEnd, { passive: true });
			window.addEventListener("touchcancel", onTouchEnd, { passive: true });
		} else {
			window.addEventListener("mousemove", onMouseMove);
			document.documentElement.addEventListener("mouseleave", onMouseLeave);
			window.addEventListener("blur", onBlur);
		}
		window.addEventListener("resize", resize);
		document.addEventListener("visibilitychange", onVisibility);
		start();

		// Live spacing changes (from DotControls) need a grid rebuild; every other param is
		// read per frame by the draw loop. subscribe() fires on each setParams().
		const unsubscribe = subscribe(() => {
			if (getParams().spacing !== lastSpacing) buildGrid();
		});

		// Dev-only console bridge for tuning the params the DotControls panel doesn't
		// surface (push / fade / falloff / colors), e.g. window.dotGrid.setParams({ push: 0 }).
		// TODO(dotgrid-advanced-controls): a panel "advanced" section could replace this —
		// anchor: components/DotGrid/dotGridStore.ts
		if (process.env.NODE_ENV !== "production") {
			(window as unknown as { dotGrid?: unknown }).dotGrid = { getParams, setParams };
		}

		return () => {
			stop();
			unsubscribe();
			if (touchOnly) {
				window.removeEventListener("touchstart", onTouch);
				window.removeEventListener("touchmove", onTouch);
				window.removeEventListener("touchend", onTouchEnd);
				window.removeEventListener("touchcancel", onTouchEnd);
			} else {
				window.removeEventListener("mousemove", onMouseMove);
				document.documentElement.removeEventListener("mouseleave", onMouseLeave);
				window.removeEventListener("blur", onBlur);
			}
			window.removeEventListener("resize", resize);
			document.removeEventListener("visibilitychange", onVisibility);
			if (process.env.NODE_ENV !== "production") {
				delete (window as unknown as { dotGrid?: unknown }).dotGrid;
			}
		};
	}, []);

	return <canvas ref={canvasRef} className={styles.dotCanvas} aria-hidden="true" />;
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS. Watch for unused-import warnings — `AutoState`, `createAutoState`, `bounceStep`, `setParams`, `subscribe` are all used.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS (compiles and type-checks). `AutoState` is used as the type of `auto`.

- [ ] **Step 4: Manual desktop check**

Run: `npm run dev`, open the site on a desktop browser.
Expected:
- On load, before moving the mouse: no blob (unchanged).
- Move the mouse: blob follows as before.
- Click another window / `alt-tab` so the page blurs (but stays visible): the blob detaches and begins a slow bounce from where it was.
- Move the mouse back over the page: blob re-attaches to the cursor.

- [ ] **Step 5: Commit**

```bash
git add components/DotGrid/DotGrid.tsx
git commit -m "feat(dotgrid): autonomous virtual pointer with desktop blur handoff + mobile touch"
```

---

### Task 3: Custom-cursor visibility fixes

**Files:**
- Modify: `app/page.tsx` (the mouse `useEffect` at ~lines 116–137, the `mousePosition` state at ~line 38, and the custom-cursor JSX at ~lines 166–174)
- Modify: `app/page.module.css` (the `.customCursor` rule at lines 11–26)

- [ ] **Step 1: Add the `cursorVisible` state**

Find (around line 38):

```tsx
	const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
```

Add directly below it:

```tsx
	// Custom cursor stays hidden until the first real mouse move (kills the top-left snap on
	// load) and hides again on blur / when the pointer leaves the window (kills the stuck cursor).
	const [cursorVisible, setCursorVisible] = useState(false);
```

- [ ] **Step 2: Show on move, hide on blur/leave**

Replace the entire mouse `useEffect` (currently lines ~116–137) with:

```tsx
	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			setMousePosition({ x: e.clientX, y: e.clientY });
			setCursorVisible(true);

			const target = e.target as HTMLElement;
			const isClickable = target.tagName === "A" || target.tagName === "BUTTON" || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.closest("a") || target.closest("button") || target.onclick !== null || target.style.cursor === "pointer";
			setIsHoveringClickable(!!isClickable);
		};

		const handleMouseDown = () => setIsMouseDown(true);
		const handleMouseUp = () => setIsMouseDown(false);
		const handleBlur = () => setCursorVisible(false);
		const handleDocMouseLeave = () => setCursorVisible(false);

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mousedown", handleMouseDown);
		window.addEventListener("mouseup", handleMouseUp);
		window.addEventListener("blur", handleBlur);
		document.documentElement.addEventListener("mouseleave", handleDocMouseLeave);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mousedown", handleMouseDown);
			window.removeEventListener("mouseup", handleMouseUp);
			window.removeEventListener("blur", handleBlur);
			document.documentElement.removeEventListener("mouseleave", handleDocMouseLeave);
		};
	}, []);
```

- [ ] **Step 3: Apply the hidden class in the JSX**

Find (around line 167):

```tsx
				className={`${styles.customCursor} ${isHoveringClickable ? styles.cursorHover : ""} ${isMouseDown ? styles.cursorClick : ""}`}
```

Replace with:

```tsx
				className={`${styles.customCursor} ${cursorVisible ? "" : styles.cursorHidden} ${isHoveringClickable ? styles.cursorHover : ""} ${isMouseDown ? styles.cursorClick : ""}`}
```

- [ ] **Step 4: Add the CSS (fade + hidden state)**

In `app/page.module.css`, find the `.customCursor` rule (lines 11–26) and replace its `transition` block plus add a new rule. Replace:

```css
	transition:
		transform 0.18s ease,
		color 0.2s ease,
		font-size 0.18s ease;
}
```

with:

```css
	transition:
		transform 0.18s ease,
		color 0.2s ease,
		font-size 0.18s ease,
		opacity 0.25s ease;
}

.customCursor.cursorHidden {
	opacity: 0;
}
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint`
Expected: PASS.
Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Manual check**

Run: `npm run dev` (or reuse the running dev server) on desktop.
Expected:
- On fresh load (before moving the mouse): no cursor in the top-left corner.
- First mouse move: cursor fades in at the pointer.
- Blur the window / move the mouse off the page edge: cursor fades out (no stuck cursor); blob takes over (from Task 2).
- Return: cursor fades back in on first move.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/page.module.css
git commit -m "fix(cursor): hide custom cursor until first move and on blur"
```

---

### Task 4: Full verification matrix

No code changes — confirm the whole feature against the spec on real devices/emulation, then record results.

**Files:** none (verification only).

- [ ] **Step 1: Production build + lint clean**

Run: `npm run lint` then `npm run build`
Expected: both PASS with no errors.

- [ ] **Step 2: Desktop, normal motion** (browser, mouse)

- Load → no top-left cursor; first move fades cursor in; blob follows mouse.
- Blur (alt-tab to another visible window) → cursor fades out; blob detaches and bounces slowly from its last spot, wandering the screen (not stuck on one diagonal).
- Return + move → cursor fades in; blob re-attaches.

- [ ] **Step 3: Desktop, reduced motion**

Enable OS "reduce motion" (or DevTools: Rendering → Emulate CSS `prefers-reduced-motion: reduce`). Reload.
- Mouse still reveals dots with no push displacement (unchanged).
- Blur → blob freezes at last position (does NOT bounce); cursor hidden.

- [ ] **Step 4: Touch-only device / emulation, normal motion**

Use a real phone, or DevTools device toolbar with touch emulation (must satisfy `(hover: none) and (pointer: coarse)` — DevTools "Mobile" preset does).
- Blob autoplays, bouncing slowly on its own from load.
- Drag a finger → blob eases to follow; release → resumes bouncing.
- **Critical non-interference:** page still scrolls normally; links/buttons still tap; form inputs still focus. The blob never blocks input.

- [ ] **Step 5: Touch-only device, reduced motion**

With reduce-motion on:
- Blob does NOT autoplay (no wandering).
- Touch → blob follows the finger; release → blob rests (no bounce).
- Dots reveal without push displacement.

- [ ] **Step 6: Resized-narrow desktop window (regression)**

Shrink a desktop browser window to phone width WITHOUT touch emulation.
- Behavior stays desktop: mouse-driven, blur-handoff — NOT mobile autoplay (proves device-based gating, not width-based).

- [ ] **Step 7: DotControls regression**

- On desktop (wide), the controls panel still appears and tunes the effect as before.
- Confirm `dotGridSupported()` was not modified.

- [ ] **Step 8: Tab-hidden battery behavior**

Switch to another browser TAB (page hidden, not just blurred) → RAF stops (existing `visibilitychange`); returning resumes. No console errors.

---

## Self-Review Notes

- **Spec coverage:** single pointer-source/two-mode architecture (Task 2) ✓; device-detection-by-media-query-not-width (Task 2 comment + Task 4 Step 6) ✓; nudged slow bounce (Task 1) ✓; mobile autoplay + touch nudge (Task 2) ✓; mobile reduced-motion follow-touch-only + push off (Task 2 frame logic) ✓; desktop blur handoff seeded from last position (Task 2 `enterAuto`) ✓; desktop reduced-motion freeze (Task 2) ✓; cursor initial-hide + blur-hide (Task 3) ✓; non-interference via passive read-only listeners (Task 2 `onTouch`, verified Task 4 Step 4) ✓; DotControls untouched (Task 4 Step 7) ✓.
- **Type consistency:** `AutoState`, `createAutoState`, `bounceStep` names match between `autoPointer.ts` (Task 1) and `DotGrid.tsx` (Task 2). `cursorVisible` / `setCursorVisible` consistent across Task 3 steps.
- **No placeholders:** every code step contains complete, paste-ready content.
- **Out of scope (per spec):** no new control-panel UI for motion params; no tap-ripple effects; no desktop idle-while-focused autoplay.
