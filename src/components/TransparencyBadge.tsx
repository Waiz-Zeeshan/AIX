/**
 * Small badge for the results UI (SRS §6.2 FR-O4, §6.3 FR-P7, §6.4 FR-AG5).
 *
 * Variants:
 *   - "rank-achieved" | "their-rank"  → "Your #N pick" / "They ranked you #M"
 *   - "auto-assigned"                 → "Auto-assigned" (amber)
 *   - "primary-honored"               → "Primary pick honored ✓" (emerald)
 *   - "secondary-honored"             → "Got your secondary" (zinc)
 *   - "balance-fallback"              → "Balanced assignment" (amber)
 *
 * Pure presentational. Server-renderable.
 */

export type TransparencyVariant =
  | "rank-achieved"
  | "their-rank"
  | "auto-assigned"
  | "primary-honored"
  | "secondary-honored"
  | "balance-fallback";

interface TransparencyBadgeProps {
  variant: TransparencyVariant;
  /** Required when variant is "rank-achieved" or "their-rank". */
  rank?: number;
  /** Optional: total list size (e.g. 10) for context. */
  outOf?: number;
}

const COLORS: Record<TransparencyVariant, string> = {
  "rank-achieved":
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  "their-rank":
    "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
  "auto-assigned":
    "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  "primary-honored":
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  "secondary-honored":
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  "balance-fallback":
    "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
};

export function TransparencyBadge({
  variant,
  rank,
  outOf
}: TransparencyBadgeProps) {
  let label: string;
  switch (variant) {
    case "rank-achieved":
      label = rank ? `Your #${rank} pick` : "Pick";
      break;
    case "their-rank":
      label =
        rank && outOf
          ? `They ranked you #${rank} of ${outOf}`
          : rank
            ? `They ranked you #${rank}`
            : "Ranked you";
      break;
    case "auto-assigned":
      label = "Auto-assigned";
      break;
    case "primary-honored":
      label = "Primary pick honored";
      break;
    case "secondary-honored":
      label = "Got your secondary";
      break;
    case "balance-fallback":
      label = "Balanced assignment";
      break;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[variant]}`}
    >
      {label}
    </span>
  );
}
