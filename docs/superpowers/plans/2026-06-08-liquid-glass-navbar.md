# Liquid Glass Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the navbar's flat opaque pill with translucent liquid glass — real `backdrop-filter` blur, a warm-tinted light mode, a gradient-lit edge, and a glass pill hover.

**Architecture:** Theme-specific surface/border/shadow live in `app/globals.css` (replacing the existing `body.dark nav` / `body.light nav` flat rules). Structural geometry — including the new hover pill — lives in `components/NavBar/Navbar.module.css`. `Navbar.tsx` is untouched. The glass is one fixed element with a single `backdrop-filter`; no JS.

**Tech Stack:** Next.js 16, CSS Modules + a global stylesheet, framer-motion (entrance animation only — not modified).

**Note on verification:** This project has **no test runner** (only `eslint` and `next build`). So each task verifies via `npm run lint`, `npm run build`, and a **visual check** in `npm run dev` at http://localhost:3000. There are no unit tests to write — the verification steps below replace the usual TDD red/green cycle.

**Important — file indentation:** Both CSS files use **tabs**, not spaces. The exact-match strings below use tabs. Preserve them.

---

### Task 1: Replace dark + light nav surfaces with liquid glass

Both theme rules are a matched pair (same gradient-border technique, mirrored colors) and must be seen together to judge, so they're edited and verified in one task.

**Files:**
- Modify: `app/globals.css` (the `body.dark nav`, `body.light nav`, and `body.light nav a::after` rules, currently lines ~121–136)

- [ ] **Step 1: Replace the three nav-theme rules**

Find this exact block:

```css
/* Navbar Theme Styles */
body.dark nav {
	background: #18181b !important;
	border: 1px solid rgba(255, 255, 255, 0.15) !important;
	box-shadow: 0 8px 32px rgba(255, 255, 255, 0.05) !important;
}

body.light nav {
	background: #f5ebe1 !important;
	border: 1px solid rgba(0, 0, 0, 0.1) !important;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
}

body.light nav a::after {
	background-color: #877564 !important;
}
```

Replace it with:

```css
/* Navbar Theme Styles — liquid glass */
body.dark nav {
	/* layer 1 (padding-box): translucent surface; layer 2 (border-box): gradient-lit edge */
	background-image:
		linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02)),
		linear-gradient(150deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.1) 45%, rgba(255, 255, 255, 0.05)) !important;
	background-origin: border-box !important;
	background-clip: padding-box, border-box !important;
	border: 1px solid transparent !important;
	-webkit-backdrop-filter: blur(18px) saturate(170%);
	backdrop-filter: blur(18px) saturate(170%);
	box-shadow:
		0 8px 32px rgba(0, 0, 0, 0.32),
		inset 0 1px 0 rgba(255, 255, 255, 0.3),
		inset 0 -1px 0 rgba(0, 0, 0, 0.15) !important;
}

body.light nav {
	background-image:
		linear-gradient(180deg, rgba(245, 235, 225, 0.6), rgba(135, 117, 100, 0.14)),
		linear-gradient(150deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.15) 45%, rgba(135, 117, 100, 0.25)) !important;
	background-origin: border-box !important;
	background-clip: padding-box, border-box !important;
	border: 1px solid transparent !important;
	-webkit-backdrop-filter: blur(18px) saturate(150%);
	backdrop-filter: blur(18px) saturate(150%);
	box-shadow:
		0 8px 30px rgba(0, 0, 0, 0.12),
		inset 0 1px 1px rgba(255, 255, 255, 0.7) !important;
}
```

(The `body.light nav a::after` rule is intentionally deleted — the underline is removed in Task 3 and the hover becomes a pill.)

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. (CSS isn't linted by eslint, but this confirms nothing else broke.)

- [ ] **Step 3: Visual check**

Run: `npm run dev`, open http://localhost:3000.
Expected:
- Navbar is now translucent — scrolling the page moves content **blurred** behind the pill.
- Top edge of the pill is visibly brighter (light catching the rim).
- Toggle the theme (sun/moon button, top-right). Dark = cool translucent glass; light = subtle warm tint, not flat cream.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Liquid glass navbar surface and gradient edge"
```

---

### Task 2: Add backdrop-filter fallback for unsupported browsers

Keeps the pill legible (more opaque) where `backdrop-filter` is unavailable.

**Files:**
- Modify: `app/globals.css` (add a block immediately after the `body.light nav { … }` rule from Task 1)

- [ ] **Step 1: Add the @supports fallback**

Immediately after the closing `}` of the `body.light nav { … }` rule, add:

```css
/* No backdrop-filter: fall back to a more opaque surface so text stays legible */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
	body.dark nav {
		background-image:
			linear-gradient(180deg, rgba(40, 40, 45, 0.92), rgba(30, 30, 34, 0.92)),
			linear-gradient(150deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.1) 45%, rgba(255, 255, 255, 0.05)) !important;
	}
	body.light nav {
		background-image:
			linear-gradient(180deg, rgba(245, 235, 225, 0.95), rgba(231, 217, 201, 0.95)),
			linear-gradient(150deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.15) 45%, rgba(135, 117, 100, 0.25)) !important;
	}
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds (compiles `globals.css` without CSS syntax errors).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Add navbar backdrop-filter fallback"
```

---

### Task 3: Swap the growing underline for a glass pill hover

Removes the `::after` underline and adds a `::before` pill that fades in behind the hovered item. Geometry goes in the module CSS; theme-specific fill colors go in `globals.css`.

**Files:**
- Modify: `components/NavBar/Navbar.module.css` (the `.navItem::after` and `.navItem:hover::after` rules, currently lines ~34–48)
- Modify: `app/globals.css` (add per-theme pill fill colors)

- [ ] **Step 1: Replace the underline pseudo-element with a pill in the module CSS**

In `components/NavBar/Navbar.module.css`, find this exact block:

```css
.navItem::after {
	content: "";
	position: absolute;
	bottom: 0;
	left: 50%;
	width: 0;
	height: 2px;
	background-color: rgba(255, 255, 255, 0.45);
	transform: translateX(-50%);
	transition: width 0.3s ease;
}

.navItem:hover::after {
	width: 80%;
}
```

Replace it with:

```css
.navItem::before {
	content: "";
	position: absolute;
	top: 50%;
	left: 0;
	right: 0;
	height: 2.1rem;
	transform: translateY(-50%);
	border-radius: 1.05rem;
	opacity: 0;
	transition: opacity 0.25s ease;
}

.navItem:hover::before {
	opacity: 1;
}
```

(The pill paints before the label text — pseudo `::before` renders under the element's own text content — so no z-index juggling is needed. The fill color is set per-theme in the next step.)

- [ ] **Step 2: Add per-theme pill fill colors in globals.css**

In `app/globals.css`, immediately after the `@supports` block added in Task 2, add:

```css
/* Hover pill fill (geometry lives in Navbar.module.css) */
body.dark nav a::before {
	background: rgba(255, 255, 255, 0.1);
}

body.light nav a::before {
	background: rgba(255, 255, 255, 0.45);
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Visual check**

Run: `npm run dev` (if not already running), open http://localhost:3000.
Expected:
- Hovering a nav item fades in a soft translucent **pill** behind the label (no underline).
- Pill is centered on the item, spans its full width, and the label text stays on top and readable.
- Works in both themes: dark pill is a faint white wash; light pill is a brighter white wash.
- Check mobile widths (DevTools responsive ~480px): pill still wraps each item cleanly.

- [ ] **Step 5: Commit**

```bash
git add components/NavBar/Navbar.module.css app/globals.css
git commit -m "Glass pill navbar hover state"
```

---

## Verification checklist (after all tasks)

- [ ] `npm run lint` — clean
- [ ] `npm run build` — succeeds
- [ ] Dark mode: translucent pill, content blurs behind it on scroll, bright top edge
- [ ] Light mode: warm-tinted glass (not flat cream), bright top edge
- [ ] Theme toggle switches cleanly between the two
- [ ] Hover shows the glass pill; no leftover underline
- [ ] Entrance animation (slide down + fade) still plays on load
- [ ] Nav links still smooth-scroll to their sections
