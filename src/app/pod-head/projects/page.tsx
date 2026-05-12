import Link from "next/link";

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
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Pick Projects</h1>
        <p className="mt-4 text-sm text-zinc-500">
          Preferences are not open right now.
        </p>
        <Link
          href="/pod-head"
          className="mt-6 inline-block text-sm text-zinc-700 underline dark:text-zinc-300"
        >
          ← Back to tasks
        </Link>
      </main>
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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pick Projects</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Choose exactly {config.projectsPerPodHead} projects. The first is
            your primary (rank 1), the second your secondary (rank 2).
          </p>
        </div>
        <Link
          href="/pod-head"
          className="text-sm text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          ← Back to tasks
        </Link>
      </header>

      <div className="mt-8">
        <PickProjectsClient
          pool={pool}
          initialPicked={initialPicked}
          requiredCount={config.projectsPerPodHead}
        />
      </div>
    </main>
  );
}
