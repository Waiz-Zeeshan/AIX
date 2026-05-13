import { signOut } from "@/auth";
import { cn } from "@/lib/utils";

export function SignOutForm({ className }: { className?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    >
      <button
        type="submit"
        className={cn(
          "rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/10",
          className
        )}
      >
        Sign out
      </button>
    </form>
  );
}
