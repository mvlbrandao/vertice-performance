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
      className="text-ink-faint hover:text-clay text-[11px] leading-none"
      aria-label="Excluir lançamento avulso"
    >
      ✕
    </button>
  );
}
