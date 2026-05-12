"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ProjectFormState } from "./actions";

export type ProjectFormDefaults = {
  id?: string;
  title: string;
  description: string;
  tags: string[];
  capacity: number | null;
};

const initialState: ProjectFormState = { status: "idle" };

export function ProjectForm({
  action,
  defaults,
  submitLabel,
  defaultCapacityHint
}: {
  action: (
    prev: ProjectFormState,
    formData: FormData
  ) => Promise<ProjectFormState>;
  defaults: ProjectFormDefaults;
  submitLabel: string;
  defaultCapacityHint: number;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {defaults.id && (
        <input type="hidden" name="id" value={defaults.id} />
      )}

      {state.status === "error" && state.fieldErrors?.form && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
          {state.fieldErrors.form}
        </div>
      )}
      {state.status === "error" && state.message && !state.fieldErrors?.form && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Title
        </label>
        <input
          type="text"
          id="title"
          name="title"
          defaultValue={defaults.title}
          maxLength={200}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
        {state.fieldErrors?.title && (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {state.fieldErrors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={defaults.description}
          maxLength={2000}
          rows={5}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
        {state.fieldErrors?.description && (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {state.fieldErrors.description}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="tags" className="block text-sm font-medium">
          Tags
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Comma-separated. Lowercased and deduped. Up to 10, each ≤ 30
          characters.
        </p>
        <input
          type="text"
          id="tags"
          name="tags"
          defaultValue={defaults.tags.join(", ")}
          className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
        {state.fieldErrors?.tags && (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {state.fieldErrors.tags}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="capacity" className="block text-sm font-medium">
          Capacity
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Optional positive integer. Leave blank to use the event default (
          {defaultCapacityHint}).
        </p>
        <input
          type="number"
          id="capacity"
          name="capacity"
          defaultValue={defaults.capacity ?? ""}
          min={1}
          step={1}
          className="mt-2 block w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
        {state.fieldErrors?.capacity && (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {state.fieldErrors.capacity}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <SubmitButton label={submitLabel} />
        <Link
          href="/admin/projects"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
