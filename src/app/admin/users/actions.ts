"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Prisma, Role } from "@prisma/client";

import { logAudit } from "@/lib/audit";
import { getConfig } from "@/lib/config";
import { CsvParseError, parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { ForbiddenError, requireAdmin } from "@/lib/permissions";
import type {
  ImportFormState,
  ImportSummary,
  RowOutcome
} from "./types";

// Lightweight RFC-light email check. The real domain validation is done
// separately against EventConfig.allowedEmailDomains.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_ROLES: ReadonlyArray<Role> = ["AGENT", "POD_HEAD", "ORCH"];

/**
 * Per-row validation schema. Operates on a normalized record produced by
 * mapping the CSV header to lowercase column names. Returns the cleaned shape
 * the upsert will use.
 */
function makeRowSchema(allowedDomains: ReadonlyArray<string>) {
  const normalizedDomains = new Set(
    allowedDomains.map((d) => d.toLowerCase().trim())
  );

  return z.object({
    email: z
      .string()
      .min(1, "email is required")
      .transform((s) => s.trim().toLowerCase())
      .refine((s) => EMAIL_PATTERN.test(s), "invalid email format")
      .refine((s) => {
        const at = s.lastIndexOf("@");
        if (at < 0) return false;
        const domain = s.slice(at + 1);
        return normalizedDomains.has(domain);
      }, `email domain not in allowlist (${[...normalizedDomains].join(", ")})`),
    name: z
      .string()
      .min(1, "name is required")
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, "name is required")
      .refine((s) => s.length <= 200, "name exceeds 200 characters"),
    role: z
      .string()
      .transform((s) => s.trim().toUpperCase())
      .refine(
        (s) => s === "" || (VALID_ROLES as ReadonlyArray<string>).includes(s),
        `role must be blank or one of ${VALID_ROLES.join(", ")}`
      )
      .transform<Role>((s) => (s === "" ? "AGENT" : (s as Role)))
  });
}

type ValidatedRow = z.infer<ReturnType<typeof makeRowSchema>>;

/** Build a `{ email, name, role }` record from a CSV row using a header map. */
function rowToRecord(
  headers: ReadonlyArray<string>,
  values: ReadonlyArray<string>
): { email: string; name: string; role: string } {
  const indexOf = (key: string) =>
    headers.findIndex((h) => h.trim().toLowerCase() === key);

  const emailIdx = indexOf("email");
  const nameIdx = indexOf("name");
  const roleIdx = indexOf("role");

  return {
    email: emailIdx >= 0 ? (values[emailIdx] ?? "") : "",
    name: nameIdx >= 0 ? (values[nameIdx] ?? "") : "",
    role: roleIdx >= 0 ? (values[roleIdx] ?? "") : ""
  };
}

export async function importUsers(
  _prev: ImportFormState,
  formData: FormData
): Promise<ImportFormState> {
  const user = await requireAdmin();

  // Phase gate — surface as a top-level error rather than crashing the page.
  try {
    const registration = await db.eventPhase.findUnique({
      where: { name: "REGISTRATION" }
    });
    if (!registration || registration.status !== "OPEN") {
      throw new ForbiddenError(
        `User import requires REGISTRATION to be OPEN (current: ${registration?.status ?? "MISSING"})`
      );
    }
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { status: "error", message: err.message };
    }
    throw err;
  }

  // Source the CSV from either the file upload or the textarea fallback.
  const file = formData.get("file");
  const pasted = formData.get("pasted");

  let csvText = "";
  if (file instanceof File && file.size > 0) {
    csvText = await file.text();
  } else if (typeof pasted === "string" && pasted.trim().length > 0) {
    csvText = pasted;
  } else {
    return {
      status: "error",
      message: "Provide a CSV file or paste CSV text."
    };
  }

  // Parse CSV.
  let rows: string[][];
  try {
    rows = parseCsv(csvText);
  } catch (err) {
    const message =
      err instanceof CsvParseError
        ? `CSV parse error at line ${err.row}: ${err.message}`
        : err instanceof Error
        ? `CSV parse error: ${err.message}`
        : "CSV parse error";
    return { status: "error", message, parseError: message };
  }

  if (rows.length === 0) {
    return { status: "error", message: "CSV is empty." };
  }

  const headers = rows[0];
  const headersLower = headers.map((h) => h.trim().toLowerCase());

  if (!headersLower.includes("email") || !headersLower.includes("name")) {
    return {
      status: "error",
      message:
        "CSV header must include at least 'email' and 'name' columns (case-insensitive). 'role' is optional."
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    return {
      status: "error",
      message: "CSV contains a header but no data rows."
    };
  }

  const config = await getConfig();
  const rowSchema = makeRowSchema(config.allowedEmailDomains);

  const outcomes: RowOutcome[] = [];
  const validated: ValidatedRow[] = [];
  const seenEmails = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2; // header is row 1
    const record = rowToRecord(headers, dataRows[i]);
    const parsed = rowSchema.safeParse(record);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "validation failed";
      outcomes.push({
        row: rowNumber,
        email: record.email,
        status: "ERROR",
        error: firstError
      });
      continue;
    }

    const cleaned = parsed.data;
    if (seenEmails.has(cleaned.email)) {
      outcomes.push({
        row: rowNumber,
        email: cleaned.email,
        status: "ERROR",
        error: "duplicate email within this CSV"
      });
      continue;
    }
    seenEmails.add(cleaned.email);

    validated.push(cleaned);
    outcomes.push({
      row: rowNumber,
      email: cleaned.email,
      status: "OK"
    });
  }

  // All-or-nothing: any ERROR rejects the entire import.
  const errorOutcomes = outcomes.filter((o) => o.status === "ERROR");
  if (errorOutcomes.length > 0) {
    return {
      status: "error",
      message: `Import rejected: ${errorOutcomes.length} of ${dataRows.length} row(s) failed validation. Nothing was written.`,
      rowErrors: outcomes
    };
  }

  // Compute by-role counts from the validated set.
  const byRole: Record<Role, number> = {
    AGENT: 0,
    POD_HEAD: 0,
    ORCH: 0
  };
  for (const v of validated) byRole[v.role]++;

  // Soft warnings vs EventConfig target counts.
  const warnings: string[] = [];
  if (byRole.ORCH !== config.orchCount) {
    warnings.push(
      `Imported ORCH count (${byRole.ORCH}) does not match EventConfig.orchCount (${config.orchCount}).`
    );
  }
  if (byRole.POD_HEAD !== config.podHeadCount) {
    warnings.push(
      `Imported POD_HEAD count (${byRole.POD_HEAD}) does not match EventConfig.podHeadCount (${config.podHeadCount}).`
    );
  }

  // Pre-count creates vs updates for the summary (cheap; one query).
  const existing = await db.user.findMany({
    where: { email: { in: validated.map((v) => v.email) } },
    select: { email: true }
  });
  const existingSet = new Set(existing.map((e) => e.email));
  const updated = validated.filter((v) => existingSet.has(v.email)).length;
  const created = validated.length - updated;

  // Transactional upsert — all-or-nothing.
  await db.$transaction(
    validated.map((v) =>
      db.user.upsert({
        where: { email: v.email },
        create: { email: v.email, name: v.name, role: v.role },
        update: { name: v.name, role: v.role }
      })
    )
  );

  const summary: ImportSummary = {
    rowsTotal: dataRows.length,
    rowsImported: validated.length,
    byRole,
    created,
    updated,
    warnings
  };

  await logAudit({
    actorId: user.id,
    action: "USER_IMPORT",
    details: {
      rowsTotal: summary.rowsTotal,
      rowsImported: summary.rowsImported,
      byRole: summary.byRole,
      created: summary.created,
      updated: summary.updated,
      warnings: summary.warnings
    } satisfies Prisma.InputJsonValue
  });

  revalidatePath("/admin/users");

  return {
    status: "success",
    summary,
    outcomes
  };
}
