import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth/guards";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const navItems: NavItem[] = [{ href: "/meus-atletas", icon: "👥", label: "Meus Atletas" }];

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const profile = await requireStaff();

  return (
    <AppShell navItems={navItems} userName={profile.fullName} roleLabel="Staff">
      {children}
    </AppShell>
  );
}
