/* Promote a user to admin (and create them if they don't exist).
 *
 * Reads ADMIN_EMAILS from env (comma-separated). For each email:
 *   - Adds the email's domain to EventConfig.allowedEmailDomains
 *   - Upserts the user with isAdmin=true (role defaults to AGENT — admin is
 *     orthogonal to role per SRS §2.1, so this user can manage the event
 *     without participating as an Orch/Pod Head/Agent)
 *
 * Also demotes any user whose email is NOT in ADMIN_EMAILS but currently has
 * isAdmin=true (skip with --no-demote to leave existing admins alone).
 *
 * Run: tsx scripts/grant-admin.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const noDemote = process.argv.includes("--no-demote");

  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error("ADMIN_EMAILS is empty. Set it in .env.local and re-run.");
    process.exit(1);
  }

  // 1. Allow the email domains.
  const domains = [...new Set(emails.map((e) => e.split("@")[1]).filter(Boolean))];
  const config = await db.eventConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });
  const merged = [...new Set([...config.allowedEmailDomains, ...domains])];
  if (merged.length !== config.allowedEmailDomains.length) {
    await db.eventConfig.update({
      where: { id: 1 },
      data: { allowedEmailDomains: merged }
    });
    console.log(`✓ allowedEmailDomains now: [${merged.join(", ")}]`);
  } else {
    console.log(`  allowedEmailDomains already covers: [${domains.join(", ")}]`);
  }

  // 2. Upsert each admin user.
  for (const email of emails) {
    const namePart = email.split("@")[0]
      .split(/[.\-_]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

    await db.user.upsert({
      where: { email },
      update: { isAdmin: true },
      create: {
        email,
        name: namePart || email,
        isAdmin: true
      }
    });
    console.log(`✓ ${email} → isAdmin=true`);
  }

  // 3. Demote everyone else.
  if (!noDemote) {
    const demoted = await db.user.updateMany({
      where: {
        isAdmin: true,
        email: { notIn: emails }
      },
      data: { isAdmin: false }
    });
    if (demoted.count > 0) {
      console.log(`✓ Demoted ${demoted.count} previously-admin user(s)`);
    }
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
