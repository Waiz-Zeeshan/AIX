"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { importUsers } from "./actions";
import {
  initialImportState,
  type ImportFormState,
  type RowOutcome
} from "./types";

export function ImportForm({ locked }: { locked: boolean }) {
  const [state, formAction] = useActionState<ImportFormState, FormData>(
    importUsers,
    initialImportState
  );

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state.status === "success" && <SuccessBlock state={state} />}
      {state.status === "error" && <ErrorBlock state={state} />}

      <div>
        <label htmlFor="file" className="block text-sm font-medium">
          CSV file
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Header row required. Columns: <code className="font-mono">email</code>
          , <code className="font-mono">name</code>,{" "}
          <code className="font-mono">role</code> (optional; blank → AGENT).
        </p>
        <input
          type="file"
          id="file"
          name="file"
          accept=".csv,text/csv"
          disabled={locked}
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:file:bg-zinc-100 dark:file:text-zinc-900 dark:hover:file:bg-zinc-200"
        />
      </div>

      <div>
        <label htmlFor="pasted" className="block text-sm font-medium">
          …or paste CSV text
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Used only if no file is selected.
        </p>
        <textarea
          id="pasted"
          name="pasted"
          rows={8}
          disabled={locked}
          placeholder={"email,name,role\nfoo@tkxel.com,Foo Bar,ORCH\nbar@tkxel.com,Bar Baz,POD_HEAD\nbaz@tkxel.com,Baz Qux,"}
          className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:disabled:bg-zinc-900"
        />
      </div>

      <div className="flex items-center gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <SubmitButton disabled={locked} />
        {locked && (
          <span className="text-xs text-zinc-500">
            Open REGISTRATION on the Phases page to enable import.
          </span>
        )}
      </div>
    </form>
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
      {pending ? "Importing…" : "Import users"}
    </button>
  );
}

function SuccessBlock({
  state
}: {
  state: Extract<ImportFormState, { status: "success" }>;
}) {
  const { summary } = state;
  return (
    <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      <div className="font-medium">
        Imported {summary.rowsImported} user
        {summary.rowsImported === 1 ? "" : "s"} ({summary.created} created,{" "}
        {summary.updated} updated).
      </div>
      <div className="text-xs">
        By role: ORCH {summary.byRole.ORCH} · POD_HEAD {summary.byRole.POD_HEAD}{" "}
        · AGENT {summary.byRole.AGENT}
      </div>
      {summary.warnings.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <div className="font-medium">Warnings</div>
          <ul className="mt-1 list-disc pl-5">
            {summary.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ErrorBlock({
  state
}: {
  state: Extract<ImportFormState, { status: "error" }>;
}) {
  return (
    <div className="space-y-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
      <div className="font-medium">{state.message}</div>
      {state.rowErrors && state.rowErrors.length > 0 && (
        <RowErrorsTable rows={state.rowErrors} />
      )}
    </div>
  );
}

function RowErrorsTable({ rows }: { rows: RowOutcome[] }) {
  const errors = rows.filter((r) => r.status === "ERROR");
  if (errors.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-md border border-rose-200 bg-white text-rose-900 dark:border-rose-900 dark:bg-zinc-950 dark:text-rose-100">
      <table className="w-full text-xs">
        <thead className="bg-rose-100 text-left text-[10px] uppercase tracking-wider text-rose-900 dark:bg-rose-950 dark:text-rose-100">
          <tr>
            <th className="px-3 py-2">Row</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((r) => (
            <tr key={`${r.row}-${r.email}`} className="border-t border-rose-200 dark:border-rose-900">
              <td className="px-3 py-1.5 font-mono">{r.row}</td>
              <td className="px-3 py-1.5 font-mono">{r.email || "—"}</td>
              <td className="px-3 py-1.5">{r.error}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
