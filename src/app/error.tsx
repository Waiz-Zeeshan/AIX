"use client";

/**
 * Route-segment error boundary (App Router convention). Catches errors
 * thrown in any descendant page or layout. Provides a "Try again" reset
 * action — Next.js re-renders the segment on call.
 */

import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <p className="font-mono text-xs uppercase tracking-wider text-red-600">
        Something went wrong
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        We hit an unexpected error
      </h1>
      <p className="mt-3 text-sm text-zinc-500">
        {error.message || "Please try again. If this keeps happening, contact the organizer."}
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-zinc-400">
          ref: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
      >
        Try again
      </button>
    </main>
  );
}
