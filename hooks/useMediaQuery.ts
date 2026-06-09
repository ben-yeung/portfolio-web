import { useEffect, useState } from "react";

/**
 * Returns whether `query` currently matches. Starts `false` on the server and the
 * first client render (so SSR markup is deterministic and hydration never mismatches),
 * then updates to the real value after mount and on every change.
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		const mql = window.matchMedia(query);
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setMatches(mql.matches);

		const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, [query]);

	return matches;
}
