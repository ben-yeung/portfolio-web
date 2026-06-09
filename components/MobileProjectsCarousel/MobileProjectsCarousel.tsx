"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, type PanInfo } from "framer-motion";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import type { Project } from "@/data/projects";
import { wrapIndex } from "./wrapIndex";
import styles from "./MobileProjectsCarousel.module.css";

const AUTOPLAY_MS = 5000; // advance cadence when idle
const RESUME_MS = 8000; // stillness required before autoplay resumes
const SWIPE_DISTANCE = 60; // px of horizontal drag that commits a slide
const SWIPE_VELOCITY = 400; // px/s flick that commits a slide
const COPIES = 3; // render the list three times so the track always has neighbours preloaded

export default function MobileProjectsCarousel({ projects }: { projects: Project[] }) {
	const n = projects.length;

	const viewportRef = useRef<HTMLDivElement>(null);
	const widthRef = useRef(0); // live slide width for closures
	const [width, setWidth] = useState(0); // slide width for rendering + drag constraints
	const x = useMotionValue(0); // track offset in px

	// `position` indexes into the 3×list track; the rest range is the middle copy [n, 2n).
	const [position, setPosition] = useState(n);
	const positionRef = useRef(n);
	const draggingRef = useRef(false);

	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reduceMotionRef = useRef(false);

	const setPos = (p: number) => {
		positionRef.current = p;
		setPosition(p);
	};

	// Measure the viewport so the track can be positioned in pixels (full-width slides).
	useLayoutEffect(() => {
		const measure = () => {
			const w = viewportRef.current?.offsetWidth ?? 0;
			widthRef.current = w;
			setWidth(w);
			x.set(-positionRef.current * w); // keep the active slide aligned on resize
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [x]);

	// Spring the track to `target`, then — only once it has settled and nothing newer is in
	// flight — re-anchor into the middle copy. The re-anchor lands on an identical card, so
	// it's invisible; doing it only at the copy edges (not every swipe) is what kills the bounce.
	const settleTo = (target: number) => {
		const w = widthRef.current;
		if (!w) return;
		setPos(target);
		animate(x, -target * w, { type: "spring", stiffness: 300, damping: 30 }).finished
			.then(() => {
				if (draggingRef.current || positionRef.current !== target) return; // superseded
				if (target < n || target >= 2 * n) {
					const anchored = n + wrapIndex(target, n);
					setPos(anchored);
					x.set(-anchored * widthRef.current);
				}
			})
			.catch(() => {}); // animate().finished rejects when interrupted by a newer move
	};

	const go = (dir: number) => settleTo(positionRef.current + dir);

	const stopAutoplay = () => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	};

	const startAutoplay = () => {
		if (reduceMotionRef.current || intervalRef.current || document.hidden) return;
		intervalRef.current = setInterval(() => go(1), AUTOPLAY_MS);
	};

	// Manual interaction wins: stop now, resume only after RESUME_MS of stillness.
	// Under reduced motion there is nothing to resume, so don't arm the timer.
	const pauseAutoplay = () => {
		stopAutoplay();
		if (resumeRef.current) clearTimeout(resumeRef.current);
		if (!reduceMotionRef.current) {
			resumeRef.current = setTimeout(startAutoplay, RESUME_MS);
		}
	};

	useEffect(() => {
		reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		startAutoplay();

		const onVisibility = () => {
			if (document.hidden) stopAutoplay();
			else startAutoplay();
		};
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			stopAutoplay();
			if (resumeRef.current) clearTimeout(resumeRef.current);
			document.removeEventListener("visibilitychange", onVisibility);
		};
		// Autoplay lifecycle is mount-scoped; helpers close over the stable `n` and refs.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleDragStart = () => {
		draggingRef.current = true;
		pauseAutoplay();
	};

	const handleDragEnd = (_event: unknown, info: PanInfo) => {
		draggingRef.current = false;
		const { offset, velocity } = info;
		let dir = 0;
		if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) dir = 1;
		else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) dir = -1;
		settleTo(positionRef.current + dir);
		pauseAutoplay();
	};

	const goTo = (index: number) => {
		// Jump to `index` within the copy we're currently in.
		const base = positionRef.current - wrapIndex(positionRef.current, n);
		settleTo(base + index);
		pauseAutoplay();
	};

	const activeIndex = wrapIndex(position, n);

	return (
		<div className={styles.carousel} role="group" aria-roledescription="carousel" aria-label="Projects">
			<div className={styles.viewport} ref={viewportRef}>
				<motion.div
					className={styles.track}
					style={{ x }}
					drag="x"
					// Constrain each gesture to ±1 card from the current rest position.
					dragConstraints={{ left: -(position + 1) * width, right: -(position - 1) * width }}
					dragElastic={0.1}
					dragMomentum={false}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				>
					{Array.from({ length: COPIES }).flatMap((_, copy) =>
						projects.map((project) => (
							<div className={styles.slide} key={`${copy}-${project.id}`} style={{ width: width ? `${width}px` : "100%" }}>
								<a href={project.link} target="_blank" rel="noopener noreferrer" className={styles.card} aria-label={`View ${project.title}`} draggable={false}>
									<div className={styles.imageWrapper}>
										<img src={project.image} alt={project.title} className={styles.image} draggable={false} />
										<div className={styles.linkBadge}>
											<HiArrowTopRightOnSquare />
										</div>
									</div>
									<div className={styles.content}>
										<h3 className={styles.title}>{project.title}</h3>
										<p className={styles.description}>{project.description}</p>
										<div className={styles.tech}>
											{project.tech.map((tech, techIndex) => (
												<span key={techIndex} className={styles.techBadge}>
													{tech}
												</span>
											))}
										</div>
									</div>
								</a>
							</div>
						)),
					)}
				</motion.div>
			</div>

			<div className={styles.dots}>
				{projects.map((p, i) => (
					<button key={p.id} type="button" className={`${styles.dot} ${i === activeIndex ? styles.dotActive : ""}`} aria-label={`Go to project ${i + 1}`} aria-current={i === activeIndex} onClick={() => goTo(i)} />
				))}
			</div>
		</div>
	);
}
