"use client";

import { useState, useTransition } from "react";

import { markPreferencesSubmitted } from "@/lib/preferences-actions";

interface Props {
  disabled: boolean;
  initialSubmittedAt: string | null;
}

export function SubmitPreferencesButton({
  disabled,
  initialSubmittedAt
}: Props) {
  const [pending, startTransition] = useTransition();
  const [submittedAt, setSubmittedAt] = useState<string | null>(
    initialSubmittedAt
  );
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);

  const handleClick = () => {
    setError(null);
    setMissing(null);
    startTransition(async () => {
      try {
        const result = await markPreferencesSubmitted();
        if (!result.ok) {
          setMissing(result.missing);
          return;
        }
        setSubmittedAt(new Date().toISOString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submit failed.");
      }
    });
  };

  if (submittedAt) {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
        Submitted {new Date(submittedAt).toLocaleString()}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {pending ? "Submitting…" : "Submit preferences"}
      </button>
      {missing && missing.length > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Still to do: {missing.join(", ")}.
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
