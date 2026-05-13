/**
 * Google Sheets read access via service-account auth.
 *
 * Used by the admin "Sync from Google Sheets" features (`/admin/agent-sync`
 * and `/admin/pod-head-sync`). Reads `GOOGLE_SHEETS_SA_KEY_JSON` from env —
 * a single-line JSON blob of a service-account key. The target sheet must
 * be shared (Viewer) with the service-account email.
 *
 * This file is pure I/O. All parsing/validation lives in the per-feature
 * planner modules (`agent-sync.ts`, `pod-head-sync.ts`).
 */

import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

export class GoogleSheetsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleSheetsConfigError";
  }
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function loadServiceAccountKey(): ServiceAccountKey {
  const raw = process.env.GOOGLE_SHEETS_SA_KEY_JSON;
  if (!raw) {
    throw new GoogleSheetsConfigError(
      "GOOGLE_SHEETS_SA_KEY_JSON is not set. Provide a Google service-account JSON key."
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GoogleSheetsConfigError(
      "GOOGLE_SHEETS_SA_KEY_JSON is not valid JSON."
    );
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as ServiceAccountKey).client_email !== "string" ||
    typeof (parsed as ServiceAccountKey).private_key !== "string"
  ) {
    throw new GoogleSheetsConfigError(
      "GOOGLE_SHEETS_SA_KEY_JSON is missing `client_email` or `private_key`."
    );
  }
  return parsed as ServiceAccountKey;
}

export interface SheetSpec {
  spreadsheetId: string;
  /** Explicit A1 range (e.g. "Sheet1!A1:N700"). Null = use whole sheet. */
  range: string | null;
  /** Numeric tab ID from a `gid=` URL fragment. Resolved to a sheet name at fetch time. */
  gid: number | null;
}

/**
 * Parse the user-supplied spec stored in `EventConfig.agentSyncSheetId` /
 * `podHeadSyncSheetId`.
 *
 * Accepts:
 *   - bare ID: `1AbC...`
 *   - ID + range: `1AbC.../Sheet1!A1:N700`
 *   - full URL: `https://docs.google.com/spreadsheets/d/1AbC.../edit#gid=0`
 *
 * If the URL contains `gid=N`, that tab is targeted (resolved to its sheet
 * name at fetch time). If the user provides an explicit `id/range` form,
 * that range wins and `gid` is ignored.
 */
export function parseSheetSpec(spec: string): SheetSpec {
  const trimmed = spec.trim();
  if (!trimmed) {
    throw new GoogleSheetsConfigError("Sheet spec is empty.");
  }

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  let spreadsheetId: string;
  let range: string | null = null;

  if (urlMatch) {
    spreadsheetId = urlMatch[1];
  } else {
    // Bare ID or `id/range` form.
    const sep = trimmed.indexOf("/");
    if (sep > -1) {
      spreadsheetId = trimmed.slice(0, sep);
      const rangePart = trimmed.slice(sep + 1);
      if (rangePart) range = rangePart;
    } else {
      spreadsheetId = trimmed;
    }
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(spreadsheetId)) {
    throw new GoogleSheetsConfigError(
      `Could not extract a spreadsheet ID from "${spec}".`
    );
  }

  // Look for `gid=N` anywhere in the URL (query or fragment). Only useful
  // when the user pasted a full URL without an explicit `id/range`.
  let gid: number | null = null;
  if (urlMatch) {
    const gidMatch = trimmed.match(/[?#&]gid=(\d+)/);
    if (gidMatch) gid = Number(gidMatch[1]);
  }

  return { spreadsheetId, range, gid };
}

/**
 * Escape a sheet name for use in an A1 range. Always wraps in single quotes
 * and doubles any embedded quotes — safe for names like `O'Brien's Sheet`
 * or `Orchs and Pod Leaders`.
 */
function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

/**
 * Fetch raw cells from the configured sheet. Returns rows as string[][].
 * Missing trailing cells in a row are returned as empty strings so column
 * indexes are stable across rows.
 *
 * If the spec carries a `gid` (e.g. from a URL with `#gid=2093692238`) and
 * no explicit range, we resolve the gid to the sheet's title via the Sheets
 * metadata API, then read from that tab. This is critical for spreadsheets
 * with multiple tabs where the user-facing one isn't the first.
 */
export async function fetchSheetRows(spec: string): Promise<string[][]> {
  const { spreadsheetId, range, gid } = parseSheetSpec(spec);
  const key = loadServiceAccountKey();

  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key.replace(/\\n/g, "\n"),
    scopes: SCOPES
  });

  const sheets = google.sheets({ version: "v4", auth });

  let effectiveRange: string;
  if (range) {
    effectiveRange = range;
  } else if (gid !== null) {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(sheetId,title))"
    });
    const target = (meta.data.sheets ?? []).find(
      (s) => s.properties?.sheetId === gid
    );
    if (!target?.properties?.title) {
      throw new GoogleSheetsConfigError(
        `Could not find a sheet/tab with gid=${gid} in the spreadsheet.`
      );
    }
    effectiveRange = `${quoteSheetName(target.properties.title)}!A1:ZZ`;
  } else {
    effectiveRange = "A1:ZZ";
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: effectiveRange,
    valueRenderOption: "UNFORMATTED_VALUE",
    majorDimension: "ROWS"
  });

  const rows = res.data.values ?? [];
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map((r) => {
    const padded: string[] = [];
    for (let i = 0; i < width; i++) {
      const cell = r[i];
      padded.push(cell === undefined || cell === null ? "" : String(cell));
    }
    return padded;
  });
}
