import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { PageHeader } from "@/components/chrome/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

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
      <>
        <PageHeader
          eyebrow="Profile"
          title="Complete your profile"
          subtitle={`Hi ${user.name}.`}
        />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <Alert variant="warning">
            Profile setup opens once the admin moves the event to the
            PREFERENCES phase.
          </Alert>
        </main>
      </>
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
    <>
      <PageHeader
        eyebrow="Profile setup"
        title="Complete your profile"
        subtitle={`Hi ${user.name} — before you can submit preferences, you need ${
          showSkills ? "a bio, skills, and a pitch." : "a bio and a pitch."
        }`}
      />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Card padding="lg">
          <ProfileForm
            initial={initial}
            showSkills={showSkills}
            pitchMin={config.pitchMinChars}
            pitchMax={config.pitchMaxChars}
          />
        </Card>
      </main>
    </>
  );
}
