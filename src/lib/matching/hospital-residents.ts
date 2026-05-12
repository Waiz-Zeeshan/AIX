/**
 * Hospital-Residents (many-to-one Gale-Shapley) — resident-proposing variant.
 *
 * Per SRS §7.3. Pure TypeScript, deterministic, no I/O. Used for both Run 1
 * (Pod Heads propose to Orchs) and Run 2 (Agents propose to Pod Heads) — the
 * resident-optimal variant is correct for both.
 */

import type { HRInput, HRResult, Hospital, Resident } from "./types";

export function hospitalResidents<TId extends string = string>(
  input: HRInput<TId>
): HRResult<TId> {
  const { residents, hospitals } = input;

  const residentById = new Map<TId, Resident<TId>>();
  for (const r of residents) residentById.set(r.id, r);

  const hospitalById = new Map<TId, Hospital<TId>>();
  for (const h of hospitals) hospitalById.set(h.id, h);

  // hRankOf[hid][rid] = rank index (lower = better). Missing rid = not on list.
  const hRankOf = new Map<TId, Map<TId, number>>();
  for (const h of hospitals) {
    const m = new Map<TId, number>();
    h.preferences.forEach((rid, rank) => m.set(rid, rank));
    hRankOf.set(h.id, m);
  }

  const rosters: Record<TId, TId[]> = {} as Record<TId, TId[]>;
  for (const h of hospitals) rosters[h.id] = [];

  const matched: Record<TId, TId | null> = {} as Record<TId, TId | null>;
  const nextProposeIdx = new Map<TId, number>();
  const free = new Set<TId>();
  for (const r of residents) {
    matched[r.id] = null;
    nextProposeIdx.set(r.id, 0);
    free.add(r.id);
  }

  let totalProposals = 0;
  let rounds = 0;

  const rankIn = (hid: TId, rid: TId): number | undefined =>
    hRankOf.get(hid)!.get(rid);

  while (free.size > 0) {
    rounds += 1;
    let progress = false;

    // Deterministic iteration: sort the snapshot of free by id ASC.
    const snapshot = [...free].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    for (const rid of snapshot) {
      if (!free.has(rid)) continue;

      const resident = residentById.get(rid)!;
      const idx = nextProposeIdx.get(rid)!;

      if (idx >= resident.preferences.length) {
        free.delete(rid); // exhausted — straggler
        continue;
      }

      const hid = resident.preferences[idx];
      nextProposeIdx.set(rid, idx + 1);
      totalProposals += 1;

      const hospital = hospitalById.get(hid);
      if (!hospital) {
        // Unknown hospital id in preferences — treat as rejection, keep trying.
        progress = true;
        continue;
      }

      const myRank = rankIn(hid, rid);
      if (myRank === undefined) {
        progress = true; // not on hospital's list → rejected
        continue;
      }

      const roster = rosters[hid];

      if (roster.length < hospital.capacity) {
        roster.push(rid);
        roster.sort((a, b) => rankIn(hid, a)! - rankIn(hid, b)!);
        matched[rid] = hid;
        free.delete(rid);
        progress = true;
      } else {
        const worst = roster[roster.length - 1];
        const worstRank = rankIn(hid, worst)!;
        if (myRank < worstRank) {
          roster.pop();
          roster.push(rid);
          roster.sort((a, b) => rankIn(hid, a)! - rankIn(hid, b)!);
          matched[rid] = hid;
          matched[worst] = null;
          free.delete(rid);
          free.add(worst);
          progress = true;
        }
        // else: rejected, rid stays in free and proposes next round.
      }
    }

    if (!progress) break;
  }

  const stragglers: TId[] = [];
  for (const r of residents) {
    if (matched[r.id] === null) stragglers.push(r.id);
  }
  stragglers.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    matched,
    rosters,
    stragglers,
    stats: { totalProposals, rounds },
  };
}
