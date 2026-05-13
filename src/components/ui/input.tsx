import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "block w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg shadow-sm transition placeholder:text-fg-subtle focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30 disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-fg-muted",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
