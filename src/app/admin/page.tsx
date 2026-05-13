import Link from "next/link";
import type { Role } from "@prisma/client";

import { CopyEmailsButton } from "@/app/admin/_components/CopyEmailsButton";
import { PageHeader } from "@/components/chrome/PageHeader";
import { SectionBanner } from "@/components/chrome/SectionBanner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

  const breakdown = await Promise.all(
    ROLE_ORDER.map(async (role) => {
      const total = roleAgg.find((r) => r.role === role)?._count._all ?? 0;
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
    <>
      <PageHeader
        eyebrow="Admin"
        title="Dashboard"
        subtitle="Participant progress and event phase status."
      />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <section className="mt-12">
          <SectionBanner title="Per-role breakdown" />
          <div className="mt-6 overflow-hidden rounded-lg border border-border-default bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-alt text-left font-display text-xs uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Role</th>
                  <th className="px-4 py-2 font-semibold">Total</th>
                  <th className="px-4 py-2 font-semibold">Profile complete</th>
                  <th className="px-4 py-2 font-semibold">Prefs submitted</th>
                  <th className="px-4 py-2 font-semibold">% submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {breakdown.map((row) => {
                  const pct =
                    row.total > 0
                      ? Math.round((row.prefsDone / row.total) * 100)
                      : 0;
                  return (
                    <tr key={row.role}>
                      <td className="px-4 py-2 font-medium text-fg">
                        {ROLE_LABELS[row.role]}
                      </td>
                      <td className="px-4 py-2 font-mono tabular-nums text-fg">
                        {row.total}
                      </td>
                      <td className="px-4 py-2 font-mono tabular-nums text-fg">
                        {row.profileDone}
                      </td>
                      <td className="px-4 py-2 font-mono tabular-nums text-fg">
                        {row.prefsDone}
                      </td>
                      <td className="px-4 py-2 font-mono tabular-nums text-brand-accent">
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <SectionBanner title="Event phases" />
          <ul className="mt-6 divide-y divide-border-default overflow-hidden rounded-lg border border-border-default bg-surface">
            {phases.map((p) => (
              <li
                key={p.name}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-display text-xs uppercase tracking-wider text-fg-muted">
                  {p.name}
                </span>
                <Badge
                  variant={
                    p.status === "OPEN"
                      ? "success"
                      : p.status === "CLOSED"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {p.status}
                </Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-fg">
                Stragglers
              </h2>
              <p className="mt-1 text-xs text-fg-muted">
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
                        ? "rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white"
                        : "rounded-md border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:border-brand-accent hover:bg-brand-accent-soft"
                    }
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="space-y-6">
            {ROLE_ORDER.map((role) => {
              const group = stragglers.byRole[role];
              return (
                <div
                  key={role}
                  className="overflow-hidden rounded-lg border border-border-default bg-surface"
                >
                  <SectionBanner title={ROLE_LABELS[role]} />
                  <div className="flex items-center justify-between border-b border-border-default bg-surface-muted px-4 py-2">
                    <Badge variant="neutral">{group.length}</Badge>
                    <CopyEmailsButton emails={group.map((u) => u.email)} />
                  </div>
                  {group.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-fg-muted">
                      No stragglers in this group.
                    </div>
                  ) : (
                    <ul className="max-h-64 divide-y divide-border-default overflow-y-auto text-sm">
                      {group.map((u) => (
                        <li
                          key={u.id}
                          className="flex items-center justify-between px-4 py-1.5"
                        >
                          <span className="font-mono text-xs text-fg">
                            {u.email}
                          </span>
                          <span className="text-xs text-fg-muted">{u.name}</span>
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
    </>
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
    <Card padding="lg">
      <div className="font-display text-xs font-semibold uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold tabular-nums tracking-tight text-fg">
          {done}
        </span>
        <span className="text-sm text-fg-muted">
          / <span className="tabular-nums">{total}</span>
        </span>
        <span className="ml-auto font-display text-sm font-semibold text-brand-accent">
          {pct}%
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-alt">
        <div
          className="h-full rounded-full bg-brand-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Card>
  );
}
