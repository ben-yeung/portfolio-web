"use client";

import ProjectCard, { Project } from "@/components/ProjectCard/ProjectCard";
import styles from "./ProjectCarousel.module.css";

interface CarouselRowProps {
	projects: Project[];
	direction: 1 | -1;
	inView: boolean;
}

const COPIES = 2;

export default function CarouselRow({ projects }: CarouselRowProps) {
	return (
		<div className={styles.row}>
			<span className={`${styles.edgeHint} ${styles.edgeHintLeft}`} aria-hidden>
				‹
			</span>
			<span className={`${styles.edgeHint} ${styles.edgeHintRight}`} aria-hidden>
				›
			</span>
			<div className={styles.track}>
				{Array.from({ length: COPIES }).flatMap((_, copy) =>
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
