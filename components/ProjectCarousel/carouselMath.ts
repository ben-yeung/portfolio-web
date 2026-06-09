/** Split a list into two rows: first floor(n/2), then the rest (so row 1 <= row 2). */
export function splitRows<T>(items: T[]): [T[], T[]] {
	const mid = Math.floor(items.length / 2);
	return [items.slice(0, mid), items.slice(mid)];
}

/**
 * How many copies of one card-set are needed so the track always overflows the
 * container, leaving a full extra set to wrap into for a seamless loop.
 */
export function computeCopies(setWidth: number, containerWidth: number): number {
	if (setWidth <= 0) return 2;
	return Math.max(2, Math.ceil(containerWidth / setWidth) + 1);
}

/** Wrap a translateX offset into the half-open range (-setWidth, 0] for a seamless modulo loop. */
export function wrapOffset(offset: number, setWidth: number): number {
	if (setWidth <= 0) return 0;
	let o = offset % setWidth;
	if (o > 0) o -= setWidth;
	return o;
}

export interface RowVelocityInput {
	pointerInside: boolean;
	pointerOverRow: boolean;
	/** Pointer x relative to the row's left edge, in px. */
	relX: number;
	rowWidth: number;
	/** +1 = idle-drift right, -1 = idle-drift left. */
	defaultDir: 1 | -1;
	/** Idle drift speed, px/sec. */
	base: number;
	/** Max steer speed at the very edge, px/sec. */
	maxEdge: number;
	/** Edge-zone width as a fraction of row width (0..0.5). */
	edgeFrac: number;
}

export interface RowVelocityOutput {
	/** Signed velocity in px/sec (positive = content moves right). */
	v: number;
	/** Left-arrow intensity 0..1. */
	leftF: number;
	/** Right-arrow intensity 0..1. */
	rightF: number;
}

/**
 * Decide a row's scroll velocity from pointer geometry:
 * - not over the row  -> idle drift in defaultDir
 * - over a left/right edge zone -> steer that direction, ramping toward the edge
 * - over the middle   -> pause (v = 0)
 */
export function rowVelocity(input: RowVelocityInput): RowVelocityOutput {
	const { pointerInside, pointerOverRow, relX, rowWidth, defaultDir, base, maxEdge, edgeFrac } = input;
	if (!pointerInside || !pointerOverRow || rowWidth <= 0) {
		return { v: defaultDir * base, leftF: 0, rightF: 0 };
	}
	const edgeW = rowWidth * edgeFrac;
	const leftF = relX < edgeW ? Math.min((edgeW - relX) / edgeW, 1) : 0;
	const rightF = relX > rowWidth - edgeW ? Math.min((relX - (rowWidth - edgeW)) / edgeW, 1) : 0;
	if (leftF > 0) return { v: maxEdge * leftF, leftF, rightF: 0 };
	if (rightF > 0) return { v: -maxEdge * rightF, leftF: 0, rightF };
	return { v: 0, leftF: 0, rightF: 0 };
}
