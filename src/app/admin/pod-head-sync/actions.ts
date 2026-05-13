"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@prisma/client";

import { logAudit } from "@/lib/audit";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import {
  planPodHeadSync,
  type ExistingUser
} from "@/lib/pod-head-sync";
import {
  fetchSheetRows,
  GoogleSheetsConfigError
} from "@/lib/google-sheets";
import { ForbiddenError, requireAdmin } from "@/lib/permissions";

import type { PodHeadSyncState } from "./types";

/**
 * Sync is allowed during REGISTRATION (bootstrap) or PREFERENCES (top-up).
 * Closed phases reject — we don't want admin tooling re-writing identity
 * data while the matching engine is consuming it.
 */
async function assertSyncPhaseOpen(): Promise<void> {
  const phases = await db.eventPhase.findMany({
    where: { name: { in: ["REGISTRATION", "PREFERENCES"] } }
  });
  const open = phases.some((p) => p.status === "OPEN");
  if (!open) {
    throw new ForbiddenError(
      "Pod-Head sync requires REGISTRATION or PREFERENCES to be OPEN."
    );
  }
}

async function loadPlanInputs(): Promise<{
  rows: string[][];
  existing: ExistingUser[];
  allowedEmailDomains: string[];
  sheetSpec: string;
}> {
  const config = await getConfig();
  if (!config.podHeadSyncSheetId) {
    throw new GoogleSheetsConfigError(
      "podHeadSyncSheetId is not configured. Set it in /admin/config."
    );
  }

  const [rows, existingRows] = await Promise.all([
    fetchSheetRows(config.podHeadSyncSheetId),
    db.user.findMany({
      select: { email: true, role: true, empId: true }
    })
  ]);

  const existing: ExistingUser[] = existingRows.map((u) => ({
    email: u.email.toLowerCase(),
    role: u.role,
    empId: u.empId
  }));

  return {
    rows,
    existing,
    allowedEmailDomains: config.allowedEmailDomains,
    sheetSpec: config.podHeadSyncSheetId
  };
}

function errorState(message: string): PodHeadSyncState {
  return { status: "error", message };
}

export async function previewPodHeadSync(): Promise<PodHeadSyncState> {
  const admin = await requireAdmin();
  try {
    await assertSyncPhaseOpen();
    const input = await loadPlanInputs();
    const plan = planPodHeadSync({
      rows: input.rows,
      allowedEmailDomains: input.allowedEmailDomains,
      existingUsers: input.existing
    });

    await logAudit({
      actorId: admin.id,
      action: "POD_HEAD_SYNC_PREVIEW",
      details: {
        sheetSpec: input.sheetSpec,
        ...plan.summary
      } satisfies Prisma.InputJsonValue
    });

    return { status: "previewed", plan, sheetSpec: input.sheetSpec };
  } catch (err) {
    return errorState(toMessage(err));
  }
}

export async function applyPodHeadSync(): Promise<PodHeadSyncState> {
  const admin = await requireAdmin();
  try {
    await assertSyncPhaseOpen();
    const input = await loadPlanInputs();
    const plan = planPodHeadSync({
      rows: input.rows,
      allowedEmailDomains: input.allowedEmailDomains,
      existingUsers: input.existing
    });

    const failedRowIndexes: number[] = [];
    const empIdsBySeenEmail: Record<string, string> = {};
    let created = 0;
    let updated = 0;
    let skipped = plan.summary.skips;

    for (const outcome of plan.outcomes) {
      if (outcome.kind === "skip") continue;

      try {
        await db.$transaction(async (tx) => {
          // Identity: name set on create only; phone refreshed on update
          // (sheet is the source of truth for contact info).
          const user = await tx.user.upsert({
            where: { email: outcome.email },
            create: {
              email: outcome.email,
              name: outcome.name,
              role: "POD_HEAD",
              phone: outcome.phone,
              empId: outcome.empId
            },
            update: {
              phone: outcome.phone,
              // Set empId on update only if the row provides one. Never clear
              // an existing empId by syncing a row that's missing it.
              ...(outcome.empId ? { empId: outcome.empId } : {})
            }
          });

          // Minimal PodHeadProfile shell so department has a home. pitch=""
          // marks the profile as not-yet-completed; Pod Head fills it via
          // /profile-setup. Existing pitch/bio/skills are preserved on update.
          await tx.podHeadProfile.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              pitch: "",
              bio: null,
              skills: [],
              department: outcome.department
            },
            update: { department: outcome.department }
          });
        });

        if (outcome.empId) empIdsBySeenEmail[outcome.email] = outcome.empId;
        if (outcome.kind === "create") created++;
        else updated++;
      } catch (err) {
        failedRowIndexes.push(outcome.rowIndex);
        skipped++;
        console.error(
          `[pod-head-sync] row ${outcome.rowIndex} (${outcome.email}) failed:`,
          err
        );
      }
    }

    await logAudit({
      actorId: admin.id,
      action: "POD_HEAD_SYNC_APPLY",
      details: {
        sheetSpec: input.sheetSpec,
        rowsTotal: plan.summary.rowsTotal,
        created,
        updated,
        skipped,
        failedRowIndexes,
        empIdsBySeenEmail
      } satisfies Prisma.InputJsonValue
    });

    revalidatePath("/admin/pod-head-sync");
    revalidatePath("/admin/users");

    return {
      status: "applied",
      plan,
      applied: { created, updated, skipped, failedRowIndexes },
      sheetSpec: input.sheetSpec
    };
  } catch (err) {
    return errorState(toMessage(err));
  }
}

function toMessage(err: unknown): string {
  if (err instanceof ForbiddenError) return err.message;
  if (err instanceof GoogleSheetsConfigError) return err.message;
  if (err instanceof Error) return err.message;
  return "Unknown error";
}
