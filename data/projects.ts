export type Project = {
	id: number;
	title: string;
	description: string;
	tech: string[];
	image: string;
	link: string;
};

export const projects: Project[] = [
	{
		id: 0,
		title: "/tanaka-gallery",
		description: "A minimal gallery template for an SF art curator. Stripe integration for demo purposes.",
		tech: ["React", "TypeScript", "Motion", "Stripe"],
		image: "/assets/tanaka.png",
		link: "https://github.com/ben-yeung/tanaka-gallery",
	},
	{
		id: 1,
		title: "/obsidian-buddy",
		description: "A modular AI assistant plugin for Obsidian with permissioned reads/writes to your vault. Modules evolve through use, powered by OpenRouter.",
		tech: ["React", "TypeScript", "Obsidian", "OpenRouter"],
		image: "/assets/obsidian.png",
		link: "https://github.com/ben-yeung/obsidian-buddy",
	},
	{
		id: 2,
		title: "/iron-fit-gym",
		description: "Website for Iron Fit Gym featuring Calendly integration, booking waiver flows, and custom trainer filtering.",
		tech: ["React", "TypeScript", "Next.js", "EmailJS", "Motion"],
		image: "/assets/ironfit.png",
		link: "https://www.ironfittf.com/",
	},
	{
		id: 3,
		title: "/crumbs-starter-kit",
		description: "An open-source starter kit for building data visualization on the CRUMBS AWS Athena interface for AIxCC Finals.",
		tech: ["React", "TypeScript", "Next.js", "Tailwind"],
		image: "/assets/starter.png",
		link: "https://aicyberchallenge.com/",
	},
	{
		id: 4,
		title: "/llm-request-viewer",
		description: "Interactive LLM request viewer displaying submission events, tasks, and requests using CRUMBS AWS Athena AIxCC Finals telemetry data.",
		tech: ["React", "TypeScript", "Next.js"],
		image: "/assets/llm.png",
		link: "https://aicyberchallenge.com/",
	},
	{
		id: 5,
		title: "/novusys",
		description: "A web3 wallet provider built on ERC-4337 using social sign-in and recovery. MV3 Chrome Extension + Launch Landing Site",
		tech: ["React", "TypeScript", "Next.js", "🥇 Scaling ETH 2023 Finalist", "🥈 Gnosis Chain"],
		image: "/assets/novusys.png",
		link: "https://github.com/novusys/novusys",
	},
	{
		id: 6,
		title: "/novusys-paymaster",
		description: "A React widget with a custom ERC-4337 paymaster allowing users to pay for entire transactions using Stripe or ERC-20 tokens.",
		tech: ["React", "TypeScript", "Next.js", "🥇 ETHGlobal Tokyo 2023 Finalist"],
		image: "/assets/paymaster.png",
		link: "https://github.com/novusys/novusys-paymaster",
	},
	{
		id: 7,
		title: "/nft-vision",
		description: "A Discord bot capable of scraping NFT floor prices based on metadata filters, normalized rankings, and marketplaces.",
		tech: ["TypeScript", "Python", "DiscordJS", "MongoDB"],
		image: "/assets/vision2.png",
		link: "https://github.com/ben-yeung/nft-vision-discord",
	},
];
