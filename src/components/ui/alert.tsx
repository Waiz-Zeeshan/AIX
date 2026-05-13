import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "rounded-md border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-sky-200 bg-sky-50 text-sky-900",
        success: "border-emerald-200 bg-emerald-50 text-emerald-900",
        warning: "border-amber-200 bg-amber-50 text-amber-900",
        danger: "border-red-200 bg-red-50 text-red-900",
        neutral: "border-border-default bg-surface-muted text-fg"
      }
    },
    defaultVariants: {
      variant: "neutral"
    }
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({
  className,
  variant,
  title,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="status"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children && <div className="leading-relaxed">{children}</div>}
    </div>
  );
}
