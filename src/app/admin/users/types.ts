/**
 * Shared types for the user-import form + action.
 *
 * Lives outside the "use server" file because Next.js forbids non-function
 * exports from a server-action module.
 */

import type { Role } from "@prisma/client";

export type RowOutcome = {
  row: number; // 1-based, where row 1 = header. First data row = 2.
  email: string;
  status: "OK" | "ERROR";
  error?: string;
};

export type ImportSummary = {
  rowsTotal: number;
  rowsImported: number;
  byRole: Record<Role, number>;
  created: number;
  updated: number;
  warnings: string[];
};

export type ImportFormState =
  | { status: "idle" }
  | {
      status: "success";
      summary: ImportSummary;
      outcomes: RowOutcome[];
    }
  | {
      status: "error";
      message: string;
      parseError?: string;
      rowErrors?: RowOutcome[];
    };

export const initialImportState: ImportFormState = { status: "idle" };
