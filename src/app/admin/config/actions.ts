"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Prisma } from "@prisma/client";

import { logAudit } from "@/lib/audit";
import { assertBalanced, getConfig, updateConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { ForbiddenError, requireAdmin } from "@/lib/permissions";

const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

const positiveInt = z.coerce
  .number({ invalid_type_error: "Must be a number" })
  .int("Must be an integer")
  .positive("Must be positive");

const baseSchema = z.object({
  orchCount: positiveInt,
  podHeadCount: positiveInt,
  projectCount: positiveInt,
  podHeadsPerOrch: positiveInt,
  agentsPerPodHead: positiveInt,
  projectsPerPodHead: positiveInt,
  defaultProjectCapacity: positiveInt,
  agentRanksTopNPodHeads: positiveInt,
  podHeadRanksTopNAgents: positiveInt,
  pitchMinChars: positiveInt,
  pitchMaxChars: positiveInt,
  allowedEmailDomains: z
    .string()
    .transform((raw) =>
      Array.from(
        new Set(
          raw
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length > 0)
        )
      )
    )
    .pipe(
      z
        .array(
          z
            .string()
            .regex(DOMAIN_PATTERN, "Invalid domain shape")
        )
        .min(1, "At least one allowed domain is required")
    )
});

const configSchema = baseSchema.refine(
  (v) => v.pitchMinChars <= v.pitchMaxChars,
  {
    message: "pitchMinChars must be ≤ pitchMaxChars",
    path: ["pitchMinChars"]
  }
);

export type ConfigFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  warning?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const EDITABLE_FIELDS = [
  "orchCount",
  "podHeadCount",
  "projectCount",
  "podHeadsPerOrch",
  "agentsPerPodHead",
  "projectsPerPodHead",
  "defaultProjectCapacity",
  "agentRanksTopNPodHeads",
  "podHeadRanksTopNAgents",
  "pitchMinChars",
  "pitchMaxChars",
  "allowedEmailDomains"
] as const;

export async function saveConfig(
  _prev: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  const user = await requireAdmin();

  const registration = await db.eventPhase.findUnique({
    where: { name: "REGISTRATION" }
  });
  if (!registration || registration.status !== "OPEN") {
    throw new ForbiddenError(
      "EventConfig is editable only while REGISTRATION is OPEN"
    );
  }

  const raw: Record<string, FormDataEntryValue | null> = {};
  for (const field of EDITABLE_FIELDS) {
    raw[field] = formData.get(field);
  }

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors
    };
  }

  const data = parsed.data;
  const current = await getConfig();

  const changes: Record<string, Prisma.InputJsonValue> = {};
  for (const field of EDITABLE_FIELDS) {
    const before = current[field];
    const after = data[field];
    const changed = Array.isArray(before)
      ? !Array.isArray(after) ||
        before.length !== after.length ||
        before.some((v, i) => v !== after[i])
      : before !== after;
    if (changed) {
      changes[field] = {
        from: before as Prisma.InputJsonValue,
        to: after as Prisma.InputJsonValue
      };
    }
  }

  const updated = await updateConfig(data);

  let warning: string | undefined;
  try {
    assertBalanced(updated);
  } catch (err) {
    warning = err instanceof Error ? err.message : String(err);
  }

  if (Object.keys(changes).length > 0) {
    await logAudit({
      actorId: user.id,
      action: "CONFIG_UPDATE",
      details: { changes } as Prisma.InputJsonValue
    });
  }

  revalidatePath("/admin/config");

  return {
    status: "success",
    message:
      Object.keys(changes).length > 0
        ? "Configuration saved."
        : "No changes to save.",
    warning
  };
}
