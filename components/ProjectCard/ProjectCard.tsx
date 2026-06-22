import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import styles from "./ProjectCard.module.css";

export interface Project {
	id: number;
	title: string;
	description: string;
	tech: string[];
	image: string;
	link: string;
}

interface ProjectCardProps {
	project: Project;
	/** Extra class applied to the card root (e.g. carousel sizing). */
	className?: string;
	/**
	 * True for duplicated carousel clones: removes them from the a11y tree and tab
	 * order while keeping them mouse-clickable. We intentionally do NOT use `inert`
	 * here — `inert` would block pointer events, so clicking a clone (which scrolls
	 * under the cursor in the marquee) would silently do nothing.
	 */
	ariaHidden?: boolean;
}

export default function ProjectCard({ project, className, ariaHidden = false }: ProjectCardProps) {
	return (
		<div className={`${styles.projectCard}${className ? ` ${className}` : ""}`} aria-hidden={ariaHidden || undefined}>
			<a href={project.link} target="_blank" rel="noopener noreferrer" className={styles.projectCardLink} aria-label={`View ${project.title}`} tabIndex={ariaHidden ? -1 : undefined}>
				<div className={styles.projectImageWrapper}>
					<img src={project.image} alt={project.title} className={styles.projectImage} loading="lazy" decoding="async" />
					<div className={styles.projectOverlay}>
						<HiArrowTopRightOnSquare className={styles.projectLinkIcon} />
					</div>
				</div>

				<div className={styles.projectContent}>
					<h3 className={styles.projectTitle}>{project.title}</h3>
					<p className={styles.projectDescription}>{project.description}</p>

					<div className={styles.projectTech}>
						{project.tech.map((tech, techIndex) => (
							<span key={techIndex} className={styles.techBadge}>
								{tech}
							</span>
						))}
					</div>
				</div>
			</a>
		</div>
	);
}
