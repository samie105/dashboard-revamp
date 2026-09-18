/**
 * Seeded randomness for the design previews.
 *
 * Every preview renders on the server and again in the browser, so any figure
 * drawn from `Math.random()` differs between the two and React reports a
 * hydration mismatch. A seeded generator gives the same sequence on both, on
 * every machine, every reload — which also means a reviewer and a designer
 * looking at the same page see the same numbers.
 *
 * Four preview data files carried their own copy of `mulberry32` before this
 * existed. New previews import it from here; the older copies can be folded in
 * as those files are next touched.
 *
 * No "use client": server components import this.
 */

/** mulberry32 — a small, fast, well-distributed 32-bit PRNG. Returns [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A stable integer seed from a string, so an id always yields the same data. */
export function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
