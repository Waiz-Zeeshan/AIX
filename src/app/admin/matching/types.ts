/**
 * Shared types for the admin matching form + actions.
 *
 * Lives outside the "use server" file because Next.js forbids non-function
 * exports from a server-action module.
 */

import type { RunSummary } from "@/lib/matching-service";

export type MatchingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  summary?: RunSummary;
};

export const initialMatchingState: MatchingActionState = { status: "idle" };
