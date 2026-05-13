/**
 * Shared types between the admin pod-head-sync page and its server actions.
 *
 * Lives in a sibling file (not actions.ts) because Next.js "use server" files
 * must only export async functions. See CLAUDE.md.
 */

import type { PodHeadSyncPlan } from "@/lib/pod-head-sync";

export type PodHeadSyncState =
  | { status: "idle" }
  | {
      status: "previewed";
      plan: PodHeadSyncPlan;
      sheetSpec: string;
    }
  | {
      status: "applied";
      plan: PodHeadSyncPlan;
      applied: {
        created: number;
        updated: number;
        skipped: number;
        failedRowIndexes: number[];
      };
      sheetSpec: string;
    }
  | { status: "error"; message: string };
