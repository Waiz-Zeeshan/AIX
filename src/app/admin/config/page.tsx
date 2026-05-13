import { PageHeader } from "@/components/chrome/PageHeader";
import { Alert } from "@/components/ui/alert";
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
    <>
      <PageHeader
        eyebrow="Admin"
        title="Event configuration"
        subtitle="Tunes counts, capacities, list sizes, pitch limits, and the auth domain allowlist. Editable during REGISTRATION only."
      />
      <main className="mx-auto max-w-5xl px-6 py-10">
        {locked && (
          <Alert variant="warning" className="mb-6">
            REGISTRATION is{" "}
            <span className="font-mono font-medium">{currentStatus}</span>. The
            configuration is locked. Re-open REGISTRATION on the Phases page to
            edit.
          </Alert>
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
            allowedEmailDomains: config.allowedEmailDomains,
            agentSyncSheetId: config.agentSyncSheetId ?? "",
            podHeadSyncSheetId: config.podHeadSyncSheetId ?? ""
          }}
          locked={locked}
        />
      </main>
    </>
  );
}
