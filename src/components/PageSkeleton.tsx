/**
 * Generic loading skeleton — animated bars sized like typical content.
 * Pure server-renderable; uses Tailwind's animate-pulse.
 */

export function PageSkeleton({ title = "Loading…" }: { title?: string }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {title}
      </span>
    </main>
  );
}
