// Single source of truth for "is this a true touch-only device?" — the media query
// `(hover: none) and (pointer: coarse)`, the same one that hides the custom cursor in
// app/page.module.css. This is a device-capability test, NOT a viewport-width breakpoint
// (a desktop window resized narrow still reports hover/fine and stays "supported").
//
// What it gates:
//   - DotControls: the desktop tuning panel renders only when this returns true.
//   - DotGrid's default pointer SOURCE: the canvas effect ALWAYS runs now — this just picks
//     the starting mode. Touch-only devices (false) start the autonomous blob ("auto"); mouse
//     devices (true) start in "pointer" mode and fall back to auto on blur / mouse-leave.
// Reduced-motion is deliberately NOT a gate: the canvas keeps the full fluid blob and only
// zeroes the dot displacement (push) and the autonomous bounce.
export function dotGridSupported(): boolean {
	if (typeof window === "undefined" || !window.matchMedia) return false;
	return !window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}
