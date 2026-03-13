import type { Metadata } from "next";
import { Didact_Gothic, EB_Garamond, Geist_Mono } from "next/font/google";
import "./globals.css";

const didactGothic = Didact_Gothic({
	variable: "--font-geist-sans",
	subsets: ["latin"],
	weight: ["400"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
	variable: "--font-serif",
	subsets: ["latin"],
	weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
	title: "Hey, I'm Ben Yeung",
	description: "Ben Yeung's Portfolio",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${didactGothic.variable} ${geistMono.variable} ${ebGaramond.variable} dark`} suppressHydrationWarning>
				{children}
			</body>
		</html>
	);
}
