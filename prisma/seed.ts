/* Seed: 1 EventConfig, 5 Orchs, 60 Pod Heads, 600 Agents, 12 Projects.
 *
 * Idempotent — wipes preference + profile + user tables first, then re-inserts.
 * Run with: npm run db:seed
 */

import { PrismaClient, Role } from "@prisma/client";

const db = new PrismaClient();

const FIRST_NAMES = [
  "Aisha", "Bilal", "Chen", "Diana", "Ethan", "Fatima", "Gabriel", "Hina",
  "Ibrahim", "Jasmine", "Kashif", "Layla", "Mateo", "Nadia", "Omar", "Priya",
  "Qasim", "Rania", "Sami", "Tariq", "Uma", "Vikram", "Waleed", "Xenia",
  "Yusuf", "Zara", "Amir", "Bea", "Cyrus", "Dilara"
];

const LAST_NAMES = [
  "Ahmed", "Bashir", "Choudhry", "Dar", "Ebrahim", "Faruqi", "Ghani", "Hashmi",
  "Iqbal", "Jamil", "Khan", "Lodhi", "Malik", "Naqvi", "Omar", "Pasha",
  "Qureshi", "Rizvi", "Siddiqui", "Tariq", "Usman", "Virk", "Wazir", "Yousaf",
  "Zaheer", "Akhtar", "Baig", "Cheema", "Durrani", "Faiz"
];

const SKILLS_POOL = [
  "Python", "TypeScript", "React", "Next.js", "PostgreSQL", "Prisma", "LLMs",
  "RAG", "Embeddings", "LangChain", "Vector DBs", "FastAPI", "Docker",
  "Kubernetes", "AWS", "GCP", "Terraform", "Data Engineering", "Pandas",
  "PyTorch", "TensorFlow", "Computer Vision", "NLP", "Reinforcement Learning",
  "Product Management", "UX Design", "Tailwind", "Go", "Rust", "GraphQL"
];

const PROJECT_TITLES: Array<{ title: string; description: string; tags: string[] }> = [
  { title: "AI Code Review Bot", description: "Build an LLM-powered code review assistant that comments on PRs with style, bug, and security findings.", tags: ["LLMs", "DevTools", "GitHub"] },
  { title: "Internal Knowledge RAG", description: "Retrieval-augmented Q&A over Tkxel's internal Confluence + Slack archives with cited answers.", tags: ["RAG", "Embeddings", "Search"] },
  { title: "Customer Support Copilot", description: "Agentic assistant that drafts replies to incoming tickets using past resolutions as few-shot examples.", tags: ["Agents", "Customer Success"] },
  { title: "Voice-First Meeting Notes", description: "Real-time transcription + action-item extraction from meetings, syncing tasks to Jira and Linear.", tags: ["Speech", "Productivity"] },
  { title: "Sales Lead Enrichment", description: "Pipeline that scrapes public signals and enriches CRM leads with intent scores and outreach suggestions.", tags: ["Data", "Sales"] },
  { title: "Document Intelligence Suite", description: "Extract structured data from contracts, invoices, and ID documents with confidence scoring.", tags: ["OCR", "NLP", "Documents"] },
  { title: "Personalized Learning Path", description: "Adaptive tutor that builds custom curricula for engineers based on skill gaps and goals.", tags: ["EdTech", "Personalization"] },
  { title: "AI Marketing Studio", description: "Generate on-brand ad copy, landing pages, and social variants from a single campaign brief.", tags: ["Marketing", "Generation"] },
  { title: "Compliance Audit Agent", description: "Continuously audits code and configs against SOC 2 / ISO 27001 controls, surfacing gaps.", tags: ["Security", "Compliance"] },
  { title: "Smart Recruiting Pipeline", description: "Resume-to-role matching with bias controls, interview-question generation, and feedback synthesis.", tags: ["HR", "Hiring"] },
  { title: "Code-to-Test Generator", description: "Reads a diff and emits high-coverage unit tests with realistic fixtures, integrated into CI.", tags: ["Testing", "DevTools"] },
  { title: "Cost Anomaly Detector", description: "Watches cloud spend across accounts, flags unusual patterns, and proposes remediations.", tags: ["FinOps", "Monitoring"] }
];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Mulberry32 — deterministic seedable RNG so seed output is reproducible.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

function generateName(idx: number): { first: string; last: string } {
  return {
    first: FIRST_NAMES[idx % FIRST_NAMES.length],
    last: LAST_NAMES[Math.floor(idx / FIRST_NAMES.length) % LAST_NAMES.length]
  };
}

function generateEmail(first: string, last: string, idx: number): string {
  return `${first.toLowerCase()}.${last.toLowerCase()}${idx}@tkxel.com`;
}

function generatePitch(role: Role, name: string): string {
  const stems: Record<Role, string[]> = {
    ORCH: [
      `I've led multi-team initiatives at Tkxel for years and want to bring that energy to AI Unlimited.`,
      `Strong opinions on product strategy, weak attachment to specific tactics — I'll make the calls fast.`,
      `I unblock people. If you've worked under me you know I read the room and clear paths.`
    ],
    POD_HEAD: [
      `Hands-on engineer who still ships code daily. I'll keep the pod moving without micromanaging.`,
      `I've shipped LLM features end-to-end and know where the dragons live: eval, latency, hallucinations.`,
      `Strong full-stack background. I write code, I review PRs, I demo on Fridays.`
    ],
    AGENT: [
      `Eager to learn the AI stack in production. I'll show up, take ownership, and iterate fast.`,
      `Quick study, comfortable in ambiguity. I'd rather try something and learn than wait for clarity.`,
      `Strong fundamentals, growing AI skills. Looking for a pod that values craft and momentum.`
    ]
  };
  const stem = pick(stems[role], rng);
  return `Hi, I'm ${name}. ${stem} Specifically for this event I want to ship something that real people use — not a demo, a product.`;
}

function generateBio(name: string): string {
  return `${name} has been at Tkxel for ${1 + Math.floor(rng() * 8)} years. Outside work: ${pick(["climbing", "open-source contrib", "DJing", "running ultras", "writing", "photography", "chess"], rng)}.`;
}

function generateSkills(n: number): string[] {
  const out = new Set<string>();
  while (out.size < n) out.add(pick(SKILLS_POOL, rng));
  return [...out];
}

async function reset() {
  // Order matters: preferences first, then profiles, then users + projects + config.
  await db.podHeadProjectPick.deleteMany();
  await db.orchPodHeadSelection.deleteMany();
  await db.podHeadOrchRanking.deleteMany();
  await db.podHeadAgentSelection.deleteMany();
  await db.agentPodHeadRanking.deleteMany();
  await db.agentProfile.deleteMany();
  await db.podHeadProfile.deleteMany();
  await db.orchProfile.deleteMany();
  await db.matchingRun.deleteMany();
  await db.auditLog.deleteMany();
  await db.eventPhase.deleteMany();
  await db.project.deleteMany();
  await db.user.deleteMany();
  await db.eventConfig.deleteMany();
}

async function main() {
  console.log("Seeding…");
  await reset();

  const config = await db.eventConfig.create({ data: { id: 1 } });
  console.log(`✓ EventConfig (orch=${config.orchCount} ph=${config.podHeadCount} agent=${config.podHeadCount * config.agentsPerPodHead} projects=${config.projectCount})`);

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // Phases — start in REGISTRATION OPEN, rest LOCKED.
  await db.eventPhase.createMany({
    data: [
      { name: "REGISTRATION", status: "OPEN", openedAt: new Date() },
      { name: "PREFERENCES", status: "LOCKED" },
      { name: "MATCHING", status: "LOCKED" },
      { name: "RESULTS_PUBLISHED", status: "LOCKED" }
    ]
  });
  console.log("✓ EventPhases initialized");

  // Projects
  for (const p of PROJECT_TITLES.slice(0, config.projectCount)) {
    await db.project.create({ data: p });
  }
  console.log(`✓ ${config.projectCount} Projects`);

  // Orchs
  let userIdx = 0;
  for (let i = 0; i < config.orchCount; i++) {
    const { first, last } = generateName(userIdx);
    const fullName = `${first} ${last}`;
    const email = generateEmail(first, last, userIdx);
    const user = await db.user.create({
      data: {
        email,
        name: fullName,
        role: Role.ORCH,
        // First Orch is admin only if ADMIN_EMAILS is empty (dev fallback).
        isAdmin:
          adminEmails.includes(email.toLowerCase()) ||
          (adminEmails.length === 0 && i === 0),
        orchProfile: {
          create: {
            bio: generateBio(fullName),
            pitch: generatePitch(Role.ORCH, fullName)
          }
        }
      }
    });
    if (i === 0) console.log(`  ↳ first Orch ${user.email} marked isAdmin=true`);
    userIdx++;
  }
  console.log(`✓ ${config.orchCount} Orchs`);

  // Pod Heads
  for (let i = 0; i < config.podHeadCount; i++) {
    const { first, last } = generateName(userIdx);
    const fullName = `${first} ${last}`;
    await db.user.create({
      data: {
        email: generateEmail(first, last, userIdx),
        name: fullName,
        role: Role.POD_HEAD,
        podHeadProfile: {
          create: {
            bio: generateBio(fullName),
            pitch: generatePitch(Role.POD_HEAD, fullName),
            skills: generateSkills(3 + Math.floor(rng() * 4))
          }
        }
      }
    });
    userIdx++;
  }
  console.log(`✓ ${config.podHeadCount} Pod Heads`);

  // Agents
  const agentCount = config.podHeadCount * config.agentsPerPodHead;
  for (let i = 0; i < agentCount; i++) {
    const { first, last } = generateName(userIdx);
    const fullName = `${first} ${last}`;
    await db.user.create({
      data: {
        email: generateEmail(first, last, userIdx),
        name: fullName,
        role: Role.AGENT,
        agentProfile: {
          create: {
            bio: generateBio(fullName),
            pitch: generatePitch(Role.AGENT, fullName),
            skills: generateSkills(2 + Math.floor(rng() * 3))
          }
        }
      }
    });
    userIdx++;
    if ((i + 1) % 100 === 0) console.log(`  …${i + 1}/${agentCount} Agents`);
  }
  console.log(`✓ ${agentCount} Agents`);

  // Bootstrap admins from env. Creates a user record if the email isn't part of
  // the synthetic participant pool (admin is orthogonal to role per SRS §2.1).
  // Also adds the admin email domain to EventConfig.allowedEmailDomains so they
  // can actually sign in.
  if (adminEmails.length > 0) {
    const adminDomains = [
      ...new Set(adminEmails.map((e) => e.split("@")[1]).filter(Boolean))
    ];
    const merged = [...new Set([...config.allowedEmailDomains, ...adminDomains])];
    if (merged.length !== config.allowedEmailDomains.length) {
      await db.eventConfig.update({
        where: { id: 1 },
        data: { allowedEmailDomains: merged }
      });
      console.log(`✓ allowedEmailDomains → [${merged.join(", ")}]`);
    }

    for (const email of adminEmails) {
      const namePart = email
        .split("@")[0]
        .split(/[.\-_]/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
      await db.user.upsert({
        where: { email },
        update: { isAdmin: true },
        create: { email, name: namePart || email, isAdmin: true }
      });
    }
    console.log(`✓ ${adminEmails.length} admin(s) bootstrapped from ADMIN_EMAILS`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
