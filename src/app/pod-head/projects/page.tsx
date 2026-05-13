import Link from "next/link";

import { AppFooter } from "@/components/chrome/AppFooter";
import { AppHeader } from "@/components/chrome/AppHeader";
import { PageHeader } from "@/components/chrome/PageHeader";
import { Alert } from "@/components/ui/alert";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { requireParticipant } from "@/lib/permissions";

import { PickProjectsClient, type ProjectPoolItem } from "./PickProjectsClient";

export const dynamic = "force-dynamic";

export default async function PickProjectsPage() {
  const user = await requireParticipant("POD_HEAD");

  const phase = await db.eventPhase.findUnique({
    where: { name: "PREFERENCES" }
  });
  if (phase?.status !== "OPEN") {
    return (
      <div className="min-h-screen bg-surface">
        <AppHeader user={{ email: user.email }} />
        <PageHeader
          eyebrow="Pod Head"
          title="Pick Projects"
          actions={
            <Link
              href="/pod-head"
              className="text-sm text-white/80 underline hover:text-white"
            >
              ← Back to tasks
            </Link>
          }
        />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <Alert variant="warning">Preferences are not open right now.</Alert>
        </main>
        <AppFooter />
      </div>
    );
  }

  const config = await getConfig();

  const podHead = await db.podHeadProfile.findUniqueOrThrow({
    where: { userId: user.id },
    select: { id: true }
  });

  const [projects, existing] = await Promise.all([
    db.project.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        capacity: true
      }
    }),
    db.podHeadProjectPick.findMany({
      where: { podHeadId: podHead.id },
      orderBy: { rank: "asc" },
      select: { projectId: true }
    })
  ]);

  const pool: ProjectPoolItem[] = projects.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    tags: p.tags,
    capacity: p.capacity ?? config.defaultProjectCapacity
  }));

  const initialPicked = existing.map((r) => r.projectId);

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader user={{ email: user.email }} />
      <PageHeader
        eyebrow="Pod Head"
        title="Pick Projects"
        subtitle={`Choose exactly ${config.projectsPerPodHead} projects. The first is your primary (rank 1), the second your secondary (rank 2).`}
        actions={
          <Link
            href="/pod-head"
            className="text-sm text-white/80 underline hover:text-white"
          >
            ← Back to tasks
          </Link>
        }
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <PickProjectsClient
          pool={pool}
          initialPicked={initialPicked}
          requiredCount={config.projectsPerPodHead}
        />
      </main>
      <AppFooter />
    </div>
  );
}
