import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Hero } from "@/components/chrome/Hero";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <Hero subhead="Sign in to continue to the AI Unlimited platform.">
      <div className="w-full space-y-4 text-left">
        {params.error ? (
          <Alert variant="danger">
            {params.error === "AccessDenied"
              ? "This email is not registered for the event. Contact the organizer."
              : "Sign-in failed. Try again."}
          </Alert>
        ) : null}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl });
          }}
        >
          <Button type="submit" variant="secondary" size="lg" className="w-full">
            Continue with Google
          </Button>
        </form>

        {isDev ? (
          <form
            className="space-y-2 rounded-md border border-white/15 bg-white/5 p-4"
            action={async (formData: FormData) => {
              "use server";
              const email = String(formData.get("email") ?? "");
              await signIn("dev-email", { email, redirectTo: callbackUrl });
            }}
          >
            <Label className="text-white/70">
              Dev sign-in (no Google needed)
            </Label>
            <div className="flex gap-2">
              <Input
                type="email"
                name="email"
                placeholder="waiz.zeeshan@camp1.tkxel.com"
                required
                className="flex-1 border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-white focus:ring-white/30"
              />
              <Button type="submit" variant="accent">
                Sign in
              </Button>
            </div>
            <p className="text-xs text-white/60">
              Available in development only. Email must already exist in the
              User table.
            </p>
          </form>
        ) : null}
      </div>
    </Hero>
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
