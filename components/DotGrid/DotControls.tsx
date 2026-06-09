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
		// Mount-only matchMedia probe: an intentional one-shot setState so the client-only
		// support flag is resolved after hydration (never during SSR), avoiding a mismatch.
		// eslint-disable-next-line react-hooks/set-state-in-effect
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
		setParams({ [key]: value } as Pick<DotGridParams, NumericKey>);
	};

	const handleReset = () => {
		// Full reset to factory defaults — also clears any dev-bridge tuning of the params
		// the panel doesn't surface (push / fade / falloff / colors), not just the six sliders.
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
