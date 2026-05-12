import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { signOut } from "@/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/phases"
              className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Phases
            </Link>
            <Link
              href="/admin/config"
              className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Config
            </Link>
            <Link
              href="/admin/users"
              className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Users
            </Link>
            <Link
              href="/admin/projects"
              className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Projects
            </Link>
            <Link
              href="/admin/audit"
              className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Audit
            </Link>
            <Link
              href="/admin/matching"
              className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Matching
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <span>{user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/signin" });
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}
