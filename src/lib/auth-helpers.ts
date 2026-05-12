/**
 * Pure authorization helpers — no `next-auth` imports, safe for Vitest.
 *
 * Implements SRS §10.1 sign-in checks:
 *   - Step 3: domain in EventConfig.allowedEmailDomains
 *   - Step 4: User row must exist
 *   - Admin bootstrap: emails in ADMIN_EMAILS get isAdmin=true on first
 *     successful sign-in (idempotent).
 */

import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";

export async function authorizeEmail(email: string, adminEmails: string[]) {
  const normalized = email.toLowerCase().trim();
  const domain = normalized.split("@")[1];
  if (!domain || !normalized.includes("@")) return null;

  const config = await getConfig();
  if (!config.allowedEmailDomains.includes(domain)) return null;

  const user = await db.user.findUnique({ where: { email: normalized } });
  if (!user) return null;

  if (adminEmails.includes(normalized) && !user.isAdmin) {
    return db.user.update({
      where: { id: user.id },
      data: { isAdmin: true }
    });
  }

  return user;
}
