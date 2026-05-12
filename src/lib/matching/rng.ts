/**
 * Deterministic seeded PRNG (mulberry32) used everywhere matching needs
 * randomness. Same seed → same sequence — required for SRS §7.8 determinism.
 *
 * Seed convention (SRS §7.2):
 *   "ai-unlimited-" + matchType + "-" + currentRunId
 */

import type { Rng } from "./types";

function hashSeed(seed: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function seededRng(seed: string): Rng {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle, deterministic given the rng. Returns a new array. */
export function shuffle<T>(input: readonly T[], rng: Rng): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Sample k items uniformly without replacement, deterministic given the rng. */
export function sample<T>(input: readonly T[], k: number, rng: Rng): T[] {
  if (k >= input.length) return shuffle(input, rng);
  return shuffle(input, rng).slice(0, k);
}
