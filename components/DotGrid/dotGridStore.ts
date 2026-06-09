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
	colorDark: [78, 82, 92], // dark space grey (muted, keeps text readable over dots)
	colorLight: [135, 117, 100], // accent #877564
};

// The live control panel now exists: components/DotGrid/DotControls.tsx surfaces a curated
// subset of these params (radius, spacing, edgeNoise, wake, grow, baseOpacity). The technical
// params (push, fade, falloff) and the dot colors are intentionally left off the panel — tune
// them via the dev-only window.dotGrid console bridge.
// Spec: docs/superpowers/specs/2026-06-09-dot-grid-customization-panel-design.md
// TODO(dotgrid-advanced-controls): optionally surface push/fade/falloff + color pickers behind
// an "advanced" disclosure in the panel. Siblings: components/DotGrid/DotControls.tsx,
// components/DotGrid/DotGrid.tsx

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
