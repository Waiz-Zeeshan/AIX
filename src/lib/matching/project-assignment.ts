/**
 * Project assignment (SRS §7.5) — FCFS with caps and balancing.
 *
 * Pure TypeScript, deterministic, no I/O. Each Pod Head ends with exactly
 * `projectsPerPodHead` DISTINCT projects; project caps are never exceeded.
 */

import type {
  PodHeadForProjects,
  ProjectAssignmentInput,
  ProjectAssignmentResult,
} from "./types";

export function assignProjects<TId extends string = string>(
  input: ProjectAssignmentInput<TId>,
): ProjectAssignmentResult<TId> {
  // TODO: generalize to projectsPerPodHead > 2. v1 of the SRS only specifies
  // primary + secondary, so we lock to N === 2 for now.
  if (input.projectsPerPodHead !== 2) {
    throw new Error(
      `assignProjects v1 only supports projectsPerPodHead === 2 (got ${input.projectsPerPodHead})`,
    );
  }

  const cap: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const p of input.projects) {
    cap[p.id] = p.capacity;
    counts[p.id] = 0;
  }

  // Sort project ids once for deterministic argmin tie-breaking (id ASC).
  const projectIdsSorted = [...input.projects.map((p) => p.id)].sort();

  // FCFS: submittedAt ASC NULLS LAST, then id ASC.
  const ordered = [...input.podHeads].sort(compareFcfs);

  const primaryAssignment: Record<string, TId> = {};
  const primaryDeferred: PodHeadForProjects<TId>[] = [];

  // Pass 1: try each Pod Head's rank-1 pick.
  for (const ph of ordered) {
    const pick = ph.projectPicks[0];
    if (counts[pick] < cap[pick]) {
      primaryAssignment[ph.id] = pick;
      counts[pick] += 1;
    } else {
      primaryDeferred.push(ph);
    }
  }

  // Pass 2: deferred PHs try secondary, else fall to least-loaded.
  for (const ph of primaryDeferred) {
    const pick = ph.projectPicks[1];
    if (counts[pick] < cap[pick]) {
      primaryAssignment[ph.id] = pick;
      counts[pick] += 1;
    } else {
      const leastLoaded = argminAvailable(counts, cap, projectIdsSorted);
      // Caller is expected to pre-validate that total capacity >= total demand.
      if (leastLoaded === null) {
        throw new Error(
          `No project with remaining capacity for primary slot of pod head ${ph.id}`,
        );
      }
      primaryAssignment[ph.id] = leastLoaded as TId;
      counts[leastLoaded] += 1;
    }
  }

  // Pass 3: assign a SECOND distinct project per PH.
  const secondaryAssignment: Record<string, TId> = {};
  for (const ph of ordered) {
    const primary = primaryAssignment[ph.id];
    const secondaryPick = ph.projectPicks[1];

    if (secondaryPick !== primary && counts[secondaryPick] < cap[secondaryPick]) {
      secondaryAssignment[ph.id] = secondaryPick;
      counts[secondaryPick] += 1;
      continue;
    }

    const primaryPick = ph.projectPicks[0];
    if (primaryPick !== primary && counts[primaryPick] < cap[primaryPick]) {
      secondaryAssignment[ph.id] = primaryPick;
      counts[primaryPick] += 1;
      continue;
    }

    const leastLoaded = argminAvailableExcluding(
      counts,
      cap,
      projectIdsSorted,
      primary,
    );
    if (leastLoaded === null) {
      throw new Error(
        `No project with remaining capacity for secondary slot of pod head ${ph.id}`,
      );
    }
    secondaryAssignment[ph.id] = leastLoaded as TId;
    counts[leastLoaded] += 1;
  }

  // Build outputs in input.podHeads order (stable for the caller).
  const assignments: Record<string, TId[]> = {};
  const dispositions: ProjectAssignmentResult<TId>["dispositions"] = [];
  for (const ph of input.podHeads) {
    const primary = primaryAssignment[ph.id];
    const secondary = secondaryAssignment[ph.id];
    assignments[ph.id] = [primary, secondary];

    // rank=1 slot: PRIMARY_HONORED iff their rank-1 pick was placed there.
    const rank1Outcome =
      primary === ph.projectPicks[0]
        ? "PRIMARY_HONORED"
        : "FELL_BACK_TO_BALANCE";
    // rank=2 slot: SECONDARY_HONORED iff their rank-2 pick was placed there
    // AND it's different from the primary slot (always true by construction
    // since assignments are distinct, but we keep the guard for clarity).
    const rank2Outcome =
      secondary === ph.projectPicks[1] && secondary !== primary
        ? "SECONDARY_HONORED"
        : "FELL_BACK_TO_BALANCE";

    dispositions.push({
      podHeadId: ph.id,
      rank: 1,
      projectId: primary,
      outcome: rank1Outcome,
    });
    dispositions.push({
      podHeadId: ph.id,
      rank: 2,
      projectId: secondary,
      outcome: rank2Outcome,
    });
  }

  const loads: Record<string, number> = {};
  for (const id of projectIdsSorted) loads[id] = counts[id];

  return {
    assignments: assignments as Record<TId, TId[]>,
    loads: loads as Record<TId, number>,
    dispositions,
  };
}

function compareFcfs<TId extends string>(
  a: PodHeadForProjects<TId>,
  b: PodHeadForProjects<TId>,
): number {
  // Nulls go LAST so completed submitters get priority (SRS §7.5).
  const aNull = a.preferencesSubmittedAt === null;
  const bNull = b.preferencesSubmittedAt === null;
  if (aNull && !bNull) return 1;
  if (!aNull && bNull) return -1;
  if (!aNull && !bNull) {
    if (a.preferencesSubmittedAt! < b.preferencesSubmittedAt!) return -1;
    if (a.preferencesSubmittedAt! > b.preferencesSubmittedAt!) return 1;
  }
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/** Project with min count among those with remaining capacity; ties by id ASC. */
function argminAvailable(
  counts: Record<string, number>,
  cap: Record<string, number>,
  idsSorted: string[],
): string | null {
  let best: string | null = null;
  for (const id of idsSorted) {
    if (counts[id] >= cap[id]) continue;
    if (best === null || counts[id] < counts[best]) best = id;
  }
  return best;
}

function argminAvailableExcluding(
  counts: Record<string, number>,
  cap: Record<string, number>,
  idsSorted: string[],
  exclude: string,
): string | null {
  let best: string | null = null;
  for (const id of idsSorted) {
    if (id === exclude) continue;
    if (counts[id] >= cap[id]) continue;
    if (best === null || counts[id] < counts[best]) best = id;
  }
  return best;
}
