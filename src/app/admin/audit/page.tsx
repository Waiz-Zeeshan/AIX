import Link from "next/link";

import { PageHeader } from "@/components/chrome/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

import {
  AUDIT_PAGE_SIZE,
  buildAuditWhere,
  filtersToSearchParams,
  parseAuditFilters,
  type AuditFilters
} from "./filters";

export const dynamic = "force-dynamic";

async function lookupActorIdsByEmail(substr: string): Promise<string[]> {
  if (!substr) return [];
  const matches = await db.user.findMany({
    where: { email: { contains: substr, mode: "insensitive" } },
    select: { id: true }
  });
  return matches.map((m) => m.id);
}

export default async function AdminAuditPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filters = parseAuditFilters(sp);

  const where = await buildAuditWhere(filters, lookupActorIdsByEmail);

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE
    })
  ]);

  const actorIds = Array.from(new Set(rows.map((r) => r.actorId)));
  const actors = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true }
  });
  const actorEmailById = new Map(actors.map((a) => [a.id, a.email]));

  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const exportQuery = filtersToSearchParams({
    actor: filters.actor,
    action: filters.action,
    from: filters.from,
    to: filters.to
  });

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        subtitle="Every admin mutation is recorded. Filter by actor email, action, and date range."
        actions={
          <Link
            href={`/admin/audit/export${exportQuery ? `?${exportQuery}` : ""}`}
          >
            <Button variant="secondary" size="sm" className="border-white/30 bg-white/10 text-white hover:border-white hover:bg-white/20">
              Export CSV
            </Button>
          </Link>
        }
      />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <FilterForm filters={filters} />

        <div className="mt-6 text-xs text-fg-muted">
          {total} {total === 1 ? "result" : "results"}
          {total > 0 && (
            <>
              {" "}
              · page <span className="font-mono">{filters.page}</span> of{" "}
              <span className="font-mono">{totalPages}</span>
            </>
          )}
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-border-default bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt text-left font-display text-xs uppercase tracking-wider text-fg-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Timestamp</th>
                <th className="px-4 py-2 font-semibold">Actor</th>
                <th className="px-4 py-2 font-semibold">Action</th>
                <th className="px-4 py-2 font-semibold">Target</th>
                <th className="px-4 py-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-fg-muted"
                  >
                    No audit log entries match these filters.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const email = actorEmailById.get(row.actorId);
                const detailsFull = stringifyDetails(row.details);
                const detailsShort = truncate(detailsFull, 80);
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-mono text-xs whitespace-nowrap text-fg">
                      <time dateTime={row.createdAt.toISOString()}>
                        {formatTimestamp(row.createdAt)}
                      </time>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {email ? (
                        <span className="font-mono text-fg">{email}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-mono text-fg-muted">
                            {row.actorId}
                          </span>
                          <Badge variant="warning">deleted user</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-brand-accent">
                      {row.action}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-fg-muted">
                      {row.target ?? "—"}
                    </td>
                    <td className="px-4 py-2 max-w-md">
                      <span
                        className="block truncate font-mono text-xs text-fg-muted"
                        title={detailsFull}
                      >
                        {detailsShort || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <Pagination filters={filters} totalPages={totalPages} />
        )}
      </main>
    </>
  );
}

function FilterForm({ filters }: { filters: AuditFilters }) {
  return (
    <form
      method="get"
      action="/admin/audit"
      className="grid grid-cols-1 gap-4 rounded-lg border border-border-default bg-surface p-4 sm:grid-cols-5"
    >
      <div className="sm:col-span-2">
        <Label htmlFor="actor">Actor email</Label>
        <Input
          type="text"
          id="actor"
          name="actor"
          defaultValue={filters.actor}
          placeholder="substring match"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="action">Action</Label>
        <Input
          type="text"
          id="action"
          name="action"
          defaultValue={filters.action}
          placeholder="CONFIG_UPDATE"
          className="mt-1 font-mono text-xs"
        />
      </div>
      <div>
        <Label htmlFor="from">From</Label>
        <Input
          type="date"
          id="from"
          name="from"
          defaultValue={filters.from}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="to">To</Label>
        <Input
          type="date"
          id="to"
          name="to"
          defaultValue={filters.to}
          className="mt-1"
        />
      </div>
      <div className="sm:col-span-5 flex items-center gap-2 border-t border-border-default pt-3">
        <Button type="submit" variant="accent">
          Apply filters
        </Button>
        <Link href="/admin/audit">
          <Button variant="secondary" type="button">
            Clear
          </Button>
        </Link>
      </div>
    </form>
  );
}

function Pagination({
  filters,
  totalPages
}: {
  filters: AuditFilters;
  totalPages: number;
}) {
  const baseQuery = {
    actor: filters.actor,
    action: filters.action,
    from: filters.from,
    to: filters.to
  };
  const prev = filters.page > 1 ? filters.page - 1 : null;
  const next = filters.page < totalPages ? filters.page + 1 : null;

  const hrefFor = (page: number): string => {
    const qs = filtersToSearchParams({ ...baseQuery, page });
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <div className="text-xs text-fg-muted">
        Page <span className="font-mono">{filters.page}</span> /{" "}
        <span className="font-mono">{totalPages}</span>
      </div>
      <div className="flex items-center gap-2">
        {prev !== null ? (
          <Link href={hrefFor(prev)}>
            <Button variant="secondary" size="sm">
              Previous
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Previous
          </Button>
        )}
        {next !== null ? (
          <Link href={hrefFor(next)}>
            <Button variant="secondary" size="sm">
              Next
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(d: Date): string {
  return `${d.toISOString().replace("T", " ").slice(0, 19)}Z`;
}

function stringifyDetails(details: unknown): string {
  if (details === null || details === undefined) return "";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
