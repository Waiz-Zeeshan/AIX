import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-lg", {
  variants: {
    variant: {
      default: "border border-border-default bg-surface",
      banner: "border border-border-default bg-surface shadow-sm",
      muted: "border border-border-default bg-surface-muted",
      "dashed-empty":
        "border border-dashed border-border-strong bg-surface-muted text-fg-muted"
    },
    padding: {
      none: "",
      sm: "p-3",
      md: "p-4",
      lg: "p-6"
    }
  },
  defaultVariants: {
    variant: "default",
    padding: "md"
  }
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 space-y-1", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-display text-base font-semibold text-fg", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-fg-muted", className)} {...props} />
  );
}
