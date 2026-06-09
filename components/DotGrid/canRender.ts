// Single source of truth for whether the DotGrid effect (and its controls) should run.
// The canvas is disabled only on true touch-only devices — the same media query that hides
// the custom cursor in app/page.module.css. Reduced-motion is deliberately NOT a gate: the
// canvas keeps the full fluid blob and only zeroes the dot displacement (push), so the
// controls should still appear and tune it.
export function dotGridSupported(): boolean {
	if (typeof window === "undefined" || !window.matchMedia) return false;
	return !window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}
