import Link from "next/link";

import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

import { deleteProject } from "./actions";
import { ConfirmDeleteForm } from "./confirm-delete-form";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  await requireAdmin();

  const [projects, config, registration] = await Promise.all([
    db.project.findMany({ orderBy: { title: "asc" } }),
    getConfig(),
    db.eventPhase.findUnique({ where: { name: "REGISTRATION" } })
  ]);

  const registrationOpen = registration?.status === "OPEN";
  const actualCount = projects.length;
  const targetCount = config.projectCount;
  const countMismatch = actualCount !== targetCount;
  const currentStatus = registration?.status ?? "MISSING";

  return (
    <main className="px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Projects: {actualCount} / {targetCount} (target). Editable during
            REGISTRATION only.
          </p>
        </div>
        <div>
          {registrationOpen ? (
            <Link
              href="/admin/projects/new"
              className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              New project
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center rounded-md bg-zinc-300 px-4 py-2 text-sm font-medium text-zinc-500 shadow-sm dark:bg-zinc-800 dark:text-zinc-500"
            >
              New project
            </button>
          )}
        </div>
      </div>

      {!registrationOpen && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          REGISTRATION is{" "}
          <span className="font-mono font-medium">{currentStatus}</span>.
          Project create / edit / delete is disabled until REGISTRATION is
          re-opened.
        </div>
      )}

      {countMismatch && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span className="font-medium">Count mismatch:</span> there are{" "}
          {actualCount} projects but EventConfig.projectCount is {targetCount}.
          Add or remove projects so the counts match before closing
          REGISTRATION.
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <Th>Title</Th>
              <Th>Tags</Th>
              <Th>Capacity</Th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {projects.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-zinc-500"
                >
                  No projects yet.
                  {registrationOpen && (
                    <>
                      {" "}
                      <Link
                        href="/admin/projects/new"
                        className="font-medium text-zinc-900 underline dark:text-zinc-100"
                      >
                        Create the first one
                      </Link>
                      .
                    </>
                  )}
                </td>
              </tr>
            )}
            {projects.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 align-top text-sm font-medium">
                  {p.title}
                </td>
                <td className="px-4 py-3 align-top text-sm text-zinc-600 dark:text-zinc-400">
                  {p.tags.length === 0 ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    p.tags.join(", ")
                  )}
                </td>
                <td className="px-4 py-3 align-top text-sm text-zinc-600 dark:text-zinc-400">
                  {p.capacity === null ? (
                    <span className="text-zinc-500">
                      default ({config.defaultProjectCapacity})
                    </span>
                  ) : (
                    p.capacity
                  )}
                </td>
                <td className="px-4 py-3 align-top text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    {registrationOpen ? (
                      <>
                        <Link
                          href={`/admin/projects/${p.id}/edit`}
                          className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          Edit
                        </Link>
                        <ConfirmDeleteForm
                          action={deleteProject}
                          id={p.id}
                          title={p.title}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-zinc-400">locked</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
      {children}
    </th>
  );
}
