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
    // O glifo é pequeno e o botão ficava colado no canto do menu: o dedo
    // errava. No toque o alvo vira 44x44; a margem vertical negativa evita
    // engordar o rodapé do menu. No desktop com mouse nada muda.
    <button
      onClick={handleLogout}
      title="Sair"
      aria-label="Sair"
      className="ml-auto shrink-0 inline-flex items-center justify-center rounded-sm bg-transparent border-none text-[#555] text-base hover:text-clay focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber pointer-coarse:size-11 pointer-coarse:-my-2"
    >
      ⏻
    </button>
  );
}
