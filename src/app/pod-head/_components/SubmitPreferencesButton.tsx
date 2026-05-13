"use client";

import { useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
      <Alert variant="success" className="text-sm">
        Submitted {new Date(submittedAt).toLocaleString()}
      </Alert>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        variant="accent"
      >
        {pending ? "Submitting…" : "Submit preferences"}
      </Button>
      {missing && missing.length > 0 ? (
        <p className="text-xs text-amber-700">
          Still to do: {missing.join(", ")}.
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
