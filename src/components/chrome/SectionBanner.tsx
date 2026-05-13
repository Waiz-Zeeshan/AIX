import { cn } from "@/lib/utils";

interface SectionBannerProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionBanner({
  title,
  subtitle,
  className
}: SectionBannerProps) {
  return (
    <div
      className={cn(
        "bg-brand-banner relative w-full text-white",
        className
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-1 px-6 py-5 text-center">
        <h2 className="font-display text-lg font-semibold uppercase tracking-[0.2em] text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-white/70">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
