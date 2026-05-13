import { AppFooter } from "@/components/chrome/AppFooter";
import { AppHeader, type NavItem } from "@/components/chrome/AppHeader";
import { requireAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/phases", label: "Phases" },
  { href: "/admin/config", label: "Config" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/matching", label: "Matching" }
];

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <AppHeader
        user={{ email: user.email }}
        nav={ADMIN_NAV}
        homeHref="/admin"
      />
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
