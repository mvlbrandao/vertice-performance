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
    <button
      onClick={handleLogout}
      title="Sair"
      className="ml-auto bg-transparent border-none text-[#555] text-base hover:text-clay"
    >
      ⏻
    </button>
  );
}
