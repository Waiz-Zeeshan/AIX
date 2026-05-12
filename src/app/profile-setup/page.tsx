import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";

import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

function landingFor(user: {
  isAdmin: boolean;
  role: "AGENT" | "POD_HEAD" | "ORCH";
}): string {
  if (user.isAdmin) return "/admin";
  if (user.role === "ORCH") return "/orch";
  if (user.role === "POD_HEAD") return "/pod-head";
  return "/agent";
}

export default async function ProfileSetupPage() {
  const user = await requireAuth();

  if (user.profileCompletedAt) {
    redirect(landingFor(user));
  }

  const [config, preferencesPhase] = await Promise.all([
    getConfig(),
    db.eventPhase.findUnique({ where: { name: "PREFERENCES" } })
  ]);

  const phaseOpen = preferencesPhase?.status === "OPEN";

  if (!phaseOpen && !user.isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">
          Complete your profile
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Hi {user.name}.</p>
        <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Profile setup opens once the admin moves the event to the PREFERENCES
          phase.
        </div>
      </main>
    );
  }

  const initial = { bio: "", skills: "", pitch: "" };

  if (user.role === "ORCH") {
    const profile = await db.orchProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, pitch: "" },
      update: {}
    });
    initial.bio = profile.bio ?? "";
    initial.pitch = profile.pitch;
  } else if (user.role === "POD_HEAD") {
    const profile = await db.podHeadProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, pitch: "" },
      update: {}
    });
    initial.bio = profile.bio ?? "";
    initial.skills = profile.skills.join(", ");
    initial.pitch = profile.pitch;
  } else {
    const profile = await db.agentProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, pitch: "" },
      update: {}
    });
    initial.bio = profile.bio ?? "";
    initial.skills = profile.skills.join(", ");
    initial.pitch = profile.pitch;
  }

  const showSkills = user.role !== "ORCH";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        Complete your profile
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Hi {user.name} — before you can submit preferences, you need
        {showSkills ? " a bio, skills, and a pitch." : " a bio and a pitch."}
      </p>

      <ProfileForm
        initial={initial}
        showSkills={showSkills}
        pitchMin={config.pitchMinChars}
        pitchMax={config.pitchMaxChars}
      />
    </main>
  );
}
