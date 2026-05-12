"use client";

import { useState } from "react";

/**
 * Tiny client component for the dashboard's straggler list. Copies a
 * comma-separated list of emails to the clipboard and flips its label briefly.
 */
export function CopyEmailsButton({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);

  if (emails.length === 0) {
    return null;
  }

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
    >
      {copied ? "Copied" : `Copy ${emails.length} emails`}
    </button>
  );
}
