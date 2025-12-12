"use client";

import { useState, useEffect, FormEvent } from "react";
import { motion } from "framer-motion";
import { HiSun, HiMoon } from "react-icons/hi";
import { SiReact, SiNextdotjs, SiNodedotjs, SiTailwindcss, SiMongodb, SiJavascript, SiTypescript, SiSelenium } from "react-icons/si";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import emailjs from "@emailjs/browser";
import styles from "./page.module.css";
import Navbar from "@/components/NavBar/Navbar";
import Footer from "@/components/Footer/Footer";

const fadeInUp = {
	initial: { opacity: 0, y: 30 },
	animate: { opacity: 1, y: 0 },
};

const projects = [
	{
		id: 1,
		title: "/crumbs-starter-kit",
		description: "An open-source starter kit for building data visualization on the CRUMBS AWS Athena interface for AIxCC Finals.",
		tech: ["React", "TypeScript", "Next.js", "Tailwind"],
		image: "/assets/starter.png",
		link: "https://aicyberchallenge.com/",
	},
	{
		id: 2,
		title: "/llm-request-viewer",
		description: "Interactive LLM request viewer displaying submission events, tasks, and requests using CRUMBS AWS Athena AIxCC Finals telemetry data.",
		tech: ["React", "TypeScript", "Next.js"],
		image: "/assets/llm.png",
		link: "https://aicyberchallenge.com/",
	},
	{
		id: 3,
		title: "/novusys",
		description: "A web3 wallet provider built on ERC-4337 using social sign-in and recovery. MV3 Chrome Extension + Launch Landing Site",
		tech: ["React", "TypeScript", "Next.js", "🥇 Scaling ETH 2023 Finalist", "🥈 Gnosis Chain"],
		image: "/assets/novusys.png",
		link: "https://github.com/novusys/novusys",
	},
	{
		id: 4,
		title: "/novusys-paymaster",
		description: "A React widget with a custom ERC-4337 paymaster allowing users to pay for entire transactions using Stripe or ERC-20 tokens.",
		tech: ["React", "TypeScript", "Next.js", "🥇 ETHGlobal Tokyo 2023 Finalist"],
		image: "/assets/paymaster.png",
		link: "https://github.com/novusys/novusys-paymaster",
	},
];

export default function Home() {
	const [isDark, setIsDark] = useState(true);
	const [currentTitle, setCurrentTitle] = useState(0);
	const [displayedText, setDisplayedText] = useState("");
	const [isTyping, setIsTyping] = useState(true);
	const [hoveredStack, setHoveredStack] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null);

	const titles = ["a full-stack developer.", "a foodie.", "a keyboard enthusiast.", "a matcha enjoyer."];

	useEffect(() => {
		document.body.classList.remove("dark", "light");
		document.body.classList.add(isDark ? "dark" : "light");
	}, [isDark]);

	useEffect(() => {
		let timeout: NodeJS.Timeout;
		const currentFullText = titles[currentTitle];

		if (isTyping) {
			if (displayedText.length < currentFullText.length) {
				timeout = setTimeout(() => {
					setDisplayedText(currentFullText.slice(0, displayedText.length + 1));
				}, 100);
			} else {
				timeout = setTimeout(() => {
					setIsTyping(false);
				}, 2000);
			}
		} else {
			if (displayedText.length > 0) {
				timeout = setTimeout(() => {
					setDisplayedText(displayedText.slice(0, -1));
				}, 50);
			} else {
				setCurrentTitle((prev) => (prev + 1) % titles.length);
				setIsTyping(true);
			}
		}

		return () => clearTimeout(timeout);
	}, [displayedText, isTyping, currentTitle, titles]);

	useEffect(() => {
		if (submitStatus) {
			const timeout = setTimeout(() => {
				setSubmitStatus(null);
			}, 3000);

			return () => clearTimeout(timeout);
		}
	}, [submitStatus]);

	const handleToggleTheme = () => {
		setIsDark(!isDark);
	};

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsSubmitting(true);
		setSubmitStatus(null);

		emailjs.sendForm("service_ip5uu5l", "template_3yohaoz", e.currentTarget, "g0K5rR910iY-3ohtl").then(
			(result) => {
				setSubmitStatus("success");
				setIsSubmitting(false);
				(e.target as HTMLFormElement).reset();
			},
			(error) => {
				console.log(error.text);
				setSubmitStatus("error");
				setIsSubmitting(false);
			}
		);
	};

	return (
		<div className={styles.container}>
			<Navbar />

			<motion.button className={`${styles.themeToggle} themeToggle`} onClick={handleToggleTheme} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} aria-label="Toggle Theme">
				{isDark ? <HiSun /> : <HiMoon />}
			</motion.button>

			<motion.section id="home" className={styles.heroSection}>
				<div className={styles.heroContent}>
					<motion.p className={styles.heroGreeting} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
						Hey, I'm
					</motion.p>
					<motion.h1 className={styles.heroName} initial={fadeInUp.initial} animate={fadeInUp.animate} transition={{ duration: 0.8, delay: 0.4 }}>
						Ben Yeung
					</motion.h1>
					<div className={styles.rotatingTitleContainer}>
						<h2 className={styles.rotatingTitle}>
							{displayedText}
							<span className={styles.cursor}>|</span>
						</h2>
					</div>
				</div>
			</motion.section>

			<motion.section id="about" className={styles.aboutSection} initial="initial" whileInView="animate" viewport={{ once: true, amount: 0.3 }}>
				<div className={styles.aboutContainer}>
					<motion.div className={styles.aboutImageWrapper} variants={fadeInUp} transition={{ duration: 0.8 }}>
						<div className={styles.aboutImage}>
							<img src="/assets/about.jpg" alt="Ben Yeung" />
						</div>
					</motion.div>

					<motion.div className={styles.aboutContent} variants={fadeInUp} transition={{ duration: 0.8, delay: 0.2 }}>
						<h2 className={styles.aboutTitle}>About Me</h2>
						<div className={styles.aboutBio}>
							<p>I'm a full-stack developer building streamlined user experiences in web2 and web3.</p>
							<p>
								UC Berkeley alumni with a degree in CS. <br /> -- Go Bears! 🐻
							</p>
							<p>I love building mechanical keyboards and smaller form factor PCs whenever I can.</p>
							<p className={styles.dailyDriver}>
								Daily Driver :{" "}
								<a href="https://www.youtube.com/watch?v=SQCjNIBbNfs" target="_blank" rel="noopener noreferrer" className={styles.link}>
									Mode Sonnet w/ Gazzew Boba U4Tx Switches
								</a>
							</p>
						</div>

						<div className={styles.stackSection}>
							<div className={styles.stackIcons}>
								<div className={styles.stackIcon} onMouseEnter={() => setHoveredStack("React")} onMouseLeave={() => setHoveredStack("")}>
									<SiReact />
								</div>
								<div className={styles.stackIcon} onMouseEnter={() => setHoveredStack("Next.js")} onMouseLeave={() => setHoveredStack("")}>
									<SiNextdotjs />
								</div>
								<div className={styles.stackIcon} onMouseEnter={() => setHoveredStack("Node.js")} onMouseLeave={() => setHoveredStack("")}>
									<SiNodedotjs />
								</div>
								<div className={styles.stackIcon} onMouseEnter={() => setHoveredStack("MongoDB")} onMouseLeave={() => setHoveredStack("")}>
									<SiMongodb />
								</div>
								<div className={styles.stackIcon} onMouseEnter={() => setHoveredStack("JavaScript")} onMouseLeave={() => setHoveredStack("")}>
									<SiJavascript />
								</div>
								<div className={styles.stackIcon} onMouseEnter={() => setHoveredStack("TypeScript")} onMouseLeave={() => setHoveredStack("")}>
									<SiTypescript />
								</div>
								<div className={styles.stackIcon} onMouseEnter={() => setHoveredStack("Selenium")} onMouseLeave={() => setHoveredStack("")}>
									<SiSelenium />
								</div>
							</div>
							<div className={styles.stackLabel}>{hoveredStack}</div>
						</div>
					</motion.div>
				</div>
			</motion.section>

			<motion.section id="projects" className={styles.projectsSection} initial="initial" whileInView="animate" viewport={{ once: true, amount: 0.3 }}>
				<div className={styles.projectsContainer}>
					<motion.h2 className={styles.projectsTitle} variants={fadeInUp} transition={{ duration: 0.8 }}>
						Projects
					</motion.h2>

					<div className={styles.projectsGrid}>
						{projects.map((project, index) => (
							<motion.div key={project.id} className={styles.projectCard} variants={fadeInUp} transition={{ duration: 0.6, delay: index * 0.1 }}>
								<a href={project.link} target="_blank" rel="noopener noreferrer" className={styles.projectCardLink} aria-label={`View ${project.title}`}>
									<div className={styles.projectImageWrapper}>
										<img src={project.image} alt={project.title} className={styles.projectImage} />
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
							</motion.div>
						))}
					</div>
				</div>
			</motion.section>

			<motion.section id="contact" className={styles.contactSection} initial="initial" whileInView="animate" viewport={{ once: true, amount: 0.3 }}>
				<div className={styles.contactContainer}>
					<motion.h2 className={styles.contactTitle} variants={fadeInUp} transition={{ duration: 0.8 }}>
						Let's Talk!
					</motion.h2>
					<motion.p className={styles.contactDescription} variants={fadeInUp} transition={{ duration: 0.8, delay: 0.2 }}>
						Feel free to reach out with any questions or proposals.
					</motion.p>

					<motion.form className={styles.contactForm} onSubmit={handleSubmit} variants={fadeInUp} transition={{ duration: 0.8, delay: 0.4 }}>
						<div className={styles.formGroup}>
							<label htmlFor="email" className={styles.formLabel}>
								Email
							</label>
							<input type="email" id="email" name="email" className={styles.formInput} placeholder="email@example.com" required aria-label="Email address" />
						</div>

						<div className={styles.formGroup}>
							<label htmlFor="message" className={styles.formLabel}>
								Message
							</label>
							<textarea id="message" name="message" className={styles.formTextarea} placeholder="Your message here..." required aria-label="Message" />
						</div>

						<button type="submit" className={styles.submitButton} disabled={isSubmitting} aria-label="Submit form">
							{isSubmitting ? "Sending..." : "Submit"}
						</button>

						{submitStatus === "success" && <div className={`${styles.statusMessage} ${styles.success}`}>Message sent! I'll get back to you soon.</div>}

						{submitStatus === "error" && <div className={`${styles.statusMessage} ${styles.error}`}>Something went wrong. Please try again.</div>}
					</motion.form>
				</div>
			</motion.section>

			<Footer />
		</div>
	);
}
