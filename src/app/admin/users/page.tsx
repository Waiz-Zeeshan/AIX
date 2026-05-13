import Link from "next/link";
import type { Prisma, Role } from "@prisma/client";

import { SyncPanel as AgentSyncPanel } from "@/app/admin/agent-sync/sync-panel";
import { PodHeadSyncPanel } from "@/app/admin/pod-head-sync/sync-panel";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["ORCH", "POD_HEAD", "AGENT"];
const ROLE_LABEL: Record<Role, string> = {
  ORCH: "Orchs",
  POD_HEAD: "Pod Heads",
  AGENT: "Agents"
};

const PAGE_SIZE = 50;

const SYNC_AUDIT_ACTIONS = [
  "AGENT_SYNC_PREVIEW",
  "AGENT_SYNC_APPLY",
  "POD_HEAD_SYNC_PREVIEW",
  "POD_HEAD_SYNC_APPLY"
] as const;

interface PageProps {
  searchParams: Promise<{ role?: string; q?: string; page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;

  const roleParam = params.role;
  const role: Role | null =
    roleParam && (ROLES as string[]).includes(roleParam)
      ? (roleParam as Role)
      : null;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);

  const whereUsers: Prisma.UserWhereInput = {};
  if (role) whereUsers.role = role;
  if (q) {
    whereUsers.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { empId: { contains: q, mode: "insensitive" } }
    ];
  }

  const [
    config,
    phases,
    totalUsers,
    roleCounts,
    adminCount,
    profileCompleted,
    preferencesSubmitted,
    recentSync,
    usersFilteredTotal,
    users
  ] = await Promise.all([
    getConfig(),
    db.eventPhase.findMany({
      where: { name: { in: ["REGISTRATION", "PREFERENCES"] } }
    }),
    db.user.count(),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.user.count({ where: { isAdmin: true } }),
    db.user.count({ where: { profileCompletedAt: { not: null } } }),
    db.user.count({ where: { preferencesSubmittedAt: { not: null } } }),
    db.auditLog.findMany({
      where: { action: { in: [...SYNC_AUDIT_ACTIONS] } },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    db.user.count({ where: whereUsers }),
    db.user.findMany({
      where: whereUsers,
      orderBy: [{ role: "asc" }, { email: "asc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        podHeadProfile: { select: { department: true } }
      }
    })
  ]);

  const phaseOpen = phases.some((p) => p.status === "OPEN");
  const phaseSummary = phases.map((p) => `${p.name}: ${p.status}`).join(" · ");
  const envConfigured = !!process.env.GOOGLE_SHEETS_SA_KEY_JSON;

  const byRole: Record<Role, number> = { AGENT: 0, POD_HEAD: 0, ORCH: 0 };
  for (const r of roleCounts) byRole[r.role] = r._count._all;

  const totalPages = Math.max(1, Math.ceil(usersFilteredTotal / PAGE_SIZE));
  const buildHref = (next: { role?: string; q?: string; page?: number }) => {
    const u = new URLSearchParams();
    const r = next.role ?? role ?? "";
    if (r) u.set("role", r);
    const qq = next.q ?? q;
    if (qq) u.set("q", qq);
    const p = next.page ?? page;
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };

  const agentSyncDisabled =
    !envConfigured || !config.agentSyncSheetId || !phaseOpen;
  const podHeadSyncDisabled =
    !envConfigured || !config.podHeadSyncSheetId || !phaseOpen;

  return (
    <main className="px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Inspect the roster, drill into any user, and sync Pod Heads or Agents
        from the configured Google Sheets.
      </p>

      <section className="mt-8 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Roster sync
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Pull Pod Heads and Agents (with ranked Pod-Head priorities) from
          Google Sheets. Re-running is idempotent.
        </p>

        {!envConfigured && (
          <Alert tone="error">
            <code className="font-mono">GOOGLE_SHEETS_SA_KEY_JSON</code> is not
            set. Add the service-account JSON to{" "}
            <code className="font-mono">.env</code> and restart the dev
            container before syncing.
          </Alert>
        )}
        {!phaseOpen && (
          <Alert tone="warn">
            Neither REGISTRATION nor PREFERENCES is OPEN — syncs are disabled. (
            {phaseSummary || "no phases set"})
          </Alert>
        )}

        <div className="mt-4 space-y-3">
          <details className="group rounded-md border border-zinc-200 dark:border-zinc-800">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <span className="flex items-center gap-2">
                <span className="text-zinc-400 group-open:rotate-90 transition-transform">
                  ▸
                </span>
                Pod Head sync
              </span>
              <span className="text-xs font-normal text-zinc-500">
                {config.podHeadSyncSheetId ? (
                  <span className="font-mono">
                    sheet: {truncateSheet(config.podHeadSyncSheetId)}
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">
                    sheet not configured
                  </span>
                )}
              </span>
            </summary>
            <div className="border-t border-zinc-200 px-4 pb-4 dark:border-zinc-800">
              <p className="mt-3 text-xs text-zinc-500">
                Bootstrap Pod Heads from a Google Sheet. Each row upserts a
                User (role=POD_HEAD) and a minimal PodHeadProfile carrying the
                Pod Head&apos;s <code className="font-mono">department</code>.
                Pod Heads still complete pitch / bio / skills via{" "}
                <code className="font-mono">/profile-setup</code>.
              </p>
              {!config.podHeadSyncSheetId && (
                <Alert tone="warn">
                  No sheet configured. Set{" "}
                  <code className="font-mono">podHeadSyncSheetId</code> in{" "}
                  <Link className="underline" href="/admin/config">
                    /admin/config
                  </Link>
                  .
                </Alert>
              )}
              <PodHeadSyncPanel
                disabled={podHeadSyncDisabled}
                sheetSpec={config.podHeadSyncSheetId ?? ""}
              />
            </div>
          </details>

          <details className="group rounded-md border border-zinc-200 dark:border-zinc-800">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <span className="flex items-center gap-2">
                <span className="text-zinc-400 group-open:rotate-90 transition-transform">
                  ▸
                </span>
                Agent sync
              </span>
              <span className="text-xs font-normal text-zinc-500">
                {config.agentSyncSheetId ? (
                  <span className="font-mono">
                    sheet: {truncateSheet(config.agentSyncSheetId)}
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">
                    sheet not configured
                  </span>
                )}
              </span>
            </summary>
            <div className="border-t border-zinc-200 px-4 pb-4 dark:border-zinc-800">
              <p className="mt-3 text-xs text-zinc-500">
                Pull agent rows + Pod-Head priorities from the configured
                Google Sheet. Each row upserts a User (role=AGENT), an
                AgentProfile, and replaces the agent&apos;s Pod-Head rankings —
                flagged <code className="font-mono">autoGenerated=true</code>{" "}
                so agents can still override in{" "}
                <code className="font-mono">/agent</code>.
              </p>
              {!config.agentSyncSheetId && (
                <Alert tone="warn">
                  No sheet configured. Set{" "}
                  <code className="font-mono">agentSyncSheetId</code> in{" "}
                  <Link className="underline" href="/admin/config">
                    /admin/config
                  </Link>
                  .
                </Alert>
              )}
              <AgentSyncPanel
                disabled={agentSyncDisabled}
                sheetSpec={config.agentSyncSheetId ?? ""}
                topN={config.agentRanksTopNPodHeads}
              />
            </div>
          </details>
        </div>
      </section>

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
              User directory
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {usersFilteredTotal.toLocaleString()} match
              {usersFilteredTotal === 1 ? "" : "es"} · showing page {page} of{" "}
              {totalPages}
            </p>
          </div>

          <form
            method="get"
            action="/admin/users"
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <select
              name="role"
              defaultValue={role ?? ""}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="search email, name, EMP ID"
              className="w-56 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Filter
            </button>
            {(role || q) && (
              <Link
                href="/admin/users"
                className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                clear
              </Link>
            )}
          </form>
        </div>

        <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">EMP ID</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Profile</th>
                <th className="px-3 py-2">Prefs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-xs text-zinc-500"
                  >
                    No users match the current filter.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-zinc-700 hover:underline dark:text-zinc-200"
                      >
                        {u.email}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="hover:underline"
                      >
                        {u.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <RoleBadge role={u.role} isAdmin={u.isAdmin} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {u.empId ?? <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {u.phone ?? <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {u.podHeadProfile?.department ?? (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {u.profileCompletedAt ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          ✓
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {u.preferencesSubmittedAt ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          ✓
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <div>
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={buildHref({ page: page - 1 })}
                  className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  ← Prev
                </Link>
              ) : (
                <span className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700">
                  ← Prev
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={buildHref({ page: page + 1 })}
                  className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Next →
                </Link>
              ) : (
                <span className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700">
                  Next →
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Recent sync activity
        </h2>
        {recentSync.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No syncs yet.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {recentSync.map((entry) => {
              const d = entry.details as SyncAuditDetails | null;
              const isApply = entry.action.endsWith("_APPLY");
              const family = entry.action.startsWith("AGENT_")
                ? "agent"
                : "pod-head";
              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <time dateTime={entry.createdAt.toISOString()}>
                      {entry.createdAt
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 19)}
                      Z
                    </time>
                    <span
                      className={
                        family === "agent"
                          ? "rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          : "rounded bg-sky-100 px-1.5 py-0.5 text-sky-900 dark:bg-sky-900 dark:text-sky-100"
                      }
                    >
                      {family}
                    </span>
                    <span
                      className={
                        isApply
                          ? "rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
                          : "rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }
                    >
                      {isApply ? "apply" : "preview"}
                    </span>
                    <span className="font-mono">actor {entry.actorId}</span>
                  </div>
                  {d ? (
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      rows={d.rowsTotal ?? "?"} · created={d.created ?? 0} ·
                      updated={d.updated ?? 0} · skipped=
                      {d.skipped ?? d.skips ?? 0}
                      {d.failedRowIndexes && d.failedRowIndexes.length > 0 ? (
                        <span className="ml-1 text-red-700 dark:text-red-400">
                          · {d.failedRowIndexes.length} failed
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function truncateSheet(spec: string): string {
  if (spec.length <= 28) return spec;
  return `${spec.slice(0, 18)}…${spec.slice(-8)}`;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function RoleBadge({ role, isAdmin }: { role: Role; isAdmin: boolean }) {
  const map: Record<Role, string> = {
    ORCH: "bg-violet-100 text-violet-900 dark:bg-violet-900 dark:text-violet-100",
    POD_HEAD: "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
    AGENT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
  };
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${map[role]}`}
      >
        {role}
      </span>
      {isAdmin && (
        <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          admin
        </span>
      )}
    </span>
  );
}

function Alert({
  tone,
  children
}: {
  tone: "error" | "warn";
  children: React.ReactNode;
}) {
  const classes =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100";
  return (
    <div className={`mt-4 rounded-md border px-4 py-3 text-sm ${classes}`}>
      {children}
    </div>
  );
}

type SyncAuditDetails = {
  rowsTotal?: number;
  creates?: number;
  updates?: number;
  skips?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  failedRowIndexes?: number[];
};
