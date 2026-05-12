import Link from "next/link";
import type { Role } from "@prisma/client";

import { CopyEmailsButton } from "@/app/admin/_components/CopyEmailsButton";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type StragglerStatus = "all" | "incomplete" | "prefs-missing";

const ROLE_ORDER: Role[] = ["ORCH", "POD_HEAD", "AGENT"];

const ROLE_LABELS: Record<Role, string> = {
  ORCH: "Orchs",
  POD_HEAD: "Pod Heads",
  AGENT: "Agents"
};

const STATUS_TABS: { value: StragglerStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "incomplete", label: "Profile incomplete" },
  { value: "prefs-missing", label: "Profile complete but prefs missing" }
];

function parseStatus(value: string | string[] | undefined): StragglerStatus {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "incomplete" || v === "prefs-missing") return v;
  return "all";
}

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = parseStatus(sp.status);

  const [
    totalUsers,
    profileCompletedTotal,
    prefsSubmittedTotal,
    roleAgg,
    phases,
    stragglers
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { profileCompletedAt: { not: null } } }),
    db.user.count({ where: { preferencesSubmittedAt: { not: null } } }),
    db.user.groupBy({
      by: ["role"],
      _count: { _all: true }
    }),
    db.eventPhase.findMany({ orderBy: { name: "asc" } }),
    fetchStragglers(status)
  ]);

  // Per-role breakdown (compute completion counts in parallel).
  const breakdown = await Promise.all(
    ROLE_ORDER.map(async (role) => {
      const total =
        roleAgg.find((r) => r.role === role)?._count._all ?? 0;
      const [profileDone, prefsDone] = await Promise.all([
        db.user.count({
          where: { role, profileCompletedAt: { not: null } }
        }),
        db.user.count({
          where: { role, preferencesSubmittedAt: { not: null } }
        })
      ]);
      return { role, total, profileDone, prefsDone };
    })
  );

  return (
    <main className="px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Participant progress and event phase status.
      </p>

      {/* Headline cards */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProgressCard
          label="Profiles completed"
          done={profileCompletedTotal}
          total={totalUsers}
        />
        <ProgressCard
          label="Preferences submitted"
          done={prefsSubmittedTotal}
          total={totalUsers}
        />
      </section>

      {/* Per-role breakdown table */}
      <section className="mt-10">
        <h2 className="text-lg font-medium">Per-role breakdown</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Profile complete</th>
                <th className="px-4 py-2 font-medium">Prefs submitted</th>
                <th className="px-4 py-2 font-medium">% submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {breakdown.map((row) => {
                const pct =
                  row.total > 0
                    ? Math.round((row.prefsDone / row.total) * 100)
                    : 0;
                return (
                  <tr key={row.role}>
                    <td className="px-4 py-2 font-medium">
                      {ROLE_LABELS[row.role]}
                    </td>
                    <td className="px-4 py-2 font-mono tabular-nums">
                      {row.total}
                    </td>
                    <td className="px-4 py-2 font-mono tabular-nums">
                      {row.profileDone}
                    </td>
                    <td className="px-4 py-2 font-mono tabular-nums">
                      {row.prefsDone}
                    </td>
                    <td className="px-4 py-2 font-mono tabular-nums">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Phase status panel */}
      <section className="mt-10">
        <h2 className="text-lg font-medium">Event phases</h2>
        <ul className="mt-3 divide-y rounded-md border border-zinc-200 dark:border-zinc-800">
          {phases.map((p) => (
            <li
              key={p.name}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">
                {p.name}
              </span>
              <span
                className={
                  p.status === "OPEN"
                    ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
                    : p.status === "CLOSED"
                    ? "rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                }
              >
                {p.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Straggler list */}
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Stragglers</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Users who have not finished onboarding. Grouped by role.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {STATUS_TABS.map((tab) => {
              const active = tab.value === status;
              const href =
                tab.value === "all" ? "/admin" : `/admin?status=${tab.value}`;
              return (
                <Link
                  key={tab.value}
                  href={href}
                  className={
                    active
                      ? "rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  }
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-4 space-y-4">
          {ROLE_ORDER.map((role) => {
            const group = stragglers.byRole[role];
            return (
              <div
                key={role}
                className="rounded-md border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{ROLE_LABELS[role]}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-mono tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {group.length}
                    </span>
                  </div>
                  <CopyEmailsButton emails={group.map((u) => u.email)} />
                </div>
                {group.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-zinc-500">
                    No stragglers in this group.
                  </div>
                ) : (
                  <ul className="max-h-64 divide-y divide-zinc-100 overflow-y-auto text-sm dark:divide-zinc-900">
                    {group.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between px-4 py-1.5"
                      >
                        <span className="font-mono text-xs">{u.email}</span>
                        <span className="text-xs text-zinc-500">{u.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

type StragglerUser = { id: string; email: string; name: string; role: Role };

async function fetchStragglers(status: StragglerStatus): Promise<{
  byRole: Record<Role, StragglerUser[]>;
}> {
  const where =
    status === "incomplete"
      ? { profileCompletedAt: null }
      : status === "prefs-missing"
      ? {
          profileCompletedAt: { not: null },
          preferencesSubmittedAt: null
        }
      : { preferencesSubmittedAt: null };

  const rows = await db.user.findMany({
    where,
    select: { id: true, email: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { email: "asc" }]
  });

  const byRole: Record<Role, StragglerUser[]> = {
    ORCH: [],
    POD_HEAD: [],
    AGENT: []
  };
  for (const u of rows) {
    byRole[u.role].push(u);
  }
  return { byRole };
}

function ProgressCard({
  label,
  done,
  total
}: {
  label: string;
  done: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-md border border-zinc-200 px-4 py-4 dark:border-zinc-800">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {done}
        </span>
        <span className="text-sm text-zinc-500">
          / <span className="tabular-nums">{total}</span>
        </span>
        <span className="ml-auto text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {pct}%
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
