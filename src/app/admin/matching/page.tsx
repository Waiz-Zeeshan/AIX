/**
 * Admin Matching UI (SRS §6.1 FR-A6, FR-A7, §7).
 *
 * Three cards, each gated on the prior step's finalization:
 *   1. Orch ↔ Pod Head
 *   2. Pod Head ↔ Agent  (locked until step 1 finalized)
 *   3. Project Assignment (locked until step 2 finalized)
 */

import { PageHeader } from "@/components/chrome/PageHeader";
import { Alert } from "@/components/ui/alert";
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
    <>
      <PageHeader
        eyebrow="Admin"
        title="Matching"
        subtitle="Run, finalize, and roll back the three matching passes. Each pass replaces its previous draft; finalize writes assignments to the live columns."
      />
      <main className="mx-auto max-w-5xl px-6 py-10">
        {!phaseOpen && (
          <Alert variant="warning" className="mb-6">
            MATCHING phase is{" "}
            <span className="font-mono font-medium">{phaseStatus}</span>.
            Matching can only be run while MATCHING is{" "}
            <span className="font-mono font-medium">OPEN</span>. Open the
            Matching phase on the Phases page to enable controls. (You can
            still view the latest state below.)
          </Alert>
        )}

        <MatchingCards status={status} phaseOpen={phaseOpen} />
      </main>
    </>
  );
}
