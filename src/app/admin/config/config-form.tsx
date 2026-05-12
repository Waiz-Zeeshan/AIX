"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { saveConfig, type ConfigFormState } from "./actions";

type ConfigDefaults = {
  orchCount: number;
  podHeadCount: number;
  projectCount: number;
  podHeadsPerOrch: number;
  agentsPerPodHead: number;
  projectsPerPodHead: number;
  defaultProjectCapacity: number;
  agentRanksTopNPodHeads: number;
  podHeadRanksTopNAgents: number;
  pitchMinChars: number;
  pitchMaxChars: number;
  allowedEmailDomains: string[];
};

const initialState: ConfigFormState = { status: "idle" };

export function ConfigForm({
  defaults,
  locked
}: {
  defaults: ConfigDefaults;
  locked: boolean;
}) {
  const [state, formAction] = useActionState(saveConfig, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-10">
      {state.status === "success" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {state.message}
        </div>
      )}
      {state.status === "error" && state.message && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
          {state.message}
        </div>
      )}
      {state.warning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span className="font-medium">Balance warning:</span> {state.warning}
        </div>
      )}

      <Group title="Counts">
        <NumberField
          name="orchCount"
          label="Orch count"
          defaultValue={defaults.orchCount}
          disabled={locked}
          error={state.fieldErrors?.orchCount}
        />
        <NumberField
          name="podHeadCount"
          label="Pod Head count"
          defaultValue={defaults.podHeadCount}
          disabled={locked}
          error={state.fieldErrors?.podHeadCount}
        />
        <NumberField
          name="projectCount"
          label="Project count"
          defaultValue={defaults.projectCount}
          disabled={locked}
          error={state.fieldErrors?.projectCount}
        />
      </Group>

      <Group title="Capacities">
        <NumberField
          name="podHeadsPerOrch"
          label="Pod Heads per Orch"
          defaultValue={defaults.podHeadsPerOrch}
          disabled={locked}
          error={state.fieldErrors?.podHeadsPerOrch}
        />
        <NumberField
          name="agentsPerPodHead"
          label="Agents per Pod Head"
          defaultValue={defaults.agentsPerPodHead}
          disabled={locked}
          error={state.fieldErrors?.agentsPerPodHead}
        />
        <NumberField
          name="projectsPerPodHead"
          label="Projects per Pod Head"
          defaultValue={defaults.projectsPerPodHead}
          disabled={locked}
          error={state.fieldErrors?.projectsPerPodHead}
        />
        <NumberField
          name="defaultProjectCapacity"
          label="Default project capacity"
          defaultValue={defaults.defaultProjectCapacity}
          disabled={locked}
          error={state.fieldErrors?.defaultProjectCapacity}
        />
      </Group>

      <Group title="List sizes">
        <NumberField
          name="agentRanksTopNPodHeads"
          label="Agents rank top N Pod Heads"
          defaultValue={defaults.agentRanksTopNPodHeads}
          disabled={locked}
          error={state.fieldErrors?.agentRanksTopNPodHeads}
        />
        <NumberField
          name="podHeadRanksTopNAgents"
          label="Pod Heads rank top N Agents"
          defaultValue={defaults.podHeadRanksTopNAgents}
          disabled={locked}
          error={state.fieldErrors?.podHeadRanksTopNAgents}
        />
      </Group>

      <Group title="Pitch constraints">
        <NumberField
          name="pitchMinChars"
          label="Pitch min chars"
          defaultValue={defaults.pitchMinChars}
          disabled={locked}
          error={state.fieldErrors?.pitchMinChars}
        />
        <NumberField
          name="pitchMaxChars"
          label="Pitch max chars"
          defaultValue={defaults.pitchMaxChars}
          disabled={locked}
          error={state.fieldErrors?.pitchMaxChars}
        />
      </Group>

      <Group title="Auth">
        <div className="sm:col-span-2">
          <label
            htmlFor="allowedEmailDomains"
            className="block text-sm font-medium"
          >
            Allowed email domains
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            Comma-separated. Each entry must match a domain shape (e.g.{" "}
            <code className="font-mono">tkxel.com</code>).
          </p>
          <input
            type="text"
            id="allowedEmailDomains"
            name="allowedEmailDomains"
            defaultValue={defaults.allowedEmailDomains.join(", ")}
            disabled={locked}
            className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:disabled:bg-zinc-900"
          />
          {state.fieldErrors?.allowedEmailDomains && (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              {state.fieldErrors.allowedEmailDomains}
            </p>
          )}
        </div>
      </Group>

      <div className="flex items-center gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <SubmitButton disabled={locked} />
        {locked && (
          <span className="text-xs text-zinc-500">
            Open REGISTRATION to enable saving.
          </span>
        )}
      </div>
    </form>
  );
}

function Group({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  disabled,
  error
}: {
  name: string;
  label: string;
  defaultValue: number;
  disabled: boolean;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <input
        type="number"
        id={name}
        name={name}
        defaultValue={defaultValue}
        min={1}
        step={1}
        disabled={disabled}
        className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:disabled:bg-zinc-900"
      />
      {error && (
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
    >
      {pending ? "Saving…" : "Save configuration"}
    </button>
  );
}
