import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

import {
  AUDIT_EXPORT_MAX_ROWS,
  buildAuditWhere,
  parseAuditFilters
} from "../filters";

export const dynamic = "force-dynamic";

async function lookupActorIdsByEmail(substr: string): Promise<string[]> {
  if (!substr) return [];
  const matches = await db.user.findMany({
    where: { email: { contains: substr, mode: "insensitive" } },
    select: { id: true }
  });
  return matches.map((m) => m.id);
}

export async function GET(request: NextRequest): Promise<Response> {
  await requireAdmin();

  const sp: Record<string, string | string[] | undefined> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    sp[key] = value;
  });

  const filters = parseAuditFilters(sp);
  const where = await buildAuditWhere(filters, lookupActorIdsByEmail);

  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: AUDIT_EXPORT_MAX_ROWS
  });

  const actorIds = Array.from(new Set(rows.map((r) => r.actorId)));
  const actors = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true }
  });
  const actorEmailById = new Map(actors.map((a) => [a.id, a.email]));

  const header = ["createdAt", "actorEmail", "action", "target", "details"];
  const lines: string[] = [header.join(",")];

  for (const row of rows) {
    const email = actorEmailById.get(row.actorId) ?? "";
    const detailsStr =
      row.details === null || row.details === undefined
        ? ""
        : typeof row.details === "string"
        ? row.details
        : JSON.stringify(row.details);
    lines.push(
      [
        row.createdAt.toISOString(),
        email,
        row.action,
        row.target ?? "",
        detailsStr
      ]
        .map(csvField)
        .join(",")
    );
  }

  const body = `${lines.join("\r\n")}\r\n`;
  const filename = `audit-${todayStamp()}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}

/** RFC 4180 quoting: wrap in quotes if the value contains comma, quote, CR, or LF. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
