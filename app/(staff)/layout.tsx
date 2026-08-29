import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth/guards";
import { getStaffAreas } from "@/lib/auth/staffAreas";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { DemoBanner } from "@/components/demo/DemoBanner";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const profile = await requireStaff();
  const areas = await getStaffAreas(profile.userId);

  const navItems: NavItem[] = [{ href: "/meus-atletas", icon: "👥", label: "Meus Atletas" }];
  if (areas.includes("agenda")) {
    navItems.push({ href: "/meus-atletas/agenda", icon: "🗓️", label: "Agenda" });
  }
  if (areas.includes("jogos")) {
    navItems.push({ href: "/meus-atletas/jogos", icon: "🏆", label: "Jogos" });
  }

  return (
    <AppShell navItems={navItems} userName={profile.fullName} roleLabel="Staff">
      <DemoBanner />
      {children}
    </AppShell>
  );
}
