import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getSessionProfile, roleHomePath } from "@/lib/auth/session";

// Área do dono da plataforma: dado vivo e sensível, nunca estático nem em
// cache compartilhado.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administração — Vértice",
  robots: { index: false, follow: false },
};

const navItems: NavItem[] = [
  // exact: /admin é prefixo de todas as outras rotas e ficaria sempre aceso.
  { href: "/admin", icon: "📊", label: "Visão geral", exact: true },
  { href: "/admin/clubes", icon: "🏟️", label: "Clubes" },
  { href: "/admin/contratos", icon: "📄", label: "Contratos" },
  { href: "/admin/saude", icon: "🩺", label: "Saúde técnica" },
  { href: "/admin/auditoria", icon: "🕵️", label: "Auditoria" },
  { href: "/admin/configuracoes", icon: "⚙️", label: "Configurações" },
  { href: "/admin/seguranca", icon: "🔐", label: "Segurança" },
];

/**
 * O layout barra quem não é administrador (404 para estranhos, /login sem
 * sessão), mas NÃO é a defesa: layouts não são reexecutados quando se navega
 * entre páginas irmãs. Por isso cada página e cada server action desta área
 * chamam requirePlatformAdmin() na primeira linha. Aqui entra com allowAal1
 * porque o layout só desenha o menu — quem trava a página quando o segundo
 * fator é obrigatório é a própria página, e a tela de segurança precisa
 * abrir para a pessoa conseguir cadastrá-lo.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdmin({ allowAal1: true });

  // O dono também pode ser treinador de um clube; nesse caso o atalho de
  // volta leva à home do papel dele. Sem perfil, o link não aparece.
  const profile = await getSessionProfile();
  const items: NavItem[] = profile
    ? [...navItems, { href: roleHomePath(profile.role), icon: "↩️", label: "Meu clube" }]
    : navItems;

  return (
    <AppShell
      navItems={items}
      userName={admin.fullName}
      roleLabel="Administrador da plataforma"
      // Sem perfil de clube o convite de push sempre falha (a inscrição é
      // gravada no perfil), então nem se oferece.
      hideDeviceInvites={!profile}
    >
      {children}
    </AppShell>
  );
}
