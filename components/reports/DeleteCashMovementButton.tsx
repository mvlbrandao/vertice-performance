"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCashMovement } from "@/lib/actions/cashClosure";

export function DeleteCashMovementButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    await deleteCashMovement(id);
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      // 11px de glifo, mas o alvo de toque é de 44px no celular (as margens
      // negativas evitam engordar a linha da lista).
      className="text-ink-faint hover:text-clay text-[11px] leading-none pointer-coarse:size-11 pointer-coarse:-my-3 pointer-coarse:-mr-3 inline-flex items-center justify-center"
      aria-label="Excluir lançamento avulso"
    >
      ✕
    </button>
  );
}
