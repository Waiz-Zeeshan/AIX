import Link from "next/link";
import { LogoLockup } from "@/components/Logo";
import { SignOutForm } from "@/components/chrome/SignOutForm";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

interface AppHeaderProps {
  user: { email?: string | null };
  nav?: NavItem[];
  homeHref?: string;
}

export function AppHeader({ user, nav = [], homeHref = "/" }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-brand-midnight/90 text-white shadow-[0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
        <Link href={homeHref} className="shrink-0">
          <LogoLockup tone="light" size="sm" withTagline={false} />
        </Link>
        {nav.length > 0 && (
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-white/80 transition",
                  "hover:bg-white/10 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden text-white/60 md:inline">{user.email}</span>
          <SignOutForm />
        </div>
      </div>
    </header>
  );
}
