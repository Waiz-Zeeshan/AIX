/**
 * Agent dashboard — preference flow (SRS §6.4: FR-AG2 + FR-AG3 + FR-AG4).
 *
 * Server component. Loads everything the client picker needs in a single
 * request: phase status, EventConfig, the full Pod Head pool (with user
 * name/email), and the current user's existing ranking so a refresh preserves
 * state.
 */

import { signOut } from "@/auth";
import { PitchCard } from "@/components/PitchCard";
import { TransparencyBadge } from "@/components/TransparencyBadge";
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
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Agent Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Welcome, {user.name} ({user.email})
          </p>
        </div>
        <SignOut />
      </header>

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
        <section className="mt-10 rounded-md border border-amber-200 bg-amber-50 px-4 py-6 dark:border-amber-900 dark:bg-amber-950">
          <h2 className="text-lg font-medium text-amber-900 dark:text-amber-100">
            Preferences are not open right now
          </h2>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            Once the admin opens the PREFERENCES phase, you&rsquo;ll be able to
            browse the Pod Head pool and rank your top {config.agentRanksTopNPodHeads}.
          </p>
        </section>
      )}
    </main>
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
      <section className="mt-10 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-medium">
          Results haven&rsquo;t been finalized yet
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Once the admin publishes results, your Pod Head, Orch, pod-mates, and
          project assignments will appear here.
        </p>
      </section>
    );
  }

  const { assignedPodHead, orchAbove, podMates, projects } = results;

  return (
    <section className="mt-10 space-y-12">
      <div>
        <h2 className="text-lg font-medium">Your Pod Head</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The Pod Head you&rsquo;ve been matched with for the event.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
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
      </div>

      <div>
        <h2 className="text-lg font-medium">Your Orch</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The Orch overseeing your Pod Head&rsquo;s pod.
        </p>
        <div className="mt-4">
          {orchAbove ? (
            <PitchCard
              name={orchAbove.name}
              role="ORCH"
              email={orchAbove.email}
              pitch={orchAbove.pitch}
            />
          ) : (
            <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No Orch has been assigned to your Pod Head yet.
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium">Your pod-mates</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The other agents on your pod.
        </p>
        {podMates.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No pod-mates assigned yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>

      <div>
        <h2 className="text-lg font-medium">Your projects</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The projects your pod will be working on.
        </p>
        {projects.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No projects have been assigned to your pod yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <article
                key={project.id}
                className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <h3 className="text-sm font-semibold tracking-tight">
                  {project.title}
                </h3>
                {project.tags.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {project.description}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

async function AgentRankingSection({
  userId,
  topN
}: {
  userId: string;
  topN: number;
}) {
  // Ensure the agent has a profile row (the gate redirects to /profile-setup
  // when the profile isn't complete, but a stray row could be missing).
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

  // Fetch all 60 Pod Heads with their user names + emails. Sort by name for a
  // stable browsing order.
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

  // Read the User.preferencesSubmittedAt timestamp so a refresh keeps the
  // "Submitted" stamp visible.
  const userRow = await db.user.findUnique({
    where: { id: userId },
    select: { preferencesSubmittedAt: true }
  });

  return (
    <section className="mt-10">
      <div>
        <h2 className="text-lg font-medium">Rank your top {topN} Pod Heads</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Browse the {podHeads.length} Pod Heads, add your top {topN} to your
          ranking, then drag to order them. Rank 1 is your top pick. Your
          ranking auto-saves; click Submit when you&rsquo;re happy.
        </p>
      </div>

      {podHeads.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          The Pod Head pool isn&rsquo;t populated yet. Check back once the admin
          has imported participants.
        </div>
      ) : (
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
      )}
    </section>
  );
}

function SignOut() {
  return (
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
  );
}
