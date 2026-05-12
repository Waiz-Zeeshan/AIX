import { describe, expect, it } from "vitest";

import { autoFillPreferences } from "./auto-fill";
import type { AutoFillInput } from "./types";

function makeIds(prefix: string, n: number): string[] {
  // Pad so lexicographic sort matches numeric intuition.
  const width = String(n).length;
  return Array.from({ length: n }, (_, i) =>
    `${prefix}-${String(i + 1).padStart(width, "0")}`,
  );
}

function baseInput(
  overrides: Partial<AutoFillInput> = {},
): AutoFillInput {
  return {
    matchType: "PODHEAD_AGENT",
    runId: "run-001",
    podHeads: [],
    orchs: [],
    agents: [],
    projects: [],
    podHeadsWhoRankedOrchs: new Set<string>(),
    orchsWhoSelectedPodHeads: new Set<string>(),
    podHeadsWhoSelectedAgents: new Set<string>(),
    agentsWhoRankedPodHeads: new Set<string>(),
    podHeadsWhoPickedProjects: new Set<string>(),
    config: {
      podHeadsPerOrch: 5,
      agentsPerPodHead: 4,
      agentRanksTopNPodHeads: 10,
      podHeadRanksTopNAgents: 12,
      projectsPerPodHead: 2,
    },
    ...overrides,
  };
}

describe("autoFillPreferences", () => {
  it("SRS §14.2 Test 4: PODHEAD_AGENT non-submitters get top-N rankings", () => {
    const podHeads = makeIds("ph", 60);
    const agents = makeIds("ag", 600);
    // 50 agents are non-submitters; rest submitted.
    const nonSubmitters = new Set(agents.slice(0, 50));
    const submitters = new Set(agents.filter((a) => !nonSubmitters.has(a)));

    const input = baseInput({
      matchType: "PODHEAD_AGENT",
      podHeads,
      agents,
      agentsWhoRankedPodHeads: submitters,
      // All pod heads submitted to isolate the agent path.
      podHeadsWhoSelectedAgents: new Set(podHeads),
    });

    const out = autoFillPreferences(input);
    const N = input.config.agentRanksTopNPodHeads;

    // Group rows by fromId.
    const groups = new Map<string, number[]>();
    for (const row of out.agentPodHeadRankings) {
      const arr = groups.get(row.fromId) ?? [];
      arr.push(row.rank);
      groups.set(row.fromId, arr);
    }

    expect(groups.size).toBe(50);
    expect(out.podHeadAgentSelections).toEqual([]);
    expect(out.autoFilledUserIds.length).toBe(50);

    for (const [fromId, ranks] of groups) {
      expect(nonSubmitters.has(fromId)).toBe(true);
      expect(ranks.length).toBe(N);
      const sorted = [...ranks].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: N }, (_, i) => i + 1));
      // Distinct target ids per group.
      const targets = out.agentPodHeadRankings
        .filter((r) => r.fromId === fromId)
        .map((r) => r.toId);
      expect(new Set(targets).size).toBe(N);
    }
  });

  it("SRS §14.2 Test 5: same (matchType, runId) is deterministic", () => {
    const input = baseInput({
      podHeads: makeIds("ph", 20),
      agents: makeIds("ag", 100),
      agentsWhoRankedPodHeads: new Set(makeIds("ag", 100).slice(20)),
      podHeadsWhoSelectedAgents: new Set(makeIds("ph", 20).slice(5)),
    });

    const a = autoFillPreferences(input);
    const b = autoFillPreferences(input);
    expect(a).toEqual(b);
  });

  it("different runIds produce different shuffles", () => {
    const podHeads = makeIds("ph", 20);
    const agents = makeIds("ag", 100);
    const common = {
      matchType: "PODHEAD_AGENT" as const,
      podHeads,
      agents,
      agentsWhoRankedPodHeads: new Set(agents.slice(20)),
      podHeadsWhoSelectedAgents: new Set(podHeads.slice(5)),
    };

    const a = autoFillPreferences(baseInput({ ...common, runId: "run-A" }));
    const b = autoFillPreferences(baseInput({ ...common, runId: "run-B" }));
    // Vanishingly unlikely to coincide at this size.
    expect(a).not.toEqual(b);
  });

  it("empty output when everyone submitted", () => {
    const podHeads = makeIds("ph", 10);
    const orchs = makeIds("or", 6);
    const agents = makeIds("ag", 50);
    const projects = makeIds("pr", 8);

    for (const matchType of [
      "ORCH_PODHEAD",
      "PODHEAD_AGENT",
      "PROJECT_ASSIGNMENT",
    ] as const) {
      const out = autoFillPreferences(
        baseInput({
          matchType,
          podHeads,
          orchs,
          agents,
          projects,
          podHeadsWhoRankedOrchs: new Set(podHeads),
          orchsWhoSelectedPodHeads: new Set(orchs),
          podHeadsWhoSelectedAgents: new Set(podHeads),
          agentsWhoRankedPodHeads: new Set(agents),
          podHeadsWhoPickedProjects: new Set(podHeads),
        }),
      );
      expect(out.podHeadOrchRankings).toEqual([]);
      expect(out.orchPodHeadSelections).toEqual([]);
      expect(out.podHeadAgentSelections).toEqual([]);
      expect(out.agentPodHeadRankings).toEqual([]);
      expect(out.podHeadProjectPicks).toEqual([]);
      expect(out.autoFilledUserIds).toEqual([]);
    }
  });

  it("ORCH_PODHEAD: fills both pod-head rankings and orch selections", () => {
    const podHeads = makeIds("ph", 8);
    const orchs = makeIds("or", 4);
    // PHs 1-3 didn't rank; Orchs 1-2 didn't select.
    const phSubmitters = new Set(podHeads.slice(3));
    const orchSubmitters = new Set(orchs.slice(2));

    const input = baseInput({
      matchType: "ORCH_PODHEAD",
      podHeads,
      orchs,
      podHeadsWhoRankedOrchs: phSubmitters,
      orchsWhoSelectedPodHeads: orchSubmitters,
    });

    const out = autoFillPreferences(input);

    // 3 PHs × 4 orchs each = 12 rows.
    expect(out.podHeadOrchRankings.length).toBe(3 * orchs.length);
    const phGroups = new Map<string, Set<string>>();
    for (const row of out.podHeadOrchRankings) {
      if (!phGroups.has(row.fromId)) phGroups.set(row.fromId, new Set());
      phGroups.get(row.fromId)!.add(row.toId);
    }
    expect(phGroups.size).toBe(3);
    for (const targets of phGroups.values()) {
      // Full ranking → every orch covered.
      expect(targets.size).toBe(orchs.length);
    }

    // 2 Orchs × podHeadsPerOrch each.
    const N = input.config.podHeadsPerOrch;
    expect(out.orchPodHeadSelections.length).toBe(2 * N);
    const orchGroups = new Map<string, number[]>();
    for (const row of out.orchPodHeadSelections) {
      const arr = orchGroups.get(row.fromId) ?? [];
      arr.push(row.rank);
      orchGroups.set(row.fromId, arr);
    }
    expect(orchGroups.size).toBe(2);
    for (const ranks of orchGroups.values()) {
      const sorted = [...ranks].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: N }, (_, i) => i + 1));
    }

    // autoFilledUserIds = 3 PHs + 2 Orchs = 5, sorted ASC, distinct.
    expect(out.autoFilledUserIds.length).toBe(5);
    expect([...out.autoFilledUserIds].sort()).toEqual(out.autoFilledUserIds);
    expect(new Set(out.autoFilledUserIds).size).toBe(5);

    // Other arrays empty.
    expect(out.podHeadAgentSelections).toEqual([]);
    expect(out.agentPodHeadRankings).toEqual([]);
    expect(out.podHeadProjectPicks).toEqual([]);
  });

  it("PROJECT_ASSIGNMENT: every non-submitting PH gets exactly projectsPerPodHead distinct projects", () => {
    const podHeads = makeIds("ph", 6);
    const projects = makeIds("pr", 5);
    const input = baseInput({
      matchType: "PROJECT_ASSIGNMENT",
      podHeads,
      projects,
      // No one submitted.
      podHeadsWhoPickedProjects: new Set<string>(),
      config: {
        podHeadsPerOrch: 5,
        agentsPerPodHead: 4,
        agentRanksTopNPodHeads: 10,
        podHeadRanksTopNAgents: 12,
        projectsPerPodHead: 2,
      },
    });

    const out = autoFillPreferences(input);
    const K = input.config.projectsPerPodHead;

    expect(out.podHeadProjectPicks.length).toBe(podHeads.length * K);

    const groups = new Map<string, string[]>();
    for (const row of out.podHeadProjectPicks) {
      const arr = groups.get(row.fromId) ?? [];
      arr.push(row.toId);
      groups.set(row.fromId, arr);
    }
    expect(groups.size).toBe(podHeads.length);
    for (const phId of podHeads) {
      const picks = groups.get(phId)!;
      expect(picks.length).toBe(K);
      expect(new Set(picks).size).toBe(K);
      for (const p of picks) expect(projects).toContain(p);
    }

    // Ranks are 1..K per PH.
    const ranksByPh = new Map<string, number[]>();
    for (const row of out.podHeadProjectPicks) {
      const arr = ranksByPh.get(row.fromId) ?? [];
      arr.push(row.rank);
      ranksByPh.set(row.fromId, arr);
    }
    for (const ranks of ranksByPh.values()) {
      expect([...ranks].sort((a, b) => a - b)).toEqual(
        Array.from({ length: K }, (_, i) => i + 1),
      );
    }

    expect(out.autoFilledUserIds.length).toBe(podHeads.length);
    expect([...out.autoFilledUserIds].sort()).toEqual(out.autoFilledUserIds);
  });
});
