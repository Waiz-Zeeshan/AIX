import Link from "next/link";

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
    <main className="px-6 py-10">
      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <Link href="/admin/projects" className="hover:underline">
          Projects
        </Link>
        <span>/</span>
        <span className="text-zinc-700 dark:text-zinc-300">New</span>
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        New project
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Define a project that Pod Heads will pick during PREFERENCES.
      </p>

      {!registrationOpen && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          REGISTRATION is{" "}
          <span className="font-mono font-medium">{currentStatus}</span>. Saving
          is disabled. Re-open REGISTRATION on the Phases page to create
          projects.
        </div>
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
  );
}
