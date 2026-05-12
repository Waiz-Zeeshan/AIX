# Software Requirements Specification
## Tkxel AI Unlimited — Team Formation Platform

**Version:** 1.1
**Date:** May 2026
**Status:** Refined draft for engineering handover
**Audience:** Claude Code / implementing engineers

---

## Changelog

**v1.1 (current)**
- Locked in **ranked semantics** for every selection (no unordered sets anywhere). Glossary updated.
- Added **self-pitch field** on every participant profile. Mandatory before preferences can be submitted.
- Added **EventConfig** model: all counts, capacities, and list sizes are configurable by admin pre-event.
- **Auto-assignment** is the only non-submitter strategy (admin has no manual choice; preferences auto-generated at matching time).
- Admin assigns Orch / Pod Head roles via CSV; default role is **Agent**.
- **Transparency requirements** expanded: every participant sees their rank-achieved and how counterparts ranked them post-results.
- **First-come-first-served (FCFS) + caps + balancing** locked in for project assignment.
- Removed: notifications, opt-out flow, forbidden pairings, manual non-submitter override.
- Added §19: **Build order for Claude Code** — explicit phased delivery plan.

---

## 1. Overview

### 1.1 Purpose
A web platform that runs the team-formation process for Tkxel's AI Unlimited Event. The system collects preferences from three tiers of participants (Orchestrators, Pod Heads, Agents), runs a stable matching algorithm, and outputs final team assignments along with project allocations.

### 1.2 Scope
**In scope (v1)**
- Authenticated participant onboarding (Google SSO, Tkxel domain only)
- Self-pitch + profile setup wizard (mandatory before preferences)
- Preference collection workflows for each role
- Project catalog management (admin pre-defines)
- Phase orchestration (admin-controlled gates)
- Stable matching engine with guaranteed full coverage
- Project assignment with FCFS + caps + balancing
- Auto-generated preferences for non-submitters at matching time
- Results publication with full transparency (rank achieved, counterpart rankings)
- Audit log of all matching runs and admin actions
- Configurable counts/capacities via EventConfig

**Out of scope (v1)**
- Email/Slack notifications (admin handles comms out-of-band)
- Opt-out flow for role designations
- Forbidden-pairing constraints
- Multi-event support
- Multi-language support
- Public/external participant access

### 1.3 Glossary

| Term | Definition |
|---|---|
| **Orch** / Orchestrator | Top-tier participant. 5 by default (configurable). Each leads N Pod Heads. |
| **Pod Head** / Pod Lead | Middle-tier participant. 60 by default. Each leads N Agents and works on M Projects. |
| **Agent** | Bottom-tier (default) participant. ~600. Each assigned to one Pod Head. |
| **Project** | A work item. 12 by default. Each Pod Head picks M; multiple Pod Heads may share a project up to cap. |
| **Self-pitch** | A required short text (each participant writes it during profile setup) explaining why they should be selected. Visible to everyone browsing the participant pool. |
| **Ranked selection** | Every preference list in this system is **ordered**. Position 1 = top pick. There are no unordered selections. |
| **Capacity** | Max headcount a higher-tier participant can accept (Orch capacity, Pod Head capacity — both configurable). |
| **Phase** | A time-bounded stage of the event with specific allowed actions. |
| **Stable match** | A pairing where no two unmatched parties would both prefer each other to their current assignment. |
| **Straggler** | A participant unmatched after the primary HR algorithm; resolved by the completion pass. |
| **Auto-assignment** | If a participant doesn't submit preferences by phase close, the system generates a deterministic-random preference list at matching time. |
| **FCFS** | First-come-first-served. Used as tie-breaker in project assignment, sorted by `preferencesSubmittedAt`. |

### 1.4 Success Criteria
1. **Completeness**: 100% of Agents assigned to a Pod Head; 100% of Pod Heads assigned to an Orch; 100% of Pod Heads have their configured number of projects. Auto-assignment guarantees this even with non-submitters.
2. **Stability**: ≥95% of preference-based matches are stable in the Gale-Shapley sense (rest are completion-pass or auto-assigned).
3. **Throughput**: All 660+ users can submit preferences over the event window without performance complaints.
4. **Auditability**: Every matching run is logged with inputs, outputs, and stats; admin can re-run and compare.
5. **Recoverability**: A bad match can be rolled back and re-run without data loss.
6. **Transparency**: Every participant can see, post-results, the rank they achieved and how their counterparts ranked them (where applicable).

---

## 2. Stakeholders & Roles

### 2.1 Role Matrix

| Role | Count (default) | Auth | Designation | Can Read | Can Write |
|---|---|---|---|---|---|
| **Admin** | 1–3 | Google SSO + `isAdmin=true` | Bootstrap via env var `ADMIN_EMAILS`, then admin can promote others | Everything | Users, projects, phases, config, trigger matching, finalize/rollback, manual overrides |
| **Orch** | 5 | Google SSO | Set by admin via CSV `role=ORCH` | Own profile, full Pod Head pool, post-match: own roster + full team tree | Own profile (incl. pitch), own preferences (rank Pod Heads, ordered list of capacity-size) |
| **Pod Head** | 60 | Google SSO | Set by admin via CSV `role=POD_HEAD` | Own profile, Orch pool, Agent pool, Project catalog, post-match: own roster + assigned Orch | Own profile (incl. pitch), 3 preference tasks (rank Orchs, rank Agents, rank Projects) |
| **Agent** | ~600 | Google SSO | **Default role** if not specified in CSV | Own profile, Pod Head pool, post-match: assigned Pod Head + pod teammates | Own profile (incl. pitch), preference list (rank Pod Heads) |

**Critical rules**:
- Designation is non-refusable. If admin marks you as Pod Head, you are a Pod Head. No opt-out.
- Anyone in the CSV without an explicit role becomes an Agent.
- `isAdmin` is orthogonal to role: an Orch can also be an admin.

### 2.2 Personas
- **Admin (Chief of Staff / event organizer)**: Onboards hundreds of users quickly, monitors preference-submission progress, runs matching, publishes results.
- **Orch (senior leader)**: Wants visibility into Pod Head candidates (with pitches) and a simple ranking interface.
- **Pod Head (team lead)**: Heaviest UI load — three preference tasks. Needs efficient filtering of 600 agents.
- **Agent (participant)**: Light UI — browses 60 Pod Heads (with pitches), ranks their top 10.

---

## 3. System Architecture

### 3.1 Locked Technical Decisions
- **Framework**: Next.js 15 (App Router) — single repo, React Server Components + Server Actions.
- **Database**: PostgreSQL 16+.
- **ORM**: Prisma.
- **Auth**: NextAuth.js (Auth.js v5), Google provider, restricted to `@tkxel.com` (configurable via env).
- **Styling**: Tailwind CSS + shadcn/ui.
- **Validation**: Zod on every input (client + server).
- **Deployment**: Vercel + managed Postgres (Neon / Supabase / RDS).
- **Background jobs**: Synchronous in v1 (matching runs on an API route, < 5s budget). Move to a queue only if exceeded.

### 3.2 High-Level Architecture
```
[Browser]
   |
   | HTTPS
   v
[Next.js App] -- Server Actions / API Routes -- [Prisma] -- [Postgres]
   |                                                            |
   +-- NextAuth (Google OAuth) ---------+                       |
                                        |                       |
                                   [Tkxel Google Workspace]     |
                                                                |
                                   [Matching Engine] -----------+
                                   (in-process TypeScript module)
```

### 3.3 Repo Layout
```
/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/signin/
│   │   ├── (participant)/
│   │   │   ├── profile-setup/        # gated wizard
│   │   │   ├── agent/
│   │   │   ├── pod-head/
│   │   │   └── orch/
│   │   ├── admin/
│   │   └── api/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── matching/                 # pure TS, framework-agnostic
│   │   ├── phases/
│   │   ├── config.ts                 # EventConfig accessor
│   │   └── permissions.ts
│   ├── components/
│   └── types/
├── tests/
│   └── matching/                     # unit tests
└── .env.example
```

---

## 4. Domain Model

### 4.1 Entity Overview
- **User** — base record. Holds email, name, role, `isAdmin`, `profileCompletedAt`, `preferencesSubmittedAt`.
- **OrchProfile / PodHeadProfile / AgentProfile** — role-specific extensions with bio, skills, **pitch**.
- **EventConfig** — singleton row holding all configurable counts.
- **Project** — admin-defined work item.
- **Preference tables** — one per directed preference relationship.
- **EventPhase** — state machine governing what's allowed when.
- **MatchingRun** — audit record of each matching execution.
- **AuditLog** — admin action history.

### 4.2 Prisma Schema (specification)

```prisma
model EventConfig {
  id        Int      @id @default(1)   // singleton enforced by application: only id=1 exists
  // Counts
  orchCount             Int @default(5)
  podHeadCount          Int @default(60)
  projectCount          Int @default(12)
  // Capacities
  podHeadsPerOrch       Int @default(12)
  agentsPerPodHead      Int @default(10)
  projectsPerPodHead    Int @default(2)
  defaultProjectCapacity Int @default(10)
  // Preference list sizes
  agentRanksTopNPodHeads     Int @default(10)
  podHeadRanksTopNAgents     Int @default(10)
  // Pitch constraints
  pitchMinChars         Int @default(50)
  pitchMaxChars         Int @default(500)
  // Auth
  allowedEmailDomains   String[] @default(["tkxel.com"])
  updatedAt DateTime @updatedAt
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  image     String?
  role      Role     @default(AGENT)
  isAdmin   Boolean  @default(false)
  profileCompletedAt     DateTime?   // set when pitch + bio submitted
  preferencesSubmittedAt DateTime?   // set when ALL preference tasks complete
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orchProfile    OrchProfile?
  podHeadProfile PodHeadProfile?
  agentProfile   AgentProfile?

  @@index([role])
  @@index([preferencesSubmittedAt])    // used for FCFS project assignment
}

enum Role { AGENT POD_HEAD ORCH }

model OrchProfile {
  id     String  @id @default(cuid())
  userId String  @unique
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  bio    String?
  pitch  String                                // REQUIRED, see EventConfig.pitchMin/MaxChars

  podHeadSelections OrchPodHeadSelection[]
  assignedPodHeads  PodHeadProfile[] @relation("OrchToAssignedPodHeads")
}

model PodHeadProfile {
  id     String   @id @default(cuid())
  userId String   @unique
  user   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bio    String?
  skills String[]
  pitch  String                                // REQUIRED

  orchRankings    PodHeadOrchRanking[]
  agentSelections PodHeadAgentSelection[]
  projectPicks    PodHeadProjectPick[]

  assignedOrchId  String?
  assignedOrch    OrchProfile? @relation("OrchToAssignedPodHeads", fields: [assignedOrchId], references: [id])
  assignedAgents  AgentProfile[] @relation("PodHeadToAssignedAgents")
}

model AgentProfile {
  id     String   @id @default(cuid())
  userId String   @unique
  user   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bio    String?
  skills String[]
  pitch  String                                // REQUIRED

  podHeadRankings AgentPodHeadRanking[]

  assignedPodHeadId String?
  assignedPodHead   PodHeadProfile? @relation("PodHeadToAssignedAgents", fields: [assignedPodHeadId], references: [id])
}

model Project {
  id          String   @id @default(cuid())
  title       String
  description String
  tags        String[]
  capacity    Int?     // null = use EventConfig.defaultProjectCapacity
  picks       PodHeadProjectPick[]
}

// === Preference tables (all ranked — no unordered sets) ===

model AgentPodHeadRanking {
  id        String @id @default(cuid())
  agentId   String
  agent     AgentProfile  @relation(fields: [agentId], references: [id], onDelete: Cascade)
  podHeadId String
  podHead   PodHeadProfile @relation(fields: [podHeadId], references: [id], onDelete: Cascade)
  rank      Int
  autoGenerated Boolean @default(false)        // true if from auto-assignment
  createdAt DateTime @default(now())

  @@unique([agentId, podHeadId])
  @@unique([agentId, rank])
  @@index([podHeadId])
}

model PodHeadAgentSelection {
  id        String @id @default(cuid())
  podHeadId String
  podHead   PodHeadProfile @relation(fields: [podHeadId], references: [id], onDelete: Cascade)
  agentId   String
  agent     AgentProfile   @relation(fields: [agentId], references: [id], onDelete: Cascade)
  rank      Int
  autoGenerated Boolean @default(false)
  createdAt DateTime @default(now())

  @@unique([podHeadId, agentId])
  @@unique([podHeadId, rank])
  @@index([agentId])
}

model PodHeadOrchRanking {
  id        String @id @default(cuid())
  podHeadId String
  podHead   PodHeadProfile @relation(fields: [podHeadId], references: [id], onDelete: Cascade)
  orchId    String
  orch      OrchProfile    @relation(fields: [orchId], references: [id], onDelete: Cascade)
  rank      Int
  autoGenerated Boolean @default(false)

  @@unique([podHeadId, orchId])
  @@unique([podHeadId, rank])
  @@index([orchId])
}

model OrchPodHeadSelection {
  id        String @id @default(cuid())
  orchId    String
  orch      OrchProfile    @relation(fields: [orchId], references: [id], onDelete: Cascade)
  podHeadId String
  podHead   PodHeadProfile @relation(fields: [podHeadId], references: [id], onDelete: Cascade)
  rank      Int
  autoGenerated Boolean @default(false)

  @@unique([orchId, podHeadId])
  @@unique([orchId, rank])
  @@index([podHeadId])
}

model PodHeadProjectPick {
  id        String @id @default(cuid())
  podHeadId String
  podHead   PodHeadProfile @relation(fields: [podHeadId], references: [id], onDelete: Cascade)
  projectId String
  project   Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  rank      Int                                // 1 = primary, 2 = secondary
  assigned  Boolean @default(false)            // true after project assignment finalized
  autoGenerated Boolean @default(false)

  @@unique([podHeadId, projectId])
  @@unique([podHeadId, rank])
  @@index([projectId])
}

// === Event state ===

model EventPhase {
  name     PhaseName   @id
  status   PhaseStatus
  openedAt DateTime?
  closedAt DateTime?
  notes    String?
}

enum PhaseName {
  REGISTRATION         // admin onboards users, configures EventConfig, defines projects
  PREFERENCES          // participants complete profile + submit preferences
  MATCHING             // admin runs algorithms; user writes locked
  RESULTS_PUBLISHED
}

enum PhaseStatus { LOCKED OPEN CLOSED }

model MatchingRun {
  id            String      @id @default(cuid())
  type          MatchType
  startedAt     DateTime    @default(now())
  completedAt   DateTime?
  status        RunStatus
  stats         Json?
  isFinalized   Boolean     @default(false)
  triggeredBy   String
  inputSnapshot Json?
  autoFilledUsers String[]                     // user IDs whose prefs were auto-generated
}

enum MatchType { ORCH_PODHEAD PODHEAD_AGENT PROJECT_ASSIGNMENT }
enum RunStatus { RUNNING COMPLETED FAILED ROLLED_BACK }

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String
  action    String   // e.g. "PHASE_OPEN", "USER_IMPORT", "MATCHING_FINALIZE", "OVERRIDE_ASSIGNMENT"
  target    String?
  details   Json?
  createdAt DateTime @default(now())
  @@index([actorId])
  @@index([createdAt])
}
```

### 4.3 Preference Relationship Summary

| From | To | List size (default, configurable) | Semantics |
|---|---|---|---|
| Agent | Pod Head | 10 ranked | Agent's preferred Pod Heads |
| Pod Head | Agent | 10 ranked | Pod Head's preferred Agents |
| Pod Head | Orch | all (5) ranked | Pod Head's full ranking of Orchs |
| Orch | Pod Head | 12 ranked | Orch's preferred Pod Heads |
| Pod Head | Project | 2 ranked | Pod Head's project picks (primary + secondary) |

All sizes are configurable via `EventConfig`. **Every list is ordered.**

### 4.4 DB-Level Constraints
- `User.email` unique
- For each preference table: `@@unique([fromId, toId])` and `@@unique([fromId, rank])`
- `rank ≥ 1` validated at application layer
- `pitch` length validated against EventConfig at application layer
- All assignment columns nullable until matching runs

---

## 5. Event Lifecycle (Phases)

### 5.1 Phase State Machine
```
                +---------------+
                | REGISTRATION  |   admin: import users, EventConfig, define projects
                +-------+-------+
                        | admin closes
                        v
                +---------------+
                | PREFERENCES   |   participants: complete profile → submit prefs
                +-------+-------+
                        | admin closes
                        v
                +---------------+
                |   MATCHING    |   admin: trigger 3 runs sequentially; auto-fill non-submitters
                +-------+-------+
                        | admin finalizes
                        v
                +---------------+
                |   RESULTS     |   read-only; full transparency view
                +---------------+
```

### 5.2 Admin Controls
- Open / Close each phase explicitly.
- Re-open phases (audit-logged with warning).
- Edit EventConfig only during REGISTRATION (locked once PREFERENCES opens).
- Force re-run of matching: reverts assignments, marks previous run as `ROLLED_BACK`, runs anew.
- All transitions logged in `AuditLog`.

### 5.3 Phase-Gated Permissions

| Action | Allowed Phase |
|---|---|
| Edit EventConfig | REGISTRATION only |
| Import users | REGISTRATION only |
| CRUD projects | REGISTRATION only |
| Complete profile (bio + pitch) | PREFERENCES (gates further actions) |
| Edit own preferences | PREFERENCES (only after profile complete) |
| Admin edit anyone's preferences | All phases (audit-logged) |
| Run matching | MATCHING only |
| View own results | RESULTS only |
| View all results (admin) | MATCHING (draft) or RESULTS |

### 5.4 Profile Setup Gate (within PREFERENCES)
- On first sign-in during PREFERENCES, user is forced to `/profile-setup`.
- Required: `bio` (optional but recommended), `skills` (for Pod Head and Agent), `pitch` (required, length per EventConfig).
- Cannot access preference UI until `profileCompletedAt IS NOT NULL`.

---

## 6. Functional Requirements

### 6.1 Admin

**FR-A1. User Onboarding (CSV bulk import)**
- Columns: `email`, `name`, `role` (optional). Missing/blank role → defaults to `AGENT`.
- Validates: email format, domain in `EventConfig.allowedEmailDomains`, role is valid enum or blank.
- Returns row-by-row errors; whole import is transactional (all-or-nothing).
- Idempotent: re-uploading updates name/role for existing emails.
- Validates target counts: warns admin if imported counts don't match EventConfig (e.g., importing 7 Orchs when configured for 5).

**FR-A2. Project Management**
- CRUD for projects: title, description, tags, optional per-project capacity (null = use EventConfig default).
- Must have exactly `EventConfig.projectCount` projects before closing REGISTRATION.

**FR-A3. EventConfig Editor**
- Editable form for all EventConfig fields.
- Editable only during REGISTRATION phase.
- Validation: every field positive integer; pitch min ≤ max; allowed domains non-empty.

**FR-A4. Phase Control**
- Current phase status board.
- Open / close / re-open phases with confirmation modal.
- Re-open prompts: "Re-opening PREFERENCES will allow late submissions. Confirm?"

**FR-A5. Progress Monitoring**
- Dashboard cards:
  - "Profiles completed: 412 / 660"
  - "Preferences submitted: 388 / 660"
  - Per-role breakdown
- Straggler list with copy-emails action.
- Filter by role, status (profile complete / prefs submitted / nothing).

**FR-A6. Matching Execution**
- Three buttons (enabled in order):
  1. Run Orch ↔ Pod Head
  2. Run Pod Head ↔ Agent
  3. Run Project Assignment
- Each disabled until prerequisites met (e.g., button 2 disabled until 1 finalized).
- Each run shows a preview with stats and a "Finalize" or "Re-run" choice.
- Re-running before finalize replaces draft.
- Auto-assignment for non-submitters happens automatically at run-time; system reports which users were auto-filled.

**FR-A7. Manual Overrides**
- Admin can re-assign any participant after matching.
- Capacity constraints enforced (cannot push Pod Head to 11 Agents).
- All overrides audit-logged with timestamp + actor + before/after state.

**FR-A8. Results Publication**
- Toggle phase to `RESULTS_PUBLISHED`.
- Once published, participants see their assignments + transparency data.

**FR-A9. Audit Log View**
- Paginated, filterable by actor, action, date range, target type.
- Export to CSV.

### 6.2 Orch

**FR-O1. Profile Setup** (required first)
- Bio (free text), pitch (required, length per EventConfig).

**FR-O2. Browse Pod Head Pool**
- Searchable list of 60 Pod Heads.
- Card shows: name, bio, skills, **pitch** (full text expandable).

**FR-O3. Rank Pod Heads**
- Drag-to-rank selecting + ordering `podHeadsPerOrch` (default 12) Pod Heads from the pool.
- Validation: exactly N distinct, ordered.
- Auto-save (debounced 500ms).
- "Submit" finalizes (still editable until phase closes).
- Setting `User.preferencesSubmittedAt = now()` on submit (if not set yet).

**FR-O4. Post-Match Transparency View**
- Assigned Pod Heads listed with: rank-achieved ("Your #N pick" or "Auto-assigned"), Pod Head's rank of you, link to their full team.
- Full org tree below: each Pod Head → their 10 Agents + 2 Projects.

### 6.3 Pod Head

**FR-P1. Profile Setup** (required first)
- Bio, skills (multi-select tags), pitch (required).

**FR-P2. Three-Task Dashboard**
- On `/pod-head`, three task cards with progress indicators:
  - "Rank Orchs (0/5)"
  - "Rank Agents (0/10)"
  - "Pick Projects (0/2)"
- Each links to its sub-page.

**FR-P3. Rank Orchs**
- Show all 5 Orchs (with bio, pitch).
- Drag-to-rank all 5 (full ranking required).

**FR-P4. Rank Agents**
- Searchable Agent pool (600) with skill filter, name search.
- Drag-to-rank 10 Agents.

**FR-P5. Pick Projects**
- Show all 12 projects with description, tags, current cap usage.
- Select exactly 2; rank as primary (1) and secondary (2).

**FR-P6. Submit All**
- Final submit button (only enabled when all three tasks complete).
- Sets `preferencesSubmittedAt = now()`. This timestamp is used for FCFS in project assignment.

**FR-P7. Post-Match Transparency View**
- Assigned Orch with "Their rank of you: #N" and "Your rank of them: #M".
- 10 assigned Agents with their rank of you and your rank of them, plus "auto-assigned" badge where applicable.
- 2 assigned Projects with badge: "Primary pick honored ✓" or "Fell back to secondary" or "Balanced assignment."

### 6.4 Agent

**FR-AG1. Profile Setup** (required first)
- Bio, skills, pitch (required).

**FR-AG2. Browse Pod Head Pool**
- Searchable list of 60 Pod Heads. Card shows name, bio, skills, full pitch.

**FR-AG3. Rank Pod Heads**
- Drag-to-rank 10.

**FR-AG4. Submit**
- Sets `preferencesSubmittedAt`.

**FR-AG5. Post-Match Transparency View**
- Assigned Pod Head: "Your #N pick" + "They ranked you #M of 10" (or "Auto-assigned").
- The Orch above the Pod Head.
- The other 9 Agents in the same pod (names + pitches).
- The 2 projects the pod will work on.

---

## 7. Matching Algorithm Specification

### 7.1 Algorithm Choice
**Hospital-Residents (HR)** algorithm — many-to-one Gale-Shapley generalization. Two independent runs:
1. **Run 1**: Pod Heads (residents) ↔ Orchs (hospitals, capacity = `EventConfig.podHeadsPerOrch`).
2. **Run 2**: Agents (residents) ↔ Pod Heads (hospitals, capacity = `EventConfig.agentsPerPodHead`).

Project assignment is separate (§7.5).

**Direction (who proposes)**:
- Run 1: Pod Heads propose.
- Run 2: Agents propose.

Resident-proposing is resident-optimal — the proposing side gets the best stable outcome possible.

### 7.2 Auto-Fill for Non-Submitters (runs BEFORE the algorithm starts)

When admin triggers a matching run:

```
function autoFillPreferences(matchType):
    seed = "ai-unlimited-" + matchType + "-" + currentRunId   // deterministic
    rng = seededRandom(seed)

    if matchType == ORCH_PODHEAD:
        # Auto-fill Pod Heads who didn't rank Orchs
        for podHead where preferencesSubmittedAt IS NULL and no PodHeadOrchRanking:
            randomOrder = shuffle(allOrchs, rng)
            insert PodHeadOrchRanking with autoGenerated=true for each (rank 1..5)
        # Auto-fill Orchs who didn't pick Pod Heads
        for orch with no OrchPodHeadSelection:
            randomPicks = sample(allPodHeads, podHeadsPerOrch, rng)
            insert OrchPodHeadSelection with autoGenerated=true

    if matchType == PODHEAD_AGENT:
        # Similarly for Agents and Pod Heads' agent picks
        ...

    if matchType == PROJECT_ASSIGNMENT:
        # Auto-pick 2 projects per Pod Head missing project picks (random from available)
        ...

    log autoFilledUsers in MatchingRun.autoFilledUsers
```

Auto-generated rows are flagged `autoGenerated = true` for transparency in results UI.

### 7.3 Pseudocode (Resident-proposing HR)

```
function hospitalResidents(residents, hospitals):
    # residents[i] = { id, preferences: [hospitalId, ...] }
    # hospitals[j] = { id, capacity, preferences: [residentId, ...] }

    rosters        = { h.id: [] for h in hospitals }
    nextProposeIdx = { r.id: 0 for r in residents }
    matched        = { r.id: null for r in residents }
    free           = set of all resident ids
    hRankOf        = { h.id: { rid: rank for rank, rid in enumerate(h.preferences) } }

    while free is not empty:
        progress = false
        for rid in copy(free):
            idx = nextProposeIdx[rid]
            if idx >= len(residents[rid].preferences):
                free.remove(rid); continue       # exhausted; becomes straggler

            hid = residents[rid].preferences[idx]
            nextProposeIdx[rid] += 1

            if rid not in hRankOf[hid]:
                progress = true; continue        # not on hospital's list → reject

            roster = rosters[hid]
            myRank = hRankOf[hid][rid]

            if len(roster) < hospitals[hid].capacity:
                roster.add(rid); sort by hRankOf[hid]
                matched[rid] = hid
                free.remove(rid)
                progress = true
            else:
                worst = roster[-1]
                if myRank < hRankOf[hid][worst]:
                    roster.pop(); roster.add(rid); sort
                    matched[rid] = hid
                    matched[worst] = null
                    free.remove(rid); free.add(worst)
                    progress = true
                # else: rejected, keep trying

        if not progress: break

    return { matched, rosters, stragglers: [r for r where matched[r] is null] }
```

### 7.4 Completion Pass
Guarantees full coverage even if HR leaves stragglers.

```
function completeMatch(result, allResidents, hospitals):
    for rid in result.stragglers:
        openHospitals = [h for h in hospitals if len(rosters[h.id]) < h.capacity]
        if openHospitals empty: break    # shouldn't happen if totals balance

        # Tier 1: hospitals that ranked this resident
        candidates = [h for h in openHospitals if rid in h.preferences]
        if candidates:
            chosen = candidate with smallest rank-of(rid)
        else:
            chosen = openHospitals sorted by id ascending, first

        rosters[chosen.id].append(rid)
        matched[rid] = chosen.id

    return matched, rosters
```

Because totals balance exactly (config-enforced: `podHeadCount = orchCount × podHeadsPerOrch`; `agentCount = podHeadCount × agentsPerPodHead`), the completion pass always succeeds.

### 7.5 Project Assignment (FCFS + Caps + Balancing)

```
function assignProjects(podHeads, projects, config):
    cap = { p.id: (p.capacity ?? config.defaultProjectCapacity) for p in projects }
    counts = { p.id: 0 for p in projects }

    # Sort Pod Heads by preferencesSubmittedAt (FCFS).
    # Nulls (auto-filled) go LAST so completed submitters get priority.
    ordered = sort podHeads by (preferencesSubmittedAt ASC NULLS LAST, id ASC)

    # Pass 1: assign primary picks where capacity allows
    primaryAssignment = {}
    primaryDeferred = []
    for ph in ordered:
        pick = ph.projectPicks[rank=1]
        if counts[pick] < cap[pick]:
            primaryAssignment[ph.id] = pick
            counts[pick] += 1
        else:
            primaryDeferred.append(ph)

    # Pass 2: handle deferred — try secondary, else least-loaded
    for ph in primaryDeferred:
        pick = ph.projectPicks[rank=2]
        if counts[pick] < cap[pick]:
            primaryAssignment[ph.id] = pick
            counts[pick] += 1
        else:
            leastLoaded = argmin(counts, where counts[p] < cap[p])
            primaryAssignment[ph.id] = leastLoaded
            counts[leastLoaded] += 1

    # Pass 3: assign each PH a SECOND project (no PH ends with just one)
    secondaryAssignment = {}
    for ph in ordered:
        # Try original secondary if not already assigned as primary
        primary = primaryAssignment[ph.id]
        secondaryPick = ph.projectPicks[rank=2]
        if secondaryPick != primary and counts[secondaryPick] < cap[secondaryPick]:
            secondaryAssignment[ph.id] = secondaryPick
            counts[secondaryPick] += 1
        else:
            # Try original primary if not already used as primary for this PH
            primaryPick = ph.projectPicks[rank=1]
            if primaryPick != primary and counts[primaryPick] < cap[primaryPick]:
                secondaryAssignment[ph.id] = primaryPick
                counts[primaryPick] += 1
            else:
                leastLoaded = argmin(counts, p != primary and counts[p] < cap[p])
                secondaryAssignment[ph.id] = leastLoaded
                counts[leastLoaded] += 1

    # Each Pod Head now has exactly 2 distinct projects.
    return primaryAssignment, secondaryAssignment
```

**Edge guard**: `totalSlots = sum(cap) >= podHeadCount * projectsPerPodHead`. Admin warned at REGISTRATION close if not.

### 7.6 Re-run Semantics
- A run produces a draft set of assignments in `MatchingRun` rows.
- Assignments written to `assignedOrchId` / `assignedPodHeadId` / project `assigned=true` only on **Finalize**.
- Re-running before finalize replaces draft.
- After finalize, requires explicit **Rollback**: nulls assignment columns, marks previous run `ROLLED_BACK`.

### 7.7 Reported Stats per Run
- Total proposals made
- Rounds until termination
- % matched to 1st / 2nd / 3rd / 4th+ choice
- Number of stragglers handled by completion pass
- Number of users whose preferences were auto-generated
- Distribution of hospital roster sizes (all should equal capacity)
- Average rank achieved (lower = better)

### 7.8 Determinism
Same inputs → identical outputs. All tie-breaks deterministic (sorted by id; seeded RNG for auto-fill).

---

## 8. API Surface

All routes under `/api`. Auth via NextAuth session. All mutations validate with Zod.

### 8.1 Auth & Identity
- `GET /api/auth/[...nextauth]` — NextAuth handlers
- `GET /api/me` — current user, role, profile completion status

### 8.2 Profile
- `GET /api/profile` — own profile
- `PUT /api/profile` — body: `{ bio, skills?, pitch }`. Sets `profileCompletedAt` if all required fields present.

### 8.3 Browsing
- `GET /api/pool/pod-heads` — list with pitches (visible to Agents, Orchs, Admin)
- `GET /api/pool/orchs` — list (visible to Pod Heads, Admin)
- `GET /api/pool/agents` — list (visible to Pod Heads, Admin)
- `GET /api/projects` — list (visible to Pod Heads, Admin)

### 8.4 Preferences (all enforce profile-complete + phase-open + ranked semantics)
- `PUT /api/preferences/agent/pod-heads` — body: `{ rankings: [{ podHeadId, rank }, ...] }`
- `PUT /api/preferences/pod-head/orchs` — body: `{ rankings: [...] }`
- `PUT /api/preferences/pod-head/agents` — body: `{ selections: [...] }`
- `PUT /api/preferences/pod-head/projects` — body: `{ picks: [{ projectId, rank: 1|2 }] }`
- `PUT /api/preferences/orch/pod-heads` — body: `{ selections: [...] }`
- `POST /api/preferences/submit` — finalizes all of a user's preferences, sets `preferencesSubmittedAt`

### 8.5 Results
- `GET /api/my-assignment` — role-appropriate transparency view (rank achieved, counterpart ranks, full pod info)

### 8.6 Admin
- `GET /api/admin/config` / `PATCH /api/admin/config` — EventConfig (PATCH only during REGISTRATION)
- `POST /api/admin/users/import` — CSV
- `POST /api/admin/projects` / `PATCH /api/admin/projects/:id` / `DELETE /api/admin/projects/:id`
- `PATCH /api/admin/phases/:name` — body: `{ status: OPEN|CLOSED }`
- `POST /api/admin/matching/run` — body: `{ type }`. Auto-fills first, then runs.
- `POST /api/admin/matching/finalize/:runId`
- `POST /api/admin/matching/rollback/:runId`
- `PATCH /api/admin/assignments/agent/:agentId` — body: `{ podHeadId }`
- `PATCH /api/admin/assignments/pod-head/:podHeadId` — body: `{ orchId }`
- `PATCH /api/admin/assignments/project` — body: `{ podHeadId, projectId, rank }`
- `GET /api/admin/audit` — paginated audit log

### 8.7 Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "PHASE_LOCKED" | "PROFILE_INCOMPLETE" | "INTERNAL",
    "message": "Human-readable",
    "details": { ... }
  }
}
```

---

## 9. UI / UX Requirements

### 9.1 Common
- Header: Tkxel logo, current phase badge (color-coded), user menu.
- Mobile-responsive.
- Loading skeletons for lists > 10 items.
- Optimistic preference saves with rollback toast.
- Drag-to-rank with keyboard fallback (up/down buttons, accessibility).

### 9.2 Key Screens

**Profile Setup Wizard** (`/profile-setup`)
- Single-page form: bio (optional textarea), skills (multi-select tags, role-appropriate), pitch (required, char counter against EventConfig).
- "Save & Continue" → role dashboard.
- Cannot be skipped; middleware redirects here from any preference page if `profileCompletedAt IS NULL`.

**Agent Dashboard** (`/agent`)
- Phase banner + profile completion indicator.
- Pod Head browser (grid of cards: name, skills, pitch preview, "View full pitch" expand).
- "My Top 10" sidebar — drag-to-rank with numbered slots.
- Submit CTA when 10/10 ranked.

**Pod Head Dashboard** (`/pod-head`)
- Three task cards with progress.
- Master "Submit all preferences" button (disabled until tasks done).
- Sub-pages: `/pod-head/orchs`, `/pod-head/agents`, `/pod-head/projects`.

**Orch Dashboard** (`/orch`)
- Pod Head browser + drag-to-rank top 12.

**Admin Dashboard** (`/admin`)
- Overview cards: phase status, submission counts.
- Tabs: **Config**, **Users**, **Projects**, **Phases**, **Matching**, **Audit**.

**Results Pages** (all roles, post-match)
- Hero: "You're on Team [Orch Name] under [Pod Head Name]."
- Transparency panel:
  - "You ranked them: #N"
  - "They ranked you: #M" (or "Auto-assigned" badge)
- Pod info: teammates, projects.

### 9.3 Reusable Components
- **DragRankList**: pool on left, ranked slots on right; search/filter; auto-save indicator.
- **PitchCard**: avatar, name, skills chips, pitch text (expandable if long).
- **TransparencyBadge**: shows rank or auto-assigned status with color coding.

---

## 10. Authentication & Authorization

### 10.1 Sign-in Flow
1. Hit any protected route → redirect to `/signin`.
2. "Sign in with Google."
3. NextAuth callback validates email domain against `EventConfig.allowedEmailDomains`.
4. Check if email exists in `User` table. If not, reject: "This email is not registered for the event. Contact the organizer."
5. On success, redirect:
   - If `profileCompletedAt IS NULL` and phase ≥ PREFERENCES → `/profile-setup`
   - Else → role dashboard (or `/admin` if `isAdmin`)

### 10.2 Authorization
- `lib/permissions.ts`: `requireRole`, `requirePhase`, `requireAdmin`, `requireProfileComplete`.
- Every API route and protected page calls one of these.
- Edge middleware (`middleware.ts`) protects route prefixes.

### 10.3 Session
- JWT sessions. Payload: `userId`, `role`, `isAdmin`, `profileCompletedAt`.

---

## 11. Non-Functional Requirements

### 11.1 Performance
- Page load P95 < 1.5s broadband / < 3s 4G.
- Preference save P95 < 300ms.
- Matching run for full default-config dataset < 5s sync. Move to background job if exceeded.
- All queries paginated/limited.

### 11.2 Security
- HTTPS only.
- CSRF via NextAuth defaults + same-site cookies.
- Zod input validation everywhere.
- No PII in client analytics/logs.
- Admin actions audit-logged.

### 11.3 Observability
- Structured JSON logs server-side.
- Matching runs log input hash, output hash, duration, stats.

### 11.4 Data Integrity
- All preference updates in DB transactions.
- Matching finalize in a single transaction.
- FK `ON DELETE CASCADE` on preference tables.

### 11.5 Backups
- Managed Postgres daily snapshots.
- Auto-snapshot when MATCHING phase opens.

### 11.6 Accessibility
- WCAG 2.1 AA. Keyboard nav for drag-to-rank. ARIA labels. Sufficient contrast.

---

## 12. Validation Rules

| Input | Rule |
|---|---|
| Agent pref list | Exactly `agentRanksTopNPodHeads` distinct IDs, ranks contiguous |
| Pod Head agent selection | Exactly `podHeadRanksTopNAgents` distinct, ranks contiguous |
| Pod Head Orch ranking | Exactly `orchCount` IDs (all of them), ranks 1..orchCount |
| Pod Head project picks | Exactly `projectsPerPodHead` distinct, ranks 1..N |
| Orch Pod Head selection | Exactly `podHeadsPerOrch` distinct, ranks contiguous |
| Pitch | Length in [`pitchMinChars`, `pitchMaxChars`] |
| Project | Title 1–200, desc 1–2000, tags ≤ 10, capacity ≥ 1 or null |
| User CSV | Valid email, domain allowed, role valid or blank (→ AGENT) |
| Matching trigger | Phase = MATCHING; prerequisite runs finalized |
| EventConfig PATCH | Phase = REGISTRATION; all counts positive; pitchMin ≤ pitchMax; `podHeadCount = orchCount × podHeadsPerOrch` recommended (warn if not) |

---

## 13. Edge Cases

| Case | Handling |
|---|---|
| User doesn't sign in | Treated as non-submitter; auto-filled at matching time. |
| User signs in but skips profile | Cannot submit preferences; auto-filled at matching with random data + warning logged. |
| User signs in, completes profile, doesn't submit preferences | Auto-filled at matching. |
| User signs in with wrong domain | Rejected at NextAuth callback. |
| Wrong domain in CSV | Rejected at import with row-level error. |
| Counts mismatch in CSV vs config | Admin warned, import proceeds, blocking error only if would cause invariant violation (e.g. >12 Orchs imported when config says 5 will require explicit config change first). |
| Two admins trigger matching concurrently | Advisory lock on `MatchingRun`; second request 409. |
| Manual override violates capacity | Rejected with 422 + explanation. |
| Matching mid-write failure | Transaction rollback; `MatchingRun.status = FAILED`. |
| Project picks all over-cap | Algorithm falls back to least-loaded (§7.5 Pass 2). |
| All Pod Heads pick same Orch | HR resolves via Orch's own rankings; over-flow Pod Heads cascade. |
| Role change after profile completion | Profile cascade-deleted; user must re-do profile + preferences. |

---

## 14. Acceptance Criteria

### 14.1 MVP Done When
- [ ] Google SSO with domain restriction works; non-registered emails rejected with clear UX.
- [ ] Admin can import 660+ users via CSV with role defaulting to AGENT.
- [ ] Admin can edit EventConfig during REGISTRATION; locked thereafter.
- [ ] Admin can CRUD exactly `projectCount` projects.
- [ ] Profile setup wizard gates preference submission with pitch length validated.
- [ ] All preference workflows function with drag-to-rank, auto-save, exact-N validation.
- [ ] Phase state machine enforced everywhere.
- [ ] Matching engine completes in < 5s for default dataset.
- [ ] Auto-fill generates preferences for non-submitters deterministically (same run → same fills).
- [ ] All stats reported per run.
- [ ] Admin can finalize / rollback / manually override.
- [ ] Results pages show full transparency: rank achieved + counterpart rank for each pairing.
- [ ] Audit log captures all admin and matching actions.
- [ ] Unit tests on matching engine ≥ 90% coverage.
- [ ] Integration tests for end-to-end preference → match → results flow.

### 14.2 Matching Engine Test Cases
1. **Happy path**: full default dataset, all submit, all matched stably.
2. **Sparse**: Agents only list 3 Pod Heads — completion pass fills.
3. **Adversarial**: All Agents rank Pod Head X first — Pod Head X's own rankings resolve.
4. **Non-submitter**: 50 Agents don't submit — auto-fill runs, all 600 matched.
5. **Determinism**: same input twice → identical output.
6. **Capacity exactness**: all rosters equal their capacity at end.
7. **Re-run replaces draft**: run, run again before finalize → only latest persists.
8. **Rollback**: finalize → rollback → assignments null again.
9. **FCFS project assignment**: Pod Head A submits at t=10, Pod Head B at t=20; both want Project X (cap=1) → A gets primary, B gets secondary or balanced.

---

## 15. Assumptions (Locked) & Open Items

### 15.1 Locked Assumptions
- **A1**: All selections are ranked (ordered). No unordered sets anywhere.
- **A2**: Pitch field is required on every profile; visible in browsing.
- **A3**: Non-submitters get deterministic auto-filled preferences at matching time. No manual admin choice.
- **A4**: All counts/capacities/list-sizes configurable via `EventConfig`.
- **A5**: Default role for CSV import without explicit role is `AGENT`.
- **A6**: No opt-out — role designations are non-refusable.
- **A7**: Projects are admin-pre-defined during REGISTRATION.
- **A8**: Project assignment uses FCFS by `preferencesSubmittedAt` + per-project caps + balancing to least-loaded as fallback.
- **A9**: Transparency is full post-results: every participant sees rank achieved and counterpart's rank of them.
- **A10**: No notifications in v1; admin sends emails out-of-band.
- **A11**: No forbidden-pairing logic.
- **A12**: Single event per deployment.
- **A13**: English only.

### 15.2 Open Items (to validate during build, not blockers)
- **O1**: Pitch character limits — default 50–500 reasonable? Confirm with first batch of test data.
- **O2**: Skills taxonomy — free-tag entry vs predefined list? **Recommendation**: free-tag with autocomplete based on existing tags, so it self-organizes.
- **O3**: Email domain allowlist — just `tkxel.com` or any subsidiaries? Confirm with admin before deployment.
- **O4**: Should auto-filled users be visually flagged in admin views? **Recommendation**: yes, with a badge.
- **O5**: Export of final rosters (CSV/PDF) for offline distribution — nice-to-have, can defer.

---

## 16. Appendix A — Worked Matching Example

**Setup** (small scale): 2 Pod Heads (cap 2 each), 4 Agents.

```
Agent rankings (top 2):
  A1: [PH1, PH2]
  A2: [PH1, PH2]
  A3: [PH2, PH1]
  A4: [PH1, PH2]

Pod Head rankings (top 2 each):
  PH1: [A1, A3]
  PH2: [A2, A4]
```

**HR run** (Agent-proposing):
- A1 → PH1 ✓ (PH1: [A1])
- A2 → PH1: full. A2 not in PH1's top 2 → reject.
- A2 → PH2 ✓ (PH2: [A2])
- A3 → PH2: full. A3 not in PH2's list → reject.
- A3 → PH1: full. PH1 ranks A3 #2. Worst current = A1 (rank 1). A3 (rank 2) > worst → reject.
- A4 → PH1: full. A4 not in PH1's list → reject.
- A4 → PH2: full. A4 in PH2's list rank 2. Worst = A2 (rank 1). A4 worse → reject.
- All free agents exhausted preferences. Stragglers: A3, A4.

**Completion pass**:
- A3: openHospitals = {} (both full). But wait — PH1 has 1/2 ([A1]), PH2 has 1/2 ([A2]). Both open.
- Hmm — actually I made an error above. Let me redo: PH1 only has A1 (cap 2, so 1 slot open). PH2 only has A2 (1 open).
- A3 → PH1: open. A3 in PH1's list → accept. (PH1: [A1, A3])
- A4 → PH2: open. A4 in PH2's list → accept. (PH2: [A2, A4])
- (Final HR result above was wrong because I marked PH1/PH2 as full at cap 1 instead of 2.)

**Final**: PH1 = [A1, A3], PH2 = [A2, A4]. All matched. All stable.

---

## 17. Appendix B — Sample CSV

```csv
email,name,role
[email protected],Alice Khan,ORCH
[email protected],Bob Ahmed,POD_HEAD
[email protected],Carol Siddiqui,
[email protected],Dan Iqbal,AGENT
```
(Carol has blank role → defaults to AGENT.)

---

## 18. Appendix C — Environment Variables

```
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://ai-unlimited.tkxel.com
NEXTAUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ADMIN_EMAILS=[email protected],[email protected]    # bootstrap admins on first sign-in
```

Allowed email domains live in `EventConfig.allowedEmailDomains` (DB-managed, not env).

---

## 19. Appendix D — Build Order for Claude Code

Recommended phased delivery. Each phase is independently testable and reviewable. Estimated effort assumes a single Claude Code agent with a senior engineer reviewing.

### Phase 1 — Foundation (~1–2 hr)
- Scaffold Next.js 15 + TypeScript + Tailwind + shadcn/ui.
- Set up Prisma with full §4.2 schema. Create initial migration.
- Implement `lib/db.ts`, `lib/config.ts` (EventConfig accessor with caching).
- Write `prisma/seed.ts` that creates: EventConfig with defaults, 5 Orchs, 60 Pod Heads, 600 Agents, 12 Projects — all with realistic test pitches.
- **Done when**: `npx prisma migrate dev && npx prisma db seed` produces a fully populated test DB.

### Phase 2 — Matching Engine (~2 hr)
- Pure TypeScript module in `src/lib/matching/`. No Prisma imports here.
- Files: `hospital-residents.ts`, `complete-match.ts`, `project-assignment.ts`, `auto-fill.ts`, `index.ts`.
- Vitest unit tests covering §14.2 cases.
- **Done when**: All 9 test cases pass; running against seed data produces complete + mostly stable matching < 5s.

### Phase 3 — Auth + Permissions (~1–2 hr)
- NextAuth.js v5 with Google provider.
- Domain check in `signIn` callback against EventConfig.
- `lib/permissions.ts` with all guards.
- `middleware.ts` for route protection.
- Sign-in page.
- Bootstrap admin from `ADMIN_EMAILS` env on first sign-in.
- **Done when**: a tkxel.com Google account signs in; a gmail.com account is rejected; an admin lands on `/admin`.

### Phase 4 — Profile Setup + Phase Control (~2 hr)
- `/profile-setup` wizard.
- Phase-aware redirects in middleware.
- Admin Phases tab with open/close controls.
- Admin Config tab with EventConfig editor.
- **Done when**: a participant can sign in, complete profile, see their (empty) role dashboard. Admin can move phases.

### Phase 5 — Admin Core (~2–3 hr)
- CSV user import with row-level error reporting.
- Project CRUD.
- Admin progress monitoring (counts, straggler lists).
- Audit log infrastructure (write everywhere relevant + read view).
- **Done when**: admin can stand up the event end-to-end up through "ready for matching."

### Phase 6 — Participant Preference UIs (~3–4 hr)
- Reusable `DragRankList` component (with keyboard fallback).
- `PitchCard` component.
- Agent ranking page.
- Pod Head three-task dashboard + sub-pages.
- Orch ranking page.
- Auto-save server actions; `preferencesSubmittedAt` set on final submit.
- **Done when**: all three role flows produce valid, complete preference data in DB.

### Phase 7 — Matching Integration (~1–2 hr)
- API routes: trigger run, finalize, rollback.
- Admin Matching tab with run buttons + stats preview.
- Auto-fill executes before each run.
- Manual override APIs and UI.
- **Done when**: admin runs all 3 matching steps; finalizes; assignments persisted.

### Phase 8 — Results + Transparency (~1–2 hr)
- `/api/my-assignment` with role-shaped responses.
- Results pages per role with TransparencyBadge.
- Phase transition to RESULTS_PUBLISHED makes participant views live.
- **Done when**: every participant can see their team + transparency data on log-in.

### Phase 9 — Polish (~1 hr)
- Error boundary, 404, 500 pages.
- Loading states.
- Mobile responsive pass.
- Empty states.
- README with setup + deployment instructions.

**Total estimate**: ~13–18 hours of Claude Code work, plus review/iteration. Achievable in a focused day or two.

---

**End of SRS.**
