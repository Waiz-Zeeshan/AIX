import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "bg-brand-page-header relative isolate overflow-hidden text-white",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_10%_30%,rgba(130,74,219,0.45),transparent_50%),radial-gradient(circle_at_90%_80%,rgba(64,16,128,0.4),transparent_55%)]"
      />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow && (
            <p className="font-display text-xs uppercase tracking-[0.35em] text-white/60">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
