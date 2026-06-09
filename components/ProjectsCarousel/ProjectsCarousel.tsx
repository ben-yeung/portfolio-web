"use client";

import { useEffect, useRef, useState } from "react";
import { motion, type PanInfo } from "framer-motion";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import type { Project } from "@/data/projects";
import { wrapIndex } from "./wrapIndex";
import styles from "./ProjectsCarousel.module.css";

const AUTOPLAY_MS = 5000; // advance cadence when idle
const RESUME_MS = 8000; // stillness required before autoplay resumes
const SWIPE_DISTANCE = 60; // px of horizontal drag that commits a slide
const SWIPE_VELOCITY = 400; // px/s flick that commits a slide

function CardVisual({ project, active = false }: { project: Project; active?: boolean }) {
	return (
		<div className={styles.card}>
			<div className={styles.imageWrapper}>
				<img src={project.image} alt={project.title} className={styles.image} draggable={false} />
				{active && (
					<div className={styles.overlay}>
						<HiArrowTopRightOnSquare className={styles.linkIcon} />
					</div>
				)}
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
		</div>
	);
}

export default function ProjectsCarousel({ projects }: { projects: Project[] }) {
	const n = projects.length;
	const [activeIndex, setActiveIndex] = useState(0);

	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reduceMotionRef = useRef(false);

	const stopAutoplay = () => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	};

	const startAutoplay = () => {
		if (reduceMotionRef.current || intervalRef.current || document.hidden) return;
		intervalRef.current = setInterval(() => {
			setActiveIndex((i) => wrapIndex(i + 1, n));
		}, AUTOPLAY_MS);
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
		// Autoplay lifecycle is mount-scoped; helpers close over the stable `n`.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const goTo = (index: number) => {
		setActiveIndex(wrapIndex(index, n));
		pauseAutoplay();
	};

	const handleDragEnd = (_event: unknown, info: PanInfo) => {
		const { offset, velocity } = info;
		if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) {
			setActiveIndex((i) => wrapIndex(i + 1, n));
		} else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) {
			setActiveIndex((i) => wrapIndex(i - 1, n));
		}
		pauseAutoplay();
	};

	const prevIndex = wrapIndex(activeIndex - 1, n);
	const nextIndex = wrapIndex(activeIndex + 1, n);
	const active = projects[activeIndex];

	return (
		<div className={styles.carousel} role="group" aria-roledescription="carousel" aria-label="Projects">
			<div className={styles.stage}>
				<button type="button" className={`${styles.sideCard} ${styles.prev}`} aria-label="Previous project" onClick={() => goTo(activeIndex - 1)}>
					<CardVisual project={projects[prevIndex]} />
				</button>

				<button type="button" className={`${styles.sideCard} ${styles.next}`} aria-label="Next project" onClick={() => goTo(activeIndex + 1)}>
					<CardVisual project={projects[nextIndex]} />
				</button>

				<motion.div key={activeIndex} className={styles.activeCard} drag="x" dragElastic={0.2} dragConstraints={{ left: 0, right: 0 }} onDragStart={pauseAutoplay} onDragEnd={handleDragEnd} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
					<a href={active.link} target="_blank" rel="noopener noreferrer" className={styles.cardLink} aria-label={`View ${active.title}`} draggable={false}>
						<CardVisual project={active} active />
					</a>
				</motion.div>
			</div>

			<div className={styles.dots}>
				{projects.map((project, i) => (
					<button key={project.id} type="button" className={`${styles.dot} ${i === activeIndex ? styles.dotActive : ""}`} aria-label={`Go to project ${i + 1}`} aria-current={i === activeIndex} onClick={() => goTo(i)} />
				))}
			</div>
		</div>
	);
}
