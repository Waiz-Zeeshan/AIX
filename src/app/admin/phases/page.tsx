import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EventPhase, PhaseName } from "@prisma/client";

import { PageHeader } from "@/components/chrome/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

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
    <>
      <PageHeader
        eyebrow="Admin"
        title="Phase Control"
        subtitle="Open and close event phases. Phases progress sequentially: Registration → Preferences → Matching → Results Published."
      />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <ul className="divide-y divide-border-default overflow-hidden rounded-lg border border-border-default bg-surface">
          {phases.map((p) => (
            <li
              key={p.name}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="font-display font-semibold text-fg">
                    {PHASE_LABELS[p.name]}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-fg-muted">
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
                    <Button
                      type="submit"
                      disabled={!canOpen(p.name)}
                      variant="accent"
                      size="sm"
                    >
                      Open
                    </Button>
                  </ConfirmForm>
                )}
                {p.status === "OPEN" && (
                  <ConfirmForm action={closePhase} phase={p.name}>
                    <Button type="submit" variant="secondary" size="sm">
                      Close
                    </Button>
                  </ConfirmForm>
                )}
                {p.status === "CLOSED" && (
                  <ConfirmForm
                    action={reopenPhase}
                    phase={p.name}
                    confirmMessage={`Re-opening ${PHASE_LABELS[p.name]} allows late changes. Confirm?`}
                  >
                    <Button
                      type="submit"
                      className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                      variant="secondary"
                      size="sm"
                    >
                      Re-open
                    </Button>
                  </ConfirmForm>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

function StatusBadge({ status }: { status: EventPhase["status"] }) {
  if (status === "OPEN") return <Badge variant="success">{status}</Badge>;
  if (status === "CLOSED") return <Badge variant="neutral">{status}</Badge>;
  return <Badge variant="warning">{status}</Badge>;
}

function Time({ value }: { value: Date | null }) {
  if (!value) return <span className="text-fg-subtle">—</span>;
  return (
    <time dateTime={value.toISOString()} className="font-mono">
      {value.toISOString().replace("T", " ").slice(0, 19)}Z
    </time>
  );
}
