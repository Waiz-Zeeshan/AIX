import Link from "next/link";

import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { requireParticipant } from "@/lib/permissions";

import { RankOrchsClient, type OrchPoolItem } from "./RankOrchsClient";

export const dynamic = "force-dynamic";

export default async function RankOrchsPage() {
  const user = await requireParticipant("POD_HEAD");

  const phase = await db.eventPhase.findUnique({
    where: { name: "PREFERENCES" }
  });
  if (phase?.status !== "OPEN") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Rank Orchs</h1>
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

  const [orchs, existing] = await Promise.all([
    db.orchProfile.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        bio: true,
        pitch: true,
        user: { select: { name: true, email: true } }
      }
    }),
    db.podHeadOrchRanking.findMany({
      where: { podHeadId: podHead.id },
      orderBy: { rank: "asc" },
      select: { orchId: true }
    })
  ]);

  const pool: OrchPoolItem[] = orchs.map((o) => ({
    id: o.id,
    name: o.user.name,
    email: o.user.email,
    bio: o.bio,
    pitch: o.pitch
  }));

  const initialRanked = existing.map((r) => r.orchId);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rank Orchs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Drag-to-rank all {config.orchCount} Orchs. Auto-saves as you go.
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
        <RankOrchsClient
          pool={pool}
          initialRanked={initialRanked}
          requiredCount={config.orchCount}
        />
      </div>
    </main>
  );
}
