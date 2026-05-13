/**
 * Pure planner for the "Sync Pod Heads from Google Sheets" admin feature.
 *
 * Live header is:  POD Heads Emails | Name with EMP ID | Phone Number | Department
 * (Hidden columns are ignored.) The planner is regex-based so it tolerates
 * column reordering, the typical typos in Google Form headers, and the agent-
 * sheet header conventions too (e.g. `Official Email` / `Email Address` if a
 * future iteration converges on a single form template).
 *
 * Pure TS, no Prisma imports — unit-testable in isolation. DB writes live in
 * `src/app/admin/pod-head-sync/actions.ts`.
 */

import {
  nameFromEmail,
  normalizeName as norm,
  splitNameAndEmpId
} from "./sync-helpers";

// Re-export for back-compat with tests that imported from this module.
export { splitNameAndEmpId };

export type PodHeadRowOutcome =
  | {
      kind: "create" | "update";
      rowIndex: number;
      email: string;
      name: string;
      phone: string | null;
      department: string | null;
      empId: string | null;
    }
  | {
      kind: "skip";
      rowIndex: number;
      email: string | null;
      reason: string;
    };

export interface PodHeadSyncPlan {
  outcomes: PodHeadRowOutcome[];
  /** Header-level warnings (duplicate columns, etc.). */
  warnings: string[];
  summary: {
    rowsTotal: number;
    creates: number;
    updates: number;
    skips: number;
  };
}

/** Per-existing-user state needed to decide create/update/skip. */
export interface ExistingUser {
  /** lowercased email */
  email: string;
  /** Skip if not POD_HEAD (and exists) — sync never reassigns roles. */
  role: "AGENT" | "POD_HEAD" | "ORCH";
  /** Existing employee ID, if any. Used to detect conflicts with other rows. */
  empId: string | null;
}

export interface PodHeadPlanInput {
  rows: string[][];
  allowedEmailDomains: string[];
  existingUsers: ExistingUser[];
}

// Header matchers. Accept both the live Pod-Head sheet and the agent sheet's
// email column names so the planner stays useful across template tweaks.
const RE_EMAIL =
  /\b(?:pod\s*heads?\s*emails?|official\s*email|email\s*address|^email$)\b/;
const RE_NAME_EMPID =
  /\bname\s*(?:with|and|\+)?\s*emp(?:\s*id)?\b|\bemployee\s*name\b|^name$/;
const RE_PHONE = /\bphone(?:\s*number)?\b|\bmobile\b/;
const RE_DEPARTMENT = /\b(?:dept|departments?|division|team)\b/;

interface HeaderIndex {
  email: number;
  nameEmpId: number;
  phone: number;
  department: number;
}

interface HeaderResult {
  index: HeaderIndex;
  warnings: string[];
}

function indexHeaders(headerRow: string[]): HeaderResult {
  const warnings: string[] = [];
  let email = -1;
  let nameEmpId = -1;
  let phone = -1;
  let department = -1;

  const tryAssign = (
    label: string,
    current: number,
    candidate: number,
    push: (i: number) => void
  ) => {
    if (current === -1) push(candidate);
    else
      warnings.push(
        `duplicate ${label} column (col ${candidate + 1}); first occurrence kept`
      );
  };

  for (let i = 0; i < headerRow.length; i++) {
    const h = norm(headerRow[i] ?? "");
    if (!h) continue;

    if (RE_EMAIL.test(h)) {
      tryAssign("email", email, i, (idx) => {
        email = idx;
      });
      continue;
    }
    if (RE_NAME_EMPID.test(h)) {
      tryAssign("name", nameEmpId, i, (idx) => {
        nameEmpId = idx;
      });
      continue;
    }
    if (RE_PHONE.test(h)) {
      tryAssign("phone", phone, i, (idx) => {
        phone = idx;
      });
      continue;
    }
    if (RE_DEPARTMENT.test(h)) {
      tryAssign("department", department, i, (idx) => {
        department = idx;
      });
      continue;
    }
  }

  if (email === -1) {
    throw new Error(
      `Missing email column (need "POD Heads Emails", "Official Email", or "Email Address").`
    );
  }
  // Name + phone + department are optional at the header level — if missing,
  // their cells just stay null on each row. Pod Head finishes via /profile-setup.

  return {
    index: { email, nameEmpId, phone, department },
    warnings
  };
}

export function planPodHeadSync(input: PodHeadPlanInput): PodHeadSyncPlan {
  const { rows, allowedEmailDomains, existingUsers } = input;

  if (rows.length === 0) {
    throw new Error("Sheet is empty.");
  }

  const { index: headers, warnings } = indexHeaders(rows[0]);
  const allowedDomains = new Set(allowedEmailDomains.map(norm));
  const existingByEmail = new Map(
    existingUsers.map((u) => [norm(u.email), u])
  );
  const existingByEmpId = new Map(
    existingUsers
      .filter((u): u is ExistingUser & { empId: string } => u.empId !== null)
      .map((u) => [u.empId, u])
  );

  const outcomes: PodHeadRowOutcome[] = [];
  const seenEmailsInSheet = new Set<string>();
  const seenEmpIdsInSheet = new Set<string>();
  let creates = 0;
  let updates = 0;
  let skips = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 1;

    const cellAt = (idx: number): string =>
      idx >= 0 && idx < row.length ? (row[idx] ?? "") : "";

    const rawEmail = cellAt(headers.email).trim();
    const rawNameCell = cellAt(headers.nameEmpId).trim();
    const rawPhone = cellAt(headers.phone).trim();
    const rawDepartment = cellAt(headers.department).trim();

    // Treat entirely-blank rows as no-ops (trailing rows in Sheets API).
    if (!rawEmail && !rawNameCell && !rawPhone && !rawDepartment) continue;

    const email = rawEmail.toLowerCase();

    const reject = (reason: string) => {
      outcomes.push({
        kind: "skip",
        rowIndex,
        email: email || null,
        reason
      });
      skips++;
    };

    if (!email) {
      reject("missing email");
      continue;
    }

    const at = email.indexOf("@");
    if (at < 1 || at === email.length - 1) {
      reject(`invalid email "${email}"`);
      continue;
    }
    const domain = email.slice(at + 1);
    if (!allowedDomains.has(domain)) {
      reject(`email domain "${domain}" not in allowedEmailDomains`);
      continue;
    }

    if (seenEmailsInSheet.has(email)) {
      reject(`duplicate email "${email}" within sheet`);
      continue;
    }
    seenEmailsInSheet.add(email);

    const existing = existingByEmail.get(email);
    if (existing && existing.role !== "POD_HEAD") {
      reject(
        `user exists with role ${existing.role}; sync only writes POD_HEAD rows`
      );
      continue;
    }

    const { name: parsedName, empId } = rawNameCell
      ? splitNameAndEmpId(rawNameCell)
      : { name: "", empId: null };
    const name = parsedName || nameFromEmail(email);

    if (empId) {
      if (seenEmpIdsInSheet.has(empId)) {
        reject(`duplicate EMP ID "${empId}" within sheet`);
        continue;
      }
      const otherExisting = existingByEmpId.get(empId);
      if (otherExisting && norm(otherExisting.email) !== email) {
        reject(
          `EMP ID "${empId}" already belongs to ${otherExisting.email}; refusing to reassign`
        );
        continue;
      }
      seenEmpIdsInSheet.add(empId);
    }

    const phone = rawPhone || null;
    const department = rawDepartment || null;

    const kind: "create" | "update" = existing ? "update" : "create";
    if (kind === "create") creates++;
    else updates++;

    outcomes.push({
      kind,
      rowIndex,
      email,
      name,
      phone,
      department,
      empId
    });
  }

  return {
    outcomes,
    warnings,
    summary: {
      rowsTotal: rows.length - 1,
      creates,
      updates,
      skips
    }
  };
}
