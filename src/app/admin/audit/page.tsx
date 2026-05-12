import Link from "next/link";

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

  // Resolve actor emails for the visible page only.
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
    <main className="px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Every admin mutation is recorded. Filter by actor email, action,
            and date range.
          </p>
        </div>
        <Link
          href={`/admin/audit/export${exportQuery ? `?${exportQuery}` : ""}`}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Export CSV
        </Link>
      </div>

      <FilterForm filters={filters} />

      <div className="mt-6 text-xs text-zinc-500">
        {total} {total === 1 ? "result" : "results"}
        {total > 0 && (
          <>
            {" "}
            · page <span className="font-mono">{filters.page}</span> of{" "}
            <span className="font-mono">{totalPages}</span>
          </>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Timestamp</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-zinc-500"
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
                  <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                    <time dateTime={row.createdAt.toISOString()}>
                      {formatTimestamp(row.createdAt)}
                    </time>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {email ? (
                      <span className="font-mono">{email}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-mono text-zinc-500">
                          {row.actorId}
                        </span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                          deleted user
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{row.action}</td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {row.target ?? "—"}
                  </td>
                  <td className="px-4 py-2 max-w-md">
                    <span
                      className="block truncate font-mono text-xs text-zinc-700 dark:text-zinc-300"
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
        <Pagination
          filters={filters}
          totalPages={totalPages}
        />
      )}
    </main>
  );
}

function FilterForm({ filters }: { filters: AuditFilters }) {
  return (
    <form
      method="get"
      action="/admin/audit"
      className="mt-6 grid grid-cols-1 gap-4 rounded-md border border-zinc-200 p-4 sm:grid-cols-5 dark:border-zinc-800"
    >
      <div className="sm:col-span-2">
        <label htmlFor="actor" className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Actor email
        </label>
        <input
          type="text"
          id="actor"
          name="actor"
          defaultValue={filters.actor}
          placeholder="substring match"
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div>
        <label htmlFor="action" className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Action
        </label>
        <input
          type="text"
          id="action"
          name="action"
          defaultValue={filters.action}
          placeholder="CONFIG_UPDATE"
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div>
        <label htmlFor="from" className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
          From
        </label>
        <input
          type="date"
          id="from"
          name="from"
          defaultValue={filters.from}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div>
        <label htmlFor="to" className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
          To
        </label>
        <input
          type="date"
          id="to"
          name="to"
          defaultValue={filters.to}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div className="sm:col-span-5 flex items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Apply filters
        </button>
        <Link
          href="/admin/audit"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Clear
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
      <div className="text-xs text-zinc-500">
        Page <span className="font-mono">{filters.page}</span> /{" "}
        <span className="font-mono">{totalPages}</span>
      </div>
      <div className="flex items-center gap-2">
        {prev !== null ? (
          <Link
            href={hrefFor(prev)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-400 dark:border-zinc-800">
            Previous
          </span>
        )}
        {next !== null ? (
          <Link
            href={hrefFor(next)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-400 dark:border-zinc-800">
            Next
          </span>
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
