/**
 * Integration test for the matching service against the seeded DB.
 *
 * Exercises the full Phase 7 pipeline:
 *   1. runOrchPodHeadMatch → finalizeMatch → entity columns persisted
 *   2. runPodHeadAgentMatch → finalizeMatch → entity columns persisted
 *   3. runProjectAssignment → finalizeMatch → assigned=true on picks
 *   4. rollbackMatch nulls the columns
 *
 * Skipped if DATABASE_URL isn't set. The test reseeds isolation by reaching
 * into the same Postgres seeded by `npm run db:seed`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import {
  runOrchPodHeadMatch,
  runPodHeadAgentMatch,
  runProjectAssignment,
  finalizeMatch,
  rollbackMatch,
  getMatchingStatus
} from "@/lib/matching-service";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const ACTOR_ID = "test-actor";

d("matching service — full pipeline (Phase 7)", () => {
  const db = new PrismaClient();

  beforeAll(async () => {
    // Bump project capacities to 13 so the 60 × 2 = 120 demand fits inside
    // 12 × 13 = 156 (mirrors the integration test in matching/integration.test.ts).
    await db.project.updateMany({ data: { capacity: 13 } });

    // Wipe any prior matching state from earlier test runs.
    await db.matchingRun.deleteMany();
    await db.podHeadProfile.updateMany({ data: { assignedOrchId: null } });
    await db.agentProfile.updateMany({ data: { assignedPodHeadId: null } });
    await db.podHeadProjectPick.updateMany({ data: { assigned: false } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("Run 1 → finalize → every Pod Head has assignedOrchId", async () => {
    const summary = await runOrchPodHeadMatch(ACTOR_ID);
    expect(summary.type).toBe("ORCH_PODHEAD");
    expect(summary.stats.matchedCount).toBe(60);

    await finalizeMatch(ACTOR_ID, "ORCH_PODHEAD");

    const unassigned = await db.podHeadProfile.count({
      where: { assignedOrchId: null }
    });
    expect(unassigned).toBe(0);

    const status = await getMatchingStatus();
    expect(status.ORCH_PODHEAD.isFinalized).toBe(true);
  });

  it("Run 2 (prerequisite enforced) → finalize → every Agent assigned", async () => {
    const summary = await runPodHeadAgentMatch(ACTOR_ID);
    expect(summary.type).toBe("PODHEAD_AGENT");
    expect(summary.stats.matchedCount).toBe(600);

    await finalizeMatch(ACTOR_ID, "PODHEAD_AGENT");

    const unassigned = await db.agentProfile.count({
      where: { assignedPodHeadId: null }
    });
    expect(unassigned).toBe(0);
  });

  it("Run 3 → finalize → every Pod Head has 2 assigned picks", async () => {
    const summary = await runProjectAssignment(ACTOR_ID);
    expect(summary.type).toBe("PROJECT_ASSIGNMENT");
    expect(summary.stats.matchedCount).toBe(60);

    await finalizeMatch(ACTOR_ID, "PROJECT_ASSIGNMENT");

    const ph = await db.podHeadProfile.findMany({
      select: {
        id: true,
        projectPicks: {
          where: { assigned: true },
          select: { projectId: true }
        }
      }
    });

    for (const p of ph) {
      expect(p.projectPicks).toHaveLength(2);
    }
  });

  it("Re-run before finalize replaces the draft (SRS §14.2 case 7)", async () => {
    // We've already finalized all three; re-rolling requires rollback first.
    await rollbackMatch(ACTOR_ID, "PROJECT_ASSIGNMENT");
    const first = await runProjectAssignment(ACTOR_ID);
    const second = await runProjectAssignment(ACTOR_ID);
    // The first draft should be gone; only `second` should exist as a draft.
    const drafts = await db.matchingRun.count({
      where: { type: "PROJECT_ASSIGNMENT", isFinalized: false }
    });
    expect(drafts).toBe(1);
    expect(first.runId).not.toBe(second.runId);
  });

  it("Rollback nulls assignments and marks run ROLLED_BACK (SRS §14.2 case 8)", async () => {
    // Refinalize Run 3 if needed, then roll back ORCH_PODHEAD.
    await rollbackMatch(ACTOR_ID, "PODHEAD_AGENT");
    await rollbackMatch(ACTOR_ID, "ORCH_PODHEAD");

    const phWithOrch = await db.podHeadProfile.count({
      where: { assignedOrchId: { not: null } }
    });
    expect(phWithOrch).toBe(0);

    const agentsWithPh = await db.agentProfile.count({
      where: { assignedPodHeadId: { not: null } }
    });
    expect(agentsWithPh).toBe(0);

    const rolled = await db.matchingRun.findFirst({
      where: { type: "ORCH_PODHEAD", status: "ROLLED_BACK" }
    });
    expect(rolled).not.toBeNull();
  });
});
