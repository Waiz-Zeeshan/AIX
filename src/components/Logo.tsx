import Image from "next/image";
import { cn } from "@/lib/utils";

type Tone = "light" | "dark";
type Size = "sm" | "md" | "lg";

interface LogoMarkProps {
  tone?: Tone;
  size?: Size;
  className?: string;
}

// Source asset is 2048×687 → aspect ratio ≈ 2.98:1. Height drives layout.
const MARK_HEIGHT: Record<Size, number> = {
  sm: 24,
  md: 40,
  lg: 80
};

const ASPECT_RATIO = 2048 / 687;

export function LogoMark({ tone = "light", size = "md", className }: LogoMarkProps) {
  const h = MARK_HEIGHT[size];
  const w = Math.round(h * ASPECT_RATIO);

  return (
    <Image
      src="/aix-logo.png"
      alt="AIX"
      width={w}
      height={h}
      priority
      className={cn(
        "select-none",
        // PNG is white-on-transparent; flip to near-black on light backgrounds.
        tone === "dark" && "brightness-0",
        className
      )}
    />
  );
}

interface LogoLockupProps {
  tone?: Tone;
  size?: Size;
  withTagline?: boolean;
  className?: string;
}

export function LogoLockup({
  tone = "light",
  size = "md",
  withTagline = false,
  className
}: LogoLockupProps) {
  const taglineColor = tone === "light" ? "text-white/70" : "text-fg-muted";
  const taglineSize =
    size === "lg" ? "text-xs" : size === "md" ? "text-[10px]" : "text-[9px]";

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center leading-none",
        className
      )}
    >
      <LogoMark tone={tone} size={size} />
      {withTagline && (
        <span
          className={cn(
            "mt-2 font-display font-semibold uppercase tracking-[0.4em]",
            taglineSize,
            taglineColor
          )}
        >
          tkxel
        </span>
      )}
    </div>
  );
}
