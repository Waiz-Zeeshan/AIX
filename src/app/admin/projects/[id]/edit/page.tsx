import Link from "next/link";
import { notFound } from "next/navigation";

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
    <main className="px-6 py-10">
      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <Link href="/admin/projects" className="hover:underline">
          Projects
        </Link>
        <span>/</span>
        <span className="text-zinc-700 dark:text-zinc-300">
          {project.title}
        </span>
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Edit project
      </h1>

      {!registrationOpen && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          REGISTRATION is{" "}
          <span className="font-mono font-medium">{currentStatus}</span>. Saving
          is disabled. Re-open REGISTRATION on the Phases page to edit
          projects.
        </div>
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
  );
}
