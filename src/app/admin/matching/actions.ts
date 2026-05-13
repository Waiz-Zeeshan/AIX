"use server";

/**
 * Admin matching server actions (SRS §6.1 FR-A6, FR-A7, §7).
 *
 * Each action:
 *   1. requireAdmin()
 *   2. requirePhase("MATCHING", "OPEN") — defensive; the UI also disables
 *      controls outside MATCHING.
 *   3. Delegates to the matching service.
 *   4. Writes an audit log entry.
 *   5. revalidatePath("/admin/matching").
 *
 * NOTE: Manual overrides (FR-A6 "OVERRIDE_ASSIGNMENT") are out of scope for
 * v1 — wire-up only, no UI yet.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MatchType, Prisma } from "@prisma/client";

import { logAudit } from "@/lib/audit";
import {
  finalizeMatch,
  rollbackMatch,
  runOrchPodHeadMatch,
  runPodHeadAgentMatch,
  runProjectAssignment
} from "@/lib/matching-service";
import { requireAdmin, requirePhase } from "@/lib/permissions";
import type { MatchingActionState } from "./types";

const matchTypeSchema = z.enum([
  "ORCH_PODHEAD",
  "PODHEAD_AGENT",
  "PROJECT_ASSIGNMENT"
]);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function guards() {
  const user = await requireAdmin();
  await requirePhase("MATCHING", "OPEN");
  return user;
}

export async function runOrchPodHead(
  _prev: MatchingActionState,
  _formData: FormData
): Promise<MatchingActionState> {
  try {
    const user = await guards();
    const summary = await runOrchPodHeadMatch(user.id);
    await logAudit({
      actorId: user.id,
      action: "MATCHING_RUN",
      target: "ORCH_PODHEAD",
      details: {
        type: "ORCH_PODHEAD",
        stats: summary.stats as unknown as Prisma.InputJsonValue
      } as Prisma.InputJsonValue
    });
    revalidatePath("/admin/matching");
    return {
      status: "success",
      message: `Orch ↔ Pod Head draft created (${summary.stats.matchedCount} matched).`,
      summary
    };
  } catch (err) {
    return { status: "error", message: errorMessage(err) };
  }
}

export async function runPodHeadAgent(
  _prev: MatchingActionState,
  _formData: FormData
): Promise<MatchingActionState> {
  try {
    const user = await guards();
    const summary = await runPodHeadAgentMatch(user.id);
    await logAudit({
      actorId: user.id,
      action: "MATCHING_RUN",
      target: "PODHEAD_AGENT",
      details: {
        type: "PODHEAD_AGENT",
        stats: summary.stats as unknown as Prisma.InputJsonValue
      } as Prisma.InputJsonValue
    });
    revalidatePath("/admin/matching");
    return {
      status: "success",
      message: `Pod Head ↔ Agent draft created (${summary.stats.matchedCount} matched).`,
      summary
    };
  } catch (err) {
    return { status: "error", message: errorMessage(err) };
  }
}

export async function runProjectAssign(
  _prev: MatchingActionState,
  _formData: FormData
): Promise<MatchingActionState> {
  try {
    const user = await guards();
    const summary = await runProjectAssignment(user.id);
    await logAudit({
      actorId: user.id,
      action: "MATCHING_RUN",
      target: "PROJECT_ASSIGNMENT",
      details: {
        type: "PROJECT_ASSIGNMENT",
        stats: summary.stats as unknown as Prisma.InputJsonValue
      } as Prisma.InputJsonValue
    });
    revalidatePath("/admin/matching");
    return {
      status: "success",
      message: `Project assignment draft created (${summary.stats.matchedCount} Pod Heads assigned).`,
      summary
    };
  } catch (err) {
    return { status: "error", message: errorMessage(err) };
  }
}

function parseType(formData: FormData): MatchType {
  const parsed = matchTypeSchema.safeParse(formData.get("type"));
  if (!parsed.success) throw new Error("Invalid match type");
  return parsed.data;
}

export async function finalize(
  _prev: MatchingActionState,
  formData: FormData
): Promise<MatchingActionState> {
  try {
    const user = await guards();
    const type = parseType(formData);
    await finalizeMatch(user.id, type);
    await logAudit({
      actorId: user.id,
      action: "MATCHING_FINALIZE",
      target: type
    });
    revalidatePath("/admin/matching");
    return { status: "success", message: `${type} finalized.` };
  } catch (err) {
    return { status: "error", message: errorMessage(err) };
  }
}

export async function rollback(
  _prev: MatchingActionState,
  formData: FormData
): Promise<MatchingActionState> {
  try {
    const user = await guards();
    const type = parseType(formData);
    await rollbackMatch(user.id, type);
    await logAudit({
      actorId: user.id,
      action: "MATCHING_ROLLBACK",
      target: type
    });
    revalidatePath("/admin/matching");
    return { status: "success", message: `${type} rolled back.` };
  } catch (err) {
    return { status: "error", message: errorMessage(err) };
  }
}
