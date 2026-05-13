/**
 * Agent dashboard — preference flow (SRS §6.4: FR-AG2 + FR-AG3 + FR-AG4).
 *
 * Server component. Loads everything the client picker needs in a single
 * request: phase status, EventConfig, the full Pod Head pool (with user
 * name/email), and the current user's existing ranking so a refresh preserves
 * state.
 */

import { AppFooter } from "@/components/chrome/AppFooter";
import { AppHeader } from "@/components/chrome/AppHeader";
import { PageHeader } from "@/components/chrome/PageHeader";
import { SectionBanner } from "@/components/chrome/SectionBanner";
import { PitchCard } from "@/components/PitchCard";
import { TransparencyBadge } from "@/components/TransparencyBadge";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { requireParticipant } from "@/lib/permissions";
import { getAgentResults } from "@/lib/results";

import {
  saveAgentRankingsAction,
  submitPreferencesAction
} from "./actions";
import {
  AgentRankPicker,
  type PodHeadOption
} from "./rank-picker";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const user = await requireParticipant("AGENT");

  const [config, preferencesPhase, resultsPhase] = await Promise.all([
    getConfig(),
    db.eventPhase.findUnique({ where: { name: "PREFERENCES" } }),
    db.eventPhase.findUnique({ where: { name: "RESULTS_PUBLISHED" } })
  ]);

  const resultsOpen = resultsPhase?.status === "OPEN";
  const preferencesOpen = preferencesPhase?.status === "OPEN";

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader user={{ email: user.email }} />
      <PageHeader
        eyebrow="Agent"
        title={resultsOpen ? "Your assignment" : "Agent dashboard"}
        subtitle={`Welcome, ${user.name} — ${user.email}`}
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        {resultsOpen ? (
          <AgentResultsSection
            userId={user.id}
            podHeadRanksTopNAgents={config.podHeadRanksTopNAgents}
          />
        ) : preferencesOpen ? (
          <AgentRankingSection
            userId={user.id}
            topN={config.agentRanksTopNPodHeads}
          />
        ) : (
          <Alert variant="warning" title="Preferences are not open right now">
            Once the admin opens the PREFERENCES phase, you&rsquo;ll be able to
            browse the Pod Head pool and rank your top {config.agentRanksTopNPodHeads}.
          </Alert>
        )}
      </main>
      <AppFooter />
    </div>
  );
}

async function AgentResultsSection({
  userId,
  podHeadRanksTopNAgents
}: {
  userId: string;
  podHeadRanksTopNAgents: number;
}) {
  const results = await getAgentResults(userId);

  if (!results.assignedPodHead) {
    return (
      <Alert variant="neutral" title="Results haven't been finalized yet">
        Once the admin publishes results, your Pod Head, Orch, pod-mates, and
        project assignments will appear here.
      </Alert>
    );
  }

  const { assignedPodHead, orchAbove, podMates, projects } = results;

  return (
    <div className="space-y-12">
      <section>
        <SectionBanner
          title="Your Pod Head"
          subtitle="The Pod Head you've been matched with for the event."
        />
        <div className="mt-6 flex flex-wrap gap-2">
          {assignedPodHead.rankAchieved !== null ? (
            <TransparencyBadge
              variant="rank-achieved"
              rank={assignedPodHead.rankAchieved}
            />
          ) : (
            <TransparencyBadge variant="auto-assigned" />
          )}
          {assignedPodHead.theirRankOfYou !== null ? (
            <TransparencyBadge
              variant="their-rank"
              rank={assignedPodHead.theirRankOfYou}
              outOf={podHeadRanksTopNAgents}
            />
          ) : null}
        </div>
        <div className="mt-3">
          <PitchCard
            name={assignedPodHead.name}
            role="POD_HEAD"
            email={assignedPodHead.email}
            bio={assignedPodHead.bio}
            skills={assignedPodHead.skills}
            pitch={assignedPodHead.pitch}
          />
        </div>
      </section>

      <section>
        <SectionBanner
          title="Your Orch"
          subtitle="The Orch overseeing your Pod Head's pod."
        />
        <div className="mt-6">
          {orchAbove ? (
            <PitchCard
              name={orchAbove.name}
              role="ORCH"
              email={orchAbove.email}
              pitch={orchAbove.pitch}
            />
          ) : (
            <Card variant="dashed-empty" padding="lg">
              <p className="text-center text-sm">
                No Orch has been assigned to your Pod Head yet.
              </p>
            </Card>
          )}
        </div>
      </section>

      <section>
        <SectionBanner
          title="Your pod-mates"
          subtitle="The other agents on your pod."
        />
        {podMates.length === 0 ? (
          <Card variant="dashed-empty" padding="lg" className="mt-6">
            <p className="text-center text-sm">No pod-mates assigned yet.</p>
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {podMates.map((mate) => (
              <PitchCard
                key={mate.id}
                name={mate.name}
                role="AGENT"
                email={mate.email}
                bio={mate.bio}
                skills={mate.skills}
                pitch={mate.pitch}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionBanner
          title="Your projects"
          subtitle="The projects your pod will be working on."
        />
        {projects.length === 0 ? (
          <Card variant="dashed-empty" padding="lg" className="mt-6">
            <p className="text-center text-sm">
              No projects have been assigned to your pod yet.
            </p>
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardTitle>{project.title}</CardTitle>
                {project.tags.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-medium text-brand-electric"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">
                  {project.description}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function AgentRankingSection({
  userId,
  topN
}: {
  userId: string;
  topN: number;
}) {
  const agentProfile = await db.agentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      podHeadRankings: {
        orderBy: { rank: "asc" },
        select: { podHeadId: true }
      }
    }
  });

  const podHeadRows = await db.podHeadProfile.findMany({
    select: {
      id: true,
      bio: true,
      skills: true,
      pitch: true,
      user: { select: { name: true, email: true } }
    },
    orderBy: { user: { name: "asc" } }
  });

  const podHeads: PodHeadOption[] = podHeadRows.map((row) => ({
    id: row.id,
    name: row.user.name,
    email: row.user.email,
    bio: row.bio,
    skills: row.skills,
    pitch: row.pitch
  }));

  const initialRanking = agentProfile?.podHeadRankings.map((r) => r.podHeadId) ?? [];

  const userRow = await db.user.findUnique({
    where: { id: userId },
    select: { preferencesSubmittedAt: true }
  });

  return (
    <section>
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-fg">
          Rank your top {topN} Pod Heads
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          Browse the {podHeads.length} Pod Heads, add your top {topN} to your
          ranking, then drag to order them. Rank 1 is your top pick. Your
          ranking auto-saves; click Submit when you&rsquo;re happy.
        </p>
      </div>

      {podHeads.length === 0 ? (
        <Card variant="dashed-empty" padding="lg" className="mt-8">
          <p className="text-center text-sm">
            The Pod Head pool isn&rsquo;t populated yet. Check back once the
            admin has imported participants.
          </p>
        </Card>
      ) : (
        <div className="mt-8">
          <AgentRankPicker
            podHeads={podHeads}
            initialRanking={initialRanking}
            maxRanks={topN}
            initialSubmittedAt={
              userRow?.preferencesSubmittedAt
                ? userRow.preferencesSubmittedAt.toISOString()
                : null
            }
            saveAction={saveAgentRankingsAction}
            submitAction={submitPreferencesAction}
          />
        </div>
      )}
    </section>
  );
}
