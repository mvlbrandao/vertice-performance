"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { setPartnerClubManaged } from "@/lib/actions/partnerClubs";

export function ManagedToggle({
  partnerClubId,
  isManaged,
}: {
  partnerClubId: string;
  isManaged: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    await setPartnerClubManaged(partnerClubId, !isManaged);
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={isManaged ? "Clique pra desmarcar como gerido por você" : "Clique pra marcar como gerido por você"}
      className="disabled:opacity-50"
    >
      <Badge tone={isManaged ? "green" : "dark"}>
        {isManaged ? "Sob sua gestão" : "Fora da sua gestão"}
      </Badge>
    </button>
  );
}
