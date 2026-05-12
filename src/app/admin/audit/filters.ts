import type { Prisma } from "@prisma/client";

/**
 * Search-param schema for /admin/audit and /admin/audit/export.
 *
 * - `actor`  — case-insensitive substring of the actor's email.
 * - `action` — exact-match action name (e.g. "CONFIG_UPDATE"); empty = any.
 * - `from`   — inclusive lower bound on createdAt (ISO date, YYYY-MM-DD).
 * - `to`     — inclusive upper bound on createdAt (ISO date, YYYY-MM-DD);
 *              interpreted as end-of-day UTC.
 * - `page`   — 1-based page number for the HTML view (ignored by export).
 */

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_MAX_ROWS = 10_000;

export interface AuditFilters {
  actor: string;
  action: string;
  from: string;
  to: string;
  page: number;
}

function pick(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseAuditFilters(
  sp: Record<string, string | string[] | undefined>
): AuditFilters {
  const pageRaw = Number.parseInt(pick(sp.page), 10);
  return {
    actor: pick(sp.actor).trim(),
    action: pick(sp.action).trim(),
    from: pick(sp.from).trim(),
    to: pick(sp.to).trim(),
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
  };
}

/** Build the Prisma `where` clause for audit log lookups. */
export async function buildAuditWhere(
  filters: AuditFilters,
  lookupActorIdsByEmail: (substr: string) => Promise<string[]>
): Promise<Prisma.AuditLogWhereInput> {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.action.length > 0) {
    where.action = filters.action;
  }

  const dateFilter: Prisma.DateTimeFilter = {};
  const fromDate = parseDateStart(filters.from);
  if (fromDate) dateFilter.gte = fromDate;
  const toDate = parseDateEnd(filters.to);
  if (toDate) dateFilter.lte = toDate;
  if (Object.keys(dateFilter).length > 0) {
    where.createdAt = dateFilter;
  }

  if (filters.actor.length > 0) {
    const ids = await lookupActorIdsByEmail(filters.actor);
    // Empty list — no match. Use an impossible id to short-circuit cleanly.
    where.actorId = { in: ids.length > 0 ? ids : ["__no_match__"] };
  }

  return where;
}

function parseDateStart(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Serialize filters back to a query string (omits empty values). */
export function filtersToSearchParams(
  filters: Omit<AuditFilters, "page"> & { page?: number }
): string {
  const params = new URLSearchParams();
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.action) params.set("action", filters.action);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  return params.toString();
}
