import Link from "next/link";
import type { Prisma, Role } from "@prisma/client";

import { SyncPanel as AgentSyncPanel } from "@/app/admin/agent-sync/sync-panel";
import { PodHeadSyncPanel } from "@/app/admin/pod-head-sync/sync-panel";
import { PageHeader } from "@/components/chrome/PageHeader";
import { SectionBanner } from "@/components/chrome/SectionBanner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SYNC_ISSUE_DUPLICATE_POD_HEADS } from "@/lib/agent-sync";
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

type DupesFilter = "hide" | "only";

interface PageProps {
  searchParams: Promise<{
    role?: string;
    q?: string;
    page?: string;
    dupes?: string;
  }>;
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
  const dupes: DupesFilter | null =
    params.dupes === "hide" || params.dupes === "only" ? params.dupes : null;

  const whereUsers: Prisma.UserWhereInput = {};
  if (role) whereUsers.role = role;
  if (q) {
    whereUsers.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { empId: { contains: q, mode: "insensitive" } }
    ];
  }
  if (dupes === "hide") {
    whereUsers.syncIssues = { isEmpty: true };
  } else if (dupes === "only") {
    whereUsers.syncIssues = { hasSome: [SYNC_ISSUE_DUPLICATE_POD_HEADS] };
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
  const buildHref = (next: {
    role?: string;
    q?: string;
    page?: number;
    dupes?: DupesFilter | "";
  }) => {
    const u = new URLSearchParams();
    const r = next.role ?? role ?? "";
    if (r) u.set("role", r);
    const qq = next.q ?? q;
    if (qq) u.set("q", qq);
    const d = next.dupes === undefined ? dupes : next.dupes;
    if (d) u.set("dupes", d);
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
    <>
      <PageHeader
        eyebrow="Admin"
        title="Users"
        subtitle="Inspect the roster, drill into any user, and sync Pod Heads or Agents from the configured Google Sheets."
      />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <section>
          <SectionBanner
            title="Roster sync"
            subtitle="Pull Pod Heads and Agents (with ranked Pod-Head priorities) from Google Sheets. Re-running is idempotent."
          />

          <div className="mt-6 space-y-4">
            {!envConfigured && (
              <Alert variant="danger">
                <code className="font-mono">GOOGLE_SHEETS_SA_KEY_JSON</code> is
                not set. Add the service-account JSON to{" "}
                <code className="font-mono">.env</code> and restart the dev
                container before syncing.
              </Alert>
            )}
            {!phaseOpen && (
              <Alert variant="warning">
                Neither REGISTRATION nor PREFERENCES is OPEN — syncs are
                disabled. ({phaseSummary || "no phases set"})
              </Alert>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <details className="group rounded-lg border border-border-default bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium hover:bg-surface-muted">
                <span className="flex items-center gap-2 text-fg">
                  <span className="text-fg-subtle transition-transform group-open:rotate-90">
                    ▸
                  </span>
                  Pod Head sync
                </span>
                <span className="text-xs font-normal text-fg-muted">
                  {config.podHeadSyncSheetId ? (
                    <span className="font-mono">
                      sheet: {truncateSheet(config.podHeadSyncSheetId)}
                    </span>
                  ) : (
                    <span className="text-amber-700">sheet not configured</span>
                  )}
                </span>
              </summary>
              <div className="border-t border-border-default px-4 pb-4">
                <p className="mt-3 text-xs text-fg-muted">
                  Bootstrap Pod Heads from a Google Sheet. Each row upserts a
                  User (role=POD_HEAD) and a minimal PodHeadProfile carrying
                  the Pod Head&apos;s{" "}
                  <code className="font-mono">department</code>. Pod Heads
                  still complete pitch / bio / skills via{" "}
                  <code className="font-mono">/profile-setup</code>.
                </p>
                {!config.podHeadSyncSheetId && (
                  <Alert variant="warning" className="mt-3">
                    No sheet configured. Set{" "}
                    <code className="font-mono">podHeadSyncSheetId</code> in{" "}
                    <Link className="text-brand-accent underline" href="/admin/config">
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

            <details className="group rounded-lg border border-border-default bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium hover:bg-surface-muted">
                <span className="flex items-center gap-2 text-fg">
                  <span className="text-fg-subtle transition-transform group-open:rotate-90">
                    ▸
                  </span>
                  Agent sync
                </span>
                <span className="text-xs font-normal text-fg-muted">
                  {config.agentSyncSheetId ? (
                    <span className="font-mono">
                      sheet: {truncateSheet(config.agentSyncSheetId)}
                    </span>
                  ) : (
                    <span className="text-amber-700">sheet not configured</span>
                  )}
                </span>
              </summary>
              <div className="border-t border-border-default px-4 pb-4">
                <p className="mt-3 text-xs text-fg-muted">
                  Pull agent rows + Pod-Head priorities from the configured
                  Google Sheet. Each row upserts a User (role=AGENT), an
                  AgentProfile, and replaces the agent&apos;s Pod-Head rankings
                  — flagged{" "}
                  <code className="font-mono">autoGenerated=true</code> so
                  agents can still override in{" "}
                  <code className="font-mono">/agent</code>.
                </p>
                {!config.agentSyncSheetId && (
                  <Alert variant="warning" className="mt-3">
                    No sheet configured. Set{" "}
                    <code className="font-mono">agentSyncSheetId</code> in{" "}
                    <Link className="text-brand-accent underline" href="/admin/config">
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

        <section className="mt-12">
          <SectionBanner title="Current roster" />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

        <section className="mt-12">
          <SectionBanner title="User directory" />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-xs text-fg-muted">
              {usersFilteredTotal.toLocaleString()} match
              {usersFilteredTotal === 1 ? "" : "es"} · showing page {page} of{" "}
              {totalPages}
            </p>

            <form
              method="get"
              action="/admin/users"
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <select
                name="role"
                defaultValue={role ?? ""}
                className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg"
              >
                <option value="">All roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <select
                name="dupes"
                defaultValue={dupes ?? ""}
                className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg"
                aria-label="Filter by sync issues"
              >
                <option value="">All agents</option>
                <option value="hide">Hide duplicate Pod Heads</option>
                <option value="only">Only duplicate Pod Heads</option>
              </select>
              <Input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="search email, name, EMP ID"
                className="w-56"
              />
              <Button type="submit" variant="secondary" size="sm">
                Filter
              </Button>
              {(role || q || dupes) && (
                <Link
                  href="/admin/users"
                  className="text-xs text-brand-accent underline hover:no-underline"
                >
                  clear
                </Link>
              )}
            </form>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-border-default bg-surface">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-alt text-left font-display text-xs uppercase tracking-wider text-fg-muted">
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
              <tbody className="divide-y divide-border-default">
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-xs text-fg-muted"
                    >
                      No users match the current filter.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="transition hover:bg-brand-accent-soft/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="text-brand-accent hover:underline"
                        >
                          {u.email}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-fg">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="hover:underline"
                          >
                            {u.name}
                          </Link>
                          {u.syncIssues?.includes(
                            SYNC_ISSUE_DUPLICATE_POD_HEADS
                          ) && (
                            <Badge variant="warning">Duplicate Pod Heads</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <RoleBadge role={u.role} isAdmin={u.isAdmin} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-fg">
                        {u.empId ?? (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-fg">
                        {u.phone ?? (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-fg">
                        {u.podHeadProfile?.department ?? (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {u.profileCompletedAt ? (
                          <span className="font-medium text-emerald-700">
                            ✓
                          </span>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {u.preferencesSubmittedAt ? (
                          <span className="font-medium text-emerald-700">
                            ✓
                          </span>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-fg-muted">
              <div>
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={buildHref({ page: page - 1 })}>
                    <Button variant="secondary" size="sm">
                      ← Prev
                    </Button>
                  </Link>
                ) : (
                  <Button variant="secondary" size="sm" disabled>
                    ← Prev
                  </Button>
                )}
                {page < totalPages ? (
                  <Link href={buildHref({ page: page + 1 })}>
                    <Button variant="secondary" size="sm">
                      Next →
                    </Button>
                  </Link>
                ) : (
                  <Button variant="secondary" size="sm" disabled>
                    Next →
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="mt-12">
          <SectionBanner title="Recent sync activity" />
          {recentSync.length === 0 ? (
            <p className="mt-6 text-sm text-fg-muted">No syncs yet.</p>
          ) : (
            <ul className="mt-6 divide-y divide-border-default rounded-lg border border-border-default bg-surface">
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                      <time dateTime={entry.createdAt.toISOString()}>
                        {entry.createdAt
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)}
                        Z
                      </time>
                      <Badge variant={family === "agent" ? "neutral" : "info"}>
                        {family}
                      </Badge>
                      <Badge variant={isApply ? "success" : "neutral"}>
                        {isApply ? "apply" : "preview"}
                      </Badge>
                      <span className="font-mono">actor {entry.actorId}</span>
                    </div>
                    {d ? (
                      <div className="text-xs text-fg-muted">
                        rows={d.rowsTotal ?? "?"} · created={d.created ?? 0} ·
                        updated={d.updated ?? 0} · skipped=
                        {d.skipped ?? d.skips ?? 0}
                        {d.failedRowIndexes && d.failedRowIndexes.length > 0 ? (
                          <span className="ml-1 font-medium text-red-700">
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
    </>
  );
}

function truncateSheet(spec: string): string {
  if (spec.length <= 28) return spec;
  return `${spec.slice(0, 18)}…${spec.slice(-8)}`;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card padding="sm">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="mt-0.5 font-display text-lg font-semibold tabular-nums text-fg">
        {value}
      </div>
    </Card>
  );
}

function RoleBadge({ role, isAdmin }: { role: Role; isAdmin: boolean }) {
  const variant: Record<Role, "accent" | "info" | "neutral"> = {
    ORCH: "accent",
    POD_HEAD: "info",
    AGENT: "neutral"
  };
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={variant[role]}>{role}</Badge>
      {isAdmin && <Badge variant="warning">admin</Badge>}
    </span>
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
