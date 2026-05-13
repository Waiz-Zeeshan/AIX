/**
 * Types shared between the admin agent-sync page and its server actions.
 *
 * Lives in a sibling file (not actions.ts) because Next.js "use server" files
 * must only export async functions. See CLAUDE.md, §"Non-obvious invariants".
 */

import type { SyncPlan } from "@/lib/agent-sync";

export type AgentSyncState =
  | { status: "idle" }
  | {
      status: "previewed";
      plan: SyncPlan;
      sheetSpec: string;
    }
  | {
      status: "applied";
      plan: SyncPlan;
      applied: {
        created: number;
        updated: number;
        skipped: number;
        failedRowIndexes: number[];
      };
      sheetSpec: string;
    }
  | { status: "error"; message: string };
