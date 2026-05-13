import Link from "next/link";

import { AppFooter } from "@/components/chrome/AppFooter";
import { AppHeader } from "@/components/chrome/AppHeader";
import { PageHeader } from "@/components/chrome/PageHeader";
import { Alert } from "@/components/ui/alert";
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
      <div className="min-h-screen bg-surface">
        <AppHeader user={{ email: user.email }} />
        <PageHeader
          eyebrow="Pod Head"
          title="Rank Orchs"
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
    <div className="min-h-screen bg-surface">
      <AppHeader user={{ email: user.email }} />
      <PageHeader
        eyebrow="Pod Head"
        title="Rank Orchs"
        subtitle={`Drag-to-rank all ${config.orchCount} Orchs. Auto-saves as you go.`}
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
        <RankOrchsClient
          pool={pool}
          initialRanked={initialRanked}
          requiredCount={config.orchCount}
        />
      </main>
      <AppFooter />
    </div>
  );
}
