"use client";

import { useState, useTransition } from "react";

import type { RowOutcome } from "@/lib/agent-sync";

import { applyAgentSync, previewAgentSync } from "./actions";
import type { AgentSyncState } from "./types";

export function SyncPanel({
  disabled,
  sheetSpec,
  topN
}: {
  disabled: boolean;
  sheetSpec: string;
  topN: number;
}) {
  const [state, setState] = useState<AgentSyncState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  const runPreview = () =>
    startTransition(async () => {
      setState(await previewAgentSync());
    });

  const runApply = () => {
    if (
      !window.confirm(
        "Apply sync? This will create/update User + AgentProfile rows and wipe-and-replace auto-generated rankings."
      )
    ) {
      return;
    }
    startTransition(async () => {
      setState(await applyAgentSync());
    });
  };

  return (
    <section className="mt-8 rounded-md border border-zinc-200 p-6 dark:border-zinc-800">
      <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <Field label="Configured sheet">
          {sheetSpec ? (
            <code className="break-all font-mono text-xs">{sheetSpec}</code>
          ) : (
            <span className="text-zinc-500">none</span>
          )}
        </Field>
        <Field label="Top-N Pod Heads per agent">
          <span className="font-mono">{topN}</span>
        </Field>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={runPreview}
          disabled={disabled || pending}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {pending && state.status !== "previewed" && state.status !== "applied"
            ? "Working…"
            : "Preview"}
        </button>
        <button
          type="button"
          onClick={runApply}
          disabled={
            disabled ||
            pending ||
            !(state.status === "previewed" && state.plan.summary.creates + state.plan.summary.updates > 0)
          }
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          Apply
        </button>
      </div>

      {state.status === "error" && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          {state.message}
        </div>
      )}

      {(state.status === "previewed" || state.status === "applied") && (
        <SyncResult state={state} />
      )}
    </section>
  );
}

function SyncResult({
  state
}: {
  state: Extract<AgentSyncState, { status: "previewed" | "applied" }>;
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
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <div className="font-medium">Header warnings</div>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {plan.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {state.status === "applied" && state.applied.failedRowIndexes.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          {state.applied.failedRowIndexes.length} row(s) failed to write:{" "}
          {state.applied.failedRowIndexes.join(", ")}. Check server logs.
        </div>
      )}

      <PlanTable outcomes={plan.outcomes} />
    </div>
  );
}

function PlanTable({ outcomes }: { outcomes: RowOutcome[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2">Row</th>
            <th className="px-3 py-2">Outcome</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {outcomes.map((o) => (
            <tr key={`${o.rowIndex}-${o.email ?? "blank"}`}>
              <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                {o.rowIndex}
              </td>
              <td className="px-3 py-2">
                <OutcomeBadge kind={o.kind} />
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {o.email ?? "(blank)"}
              </td>
              <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                {o.kind === "skip" ? (
                  o.reason
                ) : (
                  <>
                    {o.name} — {o.rankings.length} rankings
                    {o.preferredDomains.length > 0 && (
                      <span className="ml-2 text-zinc-500">
                        · domains: {o.preferredDomains.join(", ")}
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
  const map = {
    create:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
    update: "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
    skip: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
  } as const;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${map[kind]}`}
    >
      {kind}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
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
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
