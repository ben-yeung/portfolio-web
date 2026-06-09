"use client";

import { useEffect, useRef, useState } from "react";
import ProjectCard, { Project } from "@/components/ProjectCard/ProjectCard";
import { computeCopies, rowVelocity, wrapOffset } from "./carouselMath";
import styles from "./ProjectCarousel.module.css";

const BASE = 55; // idle drift, px/sec
const BASE_REDUCED = 15; // idle drift under prefers-reduced-motion, px/sec
const MAX_EDGE = 620; // max steer speed at the very edge, px/sec
const EDGE_FRAC = 0.18; // edge-zone width as a fraction of row width

interface CarouselRowProps {
	projects: Project[];
	direction: 1 | -1;
	inView: boolean;
}

export default function CarouselRow({ projects, direction, inView }: CarouselRowProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const leftArrowRef = useRef<HTMLSpanElement>(null);
	const rightArrowRef = useRef<HTMLSpanElement>(null);

	const [copies, setCopies] = useState(2);

	const offsetRef = useRef(0);
	const setWidthRef = useRef(0);
	const pointerRef = useRef({ x: 0, y: 0, inside: false });
	const focusedRef = useRef(false);
	const reducedRef = useRef(false);

	const setLen = projects.length;

	// Track the reduced-motion preference (slows idle drift; gestures still work).
	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		reducedRef.current = mq.matches;
		const onChange = () => {
			reducedRef.current = mq.matches;
		};
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);

	// Measure one set's period (distance between set 0 and set 1) and grow the
	// copy count until the track overflows the row for a seamless loop.
	useEffect(() => {
		const measure = () => {
			const root = rootRef.current;
			const track = trackRef.current;
			if (!root || !track) return;
			if (root.offsetParent === null || root.clientWidth === 0) return; // hidden (mobile)
			if (track.children.length < setLen + 1) return;
			const first = track.children[0] as HTMLElement;
			const nextSet = track.children[setLen] as HTMLElement;
			const period = nextSet.offsetLeft - first.offsetLeft;
			if (period <= 0) return;
			setWidthRef.current = period;
			const needed = computeCopies(period, root.clientWidth);
			setCopies((prev) => (prev !== needed ? needed : prev));
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [copies, setLen]);

	// Pointer + focus tracking on the row.
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const onMove = (e: MouseEvent) => {
			pointerRef.current = { x: e.clientX, y: e.clientY, inside: true };
		};
		const onLeave = () => {
			pointerRef.current.inside = false;
		};
		const onFocusIn = () => {
			focusedRef.current = true;
		};
		const onFocusOut = () => {
			focusedRef.current = false;
		};
		root.addEventListener("mousemove", onMove);
		root.addEventListener("mouseleave", onLeave);
		root.addEventListener("focusin", onFocusIn);
		root.addEventListener("focusout", onFocusOut);
		return () => {
			root.removeEventListener("mousemove", onMove);
			root.removeEventListener("mouseleave", onLeave);
			root.removeEventListener("focusin", onFocusIn);
			root.removeEventListener("focusout", onFocusOut);
		};
	}, []);

	// The animation loop.
	useEffect(() => {
		if (!inView) return;
		const root = rootRef.current;
		const track = trackRef.current;
		if (!root || !track) return;

		let rafId = 0;
		let last = performance.now();

		const frame = (now: number) => {
			const dt = Math.min((now - last) / 1000, 0.05);
			last = now;

			const setWidth = setWidthRef.current;
			if (setWidth > 0 && root.offsetParent !== null) {
				const rect = root.getBoundingClientRect();
				const p = pointerRef.current;
				const overRow = p.inside && p.y >= rect.top && p.y <= rect.bottom;
				const { v, leftF, rightF } = rowVelocity({
					pointerInside: p.inside,
					pointerOverRow: overRow,
					relX: p.x - rect.left,
					rowWidth: rect.width,
					defaultDir: direction,
					base: reducedRef.current ? BASE_REDUCED : BASE,
					maxEdge: MAX_EDGE,
					edgeFrac: EDGE_FRAC,
				});

				let vel = v;
				if (focusedRef.current && !p.inside) vel = 0; // keyboard focus pauses the row

				offsetRef.current = wrapOffset(offsetRef.current + vel * dt, setWidth);
				track.style.transform = `translateX(${offsetRef.current}px)`;

				if (leftArrowRef.current) leftArrowRef.current.style.opacity = leftF ? String(0.25 + 0.75 * leftF) : "0";
				if (rightArrowRef.current) rightArrowRef.current.style.opacity = rightF ? String(0.25 + 0.75 * rightF) : "0";
			}

			rafId = requestAnimationFrame(frame);
		};

		rafId = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(rafId);
	}, [inView, direction]);

	return (
		<div ref={rootRef} className={styles.row}>
			<span ref={leftArrowRef} className={`${styles.edgeHint} ${styles.edgeHintLeft}`} aria-hidden>
				‹
			</span>
			<span ref={rightArrowRef} className={`${styles.edgeHint} ${styles.edgeHintRight}`} aria-hidden>
				›
			</span>
			<div ref={trackRef} className={styles.track}>
				{Array.from({ length: copies }).flatMap((_, copy) =>
					projects.map((project) => (
						<div key={`${copy}-${project.id}`} className={styles.cardSlot}>
							<ProjectCard project={project} ariaHidden={copy > 0} />
						</div>
					)),
				)}
			</div>
		</div>
	);
}
