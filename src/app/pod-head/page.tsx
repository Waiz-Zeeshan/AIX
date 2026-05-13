import Link from "next/link";

import { AppFooter } from "@/components/chrome/AppFooter";
import { AppHeader } from "@/components/chrome/AppHeader";
import { PageHeader } from "@/components/chrome/PageHeader";
import { SectionBanner } from "@/components/chrome/SectionBanner";
import { PitchCard } from "@/components/PitchCard";
import { TransparencyBadge } from "@/components/TransparencyBadge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { requireParticipant } from "@/lib/permissions";
import {
  getPodHeadResults,
  type AssignedAgent,
  type AssignedOrch,
  type AssignedProject,
  type PodHeadResults
} from "@/lib/results";

import { SubmitPreferencesButton } from "./_components/SubmitPreferencesButton";

export const dynamic = "force-dynamic";

export default async function PodHeadPage() {
  const user = await requireParticipant("POD_HEAD");

  const [phase, resultsPhase, config] = await Promise.all([
    db.eventPhase.findUnique({ where: { name: "PREFERENCES" } }),
    db.eventPhase.findUnique({ where: { name: "RESULTS_PUBLISHED" } }),
    getConfig()
  ]);
  const phaseOpen = phase?.status === "OPEN";
  const resultsOpen = resultsPhase?.status === "OPEN";

  const results: PodHeadResults | null = resultsOpen
    ? await getPodHeadResults(user.id)
    : null;

  const podHead =
    !resultsOpen
      ? await db.podHeadProfile.findUnique({
          where: { userId: user.id },
          select: { id: true }
        })
      : null;

  const [orchsRanked, agentsSelected, projectsPicked, freshUser] =
    !resultsOpen && phaseOpen && podHead
      ? await Promise.all([
          db.podHeadOrchRanking.count({ where: { podHeadId: podHead.id } }),
          db.podHeadAgentSelection.count({ where: { podHeadId: podHead.id } }),
          db.podHeadProjectPick.count({ where: { podHeadId: podHead.id } }),
          db.user.findUnique({
            where: { id: user.id },
            select: { preferencesSubmittedAt: true }
          })
        ])
      : [0, 0, 0, null];

  const orchTarget = config.orchCount;
  const agentTarget = config.podHeadRanksTopNAgents;
  const projectTarget = config.projectsPerPodHead;

  const orchsDone = orchsRanked === orchTarget;
  const agentsDone = agentsSelected === agentTarget;
  const projectsDone = projectsPicked === projectTarget;
  const allDone = orchsDone && agentsDone && projectsDone;

  const submittedAt = freshUser?.preferencesSubmittedAt ?? null;

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader user={{ email: user.email }} />
      <PageHeader
        eyebrow="Pod Head"
        title={resultsOpen ? "Your assignment" : "Pod Head dashboard"}
        subtitle={`Welcome, ${user.name} — ${user.email}`}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        {resultsOpen && results ? (
          <ResultsView
            results={results}
            orchOutOf={config.orchCount}
            podHeadsPerOrch={config.podHeadsPerOrch}
            agentRanksOutOf={config.podHeadRanksTopNAgents}
            theirAgentRankOutOf={config.agentRanksTopNPodHeads}
          />
        ) : !phaseOpen ? (
          <Alert variant="warning">Preferences are not open right now.</Alert>
        ) : (
          <>
            <section>
              <h2 className="font-display text-xl font-semibold text-fg">
                Your tasks
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                Complete all three before submitting your preferences.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <TaskCard
                  href="/pod-head/orchs"
                  title="Rank Orchs"
                  done={orchsRanked}
                  total={orchTarget}
                  description="Rank all 5 Orchs in order of preference."
                  complete={orchsDone}
                />
                <TaskCard
                  href="/pod-head/agents"
                  title="Rank Agents"
                  done={agentsSelected}
                  total={agentTarget}
                  description="Select and rank your top 10 Agents."
                  complete={agentsDone}
                />
                <TaskCard
                  href="/pod-head/projects"
                  title="Pick Projects"
                  done={projectsPicked}
                  total={projectTarget}
                  description="Choose a primary and secondary project."
                  complete={projectsDone}
                />
              </div>
            </section>

            <Card className="mt-10" padding="lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-fg">
                    Submit preferences
                  </h2>
                  <p className="mt-1 text-xs text-fg-muted">
                    Locks in your preferences and stamps your submission time
                    (used for project tie-breaks).
                  </p>
                </div>
                <SubmitPreferencesButton
                  disabled={!allDone}
                  initialSubmittedAt={
                    submittedAt ? submittedAt.toISOString() : null
                  }
                />
              </div>
            </Card>
          </>
        )}
      </main>
      <AppFooter />
    </div>
  );
}

function TaskCard({
  href,
  title,
  done,
  total,
  description,
  complete
}: {
  href: string;
  title: string;
  done: number;
  total: number;
  description: string;
  complete: boolean;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-border-default bg-surface px-4 py-4 transition hover:border-brand-accent hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-semibold text-fg">
          {title}
        </span>
        {complete ? (
          <Badge variant="success">Done</Badge>
        ) : (
          <Badge variant="neutral">
            {done}/{total}
          </Badge>
        )}
      </div>
      <p className="mt-2 text-xs text-fg-muted">{description}</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
        <div
          className={
            (complete ? "bg-emerald-500 " : "bg-brand-accent ") +
            "h-full rounded-full transition-all"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 text-xs font-medium text-brand-accent group-hover:underline">
        {title} ({done}/{total}) →
      </div>
    </Link>
  );
}

function ResultsView({
  results,
  orchOutOf,
  podHeadsPerOrch,
  agentRanksOutOf,
  theirAgentRankOutOf
}: {
  results: PodHeadResults;
  orchOutOf: number;
  podHeadsPerOrch: number;
  agentRanksOutOf: number;
  theirAgentRankOutOf: number;
}) {
  const { assignedOrch, assignedAgents, assignedProjects } = results;

  if (!assignedOrch) {
    return (
      <Alert variant="neutral" title="Results haven't been finalized yet">
        Once the admin finalizes the matching runs, your assigned Orch, Agents,
        and projects will appear here.
      </Alert>
    );
  }

  return (
    <div className="space-y-10">
      <OrchSection
        orch={assignedOrch}
        orchOutOf={orchOutOf}
        theirRankOutOf={podHeadsPerOrch}
      />
      <AgentsSection
        agents={assignedAgents}
        rankOutOf={agentRanksOutOf}
        theirRankOutOf={theirAgentRankOutOf}
      />
      <ProjectsSection projects={assignedProjects} />
    </div>
  );
}

function OrchSection({
  orch,
  orchOutOf,
  theirRankOutOf
}: {
  orch: AssignedOrch;
  orchOutOf: number;
  theirRankOutOf: number;
}) {
  return (
    <section>
      <SectionBanner
        title="Your Orch"
        subtitle="The Orch you've been matched with."
      />
      <div className="mt-6">
        <PitchCard
          name={orch.name}
          email={orch.email}
          role="ORCH"
          bio={orch.bio}
          pitch={orch.pitch}
          action={
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {orch.rankAchieved !== null ? (
                <TransparencyBadge
                  variant="rank-achieved"
                  rank={orch.rankAchieved}
                  outOf={orchOutOf}
                />
              ) : null}
              {orch.theirRankOfYou !== null ? (
                <TransparencyBadge
                  variant="their-rank"
                  rank={orch.theirRankOfYou}
                  outOf={theirRankOutOf}
                />
              ) : null}
              {orch.autoGenerated ? (
                <TransparencyBadge variant="auto-assigned" />
              ) : null}
            </div>
          }
        />
      </div>
    </section>
  );
}

function AgentsSection({
  agents,
  rankOutOf,
  theirRankOutOf
}: {
  agents: AssignedAgent[];
  rankOutOf: number;
  theirRankOutOf: number;
}) {
  return (
    <section>
      <SectionBanner
        title="Your Agents"
        subtitle={`The ${agents.length} Agents on your pod.`}
      />
      {agents.length === 0 ? (
        <p className="mt-6 text-sm text-fg-muted">
          No Agents have been assigned yet.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {agents.map((a) => (
            <PitchCard
              key={a.id}
              name={a.name}
              email={a.email}
              role="AGENT"
              bio={a.bio}
              skills={a.skills}
              pitch={a.pitch}
              action={
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {a.rankAchieved !== null ? (
                    <TransparencyBadge
                      variant="rank-achieved"
                      rank={a.rankAchieved}
                      outOf={rankOutOf}
                    />
                  ) : null}
                  {a.theirRankOfYou !== null ? (
                    <TransparencyBadge
                      variant="their-rank"
                      rank={a.theirRankOfYou}
                      outOf={theirRankOutOf}
                    />
                  ) : null}
                  {a.autoGenerated ? (
                    <TransparencyBadge variant="auto-assigned" />
                  ) : null}
                </div>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectsSection({ projects }: { projects: AssignedProject[] }) {
  return (
    <section>
      <SectionBanner
        title="Your Projects"
        subtitle="Projects assigned to your pod."
      />
      {projects.length === 0 ? (
        <p className="mt-6 text-sm text-fg-muted">
          No projects have been assigned yet.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectCard({ project }: { project: AssignedProject }) {
  return (
    <Card>
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-display text-sm font-semibold tracking-tight text-fg">
          {project.title}
        </h3>
        <div className="shrink-0">
          <ProjectDispositionBadge outcome={project.outcome} />
        </div>
      </header>

      {project.tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {project.tags.map((t) => (
            <li
              key={t}
              className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-medium text-brand-electric"
            >
              {t}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 whitespace-pre-wrap text-xs text-fg-muted">
        {project.description}
      </p>
    </Card>
  );
}

function ProjectDispositionBadge({
  outcome
}: {
  outcome: AssignedProject["outcome"];
}) {
  switch (outcome) {
    case "PRIMARY_HONORED":
      return <TransparencyBadge variant="primary-honored" />;
    case "SECONDARY_HONORED":
      return <TransparencyBadge variant="secondary-honored" />;
    case "FELL_BACK_TO_BALANCE":
      return <TransparencyBadge variant="balance-fallback" />;
  }
}
