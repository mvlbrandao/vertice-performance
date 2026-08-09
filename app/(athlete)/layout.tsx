import type { ReactNode } from "react";
import { requireAthlete } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const navItems: NavItem[] = [
  { href: "/perfil", icon: "🪪", label: "Meu Perfil" },
  { href: "/minha-agenda", icon: "🗓️", label: "Minha Agenda" },
  { href: "/evolucao", icon: "📈", label: "Minha Evolução" },
  { href: "/anamnese", icon: "🧭", label: "Anamnese" },
  { href: "/treino", icon: "🏋️", label: "Treinos" },
  { href: "/mesa-tatica", icon: "🎯", label: "Mesa Tática" },
  { href: "/checkin", icon: "✅", label: "Check-in Diário" },
  { href: "/privacidade", icon: "🔒", label: "Privacidade dos meus dados" },
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
    <AppShell navItems={navItems} userName={profile.fullName} roleLabel={roleLabel}>
      {children}
    </AppShell>
  );
}
