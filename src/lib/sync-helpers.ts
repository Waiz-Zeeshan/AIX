/**
 * Helpers shared by the agent-sync and pod-head-sync planners.
 *
 * Lives in its own file so neither planner has to import from the other
 * (which would create a circular dependency once both need the same utility).
 */

/**
 * Derive a sensible display name from the email local-part when the sheet
 * doesn't carry an explicit name column. Mirrors `scripts/grant-admin.ts`.
 *   "husnain.nasir@tkxel.io" → "Husnain Nasir"
 *   "waseem.akram@tkxel.com" → "Waseem Akram"
 *   "fahad+test@tkxel.io"    → "Fahad Test"
 */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const titled = local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
  return titled || email;
}

/**
 * Split a "Full Name - 1234" cell into name + EMP ID. If there's no trailing
 * `<dash><digits>` suffix, the whole cell is the name and `empId` is null. A
 * dangling trailing dash without digits (e.g. "Foo Bar -") is stripped so
 * lookups by name still succeed.
 *
 * Tolerant on spacing — sheet operators frequently type `"Name -1234"`,
 * `"Name- 1234"`, or `"Name-1234"`. All of those are equivalent.
 *
 * Tolerant on dash character — ASCII hyphen `-`, en-dash `–`, em-dash `—`,
 * Unicode hyphen `‐` (U+2010), non-breaking hyphen `‑` (U+2011), and minus
 * sign `−` (U+2212) all accepted. Google Sheets and Excel autocorrect
 * sometimes substitute these silently.
 *
 *   "Abdullah Ameer Aftab - 2499" → { name: "Abdullah Ameer Aftab", empId: "2499" }
 *   "Hafiz Muhammad Umair-1676"   → { name: "Hafiz Muhammad Umair", empId: "1676" }
 *   "Hafiz -1676"                 → { name: "Hafiz",                empId: "1676" }
 *   "Hafiz- 1676"                 → { name: "Hafiz",                empId: "1676" }
 *   "Just A Name"                 → { name: "Just A Name",          empId: null }
 *   "Foo Bar – 99" (en-dash)      → { name: "Foo Bar",              empId: "99" }
 *   "Foo Bar -"                   → { name: "Foo Bar",              empId: null }
 *
 * Edge: an internal-dash name like "Smith-Jones" parses as `name="Smith"`,
 * `empId="Jones"`... except `empId` only matches digits, so "Smith-Jones"
 * fails the empId regex and falls back to `{ name: "Smith-Jones", empId: null }`.
 * Real internal-dash names with no digit suffix are safe.
 */
const DASH_CHARS = "-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2212";
const NAME_EMPID_RE = new RegExp(`^(.+?)\\s*[${DASH_CHARS}]\\s*(\\d+)\\s*$`);
const TRAILING_DASH_RE = new RegExp(`\\s+[${DASH_CHARS}]\\s*$`);

export function splitNameAndEmpId(cell: string): {
  name: string;
  empId: string | null;
} {
  const trimmed = cell.trim();
  const m = trimmed.match(NAME_EMPID_RE);
  if (m) return { name: m[1].trim(), empId: m[2] };
  // `\s+` (not `\s*`) before the dash so internal-dash names like
  // "Smith-Jones" aren't mangled — only dangling separators are stripped.
  const nameOnly = trimmed.replace(TRAILING_DASH_RE, "").trim();
  return { name: nameOnly, empId: null };
}

/**
 * Normalize a name for case-insensitive directory lookups: lower-case, trim,
 * collapse internal whitespace, and strip a dangling trailing dash. Used by
 * the agent-sync and pod-head-sync planners to build name→entry maps.
 */
export function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(TRAILING_DASH_RE, "");
}
