"use client";

import { FaLinkedin, FaGithub } from "react-icons/fa";
import { BsSpotify } from "react-icons/bs";
import useSWR from "swr";
import styles from "./Footer.module.css";

const Footer = () => {
	const fetcher = (url: string) => fetch(url).then((r) => r.json());
	const { data } = useSWR("/api/spotify", fetcher);

	return (
		<footer className={styles.footer}>
			<div className={styles.container}>
				<div className={styles.socialLinks}>
					<a href="https://www.linkedin.com/in/benjaminjyeung/" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="LinkedIn">
						<FaLinkedin />
					</a>
					<a href="https://github.com/ben-yeung" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="GitHub">
						<FaGithub />
					</a>
					<a href={data?.isPlaying ? data.songUrl : "https://open.spotify.com/user/benyeung"} target="_blank" rel="noopener noreferrer" className={styles.spotifyWidget} aria-label="Spotify">
						<div className={styles.spotifyIcon}>
							<BsSpotify />
						</div>
						<div className={styles.spotifyInfo}>
							{data?.isPlaying ? (
								<div className={styles.spotifyPlaying}>
									<span>Playing</span>
									<span className={styles.spotifyTitle}>{data.title}</span>
									<span>by {data.artist}</span>
								</div>
							) : (
								<span>Not Playing</span>
							)}
						</div>
					</a>
				</div>

				<div className={styles.divider}></div>

				<div className={styles.copyright}>
					<p>© 2025 Made with ❤️ by Ben Yeung</p>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
