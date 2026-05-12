import Link from "next/link";

import { signOut } from "@/auth";
import { PitchCard } from "@/components/PitchCard";
import { TransparencyBadge } from "@/components/TransparencyBadge";
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

  // When results are published, fetch finalized assignments and skip the
  // tasks UI entirely. Otherwise load preference-flow progress counters.
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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Pod Head Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Welcome, {user.name} ({user.email})
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </form>
      </header>

      {resultsOpen && results ? (
        <ResultsView
          results={results}
          orchOutOf={config.orchCount}
          podHeadsPerOrch={config.podHeadsPerOrch}
          agentRanksOutOf={config.podHeadRanksTopNAgents}
          theirAgentRankOutOf={config.agentRanksTopNPodHeads}
        />
      ) : !phaseOpen ? (
        <section className="mt-10 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Preferences are not open right now.
        </section>
      ) : (
        <>
          <section className="mt-10">
            <h2 className="text-lg font-medium">Your tasks</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Complete all three before submitting your preferences.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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

          <section className="mt-10 rounded-md border border-zinc-200 px-5 py-5 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">Submit preferences</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Locks in your preferences and stamps your submission time
                  (used for project tie-breaks).
                </p>
              </div>
              <SubmitPreferencesButton
                disabled={!allDone}
                initialSubmittedAt={submittedAt ? submittedAt.toISOString() : null}
              />
            </div>
          </section>
        </>
      )}
    </main>
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
      className="group block rounded-md border border-zinc-200 px-4 py-4 transition hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        {complete ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
            Done
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {done}/{total}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-zinc-500">{description}</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
        <div
          className={
            (complete ? "bg-emerald-500 " : "bg-zinc-500 ") +
            "h-full rounded-full transition-all"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 text-xs font-medium text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
        {title} ({done}/{total}) →
      </div>
    </Link>
  );
}

// === Results view (SRS §6.3 FR-P7) ============================================

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
      <section className="mt-10 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Results haven&rsquo;t been finalized yet
        </h2>
        <p className="mt-2">
          Once the admin finalizes the matching runs, your assigned Orch,
          Agents, and projects will appear here.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-10 space-y-10">
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
      <h2 className="text-lg font-medium">Your Orch</h2>
      <p className="mt-1 text-xs text-zinc-500">
        The Orch you&rsquo;ve been matched with.
      </p>
      <div className="mt-4">
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
      <h2 className="text-lg font-medium">Your Agents</h2>
      <p className="mt-1 text-xs text-zinc-500">
        The {agents.length} Agents on your pod.
      </p>
      {agents.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No Agents have been assigned yet.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
      <h2 className="text-lg font-medium">Your Projects</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Projects assigned to your pod.
      </p>
      {projects.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No projects have been assigned yet.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
    <article className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">
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
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {t}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
        {project.description}
      </p>
    </article>
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
