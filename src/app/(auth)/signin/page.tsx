import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const metadata = { title: "Sign in — Tkxel AI Unlimited" };

interface PageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  if (session?.user) {
    redirect(landingFor(session.user));
  }

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="text-sm text-zinc-500">
          Tkxel AI Unlimited — Team Formation Platform
        </p>
      </div>

      {params.error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {params.error === "AccessDenied"
            ? "This email is not registered for the event. Contact the organizer."
            : "Sign-in failed. Try again."}
        </div>
      ) : null}

      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: callbackUrl });
        }}
      >
        <button
          type="submit"
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Continue with Google
        </button>
      </form>

      {isDev ? (
        <form
          className="mt-6 space-y-2"
          action={async (formData: FormData) => {
            "use server";
            const email = String(formData.get("email") ?? "");
            await signIn("dev-email", { email, redirectTo: callbackUrl });
          }}
        >
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Dev sign-in (no Google needed)
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              name="email"
              placeholder="waiz.zeeshan@camp1.tkxel.com"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              required
            />
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              Sign in
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Available in development only. Email must already exist in the
            User table.
          </p>
        </form>
      ) : null}
    </main>
  );
}

function landingFor(user: {
  isAdmin: boolean;
  role: "AGENT" | "POD_HEAD" | "ORCH";
}) {
  if (user.isAdmin) return "/admin";
  if (user.role === "ORCH") return "/orch";
  if (user.role === "POD_HEAD") return "/pod-head";
  return "/agent";
}
