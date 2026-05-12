/**
 * Deterministic auto-fill for non-submitters (SRS §7.2).
 *
 * Pure TypeScript: no Prisma, no I/O. Given the set of ids who *did* submit,
 * generate plausible preferences for the rest using the seeded PRNG so that
 * (matchType, runId) is the only input that influences randomness.
 */

import { sample, seededRng, shuffle } from "./rng";
import type {
  AutoFillInput,
  AutoFillResult,
  AutoFillRow,
  Rng,
} from "./types";

/** Build rows by sampling k targets for a single fromId, ranking 1..k. */
function rankSample<TId extends string>(
  fromId: TId,
  pool: readonly TId[],
  k: number,
  rng: Rng,
): AutoFillRow<TId>[] {
  const picked = sample(pool, k, rng);
  return picked.map((toId, i) => ({ fromId, toId, rank: i + 1 }));
}

/** Build rows by ranking the entire pool 1..N for a single fromId. */
function rankAll<TId extends string>(
  fromId: TId,
  pool: readonly TId[],
  rng: Rng,
): AutoFillRow<TId>[] {
  const ordered = shuffle(pool, rng);
  return ordered.map((toId, i) => ({ fromId, toId, rank: i + 1 }));
}

export function autoFillPreferences<TId extends string = string>(
  input: AutoFillInput<TId>,
): AutoFillResult<TId> {
  const seed = `ai-unlimited-${input.matchType}-${input.runId}`;
  const rng = seededRng(seed);

  const result: AutoFillResult<TId> = {
    podHeadOrchRankings: [],
    orchPodHeadSelections: [],
    podHeadAgentSelections: [],
    agentPodHeadRankings: [],
    podHeadProjectPicks: [],
    autoFilledUserIds: [],
  };

  const filled = new Set<TId>();

  // Deterministic id ordering before any randomness is applied.
  const sortedPodHeads = [...input.podHeads].sort();
  const sortedOrchs = [...input.orchs].sort();
  const sortedAgents = [...input.agents].sort();
  const sortedProjects = [...input.projects].sort();

  if (input.matchType === "ORCH_PODHEAD") {
    // Pod Heads who didn't rank Orchs → rank ALL Orchs.
    for (const phId of sortedPodHeads) {
      if (input.podHeadsWhoRankedOrchs.has(phId)) continue;
      const rows = rankAll(phId, sortedOrchs, rng);
      result.podHeadOrchRankings.push(...rows);
      filled.add(phId);
    }
    // Orchs who didn't select Pod Heads → sample top-N.
    for (const orchId of sortedOrchs) {
      if (input.orchsWhoSelectedPodHeads.has(orchId)) continue;
      const rows = rankSample(
        orchId,
        sortedPodHeads,
        input.config.podHeadsPerOrch,
        rng,
      );
      result.orchPodHeadSelections.push(...rows);
      filled.add(orchId);
    }
  } else if (input.matchType === "PODHEAD_AGENT") {
    for (const phId of sortedPodHeads) {
      if (input.podHeadsWhoSelectedAgents.has(phId)) continue;
      const rows = rankSample(
        phId,
        sortedAgents,
        input.config.podHeadRanksTopNAgents,
        rng,
      );
      result.podHeadAgentSelections.push(...rows);
      filled.add(phId);
    }
    for (const agentId of sortedAgents) {
      if (input.agentsWhoRankedPodHeads.has(agentId)) continue;
      const rows = rankSample(
        agentId,
        sortedPodHeads,
        input.config.agentRanksTopNPodHeads,
        rng,
      );
      result.agentPodHeadRankings.push(...rows);
      filled.add(agentId);
    }
  } else if (input.matchType === "PROJECT_ASSIGNMENT") {
    for (const phId of sortedPodHeads) {
      if (input.podHeadsWhoPickedProjects.has(phId)) continue;
      const rows = rankSample(
        phId,
        sortedProjects,
        input.config.projectsPerPodHead,
        rng,
      );
      result.podHeadProjectPicks.push(...rows);
      filled.add(phId);
    }
  }

  result.autoFilledUserIds = [...filled].sort();
  return result;
}
