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
