/**
 * Small badge for the results UI (SRS §6.2 FR-O4, §6.3 FR-P7, §6.4 FR-AG5).
 *
 * Variants:
 *   - "rank-achieved" | "their-rank"  → "Your #N pick" / "They ranked you #M"
 *   - "auto-assigned"                 → "Auto-assigned" (amber)
 *   - "primary-honored"               → "Primary pick honored" (emerald)
 *   - "secondary-honored"             → "Got your secondary" (neutral)
 *   - "balance-fallback"              → "Balanced assignment" (amber)
 *
 * Renders via the centralized <Badge /> primitive.
 */

import { Badge } from "@/components/ui/badge";

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
  return <Badge variant={variant}>{label}</Badge>;
}
