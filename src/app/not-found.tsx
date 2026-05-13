import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Not found — Tkxel AI Unlimited" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <LogoMark tone="dark" size="lg" />
      <p className="mt-6 font-display text-xs uppercase tracking-[0.3em] text-brand-accent">
        404
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-fg">
        Page not found
      </h1>
      <p className="mt-3 text-sm text-fg-muted">
        We couldn&rsquo;t find what you were looking for.
      </p>
      <Link href="/" className="mt-8">
        <Button variant="accent">Go home</Button>
      </Link>
    </main>
  );
}
