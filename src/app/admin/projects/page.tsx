import Link from "next/link";

import { PageHeader } from "@/components/chrome/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
    <>
      <PageHeader
        eyebrow="Admin"
        title="Projects"
        subtitle={`Projects: ${actualCount} / ${targetCount} (target). Editable during REGISTRATION only.`}
        actions={
          registrationOpen ? (
            <Link href="/admin/projects/new">
              <Button variant="accent">New project</Button>
            </Link>
          ) : (
            <Button variant="secondary" disabled>
              New project
            </Button>
          )
        }
      />
      <main className="mx-auto max-w-7xl px-6 py-10">
        {!registrationOpen && (
          <Alert variant="warning" className="mb-6">
            REGISTRATION is{" "}
            <span className="font-mono font-medium">{currentStatus}</span>.
            Project create / edit / delete is disabled until REGISTRATION is
            re-opened.
          </Alert>
        )}

        {countMismatch && (
          <Alert variant="warning" title="Count mismatch" className="mb-6">
            There are {actualCount} projects but EventConfig.projectCount is{" "}
            {targetCount}. Add or remove projects so the counts match before
            closing REGISTRATION.
          </Alert>
        )}

        <div className="overflow-hidden rounded-lg border border-border-default bg-surface">
          <table className="min-w-full divide-y divide-border-default">
            <thead className="bg-surface-alt">
              <tr>
                <Th>Title</Th>
                <Th>Tags</Th>
                <Th>Capacity</Th>
                <th className="px-4 py-2 text-right font-display text-xs font-semibold uppercase tracking-wider text-fg-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {projects.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-fg-muted"
                  >
                    No projects yet.
                    {registrationOpen && (
                      <>
                        {" "}
                        <Link
                          href="/admin/projects/new"
                          className="font-medium text-brand-accent underline"
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
                  <td className="px-4 py-3 align-top text-sm font-medium text-fg">
                    {p.title}
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-fg-muted">
                    {p.tags.length === 0 ? (
                      <span className="text-fg-subtle">—</span>
                    ) : (
                      p.tags.join(", ")
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-fg-muted">
                    {p.capacity === null ? (
                      <span className="text-fg-muted">
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
                          <Link href={`/admin/projects/${p.id}/edit`}>
                            <Button variant="secondary" size="sm">
                              Edit
                            </Button>
                          </Link>
                          <ConfirmDeleteForm
                            action={deleteProject}
                            id={p.id}
                            title={p.title}
                          />
                        </>
                      ) : (
                        <span className="text-xs text-fg-subtle">locked</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left font-display text-xs font-semibold uppercase tracking-wider text-fg-muted">
      {children}
    </th>
  );
}
