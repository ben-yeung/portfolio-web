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

/** When vertical motion is preferred (tall/portrait screens), the max the heading may lean
 *  away from straight up/down, in radians (~34°). Keeps the blob clearly vertical-dominant
 *  while still allowing a gentle side-to-side drift. */
export const AUTO_MAX_OFF_VERTICAL = 0.6;

export interface AutoState {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

/**
 * Clamp a velocity's heading into a cone around the nearest vertical (straight up or down),
 * preserving speed and the up/down + left/right signs. On tall portrait screens an unbiased
 * heading can sit near-horizontal and read as "stuck" ping-ponging side to side; this keeps
 * motion vertical-dominant while still allowing a gentle sideways drift.
 */
function biasToVertical(vx: number, vy: number): { vx: number; vy: number } {
	const speed = Math.hypot(vx, vy) || AUTO_SPEED;
	const downward = vy >= 0 ? 1 : -1;
	// Angle away from the vertical axis: 0 = straight up/down, ±90° = horizontal.
	let off = Math.atan2(vx, Math.abs(vy));
	if (off > AUTO_MAX_OFF_VERTICAL) off = AUTO_MAX_OFF_VERTICAL;
	else if (off < -AUTO_MAX_OFF_VERTICAL) off = -AUTO_MAX_OFF_VERTICAL;
	return { vx: Math.sin(off) * speed, vy: downward * Math.cos(off) * speed };
}

/** A velocity vector of magnitude AUTO_SPEED at a random angle. When `preferVertical` is set
 *  the heading is biased toward straight up/down (see biasToVertical). rng injectable. */
export function seedVelocity(preferVertical = false, rng: () => number = Math.random): { vx: number; vy: number } {
	const angle = rng() * Math.PI * 2;
	const vx = Math.cos(angle) * AUTO_SPEED;
	const vy = Math.sin(angle) * AUTO_SPEED;
	return preferVertical ? biasToVertical(vx, vy) : { vx, vy };
}

/** Build a fresh virtual-pointer state at (x, y) with a random initial heading (biased toward
 *  vertical when `preferVertical`). */
export function createAutoState(x: number, y: number, preferVertical = false, rng: () => number = Math.random): AutoState {
	const { vx, vy } = seedVelocity(preferVertical, rng);
	return { x, y, vx, vy };
}

/**
 * Advance one frame: move by velocity, reflect off the viewport edges, and on any edge hit
 * apply a small random turn (renormalized back to AUTO_SPEED so speed stays constant).
 * Mutates `s` in place.
 */
export function bounceStep(s: AutoState, width: number, height: number, preferVertical = false, rng: () => number = Math.random): void {
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

		// Re-bias toward vertical after the nudge so repeated random turns can't random-walk
		// the blob back into a near-horizontal drift on tall screens.
		if (preferVertical) {
			const b = biasToVertical(s.vx, s.vy);
			s.vx = b.vx;
			s.vy = b.vy;
		}
	}
}
