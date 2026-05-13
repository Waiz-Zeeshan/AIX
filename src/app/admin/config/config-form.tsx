"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  agentSyncSheetId: string;
  podHeadSyncSheetId: string;
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
    <form action={formAction} className="space-y-10">
      {state.status === "success" && (
        <Alert variant="success">{state.message}</Alert>
      )}
      {state.status === "error" && state.message && (
        <Alert variant="danger">{state.message}</Alert>
      )}
      {state.warning && (
        <Alert variant="warning" title="Balance warning">
          {state.warning}
        </Alert>
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
          <Label htmlFor="allowedEmailDomains">Allowed email domains</Label>
          <p className="mt-1 text-xs text-fg-muted">
            Comma-separated. Each entry must match a domain shape (e.g.{" "}
            <code className="font-mono">tkxel.com</code>).
          </p>
          <Input
            type="text"
            id="allowedEmailDomains"
            name="allowedEmailDomains"
            defaultValue={defaults.allowedEmailDomains.join(", ")}
            disabled={locked}
            className="mt-2"
          />
          {state.fieldErrors?.allowedEmailDomains && (
            <p className="mt-1 text-xs text-red-600">
              {state.fieldErrors.allowedEmailDomains}
            </p>
          )}
        </div>
      </Group>

      <Group title="Integrations">
        <div className="sm:col-span-2">
          <Label htmlFor="agentSyncSheetId">Agent sync — Google Sheet</Label>
          <p className="mt-1 text-xs text-fg-muted">
            Sheet ID, <code className="font-mono">id/range</code> (e.g.{" "}
            <code className="font-mono">1AbC.../Agents!A1:N700</code>), or full
            Google Sheets URL. Used by{" "}
            <a className="text-brand-accent underline" href="/admin/agent-sync">
              /admin/agent-sync
            </a>
            . Leave blank to disable.
          </p>
          <Input
            type="text"
            id="agentSyncSheetId"
            name="agentSyncSheetId"
            defaultValue={defaults.agentSyncSheetId}
            disabled={locked}
            placeholder="1AbC.../Agents!A1:N700"
            className="mt-2 font-mono text-xs"
          />
          {state.fieldErrors?.agentSyncSheetId && (
            <p className="mt-1 text-xs text-red-600">
              {state.fieldErrors.agentSyncSheetId}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="podHeadSyncSheetId">
            Pod Head sync — Google Sheet
          </Label>
          <p className="mt-1 text-xs text-fg-muted">
            Used by{" "}
            <a className="text-brand-accent underline" href="/admin/pod-head-sync">
              /admin/pod-head-sync
            </a>
            . Expected columns:{" "}
            <code className="font-mono">
              POD Heads Emails | Name with EMP ID | Phone Number | Department
            </code>
            . Leave blank to disable.
          </p>
          <Input
            type="text"
            id="podHeadSyncSheetId"
            name="podHeadSyncSheetId"
            defaultValue={defaults.podHeadSyncSheetId}
            disabled={locked}
            placeholder="1AbC.../PodHeads!A1:F100"
            className="mt-2 font-mono text-xs"
          />
          {state.fieldErrors?.podHeadSyncSheetId && (
            <p className="mt-1 text-xs text-red-600">
              {state.fieldErrors.podHeadSyncSheetId}
            </p>
          )}
        </div>
      </Group>

      <div className="flex items-center gap-3 border-t border-border-default pt-6">
        <SubmitButton disabled={locked} />
        {locked && (
          <span className="text-xs text-fg-muted">
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
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-fg-muted">
        {title}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {children}
      </div>
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
      <Label htmlFor={name}>{label}</Label>
      <Input
        type="number"
        id={name}
        name={name}
        defaultValue={defaultValue}
        min={1}
        step={1}
        disabled={disabled}
        className="mt-1"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} variant="accent">
      {pending ? "Saving…" : "Save configuration"}
    </Button>
  );
}
