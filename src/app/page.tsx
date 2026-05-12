import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    if (session.user.isAdmin) redirect("/admin");
    if (session.user.role === "ORCH") redirect("/orch");
    if (session.user.role === "POD_HEAD") redirect("/pod-head");
    redirect("/agent");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">
        Tkxel AI Unlimited
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Team formation platform. Sign in with your Tkxel Google account to get
        started.
      </p>
      <Link
        href="/signin"
        className="mt-8 inline-block rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
      >
        Sign in
      </Link>
    </main>
  );
}
