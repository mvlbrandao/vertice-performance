import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LEAD_BUCKET_LABEL, type ClubLead, type LeadBucket } from "@/lib/platform/leads";

const BUCKET_ORDER: LeadBucket[] = ["quente", "engajado", "novo", "convertido", "perdido"];

const BUCKET_TONE: Record<LeadBucket, "green" | "sky" | "amber" | "clay" | "dark"> = {
  convertido: "green",
  quente: "clay",
  engajado: "sky",
  novo: "dark",
  perdido: "dark",
};

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatUltimoAcesso(iso: string | null): string {
  if (!iso) return "nunca acessou";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias}d`;
}

export function LeadFunnel({
  leads,
  recebidoMesCents,
  aReceber7DiasCents,
  conversoes30,
  cohort30,
  conversoes90,
  cohort90,
  tempoMedioConversaoDias,
}: {
  leads: ClubLead[];
  recebidoMesCents: number;
  aReceber7DiasCents: number;
  conversoes30: number;
  cohort30: number;
  conversoes90: number;
  cohort90: number;
  tempoMedioConversaoDias: number | null;
}) {
  const porBalde = new Map<LeadBucket, ClubLead[]>();
  for (const bucket of BUCKET_ORDER) porBalde.set(bucket, []);
  for (const lead of leads) porBalde.get(lead.bucket)?.push(lead);

  // Dentro de cada balde, urgência primeiro: quem tem menos dias restantes
  // (ou está há mais tempo sem progredir) aparece no topo.
  for (const bucket of BUCKET_ORDER) {
    porBalde.get(bucket)?.sort((a, b) => {
      if (a.diasRestantes !== null && b.diasRestantes !== null) return a.diasRestantes - b.diasRestantes;
      return b.diasEmTrial - a.diasEmTrial;
    });
  }

  const taxa30 = cohort30 > 0 ? Math.round((conversoes30 / cohort30) * 100) : null;
  const taxa90 = cohort90 > 0 ? Math.round((conversoes90 / cohort90) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BUCKET_ORDER.map((bucket) => (
          <div key={bucket} className="bg-paper border border-line rounded-md px-3.5 py-3">
            <span className="text-[11px] text-ink-faint uppercase tracking-wide block mb-0.5">
              {LEAD_BUCKET_LABEL[bucket]}
            </span>
            <b className="text-xl font-display">{porBalde.get(bucket)?.length ?? 0}</b>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-paper border border-line rounded-md px-3.5 py-3">
          <span className="text-[11px] text-ink-faint uppercase tracking-wide block mb-0.5">
            Recebido este mês
          </span>
          <b className="text-lg font-display">{formatCents(recebidoMesCents)}</b>
        </div>
        <div className="bg-paper border border-line rounded-md px-3.5 py-3">
          <span className="text-[11px] text-ink-faint uppercase tracking-wide block mb-0.5">
            A receber (7 dias)
          </span>
          <b className="text-lg font-display">{formatCents(aReceber7DiasCents)}</b>
        </div>
        <div className="bg-paper border border-line rounded-md px-3.5 py-3">
          <span className="text-[11px] text-ink-faint uppercase tracking-wide block mb-0.5">
            Conversão 30d / 90d
          </span>
          <b className="text-lg font-display">
            {taxa30 !== null ? `${taxa30}%` : "—"} / {taxa90 !== null ? `${taxa90}%` : "—"}
          </b>
        </div>
        <div className="bg-paper border border-line rounded-md px-3.5 py-3">
          <span className="text-[11px] text-ink-faint uppercase tracking-wide block mb-0.5">
            Tempo médio até converter
          </span>
          <b className="text-lg font-display">
            {tempoMedioConversaoDias !== null ? `${tempoMedioConversaoDias}d` : "—"}
          </b>
        </div>
      </div>

      {leads.length === 0 ? (
        <EmptyState icon="🌱" message="Nenhum lead ainda — clubes de demonstração não entram aqui." />
      ) : (
        BUCKET_ORDER.filter((b) => (porBalde.get(b)?.length ?? 0) > 0).map((bucket) => (
          <div key={bucket}>
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-ink-faint mb-2">
              {LEAD_BUCKET_LABEL[bucket]} ({porBalde.get(bucket)?.length})
            </h3>
            <div className="flex flex-col gap-2">
              {porBalde.get(bucket)?.map((lead) => (
                <div
                  key={lead.clubId}
                  className="bg-paper border border-line rounded-md px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <b className="text-sm">{lead.clubName}</b>
                      <Badge tone={BUCKET_TONE[bucket]}>{LEAD_BUCKET_LABEL[bucket]}</Badge>
                    </div>
                    <div className="text-[11.5px] text-ink-faint font-mono">
                      {lead.diasEmTrial}d em trial
                      {lead.diasRestantes !== null &&
                        ` · ${lead.diasRestantes > 0 ? `${lead.diasRestantes}d restantes` : "vencido"}`}{" "}
                      · {lead.atletasAtivos} atletas · checklist {lead.checklistDone}/{lead.checklistTotal} · último
                      acesso {formatUltimoAcesso(lead.ultimoAcesso)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
