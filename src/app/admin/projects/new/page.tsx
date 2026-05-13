import Link from "next/link";

import { PageHeader } from "@/components/chrome/PageHeader";
import { Alert } from "@/components/ui/alert";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

import { createProject } from "../actions";
import { ProjectForm } from "../project-form";

export const dynamic = "force-dynamic";

export default async function AdminProjectNewPage() {
  await requireAdmin();

  const [config, registration] = await Promise.all([
    getConfig(),
    db.eventPhase.findUnique({ where: { name: "REGISTRATION" } })
  ]);

  const registrationOpen = registration?.status === "OPEN";
  const currentStatus = registration?.status ?? "MISSING";

  return (
    <>
      <PageHeader
        eyebrow="Admin · Projects · New"
        title="New project"
        subtitle="Define a project that Pod Heads will pick during PREFERENCES."
      />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-fg-muted">
          <Link href="/admin/projects" className="text-brand-accent hover:underline">
            ← Back to Projects
          </Link>
        </div>

        {!registrationOpen && (
          <Alert variant="warning">
            REGISTRATION is{" "}
            <span className="font-mono font-medium">{currentStatus}</span>.
            Saving is disabled. Re-open REGISTRATION on the Phases page to
            create projects.
          </Alert>
        )}

        <ProjectForm
          action={createProject}
          defaults={{
            title: "",
            description: "",
            tags: [],
            capacity: null
          }}
          submitLabel="Create project"
          defaultCapacityHint={config.defaultProjectCapacity}
        />
      </main>
    </>
  );
}
