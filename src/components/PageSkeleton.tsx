/**
 * Generic loading skeleton — animated bars sized like typical content.
 * Pure server-renderable; uses Tailwind's animate-pulse.
 */

export function PageSkeleton({ title = "Loading…" }: { title?: string }) {
  return (
    <>
      <div className="bg-brand-page-header h-32" aria-hidden />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="h-8 w-40 animate-pulse rounded bg-surface-alt" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-surface-muted" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-md border border-border-default bg-surface-muted"
            />
          ))}
        </div>
        <span className="sr-only" aria-live="polite">
          {title}
        </span>
      </main>
    </>
  );
}
