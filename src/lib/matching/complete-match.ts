/**
 * Completion pass for the Hospital-Residents match (SRS §7.4).
 *
 * Pure TypeScript: no I/O, no Prisma. Mutates none of the caller's inputs.
 * Places every straggler into an open hospital, preferring hospitals that
 * ranked the resident (tier 1) and falling back to lowest-id open hospital
 * (tier 2). Each affected roster is re-sorted by the hospital's preference
 * order (ranked residents first in rank order; unranked appended by id ASC).
 */

import type { CompletedHRResult, Hospital, HRResult } from "./types";

export function completeMatch<TId extends string = string>(
  hrResult: HRResult<TId>,
  hospitals: Hospital<TId>[]
): CompletedHRResult<TId> {
  // Defensive clones so the caller's objects are untouched.
  const matched: Record<TId, TId | null> = { ...hrResult.matched };
  const rosters = {} as Record<TId, TId[]>;
  for (const hid of Object.keys(hrResult.rosters) as TId[]) {
    rosters[hid] = [...hrResult.rosters[hid]];
  }

  // Index hospitals by id and pre-compute rank lookups for O(1) ranking.
  const hospitalById = new Map<TId, Hospital<TId>>();
  const rankMaps = new Map<TId, Map<TId, number>>();
  for (const h of hospitals) {
    hospitalById.set(h.id, h);
    const rm = new Map<TId, number>();
    h.preferences.forEach((rid, idx) => rm.set(rid, idx));
    rankMaps.set(h.id, rm);
    // Ensure every hospital has a roster entry so capacity checks work
    // even if the prior pass never proposed to it.
    if (!(h.id in rosters)) rosters[h.id] = [];
  }

  const completedPlacements: TId[] = [];

  // Deterministic order: stragglers by id ASC.
  const stragglers = [...hrResult.stragglers].sort();

  for (const rid of stragglers) {
    const open = hospitals.filter(
      (h) => rosters[h.id].length < h.capacity
    );
    if (open.length === 0) break;

    // Tier 1: hospitals whose preferences include this resident.
    const tier1 = open.filter((h) => rankMaps.get(h.id)!.has(rid));

    let chosen: Hospital<TId>;
    if (tier1.length > 0) {
      chosen = tier1.reduce((best, h) => {
        const r = rankMaps.get(h.id)!.get(rid)!;
        const bestR = rankMaps.get(best.id)!.get(rid)!;
        if (r < bestR) return h;
        // Tie-break on hospital id ASC for full determinism, though prefs
        // are unique so ties shouldn't occur within one hospital's list.
        if (r === bestR && h.id < best.id) return h;
        return best;
      });
    } else {
      // Tier 2: lowest-id open hospital.
      chosen = open.reduce((best, h) => (h.id < best.id ? h : best));
    }

    rosters[chosen.id] = appendAndSort(rosters[chosen.id], rid, chosen);
    matched[rid] = chosen.id;
    completedPlacements.push(rid);
  }

  return {
    matched,
    rosters,
    stats: hrResult.stats,
    completedPlacements,
  };
}

/**
 * Re-sort a roster after appending `newRid`. Residents on the hospital's
 * preference list come first in rank order; unranked residents follow,
 * sorted by id ASC.
 */
function appendAndSort<TId extends string>(
  roster: TId[],
  newRid: TId,
  hospital: Hospital<TId>
): TId[] {
  const combined = [...roster, newRid];
  const rank = new Map<TId, number>();
  hospital.preferences.forEach((rid, idx) => rank.set(rid, idx));

  return combined.sort((a, b) => {
    const ra = rank.get(a);
    const rb = rank.get(b);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
