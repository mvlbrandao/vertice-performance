import type { ReactNode } from "react";
import { requireCoach } from "@/lib/auth/guards";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const navItems: NavItem[] = [
  { href: "/dashboard", icon: "📊", label: "Painel" },
  { href: "/athletes", icon: "👥", label: "Atletas" },
  { href: "/agenda", icon: "🗓️", label: "Agenda de Encontros" },
  { href: "/plays", icon: "🎯", label: "Mesa Tática" },
  { href: "/jogos", icon: "🏆", label: "Jogos" },
  { href: "/clube", icon: "🏟️", label: "Clubes" },
  { href: "/equipe", icon: "🧑‍⚕️", label: "Equipe" },
  { href: "/config", icon: "🔒", label: "Segurança & Privacidade" },
];

export default async function CoachLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireCoach();

  return (
    <AppShell navItems={navItems} userName={profile.fullName} roleLabel="Treinador(a) / Staff">
      {children}
    </AppShell>
  );
}
