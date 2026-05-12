/**
 * Audit log writer (SRS §11.2, §6.1 FR-A9).
 *
 * Every admin action that mutates state must call this. Reads are not audited.
 * Action names should be UPPER_SNAKE_CASE verbs:
 *   "PHASE_OPEN", "PHASE_CLOSE", "PHASE_REOPEN",
 *   "CONFIG_UPDATE",
 *   "USER_IMPORT", "PROJECT_CREATE", "PROJECT_UPDATE", "PROJECT_DELETE",
 *   "MATCHING_RUN", "MATCHING_FINALIZE", "MATCHING_ROLLBACK",
 *   "OVERRIDE_ASSIGNMENT".
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface AuditEntry {
  actorId: string;
  action: string;
  target?: string;
  details?: Prisma.InputJsonValue;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      target: entry.target,
      details: entry.details
    }
  });
}
