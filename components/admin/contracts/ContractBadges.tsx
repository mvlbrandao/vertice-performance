import { Badge } from "@/components/ui/Badge";
import { STATUS_LABEL, classifyExpiry } from "@/lib/platform/contractRules";
import { STATUS_TONE, expiryBadge } from "@/lib/platform/contractView";
import type { ContractStatus } from "@/lib/types/database";

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Selo de prazo; só contrato vigente tem (o resto devolve null e some). */
export function ContractExpiryBadge({
  contract,
  todayISO,
}: {
  contract: { status: ContractStatus; ends_on: string | null };
  todayISO: string;
}) {
  const badge = expiryBadge(classifyExpiry(contract, todayISO));
  if (!badge) return null;
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

/** Classes de um link com cara de botão (o Button é um <button>; navegação pede <a>). */
export const LINK_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-sm border font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2 px-3.5 py-2.5 text-sm pointer-coarse:min-h-11";

export const LINK_BUTTON_OUTLINE = `${LINK_BUTTON_CLASS} bg-white text-ink border-line hover:border-pitch-dark hover:text-pitch-dark`;
export const LINK_BUTTON_AMBER = `${LINK_BUTTON_CLASS} bg-amber text-pitch-dark border-amber font-bold hover:bg-amber-deep`;
