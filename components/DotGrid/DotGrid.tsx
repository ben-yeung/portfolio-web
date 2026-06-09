"use client";

import { useEffect, useRef } from "react";
import styles from "./DotGrid.module.css";
import { getParams, setParams, subscribe } from "./dotGridStore";
import { dotGridSupported } from "./canRender";
import { AutoState, createAutoState, bounceStep, AUTO_SPEED } from "./autoPointer";

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
const TOUCH_EASE = 0.08; // how fast the virtual pointer slides toward an active touch (low = smooth, gradual)
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

		// Tall/portrait screens read better with vertical-dominant blob motion. Recomputed per
		// use (not cached) so a device rotation is respected on the next seed / bounce.
		const isPortrait = () => window.innerHeight > window.innerWidth;

		// Pointer-source state. `mode` selects what drives `mouse` each frame; `auto` is the
		// virtual pointer integrated by the bounce motion; touch* tracks an active finger.
		let mode: "pointer" | "auto" = touchOnly ? "auto" : "pointer";
		let auto: AutoState = createAutoState(window.innerWidth / 2, window.innerHeight / 2, isPortrait());
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
			// Mobile is always auto; and once in auto, repeated blur/leave events must NOT
			// re-seed (else the blob would jump on every focus change) — let it keep bouncing.
			if (touchOnly || mode === "auto") return;
			const lastX = followers[0].x < -9000 ? window.innerWidth / 2 : followers[0].x;
			const lastY = followers[0].y < -9000 ? window.innerHeight / 2 : followers[0].y;
			auto = createAutoState(lastX, lastY, isPortrait());
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
					// Ease toward the finger, then steer the autonomous velocity to match the
					// direction of THAT movement. So when the finger lifts, the blob resumes
					// traveling the way it was just pulled — tap below a rising blob and it
					// continues downward, instead of snapping back to its old upward heading.
					const px = auto.x;
					const py = auto.y;
					auto.x += (touchPoint.x - auto.x) * TOUCH_EASE;
					auto.y += (touchPoint.y - auto.y) * TOUCH_EASE;
					const dx = auto.x - px;
					const dy = auto.y - py;
					const d = Math.hypot(dx, dy);
					if (d > 0.05) {
						// Once the blob is nearly on the finger the delta shrinks; below the
						// threshold we keep the last good heading rather than jittering.
						auto.vx = (dx / d) * AUTO_SPEED;
						auto.vy = (dy / d) * AUTO_SPEED;
					}
				} else if (!reduceMotion) {
					// Autonomous slow bounce. (reduced-motion + no touch => hold last position.)
					bounceStep(auto, window.innerWidth, window.innerHeight, isPortrait());
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
