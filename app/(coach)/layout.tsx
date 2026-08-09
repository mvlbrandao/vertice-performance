import type { ReactNode } from "react";
import { requireCoach } from "@/lib/auth/guards";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const navItems: NavItem[] = [
  { href: "/dashboard", icon: "📊", label: "Painel" },
  { href: "/athletes", icon: "👥", label: "Atletas" },
  { href: "/agenda", icon: "🗓️", label: "Agenda de Encontros" },
  { href: "/contas-a-pagar", icon: "💸", label: "Contas a Pagar" },
  { href: "/relatorios", icon: "📈", label: "Relatórios" },
  { href: "/plays", icon: "🎯", label: "Mesa Tática" },
  { href: "/jogos", icon: "🏆", label: "Jogos" },
  { href: "/clube", icon: "🏟️", label: "Clubes" },
  { href: "/equipe", icon: "🧑‍⚕️", label: "Equipe" },
  { href: "/config", icon: "🔒", label: "Configurações & Segurança" },
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
