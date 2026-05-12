"use server";

/**
 * Thin server-action wrappers for the Agent preference flow (SRS §6.4).
 *
 * The heavy lifting lives in `src/lib/preferences-actions.ts`. These wrappers
 * exist so the colocated client component can `import { ... } from "./actions"`
 * without the client bundle pulling in unrelated server-side code.
 *
 * Each wrapper returns a plain serializable result `{ ok, error? }` because
 * server actions called from `'use client'` need serializable values.
 */

import {
  markPreferencesSubmitted,
  saveAgentRankings
} from "@/lib/preferences-actions";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface SubmitResult extends ActionResult {
  missing?: string[];
  submittedAt?: string;
}

export async function saveAgentRankingsAction(
  podHeadIds: string[]
): Promise<ActionResult> {
  try {
    await saveAgentRankings(podHeadIds);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save rankings."
    };
  }
}

export async function submitPreferencesAction(): Promise<SubmitResult> {
  try {
    const result = await markPreferencesSubmitted();
    if (!result.ok) {
      return {
        ok: false,
        missing: result.missing,
        error:
          "Finish all required steps before submitting: " +
          result.missing.join(", ") +
          "."
      };
    }
    return { ok: true, submittedAt: new Date().toISOString() };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not submit."
    };
  }
}
