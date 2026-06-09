/**
 * Wrap an index into the range [0, n) using positive modulo.
 * This is what makes the carousel loop infinitely in both directions:
 *   wrapIndex(-1, 7) === 6   wrapIndex(7, 7) === 0
 */
export function wrapIndex(i: number, n: number): number {
	return ((i % n) + n) % n;
}
