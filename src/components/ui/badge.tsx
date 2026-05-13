import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        // General
        neutral: "bg-surface-alt text-fg",
        accent: "bg-brand-accent-soft text-brand-electric",
        success: "bg-emerald-100 text-emerald-900",
        warning: "bg-amber-100 text-amber-900",
        info: "bg-sky-100 text-sky-900",
        danger: "bg-red-100 text-red-900",
        // Transparency (matching results UI)
        "rank-achieved": "bg-emerald-100 text-emerald-900",
        "their-rank": "bg-sky-100 text-sky-900",
        "auto-assigned": "bg-amber-100 text-amber-900",
        "primary-honored": "bg-emerald-100 text-emerald-900",
        "secondary-honored": "bg-surface-alt text-fg-muted",
        "balance-fallback": "bg-amber-100 text-amber-900"
      }
    },
    defaultVariants: {
      variant: "neutral"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
