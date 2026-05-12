"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { MatchType } from "@prisma/client";

import {
  finalize,
  initialMatchingState,
  rollback,
  runOrchPodHead,
  runPodHeadAgent,
  runProjectAssign,
  type MatchingActionState
} from "./actions";
import type { MatchingStatus } from "@/lib/matching-service";

type StepStats = MatchingStatus[MatchType]["stats"];

type StepInfo = {
  type: MatchType;
  index: number;
  title: string;
  description: string;
  runAction: (
    prev: MatchingActionState,
    formData: FormData
  ) => Promise<MatchingActionState>;
};

const STEPS: StepInfo[] = [
  {
    type: "ORCH_PODHEAD",
    index: 1,
    title: "Orch ↔ Pod Head",
    description:
      "Pod Heads propose to Orchs (resident-proposing Hospital-Residents). Run 1 of 3.",
    runAction: runOrchPodHead
  },
  {
    type: "PODHEAD_AGENT",
    index: 2,
    title: "Pod Head ↔ Agent",
    description:
      "Agents propose to Pod Heads. Requires Orch ↔ Pod Head to be finalized.",
    runAction: runPodHeadAgent
  },
  {
    type: "PROJECT_ASSIGNMENT",
    index: 3,
    title: "Project Assignment",
    description:
      "FCFS project allocation by preferencesSubmittedAt. Requires Pod Head ↔ Agent to be finalized.",
    runAction: runProjectAssign
  }
];

export function MatchingCards({
  status,
  phaseOpen
}: {
  status: MatchingStatus;
  phaseOpen: boolean;
}) {
  const orchFinalized = status.ORCH_PODHEAD.isFinalized;
  const podHeadAgentFinalized = status.PODHEAD_AGENT.isFinalized;

  return (
    <div className="mt-8 space-y-6">
      {STEPS.map((step) => {
        const stepStatus = status[step.type];
        const prereqMet =
          step.type === "ORCH_PODHEAD"
            ? true
            : step.type === "PODHEAD_AGENT"
            ? orchFinalized
            : podHeadAgentFinalized;
        return (
          <StepCard
            key={step.type}
            step={step}
            stepStatus={stepStatus}
            prereqMet={prereqMet}
            phaseOpen={phaseOpen}
          />
        );
      })}
    </div>
  );
}

function StepCard({
  step,
  stepStatus,
  prereqMet,
  phaseOpen
}: {
  step: StepInfo;
  stepStatus: MatchingStatus[MatchType];
  prereqMet: boolean;
  phaseOpen: boolean;
}) {
  const hasRun = stepStatus.runId !== null;
  const isFinalized = stepStatus.isFinalized;
  const hasDraft = hasRun && !isFinalized;

  const interactiveDisabled = !phaseOpen || !prereqMet;

  return (
    <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            <span className="text-zinc-400">{step.index}.</span> {step.title}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">{step.description}</p>
        </div>
        <StateBadge
          isFinalized={isFinalized}
          hasDraft={hasDraft}
          prereqMet={prereqMet}
        />
      </header>

      {!prereqMet && (
        <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Finalize step {step.index - 1} before running this step.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <RunButton
          action={step.runAction}
          label={hasDraft ? "Re-run" : "Run"}
          disabled={interactiveDisabled || isFinalized}
        />
        {hasDraft && (
          <FinalizeButton type={step.type} disabled={interactiveDisabled} />
        )}
        {isFinalized && (
          <RollbackButton type={step.type} disabled={interactiveDisabled} />
        )}
      </div>

      {stepStatus.stats && (
        <StatsPanel type={step.type} stats={stepStatus.stats} />
      )}
    </section>
  );
}

function StateBadge({
  isFinalized,
  hasDraft,
  prereqMet
}: {
  isFinalized: boolean;
  hasDraft: boolean;
  prereqMet: boolean;
}) {
  if (isFinalized) {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
        Finalized
      </span>
    );
  }
  if (hasDraft) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
        Draft
      </span>
    );
  }
  if (!prereqMet) {
    return (
      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        Locked
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      Not started
    </span>
  );
}

function RunButton({
  action,
  label,
  disabled
}: {
  action: (
    prev: MatchingActionState,
    formData: FormData
  ) => Promise<MatchingActionState>;
  label: string;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(action, initialMatchingState);
  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <RunSubmit label={label} disabled={disabled} />
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

function RunSubmit({
  label,
  disabled
}: {
  label: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
    >
      {pending ? "Running…" : label}
    </button>
  );
}

function FinalizeButton({
  type,
  disabled
}: {
  type: MatchType;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(finalize, initialMatchingState);
  return (
    <div className="flex flex-col gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              `Finalize ${type}? This writes draft placements to the live assignment columns.`
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="type" value={type} />
        <FinalizeSubmit disabled={disabled} />
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

function FinalizeSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900"
    >
      {pending ? "Finalizing…" : "Finalize"}
    </button>
  );
}

function RollbackButton({
  type,
  disabled
}: {
  type: MatchType;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(rollback, initialMatchingState);
  const confirmMessage =
    type === "PROJECT_ASSIGNMENT"
      ? "Rolling back PROJECT_ASSIGNMENT will null all project assignments. Continue?"
      : type === "ORCH_PODHEAD"
      ? "Rolling back ORCH_PODHEAD will null all Pod Head → Orch assignments. Continue?"
      : "Rolling back PODHEAD_AGENT will null all Agent → Pod Head assignments. Continue?";

  return (
    <div className="flex flex-col gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!window.confirm(confirmMessage)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="type" value={type} />
        <RollbackSubmit disabled={disabled} />
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

function RollbackSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-900 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100 dark:hover:bg-rose-900"
    >
      {pending ? "Rolling back…" : "Rollback"}
    </button>
  );
}

function ActionMessage({ state }: { state: MatchingActionState }) {
  if (state.status === "idle" || !state.message) return null;
  const cls =
    state.status === "success"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-rose-700 dark:text-rose-400";
  return <p className={`text-xs ${cls}`}>{state.message}</p>;
}

function StatsPanel({
  type,
  stats
}: {
  type: MatchType;
  stats: StepStats;
}) {
  if (!stats) return null;
  const sizes = Object.values(stats.rosterSizes ?? {});
  let min = 0;
  let max = 0;
  let avg = 0;
  if (sizes.length > 0) {
    min = Math.min(...sizes);
    max = Math.max(...sizes);
    avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  }

  const items: Array<{ label: string; value: string }> = [
    { label: "Matched", value: String(stats.matchedCount) }
  ];
  if (typeof stats.totalProposals === "number") {
    items.push({ label: "Proposals", value: String(stats.totalProposals) });
  }
  if (typeof stats.rounds === "number") {
    items.push({ label: "Rounds", value: String(stats.rounds) });
  }
  items.push({ label: "Auto-filled", value: String(stats.autoFilledCount) });
  items.push({ label: "Duration", value: `${stats.durationMs} ms` });

  return (
    <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Run summary
      </h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it) => (
          <div key={it.label}>
            <dt className="text-xs text-zinc-500">{it.label}</dt>
            <dd className="font-mono font-medium">{it.value}</dd>
          </div>
        ))}
      </dl>

      {sizes.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {type === "PROJECT_ASSIGNMENT"
              ? "Project load distribution"
              : "Roster sizes"}
          </h4>
          <dl className="mt-2 grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">Min</dt>
              <dd className="font-mono font-medium">{min}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Max</dt>
              <dd className="font-mono font-medium">{max}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Avg</dt>
              <dd className="font-mono font-medium">{avg.toFixed(2)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
