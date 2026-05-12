/**
 * Integration test for the matching engine running against the seeded database.
 *
 * Covers SRS §14.2 Test 1 (happy-path full dataset): all 660 participants get
 * matched, all 60 Pod Heads get 2 projects, the whole pipeline finishes in
 * well under the 5s budget.
 *
 * This is the only test in the suite that touches Postgres. Skipped if
 * DATABASE_URL is not set or the DB isn't seeded.
 *
 * Run: `npx vitest run tests/matching/integration.test.ts`
 */

import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  hospitalResidents,
  completeMatch,
  assignProjects,
  autoFillPreferences,
  type HRInput,
  type AutoFillInput
} from "@/lib/matching";
import { seededRng, shuffle } from "@/lib/matching/rng";

const hasDbUrl = !!process.env.DATABASE_URL;
const describeIfDb = hasDbUrl ? describe : describe.skip;

describeIfDb("matching engine — full pipeline against seeded DB", () => {
  const db = new PrismaClient();

  let runId: string;

  beforeAll(async () => {
    const orchCount = await db.user.count({ where: { role: "ORCH" } });
    const phCount = await db.user.count({ where: { role: "POD_HEAD" } });
    const agentCount = await db.user.count({ where: { role: "AGENT" } });
    if (orchCount !== 5 || phCount !== 60 || agentCount < 600) {
      throw new Error(
        `Expected seeded DB (5/60/600+), got ${orchCount}/${phCount}/${agentCount}. ` +
          `Run \`npm run db:seed\`.`
      );
    }
    runId = `integration-${Date.now()}`;
  });

  it("Run 1: Pod Heads ↔ Orchs — every Pod Head placed at exact capacity", async () => {
    const t0 = Date.now();

    const orchs = await db.orchProfile.findMany({ select: { id: true } });
    const podHeads = await db.podHeadProfile.findMany({ select: { id: true } });
    const config = await db.eventConfig.findUniqueOrThrow({ where: { id: 1 } });

    // Auto-fill EVERYONE (no one has submitted preferences yet in seed data).
    const autoFill = autoFillPreferences({
      matchType: "ORCH_PODHEAD",
      runId,
      podHeads: podHeads.map((p) => p.id),
      orchs: orchs.map((o) => o.id),
      agents: [],
      projects: [],
      podHeadsWhoRankedOrchs: new Set(),
      orchsWhoSelectedPodHeads: new Set(),
      podHeadsWhoSelectedAgents: new Set(),
      agentsWhoRankedPodHeads: new Set(),
      podHeadsWhoPickedProjects: new Set(),
      config: {
        podHeadsPerOrch: config.podHeadsPerOrch,
        agentsPerPodHead: config.agentsPerPodHead,
        agentRanksTopNPodHeads: config.agentRanksTopNPodHeads,
        podHeadRanksTopNAgents: config.podHeadRanksTopNAgents,
        projectsPerPodHead: config.projectsPerPodHead
      }
    } satisfies AutoFillInput);

    // Build HR input: Pod Heads (residents) propose to Orchs (hospitals).
    const phPrefs = new Map<string, string[]>();
    for (const row of autoFill.podHeadOrchRankings) {
      const list = phPrefs.get(row.fromId) ?? [];
      list[row.rank - 1] = row.toId;
      phPrefs.set(row.fromId, list);
    }

    const orchPrefs = new Map<string, string[]>();
    for (const row of autoFill.orchPodHeadSelections) {
      const list = orchPrefs.get(row.fromId) ?? [];
      list[row.rank - 1] = row.toId;
      orchPrefs.set(row.fromId, list);
    }

    const hrInput: HRInput = {
      residents: podHeads.map((p) => ({
        id: p.id,
        preferences: phPrefs.get(p.id) ?? []
      })),
      hospitals: orchs.map((o) => ({
        id: o.id,
        capacity: config.podHeadsPerOrch,
        preferences: orchPrefs.get(o.id) ?? []
      }))
    };

    const hr = hospitalResidents(hrInput);
    const completed = completeMatch(hr, hrInput.hospitals);

    const elapsed = Date.now() - t0;

    // Every Pod Head matched.
    const matchedCount = Object.values(completed.matched).filter(
      (v) => v !== null
    ).length;
    expect(matchedCount).toBe(60);

    // Every Orch at exact capacity (60 / 5 = 12).
    for (const orch of orchs) {
      expect(completed.rosters[orch.id]).toHaveLength(config.podHeadsPerOrch);
    }

    // Budget: comfortably under 5s.
    expect(elapsed).toBeLessThan(5000);
  });

  it("Run 2: Agents ↔ Pod Heads — every Agent placed", async () => {
    const podHeads = await db.podHeadProfile.findMany({ select: { id: true } });
    const agents = await db.agentProfile.findMany({ select: { id: true } });
    const config = await db.eventConfig.findUniqueOrThrow({ where: { id: 1 } });

    const autoFill = autoFillPreferences({
      matchType: "PODHEAD_AGENT",
      runId,
      podHeads: podHeads.map((p) => p.id),
      orchs: [],
      agents: agents.map((a) => a.id),
      projects: [],
      podHeadsWhoRankedOrchs: new Set(),
      orchsWhoSelectedPodHeads: new Set(),
      podHeadsWhoSelectedAgents: new Set(),
      agentsWhoRankedPodHeads: new Set(),
      podHeadsWhoPickedProjects: new Set(),
      config: {
        podHeadsPerOrch: config.podHeadsPerOrch,
        agentsPerPodHead: config.agentsPerPodHead,
        agentRanksTopNPodHeads: config.agentRanksTopNPodHeads,
        podHeadRanksTopNAgents: config.podHeadRanksTopNAgents,
        projectsPerPodHead: config.projectsPerPodHead
      }
    } satisfies AutoFillInput);

    const agentPrefs = new Map<string, string[]>();
    for (const row of autoFill.agentPodHeadRankings) {
      const list = agentPrefs.get(row.fromId) ?? [];
      list[row.rank - 1] = row.toId;
      agentPrefs.set(row.fromId, list);
    }
    const phPrefs = new Map<string, string[]>();
    for (const row of autoFill.podHeadAgentSelections) {
      const list = phPrefs.get(row.fromId) ?? [];
      list[row.rank - 1] = row.toId;
      phPrefs.set(row.fromId, list);
    }

    const hrInput: HRInput = {
      residents: agents.map((a) => ({
        id: a.id,
        preferences: agentPrefs.get(a.id) ?? []
      })),
      hospitals: podHeads.map((p) => ({
        id: p.id,
        capacity: config.agentsPerPodHead,
        preferences: phPrefs.get(p.id) ?? []
      }))
    };

    const t0 = Date.now();
    const hr = hospitalResidents(hrInput);
    const completed = completeMatch(hr, hrInput.hospitals);
    const elapsed = Date.now() - t0;

    const matchedCount = Object.values(completed.matched).filter(
      (v) => v !== null
    ).length;
    expect(matchedCount).toBe(600);

    for (const ph of podHeads) {
      expect(completed.rosters[ph.id]).toHaveLength(config.agentsPerPodHead);
    }

    expect(elapsed).toBeLessThan(5000);
  });

  it("Project assignment — every Pod Head gets 2 distinct projects, caps respected", async () => {
    const podHeads = await db.podHeadProfile.findMany({ select: { id: true } });
    const projects = await db.project.findMany({
      select: { id: true, capacity: true }
    });
    const config = await db.eventConfig.findUniqueOrThrow({ where: { id: 1 } });

    // Auto-fill project picks (no one submitted), then pretend everyone
    // submitted at slightly different timestamps to exercise the FCFS path.
    const af = autoFillPreferences({
      matchType: "PROJECT_ASSIGNMENT",
      runId,
      podHeads: podHeads.map((p) => p.id),
      orchs: [],
      agents: [],
      projects: projects.map((p) => p.id),
      podHeadsWhoRankedOrchs: new Set(),
      orchsWhoSelectedPodHeads: new Set(),
      podHeadsWhoSelectedAgents: new Set(),
      agentsWhoRankedPodHeads: new Set(),
      podHeadsWhoPickedProjects: new Set(),
      config: {
        podHeadsPerOrch: config.podHeadsPerOrch,
        agentsPerPodHead: config.agentsPerPodHead,
        agentRanksTopNPodHeads: config.agentRanksTopNPodHeads,
        podHeadRanksTopNAgents: config.podHeadRanksTopNAgents,
        projectsPerPodHead: config.projectsPerPodHead
      }
    } satisfies AutoFillInput);

    const picks = new Map<string, string[]>();
    for (const row of af.podHeadProjectPicks) {
      const list = picks.get(row.fromId) ?? [];
      list[row.rank - 1] = row.toId;
      picks.set(row.fromId, list);
    }

    // Assign a fake monotonic timestamp to drive FCFS.
    const phWithTimes = podHeads.map((p, i) => ({
      id: p.id,
      preferencesSubmittedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      projectPicks: picks.get(p.id) ?? []
    }));

    // Real ops gives projects ~20% slack over exact demand (SRS §7.5 edge
    // guard). Default seed leaves total cap == total demand, which is the
    // pathological case; mirror realistic config here.
    const slack = Math.ceil(config.defaultProjectCapacity * 1.25);
    const result = assignProjects({
      podHeads: phWithTimes,
      projects: projects.map((p) => ({
        id: p.id,
        capacity: p.capacity ?? slack
      })),
      projectsPerPodHead: config.projectsPerPodHead
    });

    expect(Object.keys(result.assignments)).toHaveLength(60);

    for (const ph of podHeads) {
      const assigned = result.assignments[ph.id];
      expect(assigned).toHaveLength(2);
      expect(new Set(assigned).size).toBe(2);
    }

    for (const p of projects) {
      const cap = p.capacity ?? slack;
      expect(result.loads[p.id]).toBeLessThanOrEqual(cap);
    }

    // Total slots consumed = 60 × 2 = 120
    const total = Object.values(result.loads).reduce((a, b) => a + b, 0);
    expect(total).toBe(60 * 2);
  });

  it("Determinism — same runId produces identical auto-fill output", () => {
    const podHeads = ["ph1", "ph2", "ph3"];
    const orchs = ["o1", "o2"];

    const inputs = {
      matchType: "ORCH_PODHEAD" as const,
      runId: "det-test",
      podHeads,
      orchs,
      agents: [],
      projects: [],
      podHeadsWhoRankedOrchs: new Set<string>(),
      orchsWhoSelectedPodHeads: new Set<string>(),
      podHeadsWhoSelectedAgents: new Set<string>(),
      agentsWhoRankedPodHeads: new Set<string>(),
      podHeadsWhoPickedProjects: new Set<string>(),
      config: {
        podHeadsPerOrch: 2,
        agentsPerPodHead: 10,
        agentRanksTopNPodHeads: 10,
        podHeadRanksTopNAgents: 10,
        projectsPerPodHead: 2
      }
    };

    const a = autoFillPreferences(inputs);
    const b = autoFillPreferences(inputs);
    expect(a).toEqual(b);

    // Also confirm the rng is deterministic
    const r1 = seededRng("seed");
    const r2 = seededRng("seed");
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);

    // And shuffle
    const s1 = shuffle(["a", "b", "c", "d"], seededRng("x"));
    const s2 = shuffle(["a", "b", "c", "d"], seededRng("x"));
    expect(s1).toEqual(s2);
  });
});
