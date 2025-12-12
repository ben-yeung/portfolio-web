"use client";

import { motion, animate } from "framer-motion";
import styles from "./Navbar.module.css";

const Navbar = () => {
	const navItems = [
		{ label: "Home", href: "#home" },
		{ label: "About", href: "#about" },
		{ label: "Projects", href: "#projects" },
		{ label: "Contact", href: "#contact" },
	];

	const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
		e.preventDefault();
		const element = document.querySelector(href);
		if (element) {
			const targetPosition = element.getBoundingClientRect().top + window.scrollY - 80;

			animate(window.scrollY, targetPosition, {
				duration: 0.8,
				ease: "easeInOut",
				onUpdate: (latest) => window.scrollTo(0, latest),
			});
		}
	};

	return (
		<motion.nav className={styles.navbar} initial={{ y: -100, opacity: 0, x: "-50%" }} animate={{ y: 0, opacity: 1, x: "-50%" }} transition={{ duration: 0.5, delay: 0.5 }}>
			<div className={styles.navContainer}>
				{navItems.map((item, index) => (
					<motion.a key={item.label} href={item.href} className={styles.navItem} onClick={(e) => handleNavClick(e, item.href)} whileTap={{ scale: 0.95 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + index * 0.05 }}>
						{item.label}
					</motion.a>
				))}
			</div>
		</motion.nav>
	);
};

export default Navbar;
