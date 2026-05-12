import Link from "next/link";

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
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Rank Agents</h1>
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

  // Build skill set once on the server (deterministic order).
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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rank Agents</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Select and rank exactly {config.podHeadRanksTopNAgents} Agents.
            Search and filter to find your team.
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
        <RankAgentsClient
          pool={pool}
          allSkills={allSkills}
          initialRanked={initialRanked}
          requiredCount={config.podHeadRanksTopNAgents}
        />
      </div>
    </main>
  );
}
