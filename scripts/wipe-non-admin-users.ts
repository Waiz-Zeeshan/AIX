/* Wipe every user except a designated admin email.
 *
 * Cascade FKs handle: AgentProfile / PodHeadProfile / OrchProfile and all
 * preference tables (AgentPodHeadRanking, PodHeadAgentSelection,
 * PodHeadOrchRanking, OrchPodHeadSelection, PodHeadProjectPick).
 *
 * Also wipes MatchingRun (always — runs reference now-deleted user IDs and
 * become meaningless) and AuditLog entries whose actorId is no longer a
 * valid user.
 *
 * Run:  npx tsx scripts/wipe-non-admin-users.ts
 */

import { PrismaClient } from "@prisma/client";

const KEEP_EMAIL = "fahad.qamar@tkxel.io";

const db = new PrismaClient();

async function main() {
  const keepEmail = KEEP_EMAIL.toLowerCase();

  const keeper = await db.user.findUnique({ where: { email: keepEmail } });
  if (!keeper) {
    console.error(
      `Refusing to wipe: keeper "${keepEmail}" does not exist. Sign in once first.`
    );
    process.exit(1);
  }

  const totalUsers = await db.user.count();
  console.log(
    `Found ${totalUsers} users total. Keeping ${keeper.email} (${keeper.id}).`
  );

  // Delete other users — cascades take out profiles + preference rows.
  const deletedUsers = await db.user.deleteMany({
    where: { email: { not: keepEmail } }
  });
  console.log(`✓ deleted ${deletedUsers.count} users (cascade dropped profiles + preferences).`);

  // MatchingRun is independent of FK cascade.
  const deletedRuns = await db.matchingRun.deleteMany({});
  console.log(`✓ deleted ${deletedRuns.count} MatchingRun rows.`);

  // AuditLog.actorId is a plain string; entries don't auto-clean on user delete.
  const deletedAudit = await db.auditLog.deleteMany({
    where: { actorId: { not: keeper.id } }
  });
  console.log(
    `✓ deleted ${deletedAudit.count} AuditLog entries by non-admin actors.`
  );

  // Make sure the keeper is still flagged isAdmin=true.
  if (!keeper.isAdmin) {
    await db.user.update({
      where: { id: keeper.id },
      data: { isAdmin: true }
    });
    console.log(`✓ promoted ${keeper.email} → isAdmin=true.`);
  }

  // Final counts.
  const [users, profiles, runs, audit] = await Promise.all([
    db.user.count(),
    db.agentProfile.count().then(async (a) => ({
      AgentProfile: a,
      PodHeadProfile: await db.podHeadProfile.count(),
      OrchProfile: await db.orchProfile.count()
    })),
    db.matchingRun.count(),
    db.auditLog.count()
  ]);
  console.log("\nFinal counts:");
  console.log(`  User: ${users}`);
  console.log(`  Profiles: ${JSON.stringify(profiles)}`);
  console.log(`  MatchingRun: ${runs}`);
  console.log(`  AuditLog: ${audit}`);
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
