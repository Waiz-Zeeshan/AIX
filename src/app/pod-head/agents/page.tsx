import Link from "next/link";

import { AppFooter } from "@/components/chrome/AppFooter";
import { AppHeader } from "@/components/chrome/AppHeader";
import { PageHeader } from "@/components/chrome/PageHeader";
import { Alert } from "@/components/ui/alert";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { requireParticipant } from "@/lib/permissions";

import { RankAgentsClient, type AgentPoolItem } from "./RankAgentsClient";

export const dynamic = "force-dynamic";

export default async function RankAgentsPage() {
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
          title="Rank Agents"
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

  const [agents, existing] = await Promise.all([
    db.agentProfile.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        bio: true,
        skills: true,
        pitch: true,
        user: { select: { name: true, email: true } }
      }
    }),
    db.podHeadAgentSelection.findMany({
      where: { podHeadId: podHead.id },
      orderBy: { rank: "asc" },
      select: { agentId: true }
    })
  ]);

  const skillSet = new Set<string>();
  for (const a of agents) {
    for (const s of a.skills) skillSet.add(s);
  }
  const allSkills = Array.from(skillSet).sort((a, b) => a.localeCompare(b));

  const pool: AgentPoolItem[] = agents.map((a) => ({
    id: a.id,
    name: a.user.name,
    email: a.user.email,
    bio: a.bio,
    skills: a.skills,
    pitch: a.pitch
  }));

  const initialRanked = existing.map((r) => r.agentId);

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader user={{ email: user.email }} />
      <PageHeader
        eyebrow="Pod Head"
        title="Rank Agents"
        subtitle={`Select and rank exactly ${config.podHeadRanksTopNAgents} Agents. Search and filter to find your team.`}
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
        <RankAgentsClient
          pool={pool}
          allSkills={allSkills}
          initialRanked={initialRanked}
          requiredCount={config.podHeadRanksTopNAgents}
        />
      </main>
      <AppFooter />
    </div>
  );
}
