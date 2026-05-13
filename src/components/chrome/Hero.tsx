import { cn } from "@/lib/utils";

interface HeroProps {
  /** Optional copy rendered above the CTA inside the glass card. */
  subhead?: string;
  /** Optional slot for CTAs (sign-in form, button, etc.). */
  children?: React.ReactNode;
  className?: string;
}

export function Hero({ subhead, children, className }: HeroProps) {
  return (
    <section
      className={cn(
        "relative flex min-h-screen items-center justify-center bg-brand-midnight bg-center bg-no-repeat px-6 py-12 text-white",
        className
      )}
      style={{
        backgroundImage: "url('/aix-banner.jpg')",
        backgroundSize: "100% 100%"
      }}
    >
      {/* Glassmorphic card sitting over the banner. */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 shadow-[0_20px_60px_-15px_rgba(64,16,128,0.7)] backdrop-blur-2xl">
        <div className="flex flex-col gap-5 text-center">
          {subhead && (
            <p className="text-sm leading-relaxed text-white/85">{subhead}</p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
