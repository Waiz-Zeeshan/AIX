import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Label = forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "block text-xs font-semibold uppercase tracking-wide text-fg-muted",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";
