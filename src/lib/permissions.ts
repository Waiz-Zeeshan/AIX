/**
 * Server-side authorization guards. Per SRS §10.2 every protected page and
 * API route must call one of these.
 *
 * Each helper either returns the relevant data or throws a redirect / 403.
 * They run on the server only — never import this from client components.
 */

import { redirect } from "next/navigation";
import type { PhaseName, PhaseStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Require an authenticated session. Redirects to /signin if missing.
 *
 * Also refreshes `profileCompletedAt`, `role`, and `isAdmin` from the DB
 * because the JWT freezes those at sign-in time — but they change mid-
 * session (profile completion, admin promotion, CSV-import role edits).
 * Trusting the stale JWT for gating would loop users back to /profile-setup
 * after they've just saved their profile.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  const fresh = await db.user.findUnique({
    where: { id: session.user.id },
    select: { profileCompletedAt: true, role: true, isAdmin: true }
  });
  if (!fresh) {
    // User was deleted while signed in — force a re-auth.
    redirect("/signin");
  }
  return {
    ...session.user,
    profileCompletedAt: fresh.profileCompletedAt,
    role: fresh.role,
    isAdmin: fresh.isAdmin
  };
}

/** Require admin privileges. */
export async function requireAdmin() {
  const user = await requireAuth();
  if (!user.isAdmin) {
    throw new ForbiddenError("Admin access required");
  }
  return user;
}

/** Require the user to hold a specific role (admin bypasses). */
export async function requireRole(role: Role) {
  const user = await requireAuth();
  if (user.role !== role && !user.isAdmin) {
    throw new ForbiddenError(`Role ${role} required`);
  }
  return user;
}

/**
 * Require the user to have completed their profile (bio + pitch). Redirects
 * to /profile-setup if not — per SRS §10.1 step 5 + §5.4 profile gate.
 */
export async function requireProfileComplete() {
  const user = await requireAuth();
  if (!user.profileCompletedAt) {
    redirect("/profile-setup");
  }
  return user;
}

/**
 * Require a phase to be in a given status. Throws if not. Reads the
 * EventPhase table — phases are admin-controlled at runtime so we can't
 * cache them aggressively.
 */
export async function requirePhase(
  name: PhaseName,
  status: PhaseStatus = "OPEN"
) {
  const phase = await db.eventPhase.findUnique({ where: { name } });
  if (!phase || phase.status !== status) {
    throw new ForbiddenError(
      `Phase ${name} must be ${status} (current: ${phase?.status ?? "MISSING"})`
    );
  }
  return phase;
}

/** Convenience: post-results visibility gate. */
export async function requireResultsPublished() {
  return requirePhase("RESULTS_PUBLISHED", "OPEN");
}

/**
 * Combined role + phase + profile gate for role-dashboard pages.
 *
 * Per SRS §5.4: when PREFERENCES is OPEN, a participant without
 * `profileCompletedAt` is redirected to /profile-setup before they can do
 * anything. Outside PREFERENCES (REGISTRATION still in progress, or MATCHING/
 * RESULTS) the dashboard renders normally with a phase-appropriate empty
 * state.
 */
export async function requireParticipant(role: Role) {
  const user = await requireRole(role);
  const preferences = await db.eventPhase.findUnique({
    where: { name: "PREFERENCES" }
  });
  if (preferences?.status === "OPEN" && !user.profileCompletedAt) {
    redirect("/profile-setup");
  }
  return user;
}
