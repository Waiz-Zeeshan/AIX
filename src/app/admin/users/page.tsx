import type { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["ORCH", "POD_HEAD", "AGENT"];
const ROLE_LABEL: Record<Role, string> = {
  ORCH: "Orchs",
  POD_HEAD: "Pod Heads",
  AGENT: "Agents"
};

export default async function AdminUsersPage() {
  await requireAdmin();

  const [
    registration,
    totalUsers,
    roleCounts,
    adminCount,
    profileCompleted,
    preferencesSubmitted,
    recentImports
  ] = await Promise.all([
    db.eventPhase.findUnique({ where: { name: "REGISTRATION" } }),
    db.user.count(),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.user.count({ where: { isAdmin: true } }),
    db.user.count({ where: { profileCompletedAt: { not: null } } }),
    db.user.count({ where: { preferencesSubmittedAt: { not: null } } }),
    db.auditLog.findMany({
      where: { action: "USER_IMPORT" },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);

  const locked = !registration || registration.status !== "OPEN";
  const currentStatus = registration?.status ?? "MISSING";

  const byRole: Record<Role, number> = { AGENT: 0, POD_HEAD: 0, ORCH: 0 };
  for (const r of roleCounts) byRole[r.role] = r._count._all;

  return (
    <main className="px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Bulk-import the participant roster via CSV. Re-uploading is idempotent —
        existing emails get their <code className="font-mono">name</code> and{" "}
        <code className="font-mono">role</code> updated; new emails are created.
        Editable during REGISTRATION only.
      </p>

      {locked && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          REGISTRATION is{" "}
          <span className="font-mono font-medium">{currentStatus}</span>. User
          import is locked. Re-open REGISTRATION on the Phases page to import.
        </div>
      )}

      <ImportForm locked={locked} />

      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Current roster
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total users" value={totalUsers} />
          {ROLES.map((r) => (
            <Stat key={r} label={ROLE_LABEL[r]} value={byRole[r]} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Admins" value={adminCount} />
          <Stat
            label="Profiles completed"
            value={`${profileCompleted} / ${totalUsers}`}
          />
          <Stat
            label="Preferences submitted"
            value={`${preferencesSubmitted} / ${totalUsers}`}
          />
        </div>
      </section>

      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Recent imports
        </h2>
        {recentImports.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No imports yet.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {recentImports.map((entry) => {
              const details = entry.details as ImportAuditDetails | null;
              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-mono text-xs text-zinc-500">
                      <time dateTime={entry.createdAt.toISOString()}>
                        {entry.createdAt
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)}
                        Z
                      </time>{" "}
                      · actor{" "}
                      <span className="font-mono">{entry.actorId}</span>
                    </div>
                    {details ? (
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {details.rowsImported} imported (
                        {details.created ?? "?"} created,{" "}
                        {details.updated ?? "?"} updated) — ORCH{" "}
                        {details.byRole?.ORCH ?? 0} · POD_HEAD{" "}
                        {details.byRole?.POD_HEAD ?? 0} · AGENT{" "}
                        {details.byRole?.AGENT ?? 0}
                        {details.warnings && details.warnings.length > 0 && (
                          <span className="ml-2 text-amber-700 dark:text-amber-400">
                            · {details.warnings.length} warning
                            {details.warnings.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// Shape mirrors what `importUsers` writes to AuditLog.details. Kept loose
// because audit rows are historical and may predate schema changes.
type ImportAuditDetails = {
  rowsTotal?: number;
  rowsImported?: number;
  byRole?: Partial<Record<Role, number>>;
  created?: number;
  updated?: number;
  warnings?: string[];
};
