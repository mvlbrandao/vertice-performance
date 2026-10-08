"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();

    // O cache offline guarda as páginas já visitadas, com dados pessoais do
    // atleta. Num aparelho compartilhado (celular do treinador, tablet de
    // casa), quem entrasse depois poderia ficar sem internet e ver as telas
    // de quem usou antes. Sair da conta limpa esse cache.
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    router.push("/login");
    router.refresh();
  }

  return (
    // size-11 (44px): o glifo é pequeno, mas o alvo de toque não pode ser — era
    // o botão de sair, colado no canto do menu, que o dedo errava. As margens
    // negativas devolvem o espaço para o rodapé do menu não crescer.
    <button
      onClick={handleLogout}
      title="Sair"
      aria-label="Sair"
      className="ml-auto -my-2 -mr-2 size-11 shrink-0 inline-flex items-center justify-center rounded-sm bg-transparent border-none text-[#555] text-base hover:text-clay focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
    >
      ⏻
    </button>
  );
}
