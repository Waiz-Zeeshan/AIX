import Link from "next/link";

export const metadata = { title: "Not found — Tkxel AI Unlimited" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <p className="font-mono text-xs uppercase tracking-wider text-zinc-500">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-3 text-sm text-zinc-500">
        We couldn&rsquo;t find what you were looking for.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
      >
        Go home
      </Link>
    </main>
  );
}
