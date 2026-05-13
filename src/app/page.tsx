import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Hero } from "@/components/chrome/Hero";
import { Button } from "@/components/ui/button";

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
    <Hero subhead="Internal team-formation platform for the AI Unlimited Event. Sign in with your Tkxel Google account to get started.">
      <Link href="/signin">
        <Button variant="accent" size="lg">
          Sign in
        </Button>
      </Link>
    </Hero>
  );
}
