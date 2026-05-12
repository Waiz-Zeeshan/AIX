import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EventPhase, PhaseName } from "@prisma/client";

import { requireAdmin } from "@/lib/permissions";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ConfirmForm } from "./confirm-form";

export const dynamic = "force-dynamic";

const PHASE_ORDER: PhaseName[] = [
  "REGISTRATION",
  "PREFERENCES",
  "MATCHING",
  "RESULTS_PUBLISHED"
];

const PHASE_LABELS: Record<PhaseName, string> = {
  REGISTRATION: "Registration",
  PREFERENCES: "Preferences",
  MATCHING: "Matching",
  RESULTS_PUBLISHED: "Results Published"
};

const phaseSchema = z.object({
  phase: z.enum(["REGISTRATION", "PREFERENCES", "MATCHING", "RESULTS_PUBLISHED"])
});

function parsePhase(formData: FormData): PhaseName {
  const parsed = phaseSchema.safeParse({ phase: formData.get("phase") });
  if (!parsed.success) {
    throw new Error("Invalid phase name");
  }
  return parsed.data.phase;
}

async function openPhase(formData: FormData) {
  "use server";
  const user = await requireAdmin();
  const name = parsePhase(formData);

  const phases = await db.eventPhase.findMany();
  const byName = new Map(phases.map((p) => [p.name, p]));
  const idx = PHASE_ORDER.indexOf(name);
  for (let i = 0; i < idx; i++) {
    const prior = byName.get(PHASE_ORDER[i]);
    if (!prior || prior.status !== "CLOSED") {
      throw new Error(
        `Cannot open ${name}: prior phase ${PHASE_ORDER[i]} is not CLOSED`
      );
    }
  }

  const current = byName.get(name);
  if (!current || current.status !== "LOCKED") {
    throw new Error(`Phase ${name} is not LOCKED`);
  }

  await db.eventPhase.update({
    where: { name },
    data: { status: "OPEN", openedAt: new Date() }
  });
  await logAudit({
    actorId: user.id,
    action: "PHASE_OPEN",
    target: name
  });
  revalidatePath("/admin/phases");
}

async function closePhase(formData: FormData) {
  "use server";
  const user = await requireAdmin();
  const name = parsePhase(formData);

  const current = await db.eventPhase.findUnique({ where: { name } });
  if (!current || current.status !== "OPEN") {
    throw new Error(`Phase ${name} is not OPEN`);
  }

  await db.eventPhase.update({
    where: { name },
    data: { status: "CLOSED", closedAt: new Date() }
  });
  await logAudit({
    actorId: user.id,
    action: "PHASE_CLOSE",
    target: name
  });
  revalidatePath("/admin/phases");
}

async function reopenPhase(formData: FormData) {
  "use server";
  const user = await requireAdmin();
  const name = parsePhase(formData);

  const current = await db.eventPhase.findUnique({ where: { name } });
  if (!current || current.status !== "CLOSED") {
    throw new Error(`Phase ${name} is not CLOSED`);
  }

  await db.eventPhase.update({
    where: { name },
    data: { status: "OPEN", closedAt: null }
  });
  await logAudit({
    actorId: user.id,
    action: "PHASE_REOPEN",
    target: name
  });
  revalidatePath("/admin/phases");
}

export default async function AdminPhasesPage() {
  await requireAdmin();

  const rows = await db.eventPhase.findMany();
  const byName = new Map(rows.map((r) => [r.name, r]));
  const phases = PHASE_ORDER.map((name) => byName.get(name)).filter(
    (p): p is EventPhase => Boolean(p)
  );

  const canOpen = (name: PhaseName): boolean => {
    const idx = PHASE_ORDER.indexOf(name);
    for (let i = 0; i < idx; i++) {
      const prior = byName.get(PHASE_ORDER[i]);
      if (!prior || prior.status !== "CLOSED") return false;
    }
    return true;
  };

  return (
    <main className="px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Phase Control</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Open and close event phases. Phases progress sequentially:
        Registration → Preferences → Matching → Results Published.
      </p>

      <ul className="mt-8 divide-y rounded-md border border-zinc-200 dark:border-zinc-800">
        {phases.map((p) => (
          <li
            key={p.name}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="font-medium">{PHASE_LABELS[p.name]}</span>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
                <span>
                  Opened: <Time value={p.openedAt} />
                </span>
                <span>
                  Closed: <Time value={p.closedAt} />
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {p.status === "LOCKED" && (
                <ConfirmForm action={openPhase} phase={p.name}>
                  <button
                    type="submit"
                    disabled={!canOpen(p.name)}
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
                  >
                    Open
                  </button>
                </ConfirmForm>
              )}
              {p.status === "OPEN" && (
                <ConfirmForm action={closePhase} phase={p.name}>
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Close
                  </button>
                </ConfirmForm>
              )}
              {p.status === "CLOSED" && (
                <ConfirmForm
                  action={reopenPhase}
                  phase={p.name}
                  confirmMessage={`Re-opening ${PHASE_LABELS[p.name]} allows late changes. Confirm?`}
                >
                  <button
                    type="submit"
                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
                  >
                    Re-open
                  </button>
                </ConfirmForm>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

function StatusBadge({ status }: { status: EventPhase["status"] }) {
  const cls =
    status === "OPEN"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
      : status === "CLOSED"
      ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

function Time({ value }: { value: Date | null }) {
  if (!value) return <span className="text-zinc-400">—</span>;
  return (
    <time dateTime={value.toISOString()} className="font-mono">
      {value.toISOString().replace("T", " ").slice(0, 19)}Z
    </time>
  );
}
