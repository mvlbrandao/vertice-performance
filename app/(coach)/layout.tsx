import type { ReactNode } from "react";
import { requireCoach } from "@/lib/auth/guards";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { HelpButton } from "@/components/help/HelpButton";

const navItems: NavItem[] = [
  { href: "/dashboard", icon: "📊", label: "Painel" },
  { href: "/athletes", icon: "👥", label: "Atletas" },
  { href: "/agenda", icon: "🗓️", label: "Agenda de Encontros" },
  {
    href: "/financeiro",
    icon: "💰",
    label: "Financeiro",
    children: [
      { href: "/contas-a-receber", icon: "💳", label: "Contas a Receber" },
      { href: "/inadimplencia", icon: "🔔", label: "Inadimplência" },
      { href: "/contas-a-pagar", icon: "💸", label: "Contas a Pagar" },
      { href: "/relatorios", icon: "📈", label: "Relatórios" },
      { href: "/caixa-do-dia", icon: "🗄️", label: "Caixa do Dia" },
      { href: "/evolucao-despesas", icon: "📊", label: "Evolução de Despesas" },
      { href: "/evolucao-financeira-sub", icon: "🧭", label: "Evolução de Receita" },
      { href: "/cancelamentos", icon: "🚫", label: "Cancelamentos" },
    ],
  },
  { href: "/plays", icon: "🎯", label: "Mesa Tática" },
  { href: "/jogos", icon: "🏆", label: "Jogos" },
  { href: "/comissao-tecnica", icon: "🔬", label: "Comissão Técnica" },
  { href: "/desafios-gestao", icon: "🎖️", label: "Desafios" },
  { href: "/clube", icon: "🏟️", label: "Clubes" },
  { href: "/equipe", icon: "🧑‍⚕️", label: "Equipe" },
  { href: "/auditoria", icon: "🕵️", label: "Auditoria" },
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
      <HelpButton />
    </AppShell>
  );
}
