import Link from "next/link";
import { notFound } from "next/navigation";
import type { Role } from "@prisma/client";

import { PageHeader } from "@/components/chrome/PageHeader";
import {
  PreferenceTree,
  type PreferenceBranchData,
  type PreferenceTreeNode
} from "@/components/PreferenceTree";
import { TransparencyBadge } from "@/components/TransparencyBadge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { getProjectDispositions } from "@/lib/results";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  ORCH: "Orch",
  POD_HEAD: "Pod Head",
  AGENT: "Agent"
};

const ROLE_BADGE_VARIANT: Record<Role, "accent" | "info" | "neutral"> = {
  ORCH: "accent",
  POD_HEAD: "info",
  AGENT: "neutral"
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    include: {
      orchProfile: true,
      podHeadProfile: true,
      agentProfile: true
    }
  });
  if (!user) notFound();

  const config = await getConfig();

  return (
    <>
      <PageHeader
        eyebrow={`Admin · Users · ${user.email}`}
        title={user.name}
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <nav className="text-xs text-fg-muted">
          <Link href="/admin/users" className="text-brand-accent hover:underline">
            ← Back to Users
          </Link>
        </nav>

        <header className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variant={ROLE_BADGE_VARIANT[user.role]}>{user.role}</Badge>
          {user.isAdmin && <Badge variant="warning">admin</Badge>}
        </header>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
          <span className="font-mono">{user.email}</span>
          <span>·</span>
          <span>
            Profile:{" "}
            {user.profileCompletedAt ? (
              <span className="font-medium text-emerald-700">✓ completed</span>
            ) : (
              <span className="text-fg-subtle">not completed</span>
            )}
          </span>
          <span>·</span>
          <span>
            Prefs:{" "}
            {user.preferencesSubmittedAt ? (
              <span className="font-medium text-emerald-700">✓ submitted</span>
            ) : (
              <span className="text-fg-subtle">not submitted</span>
            )}
          </span>
          <span>·</span>
          <span>
            Joined{" "}
            <time dateTime={user.createdAt.toISOString()}>
              {user.createdAt.toISOString().slice(0, 10)}
            </time>
          </span>
        </div>

        <ProfileCard user={user} />

        <section className="mt-10">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-fg-muted">
            Preferences
          </h2>
          <p className="mt-1 text-xs text-fg-muted">
            {ROLE_LABEL[user.role]}&apos;s ranked picks (root → branches →
            children) and who picked them in return.
          </p>

          <div className="mt-4">
            {user.role === "AGENT" ? (
              <AgentTree
                name={user.name}
                profileId={user.agentProfile?.id ?? null}
              />
            ) : user.role === "POD_HEAD" ? (
              <PodHeadTree
                name={user.name}
                profileId={user.podHeadProfile?.id ?? null}
                podHeadCount={config.podHeadCount}
              />
            ) : (
              <OrchTree
                name={user.name}
                profileId={user.orchProfile?.id ?? null}
              />
            )}
          </div>
        </section>
      </main>
    </>
  );
}

// === Profile card ===

function ProfileCard({
  user
}: {
  user: {
    role: Role;
    phone: string | null;
    empId: string | null;
    orchProfile: { bio: string | null; pitch: string } | null;
    podHeadProfile: {
      bio: string | null;
      pitch: string;
      skills: string[];
      department: string | null;
    } | null;
    agentProfile: {
      bio: string | null;
      pitch: string;
      skills: string[];
      preferredDomains: string[];
    } | null;
  };
}) {
  const profile =
    user.role === "AGENT"
      ? user.agentProfile
      : user.role === "POD_HEAD"
        ? user.podHeadProfile
        : user.orchProfile;

  const skills =
    user.role === "AGENT"
      ? user.agentProfile?.skills ?? []
      : user.role === "POD_HEAD"
        ? user.podHeadProfile?.skills ?? []
        : [];
  const preferredDomains = user.agentProfile?.preferredDomains ?? [];
  const department = user.podHeadProfile?.department ?? null;

  return (
    <Card padding="lg" className="mt-8">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-fg-muted">
        Profile
      </h2>

      {!profile && (
        <Alert variant="warning" className="mt-3 text-xs">
          This user does not have a {ROLE_LABEL[user.role]} profile. They have
          not completed profile setup.
        </Alert>
      )}

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Phone" value={user.phone} />
        <Field label="EMP ID" value={user.empId} mono />
        <Field label="Department" value={department} />
      </div>

      {profile && (
        <div className="mt-4 space-y-3">
          <Field label="Bio" value={profile.bio} multiline />
          <Field label="Pitch" value={profile.pitch} multiline />

          {skills.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-fg-muted">
                Skills
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-medium text-brand-electric"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {preferredDomains.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-fg-muted">
                Preferred domains
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {preferredDomains.map((d) => (
                  <Badge key={d} variant="info">
                    {d}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Field({
  label,
  value,
  mono,
  multiline
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div
        className={[
          "mt-1 text-sm text-fg",
          mono ? "font-mono text-xs" : "",
          multiline ? "whitespace-pre-wrap" : ""
        ].join(" ")}
      >
        {value && value.trim().length > 0 ? (
          value
        ) : (
          <span className="text-fg-subtle">—</span>
        )}
      </div>
    </div>
  );
}

// === Agent tree ===

async function AgentTree({
  name,
  profileId
}: {
  name: string;
  profileId: string | null;
}) {
  if (!profileId) {
    return <NoProfileMessage role="AGENT" name={name} />;
  }

  const profile = await db.agentProfile.findUnique({
    where: { id: profileId },
    include: {
      assignedPodHead: {
        select: { id: true, user: { select: { name: true } } }
      },
      podHeadRankings: {
        orderBy: { rank: "asc" },
        include: {
          podHead: {
            select: {
              id: true,
              department: true,
              user: { select: { name: true } }
            }
          }
        }
      },
      selectedByPodHeads: {
        orderBy: { rank: "asc" },
        include: {
          podHead: {
            select: {
              id: true,
              department: true,
              user: { select: { name: true } }
            }
          }
        }
      }
    }
  });
  if (!profile) return <NoProfileMessage role="AGENT" name={name} />;

  const assignedId = profile.assignedPodHeadId;

  const outgoing: PreferenceTreeNode[] = profile.podHeadRankings.map((r) => ({
    rank: r.rank,
    name: r.podHead.user.name,
    role: "POD_HEAD",
    subtitle: r.podHead.department ?? undefined,
    autoGenerated: r.autoGenerated,
    matched: assignedId === r.podHead.id,
    badges: (
      <>
        {r.autoGenerated && <TransparencyBadge variant="auto-assigned" />}
        {assignedId === r.podHead.id && (
          <TransparencyBadge variant="rank-achieved" rank={r.rank} />
        )}
      </>
    )
  }));

  const incoming: PreferenceTreeNode[] = profile.selectedByPodHeads.map((s) => ({
    rank: s.rank,
    name: s.podHead.user.name,
    role: "POD_HEAD",
    subtitle: s.podHead.department ?? undefined,
    autoGenerated: s.autoGenerated,
    matched: assignedId === s.podHead.id,
    badges: (
      <>
        {s.autoGenerated && <TransparencyBadge variant="auto-assigned" />}
        <TransparencyBadge variant="their-rank" rank={s.rank} />
      </>
    )
  }));

  const branches: PreferenceBranchData[] = [
    {
      title: "Pod Head Priorities",
      caption: `Pod Heads this agent ranked (top ${outgoing.length || "—"}).`,
      emptyMessage: "Agent has not submitted Pod Head preferences yet.",
      items: outgoing
    },
    {
      title: "Picked by Pod Heads",
      caption: `Pod Heads who ranked this agent.`,
      emptyMessage: "No Pod Head has ranked this agent yet.",
      items: incoming
    }
  ];

  return (
    <PreferenceTree
      root={
        <RootHeader
          name={name}
          role="AGENT"
          assignment={
            profile.assignedPodHead
              ? `Pod Head: ${profile.assignedPodHead.user.name}`
              : null
          }
        />
      }
      branches={branches}
    />
  );
}

// === Pod Head tree ===

async function PodHeadTree({
  name,
  profileId,
  podHeadCount
}: {
  name: string;
  profileId: string | null;
  podHeadCount: number;
}) {
  if (!profileId) return <NoProfileMessage role="POD_HEAD" name={name} />;

  const profile = await db.podHeadProfile.findUnique({
    where: { id: profileId },
    include: {
      assignedOrch: { select: { id: true, user: { select: { name: true } } } },
      orchRankings: {
        orderBy: { rank: "asc" },
        include: {
          orch: { select: { id: true, user: { select: { name: true } } } }
        }
      },
      agentSelections: {
        orderBy: { rank: "asc" },
        include: {
          agent: {
            select: {
              id: true,
              skills: true,
              user: { select: { name: true } }
            }
          }
        }
      },
      projectPicks: {
        orderBy: { rank: "asc" },
        include: { project: { select: { id: true, title: true, tags: true } } }
      },
      selectedByOrchs: {
        orderBy: { rank: "asc" },
        include: {
          orch: { select: { id: true, user: { select: { name: true } } } }
        }
      },
      rankedByAgents: {
        orderBy: { rank: "asc" },
        include: {
          agent: {
            select: {
              id: true,
              skills: true,
              user: { select: { name: true } }
            }
          }
        }
      }
    }
  });
  if (!profile) return <NoProfileMessage role="POD_HEAD" name={name} />;

  const assignedOrchId = profile.assignedOrchId;
  const dispositions = await getProjectDispositions(profile.id);

  const assignedAgentIds = new Set(
    (
      await db.agentProfile.findMany({
        where: { assignedPodHeadId: profile.id },
        select: { id: true }
      })
    ).map((a) => a.id)
  );

  const orchBranch: PreferenceTreeNode[] = profile.orchRankings.map((r) => ({
    rank: r.rank,
    name: r.orch.user.name,
    role: "ORCH",
    autoGenerated: r.autoGenerated,
    matched: assignedOrchId === r.orch.id,
    badges: (
      <>
        {r.autoGenerated && <TransparencyBadge variant="auto-assigned" />}
        {assignedOrchId === r.orch.id && (
          <TransparencyBadge variant="rank-achieved" rank={r.rank} />
        )}
      </>
    )
  }));

  const agentPicksBranch: PreferenceTreeNode[] = profile.agentSelections.map(
    (s) => ({
      rank: s.rank,
      name: s.agent.user.name,
      role: "AGENT",
      subtitle: s.agent.skills.slice(0, 3).join(", ") || undefined,
      autoGenerated: s.autoGenerated,
      matched: assignedAgentIds.has(s.agent.id),
      badges: (
        <>
          {s.autoGenerated && <TransparencyBadge variant="auto-assigned" />}
          {assignedAgentIds.has(s.agent.id) && (
            <TransparencyBadge variant="rank-achieved" rank={s.rank} />
          )}
        </>
      )
    })
  );

  const projectBranch: PreferenceTreeNode[] = profile.projectPicks.map((p) => {
    const disp = dispositions.get(p.project.id);
    const dispBadge =
      disp === "PRIMARY_HONORED" ? (
        <TransparencyBadge variant="primary-honored" />
      ) : disp === "SECONDARY_HONORED" ? (
        <TransparencyBadge variant="secondary-honored" />
      ) : disp === "FELL_BACK_TO_BALANCE" ? (
        <TransparencyBadge variant="balance-fallback" />
      ) : null;
    return {
      rank: p.rank,
      name: p.project.title,
      subtitle:
        (p.rank === 1 ? "Primary" : "Secondary") +
        (p.project.tags.length > 0 ? ` · ${p.project.tags.join(", ")}` : ""),
      autoGenerated: p.autoGenerated,
      matched: p.assigned,
      badges: (
        <>
          {p.autoGenerated && <TransparencyBadge variant="auto-assigned" />}
          {dispBadge}
        </>
      )
    };
  });

  const incomingOrch: PreferenceTreeNode[] = profile.selectedByOrchs.map((s) => ({
    rank: s.rank,
    name: s.orch.user.name,
    role: "ORCH",
    autoGenerated: s.autoGenerated,
    matched: assignedOrchId === s.orch.id,
    badges: (
      <>
        {s.autoGenerated && <TransparencyBadge variant="auto-assigned" />}
        <TransparencyBadge variant="their-rank" rank={s.rank} />
      </>
    )
  }));

  const incomingAgents: PreferenceTreeNode[] = profile.rankedByAgents.map(
    (r) => ({
      rank: r.rank,
      name: r.agent.user.name,
      role: "AGENT",
      subtitle: r.agent.skills.slice(0, 3).join(", ") || undefined,
      autoGenerated: r.autoGenerated,
      matched: assignedAgentIds.has(r.agent.id),
      badges: (
        <>
          {r.autoGenerated && <TransparencyBadge variant="auto-assigned" />}
          <TransparencyBadge
            variant="their-rank"
            rank={r.rank}
            outOf={podHeadCount}
          />
        </>
      )
    })
  );

  const branches: PreferenceBranchData[] = [
    {
      title: "Orch Priorities",
      caption: "Orchestrators this Pod Head ranked.",
      emptyMessage: "Pod Head has not submitted Orch preferences yet.",
      items: orchBranch
    },
    {
      title: "Agent Picks",
      caption: "Agents this Pod Head selected.",
      emptyMessage: "Pod Head has not submitted Agent picks yet.",
      items: agentPicksBranch
    },
    {
      title: "Project Picks",
      caption: "Rank 1 = primary, rank 2 = secondary.",
      emptyMessage: "Pod Head has not submitted Project picks yet.",
      items: projectBranch
    },
    {
      title: "Picked by Orchs",
      caption: "Orchestrators who ranked this Pod Head.",
      emptyMessage: "No Orch has ranked this Pod Head yet.",
      items: incomingOrch
    },
    {
      title: "Picked by Agents",
      caption: "Agents who ranked this Pod Head.",
      emptyMessage: "No Agent has ranked this Pod Head yet.",
      items: incomingAgents
    }
  ];

  const assignmentText = profile.assignedOrch
    ? `Orch: ${profile.assignedOrch.user.name} · ${assignedAgentIds.size} assigned Agents`
    : null;

  return (
    <PreferenceTree
      root={
        <RootHeader
          name={name}
          role="POD_HEAD"
          assignment={assignmentText}
        />
      }
      branches={branches}
    />
  );
}

// === Orch tree ===

async function OrchTree({
  name,
  profileId
}: {
  name: string;
  profileId: string | null;
}) {
  if (!profileId) return <NoProfileMessage role="ORCH" name={name} />;

  const profile = await db.orchProfile.findUnique({
    where: { id: profileId },
    include: {
      assignedPodHeads: {
        select: { id: true, user: { select: { name: true } } }
      },
      podHeadSelections: {
        orderBy: { rank: "asc" },
        include: {
          podHead: {
            select: {
              id: true,
              department: true,
              user: { select: { name: true } }
            }
          }
        }
      },
      rankedByPodHeads: {
        orderBy: { rank: "asc" },
        include: {
          podHead: {
            select: {
              id: true,
              department: true,
              user: { select: { name: true } }
            }
          }
        }
      }
    }
  });
  if (!profile) return <NoProfileMessage role="ORCH" name={name} />;

  const assignedPodHeadIds = new Set(profile.assignedPodHeads.map((p) => p.id));

  const outgoing: PreferenceTreeNode[] = profile.podHeadSelections.map((s) => ({
    rank: s.rank,
    name: s.podHead.user.name,
    role: "POD_HEAD",
    subtitle: s.podHead.department ?? undefined,
    autoGenerated: s.autoGenerated,
    matched: assignedPodHeadIds.has(s.podHead.id),
    badges: (
      <>
        {s.autoGenerated && <TransparencyBadge variant="auto-assigned" />}
        {assignedPodHeadIds.has(s.podHead.id) && (
          <TransparencyBadge variant="rank-achieved" rank={s.rank} />
        )}
      </>
    )
  }));

  const incoming: PreferenceTreeNode[] = profile.rankedByPodHeads.map((r) => ({
    rank: r.rank,
    name: r.podHead.user.name,
    role: "POD_HEAD",
    subtitle: r.podHead.department ?? undefined,
    autoGenerated: r.autoGenerated,
    matched: assignedPodHeadIds.has(r.podHead.id),
    badges: (
      <>
        {r.autoGenerated && <TransparencyBadge variant="auto-assigned" />}
        <TransparencyBadge variant="their-rank" rank={r.rank} />
      </>
    )
  }));

  const branches: PreferenceBranchData[] = [
    {
      title: "Pod Head Picks",
      caption: "Pod Heads this Orch ranked.",
      emptyMessage: "Orch has not submitted Pod Head picks yet.",
      items: outgoing
    },
    {
      title: "Picked by Pod Heads",
      caption: "Pod Heads who ranked this Orch.",
      emptyMessage: "No Pod Head has ranked this Orch yet.",
      items: incoming
    }
  ];

  const assignmentText =
    profile.assignedPodHeads.length > 0
      ? `${profile.assignedPodHeads.length} assigned Pod Head${profile.assignedPodHeads.length === 1 ? "" : "s"}`
      : null;

  return (
    <PreferenceTree
      root={
        <RootHeader name={name} role="ORCH" assignment={assignmentText} />
      }
      branches={branches}
    />
  );
}

// === Shared bits ===

function RootHeader({
  name,
  role,
  assignment
}: {
  name: string;
  role: Role;
  assignment: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-base font-semibold text-fg">
          {name}
        </span>
        <Badge variant={ROLE_BADGE_VARIANT[role]}>{role}</Badge>
      </div>
      {assignment ? (
        <div className="inline-flex items-center gap-1.5 text-xs">
          <Badge variant="success">Matched</Badge>
          <span className="text-fg-muted">{assignment}</span>
        </div>
      ) : (
        <div className="text-xs text-fg-muted">
          No finalized assignment yet.
        </div>
      )}
    </div>
  );
}

function NoProfileMessage({ role, name }: { role: Role; name: string }) {
  return (
    <div className="rounded-md border border-dashed border-border-strong bg-surface-muted px-4 py-8 text-center text-sm text-fg-muted">
      {name} does not have a {ROLE_LABEL[role]} profile yet — no preferences to
      display.
    </div>
  );
}
