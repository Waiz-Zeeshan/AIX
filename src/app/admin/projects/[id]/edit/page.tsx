import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/chrome/PageHeader";
import { Alert } from "@/components/ui/alert";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

import { updateProject } from "../../actions";
import { ProjectForm } from "../../project-form";

export const dynamic = "force-dynamic";

export default async function AdminProjectEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const [project, config, registration] = await Promise.all([
    db.project.findUnique({ where: { id } }),
    getConfig(),
    db.eventPhase.findUnique({ where: { name: "REGISTRATION" } })
  ]);

  if (!project) {
    notFound();
  }

  const registrationOpen = registration?.status === "OPEN";
  const currentStatus = registration?.status ?? "MISSING";

  return (
    <>
      <PageHeader
        eyebrow={`Admin · Projects · ${project.title}`}
        title="Edit project"
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
            Saving is disabled. Re-open REGISTRATION on the Phases page to edit
            projects.
          </Alert>
        )}

        <ProjectForm
          action={updateProject}
          defaults={{
            id: project.id,
            title: project.title,
            description: project.description,
            tags: project.tags,
            capacity: project.capacity
          }}
          submitLabel="Save changes"
          defaultCapacityHint={config.defaultProjectCapacity}
        />
      </main>
    </>
  );
}
