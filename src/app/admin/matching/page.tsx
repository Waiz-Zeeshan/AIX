/**
 * Admin Matching UI (SRS §6.1 FR-A6, FR-A7, §7).
 *
 * Three cards, each gated on the prior step's finalization:
 *   1. Orch ↔ Pod Head
 *   2. Pod Head ↔ Agent  (locked until step 1 finalized)
 *   3. Project Assignment (locked until step 2 finalized)
 *
 * Run / Finalize / Rollback all delegate to matching-service. Runs are
 * server-synchronous (per SRS §3.1 there is no job queue in v1).
 *
 * Manual Overrides (FR-A6 row "OVERRIDE_ASSIGNMENT") are deferred — wire-up
 * only, no UI in v1.
 */

import { db } from "@/lib/db";
import { getMatchingStatus } from "@/lib/matching-service";
import { requireAdmin } from "@/lib/permissions";

import { MatchingCards } from "./matching-cards";

export const dynamic = "force-dynamic";

export default async function AdminMatchingPage() {
  await requireAdmin();

  const [status, matchingPhase] = await Promise.all([
    getMatchingStatus(),
    db.eventPhase.findUnique({ where: { name: "MATCHING" } })
  ]);

  const phaseOpen = matchingPhase?.status === "OPEN";
  const phaseStatus = matchingPhase?.status ?? "MISSING";

  return (
    <main className="px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Matching</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Run, finalize, and roll back the three matching passes. Each pass
        replaces its previous draft; finalize writes assignments to the live
        columns.
      </p>

      {!phaseOpen && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          MATCHING phase is{" "}
          <span className="font-mono font-medium">{phaseStatus}</span>. Matching
          can only be run while MATCHING is{" "}
          <span className="font-mono font-medium">OPEN</span>. Open the Matching
          phase on the Phases page to enable controls. (You can still view the
          latest state below.)
        </div>
      )}

      <MatchingCards status={status} phaseOpen={phaseOpen} />
    </main>
  );
}
