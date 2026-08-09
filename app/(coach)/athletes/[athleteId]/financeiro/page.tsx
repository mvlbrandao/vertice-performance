import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewChargeModal } from "@/components/billing/NewChargeModal";
import { ChargeRow } from "@/components/billing/ChargeRow";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function AthleteFinanceiroPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const supabase = await createClient();

  const { data: charges } = await supabase
    .from("athlete_charges")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("due_date", { ascending: false });

  const pendingTotal = (charges ?? [])
    .filter((c) => c.status === "Pendente" || c.status === "Atrasado")
    .reduce((sum, c) => sum + c.amount_cents, 0);
  const paidTotal = (charges ?? [])
    .filter((c) => c.status === "Pago")
    .reduce((sum, c) => sum + c.amount_cents, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-[19px] m-0">Financeiro</h3>
          <div className="text-xs text-ink-faint mt-0.5">
            Lançamentos de mensalidade e pagamentos do atleta.
          </div>
        </div>
        <NewChargeModal athleteId={athleteId} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Em aberto</span>
          <b className="block font-display text-2xl leading-none mt-1">
            {formatCents(pendingTotal)}
          </b>
        </Card>
        <Card>
          <span className="text-xs font-semibold text-ink-soft">Pago</span>
          <b className="block font-display text-2xl leading-none mt-1">
            {formatCents(paidTotal)}
          </b>
        </Card>
      </div>

      <Card>
        {!charges || charges.length === 0 ? (
          <EmptyState icon="💳" message="Nenhum lançamento registrado ainda." />
        ) : (
          charges.map((c) => (
            <ChargeRow
              key={c.id}
              id={c.id}
              athleteId={athleteId}
              description={c.description}
              amountCents={c.amount_cents}
              competenceMonth={c.competence_month}
              competenceYear={c.competence_year}
              dueDate={c.due_date}
              status={c.status}
              canManage
            />
          ))
        )}
      </Card>

      <div className="mt-4 text-[12.5px] text-ink-soft bg-chalk border border-line rounded-md px-3.5 py-3">
        💡 Cobrança recorrente com cartão/PIX automático ainda não está ligada — isso exige uma
        conta em um gateway de pagamento (recomendação: Asaas, que cobre PIX, boleto e cartão com
        régua de cobrança pra clube/assinatura no Brasil). Assim que o clube tiver a conta, dá pra
        conectar aqui sem mudar como os lançamentos manuais funcionam.
      </div>
    </div>
  );
}
