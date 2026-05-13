"use client";

import { useEffect } from "react";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <LogoMark tone="dark" size="lg" />
      <p className="mt-6 font-display text-xs uppercase tracking-[0.3em] text-red-600">
        Something went wrong
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-fg">
        We hit an unexpected error
      </h1>
      <p className="mt-3 text-sm text-fg-muted">
        {error.message ||
          "Please try again. If this keeps happening, contact the organizer."}
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-fg-subtle">
          ref: {error.digest}
        </p>
      ) : null}
      <Button onClick={reset} variant="accent" className="mt-8">
        Try again
      </Button>
    </main>
  );
}
