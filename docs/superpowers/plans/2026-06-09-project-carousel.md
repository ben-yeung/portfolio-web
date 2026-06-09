# Two-Row Project Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop projects grid with a two-row, opposite-direction, auto-scrolling carousel that pauses and steers per-row with the cursor, while leaving the mobile/tablet stacked layout unchanged.

**Architecture:** Extract the existing inline card markup into a reusable `ProjectCard`. A new client component `ProjectCarousel` splits the projects in half and renders two `CarouselRow`s (opposite drift directions). Each `CarouselRow` owns a `requestAnimationFrame` loop driving a CSS `translateX` on a duplicated card track, with pointer geometry deciding idle-drift / pause / edge-steer. Desktop vs. mobile is a pure CSS `display` toggle; the carousel JS guards itself when hidden. Pure geometry helpers live in `carouselMath.ts`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, CSS Modules, framer-motion (existing, used only by the mobile grid). No test framework — verification is `tsc --noEmit`, `eslint`, `next build`, and a manual browser checklist.

**Spec:** `docs/superpowers/specs/2026-06-09-project-carousel-design.md`

**Conventions for this repo:**
- CSS Modules with kebab-not-used; class names are camelCase (e.g., `styles.projectCard`).
- Tabs for indentation in existing files (match the surrounding file).
- Path alias `@/` maps to the repo root (e.g., `@/components/...`).
- No automated tests exist; do not add a test runner.

**Verification commands (used throughout):**
- Typecheck: `npx tsc --noEmit`
- Lint: `npm run lint`
- Production build: `npm run build`
- Manual: `npm run dev` then open `http://localhost:3000`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `components/ProjectCard/ProjectCard.tsx` | **Create.** Presentational card (link, image+overlay, title, description, tech badges). Used by both the mobile grid and the carousel. |
| `components/ProjectCard/ProjectCard.module.css` | **Create.** Card-only styles, moved out of `app/page.module.css`. |
| `components/ProjectCarousel/carouselMath.ts` | **Create.** Pure helpers: `splitRows`, `computeCopies`, `wrapOffset`, `rowVelocity`. |
| `components/ProjectCarousel/CarouselRow.tsx` | **Create.** One animated row: rAF loop, pointer handling, seamless-loop sizing, edge arrows. |
| `components/ProjectCarousel/ProjectCarousel.tsx` | **Create.** Splits projects, renders two rows, owns the `IntersectionObserver`. |
| `components/ProjectCarousel/ProjectCarousel.module.css` | **Create.** Row/track/card-slot/edge-hint styles + the `≥1025px` show toggle. |
| `app/page.tsx` | **Modify.** Use `ProjectCard` in the grid; render `ProjectCarousel`; drop the now-unused icon import. |
| `app/page.module.css` | **Modify.** Remove card-only rules (moved to `ProjectCard.module.css`); hide the grid at `≥1025px`. |

---

## Task 1: Extract `ProjectCard` (no behavior change)

Pull the inline card markup and its CSS out of the page so both layouts share one card. After this task the site looks **identical** at every width.

**Files:**
- Create: `components/ProjectCard/ProjectCard.tsx`
- Create: `components/ProjectCard/ProjectCard.module.css`
- Modify: `app/page.tsx` (imports + the `.projectsGrid` map, lines ~7 and ~313-339)
- Modify: `app/page.module.css` (remove card-only rules at lines ~340-445, the `.projectLinkIcon` override in the `768` block ~516-519, and the card-only rules in the `480` block ~574-595)

- [ ] **Step 1: Create the `ProjectCard` component**

Create `components/ProjectCard/ProjectCard.tsx`:

```tsx
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
	/** True for duplicated carousel clones: removes them from a11y + tab order. */
	ariaHidden?: boolean;
}

export default function ProjectCard({ project, className, ariaHidden = false }: ProjectCardProps) {
	return (
		<div className={`${styles.projectCard}${className ? ` ${className}` : ""}`} aria-hidden={ariaHidden || undefined} inert={ariaHidden || undefined}>
			<a href={project.link} target="_blank" rel="noopener noreferrer" className={styles.projectCardLink} aria-label={`View ${project.title}`} tabIndex={ariaHidden ? -1 : undefined}>
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
		</div>
	);
}
```

- [ ] **Step 2: Create the card CSS module**

Create `components/ProjectCard/ProjectCard.module.css` with the card rules moved from `app/page.module.css` (note the added `width: 100%` on `.projectCard` so it fills whatever container holds it — grid cell or carousel slot):

```css
.projectCard {
	/* Liquid-glass surface matching the navbar, but with the lit edge on the BOTTOM
	   to round out the description area: translucent surface clipped to padding-box,
	   bottom-lit gradient edge clipped to border-box. */
	width: 100%;
	background-image: var(--glass-surface), var(--glass-edge-bottom);
	background-origin: border-box;
	background-clip: padding-box, border-box;
	border: 1px solid transparent;
	border-radius: 1rem;
	overflow: hidden;
	/* Frost the dot grid behind the card so description text stays readable. */
	-webkit-backdrop-filter: blur(3px) saturate(120%);
	backdrop-filter: blur(3px) saturate(120%);
	box-shadow: var(--glass-inset-bottom);
	transition: all 0.3s ease;
}

.projectCard:hover {
	background-image: var(--glass-surface-hover), var(--glass-edge-bottom);
	box-shadow: var(--project-card-hover-shadow), var(--glass-inset-bottom);
}

.projectCardLink {
	display: block;
	text-decoration: none;
	color: inherit;
}

.projectImageWrapper {
	position: relative;
	width: 100%;
	aspect-ratio: 16/9;
	overflow: hidden;
	background: var(--project-image-bg);
}

.projectImage {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.projectOverlay {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	opacity: 0;
	transition: opacity 0.3s ease;
}

.projectCard:hover .projectOverlay {
	opacity: 1;
}

.projectLinkIcon {
	width: 3rem;
	height: 3rem;
	color: white;
}

.projectContent {
	padding: 1.25rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.projectTitle {
	font-size: 1.5rem;
	font-weight: 600;
	margin: 0;
	line-height: 1.3;
}

.projectDescription {
	font-size: 1.2rem;
	line-height: 1.5;
	margin: 0;
	opacity: 0.7;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.projectTech {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.techBadge {
	padding: 0.4rem 0.75rem;
	background: var(--tech-badge-bg);
	border-radius: 0.375rem;
	font-size: 1rem;
	font-weight: 500;
	opacity: 0.9;
}

@media (max-width: 768px) {
	.projectLinkIcon {
		width: 2.5rem;
		height: 2.5rem;
	}
}

@media (max-width: 480px) {
	.projectContent {
		padding: 1rem;
		gap: 0.625rem;
	}

	.projectTitle {
		font-size: 1.25rem;
	}

	.projectDescription {
		font-size: 0.875rem;
	}

	.projectLinkIcon {
		width: 2rem;
		height: 2rem;
	}

	.techBadge {
		padding: 0.35rem 0.65rem;
		font-size: 0.75rem;
	}
}
```

- [ ] **Step 3: Remove the moved card rules from `app/page.module.css`**

Delete these rule blocks from `app/page.module.css` (they now live in `ProjectCard.module.css`):
- The base block: everything from `.projectCard {` through the end of `.techBadge { ... }` (the contiguous block at ~lines 340-445).
- Inside the `@media (max-width: 768px)` block: the `.projectLinkIcon { width: 2.5rem; height: 2.5rem; }` rule (~lines 516-519).
- Inside the `@media (max-width: 480px)` block: the `.projectContent`, `.projectTitle`, `.projectDescription`, `.projectLinkIcon`, and `.techBadge` rules (~lines 574-595).

Keep `.projectsSection`, `.projectsContainer`, `.projectsTitle`, `.projectsGrid` and their responsive variants — those stay in `page.module.css`.

- [ ] **Step 4: Update `app/page.tsx` imports**

Remove the now-unused icon import (it moved into `ProjectCard`) and add the new imports. In the import block near the top:

Remove this line:
```tsx
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
```

Add (after the existing `DotControls` import line ~14):
```tsx
import ProjectCard, { Project } from "@/components/ProjectCard/ProjectCard";
```

Type the existing `projects` array by changing its declaration:
```tsx
const projects: Project[] = [
```

- [ ] **Step 5: Replace the grid card markup in `app/page.tsx`**

Replace the `.projectsGrid` block (the `<div className={styles.projectsGrid}> ... </div>` containing the `projects.map(...)`, ~lines 313-339) with:

```tsx
					<div className={styles.projectsGrid}>
						{projects.map((project, index) => (
							<motion.div key={project.id} variants={fadeInUp} initial="initial" whileInView="animate" viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.6, delay: index * 0.1 }}>
								<ProjectCard project={project} />
							</motion.div>
						))}
					</div>
```

- [ ] **Step 6: Verify typecheck, lint, build**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all succeed with no errors. (If `inert` raises a type error, confirm `@types/react` is v19 — it is per `package.json`; `inert?: boolean` is supported.)

- [ ] **Step 7: Manual check — nothing changed visually**

Run `npm run dev`, open `http://localhost:3000`, scroll to Projects. At desktop width it should still show the 2-column grid; at ≤768px the single column. Card hover (image overlay, lift) and links still work in both light and dark themes.

- [ ] **Step 8: Commit**

```bash
git add components/ProjectCard app/page.tsx app/page.module.css
git commit -m "refactor(projects): extract ProjectCard component and styles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Pure geometry helpers (`carouselMath.ts`)

Isolate the math so the row component stays focused on DOM/effects.

**Files:**
- Create: `components/ProjectCarousel/carouselMath.ts`

- [ ] **Step 1: Create the helpers**

Create `components/ProjectCarousel/carouselMath.ts`:

```ts
/** Split a list into two rows: first floor(n/2), then the rest (so row 1 <= row 2). */
export function splitRows<T>(items: T[]): [T[], T[]] {
	const mid = Math.floor(items.length / 2);
	return [items.slice(0, mid), items.slice(mid)];
}

/**
 * How many copies of one card-set are needed so the track always overflows the
 * container, leaving a full extra set to wrap into for a seamless loop.
 */
export function computeCopies(setWidth: number, containerWidth: number): number {
	if (setWidth <= 0) return 2;
	return Math.max(2, Math.ceil(containerWidth / setWidth) + 1);
}

/** Wrap a translateX offset into the half-open range (-setWidth, 0] for a seamless modulo loop. */
export function wrapOffset(offset: number, setWidth: number): number {
	if (setWidth <= 0) return 0;
	let o = offset % setWidth;
	if (o > 0) o -= setWidth;
	return o;
}

export interface RowVelocityInput {
	pointerInside: boolean;
	pointerOverRow: boolean;
	/** Pointer x relative to the row's left edge, in px. */
	relX: number;
	rowWidth: number;
	/** +1 = idle-drift right, -1 = idle-drift left. */
	defaultDir: 1 | -1;
	/** Idle drift speed, px/sec. */
	base: number;
	/** Max steer speed at the very edge, px/sec. */
	maxEdge: number;
	/** Edge-zone width as a fraction of row width (0..0.5). */
	edgeFrac: number;
}

export interface RowVelocityOutput {
	/** Signed velocity in px/sec (positive = content moves right). */
	v: number;
	/** Left-arrow intensity 0..1. */
	leftF: number;
	/** Right-arrow intensity 0..1. */
	rightF: number;
}

/**
 * Decide a row's scroll velocity from pointer geometry:
 * - not over the row  -> idle drift in defaultDir
 * - over a left/right edge zone -> steer that direction, ramping toward the edge
 * - over the middle   -> pause (v = 0)
 */
export function rowVelocity(input: RowVelocityInput): RowVelocityOutput {
	const { pointerInside, pointerOverRow, relX, rowWidth, defaultDir, base, maxEdge, edgeFrac } = input;
	if (!pointerInside || !pointerOverRow || rowWidth <= 0) {
		return { v: defaultDir * base, leftF: 0, rightF: 0 };
	}
	const edgeW = rowWidth * edgeFrac;
	const leftF = relX < edgeW ? Math.min((edgeW - relX) / edgeW, 1) : 0;
	const rightF = relX > rowWidth - edgeW ? Math.min((relX - (rowWidth - edgeW)) / edgeW, 1) : 0;
	if (leftF > 0) return { v: maxEdge * leftF, leftF, rightF: 0 };
	if (rightF > 0) return { v: -maxEdge * rightF, leftF: 0, rightF };
	return { v: 0, leftF: 0, rightF: 0 };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add components/ProjectCarousel/carouselMath.ts
git commit -m "feat(carousel): add pure geometry helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Static two-row scaffold + desktop/mobile toggle

Get the layout and CSS toggle right before adding motion. After this task, desktop shows two static rows of cards; mobile still shows the stacked grid.

**Files:**
- Create: `components/ProjectCarousel/CarouselRow.tsx`
- Create: `components/ProjectCarousel/ProjectCarousel.tsx`
- Create: `components/ProjectCarousel/ProjectCarousel.module.css`
- Modify: `app/page.tsx` (import + render the carousel)
- Modify: `app/page.module.css` (hide the grid at `≥1025px`)

- [ ] **Step 1: Create the CSS module**

Create `components/ProjectCarousel/ProjectCarousel.module.css`:

```css
.carousel {
	display: none;
	width: 100%;
	margin-top: 2rem;
}

/* Carousel is desktop-only; below this the page renders the stacked grid. */
@media (min-width: 1025px) {
	.carousel {
		display: block;
	}
}

.row {
	position: relative;
	overflow: hidden;
	padding: 0.85rem 0;
	-webkit-mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
	mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
}

.track {
	display: flex;
	gap: 1.75rem;
	width: max-content;
	will-change: transform;
}

.cardSlot {
	display: flex;
	flex: 0 0 clamp(440px, 45vw, 720px);
	width: clamp(440px, 45vw, 720px);
}

.edgeHint {
	position: absolute;
	top: 0;
	bottom: 0;
	width: 18%;
	display: flex;
	align-items: center;
	font-size: 2.2rem;
	color: var(--text-primary);
	pointer-events: none;
	opacity: 0;
	z-index: 5;
}

.edgeHintLeft {
	left: 0;
	justify-content: flex-start;
	padding-left: 1.2rem;
	background: linear-gradient(90deg, rgba(135, 117, 100, 0.18), transparent);
}

.edgeHintRight {
	right: 0;
	justify-content: flex-end;
	padding-right: 1.2rem;
	background: linear-gradient(270deg, rgba(135, 117, 100, 0.18), transparent);
}
```

- [ ] **Step 2: Create the static `CarouselRow`**

Create `components/ProjectCarousel/CarouselRow.tsx` (static scaffold — fixed 2 copies, no animation yet; the rAF/pointer logic is added in Task 4):

```tsx
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
```

- [ ] **Step 3: Create `ProjectCarousel`**

Create `components/ProjectCarousel/ProjectCarousel.tsx` (static for now — `inView` is hard-coded `true`; the `IntersectionObserver` is added in Task 5):

```tsx
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
```

- [ ] **Step 4: Render the carousel in `app/page.tsx`**

Add the import (after the `ProjectCard` import from Task 1):
```tsx
import ProjectCarousel from "@/components/ProjectCarousel/ProjectCarousel";
```

In the projects section, add the carousel immediately **before** the `.projectsGrid` div (so the carousel shows on desktop, the grid on mobile). The block becomes:

```tsx
					<ProjectCarousel projects={projects} />

					<div className={styles.projectsGrid}>
						{projects.map((project, index) => (
							<motion.div key={project.id} variants={fadeInUp} initial="initial" whileInView="animate" viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.6, delay: index * 0.1 }}>
								<ProjectCard project={project} />
							</motion.div>
						))}
					</div>
```

- [ ] **Step 5: Hide the grid on desktop in `app/page.module.css`**

The grid must disappear where the carousel appears. Add this rule (place it right after the existing `@media (max-width: 1024px) { .projectsGrid { ... } }` block):

```css
@media (min-width: 1025px) {
	.projectsGrid {
		display: none;
	}
}
```

- [ ] **Step 6: Verify typecheck, lint, build**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all PASS.

- [ ] **Step 7: Manual check — static two-row layout**

`npm run dev`, open `http://localhost:3000`:
- At desktop width (≥1025px): two static rows of cards, ~2 cards wide with the next peeking, edges softly faded. No motion yet. Grid is gone.
- Resize to ≤1024px: the stacked single-column grid returns; carousel is hidden.
- Both themes look correct.

- [ ] **Step 8: Commit**

```bash
git add components/ProjectCarousel app/page.tsx app/page.module.css
git commit -m "feat(carousel): static two-row scaffold with desktop toggle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Animate the rows — drift, seamless loop, pause, edge-steer

Replace the static `CarouselRow` with the full interactive implementation: measured seamless loop, idle drift, per-row pause, edge steering with arrow feedback, reduced-motion slow-down, and keyboard focus pause.

**Files:**
- Modify: `components/ProjectCarousel/CarouselRow.tsx` (full replacement)

- [ ] **Step 1: Replace `CarouselRow.tsx` with the full implementation**

Replace the entire contents of `components/ProjectCarousel/CarouselRow.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import ProjectCard, { Project } from "@/components/ProjectCard/ProjectCard";
import { computeCopies, rowVelocity, wrapOffset } from "./carouselMath";
import styles from "./ProjectCarousel.module.css";

const BASE = 55; // idle drift, px/sec
const BASE_REDUCED = 15; // idle drift under prefers-reduced-motion, px/sec
const MAX_EDGE = 620; // max steer speed at the very edge, px/sec
const EDGE_FRAC = 0.18; // edge-zone width as a fraction of row width

interface CarouselRowProps {
	projects: Project[];
	direction: 1 | -1;
	inView: boolean;
}

export default function CarouselRow({ projects, direction, inView }: CarouselRowProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const leftArrowRef = useRef<HTMLSpanElement>(null);
	const rightArrowRef = useRef<HTMLSpanElement>(null);

	const [copies, setCopies] = useState(2);

	const offsetRef = useRef(0);
	const setWidthRef = useRef(0);
	const pointerRef = useRef({ x: 0, y: 0, inside: false });
	const focusedRef = useRef(false);
	const reducedRef = useRef(false);

	const setLen = projects.length;

	// Track the reduced-motion preference (slows idle drift; gestures still work).
	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		reducedRef.current = mq.matches;
		const onChange = () => {
			reducedRef.current = mq.matches;
		};
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);

	// Measure one set's period (distance between set 0 and set 1) and grow the
	// copy count until the track overflows the row for a seamless loop.
	useEffect(() => {
		const measure = () => {
			const root = rootRef.current;
			const track = trackRef.current;
			if (!root || !track) return;
			if (root.offsetParent === null || root.clientWidth === 0) return; // hidden (mobile)
			if (track.children.length < setLen + 1) return;
			const first = track.children[0] as HTMLElement;
			const nextSet = track.children[setLen] as HTMLElement;
			const period = nextSet.offsetLeft - first.offsetLeft;
			if (period <= 0) return;
			setWidthRef.current = period;
			const needed = computeCopies(period, root.clientWidth);
			setCopies((prev) => (prev !== needed ? needed : prev));
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [copies, setLen]);

	// Pointer + focus tracking on the row.
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const onMove = (e: MouseEvent) => {
			pointerRef.current = { x: e.clientX, y: e.clientY, inside: true };
		};
		const onLeave = () => {
			pointerRef.current.inside = false;
		};
		const onFocusIn = () => {
			focusedRef.current = true;
		};
		const onFocusOut = () => {
			focusedRef.current = false;
		};
		root.addEventListener("mousemove", onMove);
		root.addEventListener("mouseleave", onLeave);
		root.addEventListener("focusin", onFocusIn);
		root.addEventListener("focusout", onFocusOut);
		return () => {
			root.removeEventListener("mousemove", onMove);
			root.removeEventListener("mouseleave", onLeave);
			root.removeEventListener("focusin", onFocusIn);
			root.removeEventListener("focusout", onFocusOut);
		};
	}, []);

	// The animation loop.
	useEffect(() => {
		if (!inView) return;
		const root = rootRef.current;
		const track = trackRef.current;
		if (!root || !track) return;

		let rafId = 0;
		let last = performance.now();

		const frame = (now: number) => {
			const dt = Math.min((now - last) / 1000, 0.05);
			last = now;

			const setWidth = setWidthRef.current;
			if (setWidth > 0 && root.offsetParent !== null) {
				const rect = root.getBoundingClientRect();
				const p = pointerRef.current;
				const overRow = p.inside && p.y >= rect.top && p.y <= rect.bottom;
				const { v, leftF, rightF } = rowVelocity({
					pointerInside: p.inside,
					pointerOverRow: overRow,
					relX: p.x - rect.left,
					rowWidth: rect.width,
					defaultDir: direction,
					base: reducedRef.current ? BASE_REDUCED : BASE,
					maxEdge: MAX_EDGE,
					edgeFrac: EDGE_FRAC,
				});

				let vel = v;
				if (focusedRef.current && !p.inside) vel = 0; // keyboard focus pauses the row

				offsetRef.current = wrapOffset(offsetRef.current + vel * dt, setWidth);
				track.style.transform = `translateX(${offsetRef.current}px)`;

				if (leftArrowRef.current) leftArrowRef.current.style.opacity = leftF ? String(0.25 + 0.75 * leftF) : "0";
				if (rightArrowRef.current) rightArrowRef.current.style.opacity = rightF ? String(0.25 + 0.75 * rightF) : "0";
			}

			rafId = requestAnimationFrame(frame);
		};

		rafId = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(rafId);
	}, [inView, direction]);

	return (
		<div ref={rootRef} className={styles.row}>
			<span ref={leftArrowRef} className={`${styles.edgeHint} ${styles.edgeHintLeft}`} aria-hidden>
				‹
			</span>
			<span ref={rightArrowRef} className={`${styles.edgeHint} ${styles.edgeHintRight}`} aria-hidden>
				›
			</span>
			<div ref={trackRef} className={styles.track}>
				{Array.from({ length: copies }).flatMap((_, copy) =>
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
```

- [ ] **Step 2: Verify typecheck, lint, build**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all PASS.

- [ ] **Step 3: Manual check — full interaction**

`npm run dev`, desktop width, scroll to Projects:
- Row 1 drifts right, row 2 drifts left; the loop is seamless (no jump or empty gap) — watch through a full cycle.
- Hover a row's middle: **only** that row pauses; the other keeps drifting.
- Move toward a row's left/right edge: **only** that row steers that direction, faster nearer the edge, and the ‹ or › arrow glows in that row.
- Test at 1280px, 1440px, and 1920px (and a maximized ultrawide if available): always ~2 cards visible, no empty gaps in the loop.
- Tab with the keyboard: focus reaches each project once (clones are skipped); the focused card's row holds still.
- Toggle OS "reduce motion" on: drift is much slower but pause + edge-steer still work.

- [ ] **Step 4: Commit**

```bash
git add components/ProjectCarousel/CarouselRow.tsx
git commit -m "feat(carousel): rAF drift, seamless loop, pause, and edge-steer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Pause off-screen + final verification

Stop the rAF work when the projects section is scrolled out of view, then run the full verification pass.

**Files:**
- Modify: `components/ProjectCarousel/ProjectCarousel.tsx` (add `IntersectionObserver`)

- [ ] **Step 1: Add the `IntersectionObserver` to `ProjectCarousel.tsx`**

Replace the entire contents of `components/ProjectCarousel/ProjectCarousel.tsx` with:

```tsx
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
		<div ref={wrapperRef} className={styles.carousel} aria-label="Projects">
			<CarouselRow projects={rowTop} direction={1} inView={inView} />
			<CarouselRow projects={rowBottom} direction={-1} inView={inView} />
		</div>
	);
}
```

- [ ] **Step 2: Verify typecheck, lint, build**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all PASS.

- [ ] **Step 3: Full manual QA checklist (from the spec)**

`npm run dev`, then verify every item:
- [ ] Desktop (≥1025px): two rows; row 1 drifts right, row 2 left; loop is seamless.
- [ ] Hovering a row's middle pauses **only** that row.
- [ ] Edge zones steer **only** the hovered row; speed ramps to the edge; ‹/› arrow shows in that row.
- [ ] ~2 cards visible (third peeking) at 1280 / 1440 / 1920 with no empty gaps in the loop.
- [ ] ≤1024px renders the existing single-column stacked cards, unchanged.
- [ ] `prefers-reduced-motion` slows the drift but keeps pause + edge-steer working.
- [ ] Keyboard tab reaches each project once; focusing a card pauses its row.
- [ ] Light and dark themes both correct.
- [ ] Scrolling the section out of view and back resumes cleanly (no jump); no console errors.

- [ ] **Step 4: Commit**

```bash
git add components/ProjectCarousel/ProjectCarousel.tsx
git commit -m "feat(carousel): pause animation when section is offscreen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes (author checklist — verify before execution)

**Spec coverage:**
- Two-row split (3 right / 4 left) → `splitRows` + `direction` props (Tasks 2, 3, 5). ✓
- Card width `clamp(440px, 45vw, 720px)`, gap 1.75rem, edge fade → `ProjectCarousel.module.css` (Task 3). ✓
- Per-row idle / pause / edge-steer with ramp + arrows → `rowVelocity` + loop (Tasks 2, 4). ✓
- Seamless loop via measured period + clone count → measure effect + `computeCopies`/`wrapOffset` (Tasks 2, 4). ✓
- Breakpoint ≥1025px carousel / ≤1024px grid → CSS toggle (Task 3). ✓
- Reduced motion = slowed drift, gestures kept → `BASE_REDUCED` (Task 4). ✓
- a11y: clones `aria-hidden`+`inert`, focus pauses row → `ProjectCard` props + focus handlers (Tasks 1, 4). ✓
- Perf: transform-only + `will-change` + IntersectionObserver + hidden-guard → CSS + Tasks 4, 5. ✓
- Manual verification (no test runner) → checklists in Tasks 3, 4, 5. ✓

**Type consistency:** `Project` defined once in `ProjectCard.tsx` and imported everywhere; helper names (`splitRows`, `computeCopies`, `wrapOffset`, `rowVelocity`) and the `CarouselRow` props (`projects`, `direction`, `inView`) are identical across Tasks 2-5. ✓

**No placeholders:** every code step contains full file or full-block content. ✓
