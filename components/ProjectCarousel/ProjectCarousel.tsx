"use client";

import { Project } from "@/components/ProjectCard/ProjectCard";
import CarouselRow from "./CarouselRow";
import { splitRows } from "./carouselMath";
import styles from "./ProjectCarousel.module.css";

interface ProjectCarouselProps {
	projects: Project[];
}

export default function ProjectCarousel({ projects }: ProjectCarouselProps) {
	const [rowTop, rowBottom] = splitRows(projects);

	return (
		<div className={styles.carousel} aria-label="Projects">
			<CarouselRow projects={rowTop} direction={1} inView={true} />
			<CarouselRow projects={rowBottom} direction={-1} inView={true} />
		</div>
	);
}
