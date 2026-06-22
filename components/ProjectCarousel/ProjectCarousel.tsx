"use client";

import { useEffect, useRef, useState } from "react";
import { Project } from "@/components/ProjectCard/ProjectCard";
import CarouselRow from "./CarouselRow";
import { splitRows } from "./carouselMath";
import styles from "./ProjectCarousel.module.css";

interface ProjectCarouselProps {
	projects: Project[];
}

export default function ProjectCarousel({ projects }: ProjectCarouselProps) {
	const [rowTop, rowBottom] = splitRows(projects);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const [inView, setInView] = useState(true);

	useEffect(() => {
		const el = wrapperRef.current;
		if (!el || typeof IntersectionObserver === "undefined") return;
		const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "100px" });
		io.observe(el);
		return () => io.disconnect();
	}, []);

	return (
		<div ref={wrapperRef} className={styles.carousel} role="region" aria-label="Projects carousel">
			<CarouselRow projects={rowTop} direction={-1} inView={inView} />
			<CarouselRow projects={rowBottom} direction={1} inView={inView} />
		</div>
	);
}
