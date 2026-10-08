import type { ReactNode } from "react";
import { requireAthlete } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { DemoBanner } from "@/components/demo/DemoBanner";

const navItems: NavItem[] = [
  { href: "/perfil", icon: "🪪", label: "Meu Perfil" },
  { href: "/minha-agenda", icon: "🗓️", label: "Minha Agenda" },
  { href: "/evolucao", icon: "📈", label: "Minha Evolução" },
  { href: "/anamnese", icon: "🧭", label: "Anamnese" },
  { href: "/financeiro", icon: "💳", label: "Financeiro" },
  { href: "/treino", icon: "🏋️", label: "Treinos" },
  { href: "/desafios", icon: "🎖️", label: "Desafios" },
  { href: "/mesa-tatica", icon: "🎯", label: "Mesa Tática" },
  { href: "/checkin", icon: "✅", label: "Check-in Diário" },
  { href: "/privacidade", icon: "🔒", label: "Privacidade dos meus dados" },
];

// Os quatro usos de todo dia, ao alcance do polegar. O resto do menu fica
// atrás de "Mais" (o próprio AppShell acrescenta o botão). Rótulos curtos:
// cada aba tem ~1/5 da largura de um celular de 360px.
const mobileTabs: NavItem[] = [
  { href: "/perfil", icon: "🪪", label: "Perfil" },
  { href: "/minha-agenda", icon: "🗓️", label: "Agenda" },
  { href: "/treino", icon: "🏋️", label: "Treinos" },
  { href: "/checkin", icon: "✅", label: "Check-in" },
];

export default async function AthleteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireAthlete();
  const supabase = await createClient();
  let roleLabel = "Atleta";
  if (profile.athleteId) {
    const { data: athlete } = await supabase
      .from("athletes")
      .select("category")
      .eq("id", profile.athleteId)
      .single();
    if (athlete?.category) roleLabel = athlete.category;
  }

  return (
    <AppShell
      navItems={navItems}
      mobileTabs={mobileTabs}
      userName={profile.fullName}
      roleLabel={roleLabel}
    >
      <DemoBanner />
      {children}
    </AppShell>
  );
}
