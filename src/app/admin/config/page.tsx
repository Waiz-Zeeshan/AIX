import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

import { ConfigForm } from "./config-form";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  await requireAdmin();

  const [config, registration] = await Promise.all([
    getConfig(),
    db.eventPhase.findUnique({ where: { name: "REGISTRATION" } })
  ]);

  const locked = !registration || registration.status !== "OPEN";
  const currentStatus = registration?.status ?? "MISSING";

  return (
    <main className="px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">
        Event configuration
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Tunes counts, capacities, list sizes, pitch limits, and the auth domain
        allowlist. Editable during REGISTRATION only.
      </p>

      {locked && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          REGISTRATION is{" "}
          <span className="font-mono font-medium">{currentStatus}</span>. The
          configuration is locked. Re-open REGISTRATION on the Phases page to
          edit.
        </div>
      )}

      <ConfigForm
        defaults={{
          orchCount: config.orchCount,
          podHeadCount: config.podHeadCount,
          projectCount: config.projectCount,
          podHeadsPerOrch: config.podHeadsPerOrch,
          agentsPerPodHead: config.agentsPerPodHead,
          projectsPerPodHead: config.projectsPerPodHead,
          defaultProjectCapacity: config.defaultProjectCapacity,
          agentRanksTopNPodHeads: config.agentRanksTopNPodHeads,
          podHeadRanksTopNAgents: config.podHeadRanksTopNAgents,
          pitchMinChars: config.pitchMinChars,
          pitchMaxChars: config.pitchMaxChars,
          allowedEmailDomains: config.allowedEmailDomains
        }}
        locked={locked}
      />
    </main>
  );
}
