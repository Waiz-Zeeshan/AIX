"use client";

import { useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PodHeadRowOutcome } from "@/lib/pod-head-sync";

import { applyPodHeadSync, previewPodHeadSync } from "./actions";
import type { PodHeadSyncState } from "./types";

export function PodHeadSyncPanel({
  disabled,
  sheetSpec
}: {
  disabled: boolean;
  sheetSpec: string;
}) {
  const [state, setState] = useState<PodHeadSyncState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  const runPreview = () =>
    startTransition(async () => {
      setState(await previewPodHeadSync());
    });

  const runApply = () => {
    if (
      !window.confirm(
        "Apply Pod-Head sync? This will create/update User + PodHeadProfile rows."
      )
    ) {
      return;
    }
    startTransition(async () => {
      setState(await applyPodHeadSync());
    });
  };

  return (
    <section className="mt-8 rounded-lg border border-border-default bg-surface p-6">
      <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <Field label="Configured sheet">
          {sheetSpec ? (
            <code className="break-all font-mono text-xs text-fg">
              {sheetSpec}
            </code>
          ) : (
            <span className="text-fg-muted">none</span>
          )}
        </Field>
        <Field label="Profile completion">
          <span className="text-xs text-fg-muted">
            Sync writes identity + phone + department only. Pod Head still
            completes pitch / bio / skills via{" "}
            <code className="font-mono">/profile-setup</code>.
          </span>
        </Field>
      </div>

      <div className="mt-6 flex gap-3">
        <Button
          type="button"
          onClick={runPreview}
          disabled={disabled || pending}
          variant="secondary"
        >
          {pending && state.status !== "previewed" && state.status !== "applied"
            ? "Working…"
            : "Preview"}
        </Button>
        <Button
          type="button"
          onClick={runApply}
          disabled={
            disabled ||
            pending ||
            !(
              state.status === "previewed" &&
              state.plan.summary.creates + state.plan.summary.updates > 0
            )
          }
          variant="accent"
        >
          Apply
        </Button>
      </div>

      {state.status === "error" && (
        <Alert variant="danger" className="mt-6">
          {state.message}
        </Alert>
      )}

      {(state.status === "previewed" || state.status === "applied") && (
        <Result state={state} />
      )}
    </section>
  );
}

function Result({
  state
}: {
  state: Extract<PodHeadSyncState, { status: "previewed" | "applied" }>;
}) {
  const plan = state.plan;
  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Rows scanned" value={plan.summary.rowsTotal} />
        {state.status === "previewed" ? (
          <>
            <Stat label="Would create" value={plan.summary.creates} />
            <Stat label="Would update" value={plan.summary.updates} />
            <Stat label="Would skip" value={plan.summary.skips} />
          </>
        ) : (
          <>
            <Stat label="Created" value={state.applied.created} />
            <Stat label="Updated" value={state.applied.updated} />
            <Stat label="Skipped" value={state.applied.skipped} />
          </>
        )}
      </div>

      {plan.warnings.length > 0 && (
        <Alert variant="warning" title="Header warnings">
          <ul className="mt-1 list-disc pl-5 text-xs">
            {plan.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      {state.status === "applied" &&
        state.applied.failedRowIndexes.length > 0 && (
          <Alert variant="danger">
            {state.applied.failedRowIndexes.length} row(s) failed to write:{" "}
            {state.applied.failedRowIndexes.join(", ")}. Check server logs.
          </Alert>
        )}

      <PlanTable outcomes={plan.outcomes} />
    </div>
  );
}

function PlanTable({ outcomes }: { outcomes: PodHeadRowOutcome[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface">
      <table className="min-w-full text-sm">
        <thead className="bg-surface-alt text-left font-display text-xs uppercase tracking-wider text-fg-muted">
          <tr>
            <th className="px-3 py-2">Row</th>
            <th className="px-3 py-2">Outcome</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {outcomes.map((o) => (
            <tr key={`${o.rowIndex}-${o.email ?? "blank"}`}>
              <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                {o.rowIndex}
              </td>
              <td className="px-3 py-2">
                <OutcomeBadge kind={o.kind} />
              </td>
              <td className="px-3 py-2 font-mono text-xs text-fg">
                {o.email ?? "(blank)"}
              </td>
              <td className="px-3 py-2 text-xs text-fg-muted">
                {o.kind === "skip" ? (
                  o.reason
                ) : (
                  <>
                    {o.name}
                    {o.empId && (
                      <span className="ml-2 text-fg-muted">
                        · emp {o.empId}
                      </span>
                    )}
                    {o.department && (
                      <span className="ml-2 text-fg-muted">
                        · {o.department}
                      </span>
                    )}
                    {o.phone && (
                      <span className="ml-2 font-mono text-fg-muted">
                        · {o.phone}
                      </span>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutcomeBadge({ kind }: { kind: "create" | "update" | "skip" }) {
  if (kind === "create") return <Badge variant="success">create</Badge>;
  if (kind === "update") return <Badge variant="info">update</Badge>;
  return <Badge variant="neutral">skip</Badge>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card padding="sm">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="mt-0.5 font-display text-lg font-semibold tabular-nums text-fg">
        {value}
      </div>
    </Card>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
