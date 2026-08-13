import { requireCoachIgnoringLicense } from "@/lib/auth/guards";
import { getClubLicense } from "@/lib/platform/license";
import { getAthleteUsage } from "@/lib/platform/license";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MOTIVO: Record<string, { titulo: string; texto: string }> = {
  trial_expirado: {
    titulo: "Seu período de teste terminou",
    texto:
      "Os dados do clube estão todos guardados. Assine para voltar a usar — nada foi apagado.",
  },
  assinatura: {
    titulo: "Assinatura suspensa",
    texto: "Não conseguimos concluir a cobrança. Regularize para reativar o acesso do clube.",
  },
  cancelado: {
    titulo: "Assinatura cancelada",
    texto: "O clube foi cancelado. Fale com o suporte se quiser reativar.",
  },
};

/**
 * Tela que o dono vê quando o clube perde acesso.
 *
 * Fora do grupo (coach) de propósito, e não só por usar o guard que ignora
 * a licença: o layout daquele grupo chama requireCoach(), que bloqueia e
 * manda pra cá — o que fazia a página redirecionar pra si mesma em laço.
 * Descoberto testando com um clube de teste vencido: /assinatura respondia
 * 307 indefinidamente.
 */
export default async function AssinaturaPage() {
  const coach = await requireCoachIgnoringLicense();
  const license = await getClubLicense(coach.clubId);
  const usage = await getAthleteUsage(coach.clubId);

  const motivo = license.blockedReason ? MOTIVO[license.blockedReason] : null;
  const emCortesia = !!license.courtesyUntil && new Date(license.courtesyUntil) > new Date();

  return (
    <div className="min-h-screen bg-chalk p-5 sm:p-8">
      <div className="max-w-2xl mx-auto">
      <h1 className="text-[28px] m-0 mb-1">Assinatura</h1>
      <div className="text-xs text-ink-faint mb-4">{license.clubName}</div>

      {motivo && (
        <Card className="mb-4 border-clay/40">
          <h2 className="text-[19px] m-0 mb-1.5">{motivo.titulo}</h2>
          <p className="text-[13.5px] text-ink-soft m-0">{motivo.texto}</p>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Badge
            tone={
              license.status === "ativo"
                ? "green"
                : license.status === "trial"
                  ? "sky"
                  : license.status === "atrasado"
                    ? "amber"
                    : "clay"
            }
          >
            {license.status}
          </Badge>
          {emCortesia && <Badge tone="amber">cortesia</Badge>}
          <span className="text-[13px] font-semibold">{license.planName}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <b className="font-mono text-lg block">
              {license.priceCents > 0 ? formatCents(license.priceCents) : "a definir"}
            </b>
            <span className="text-[10.5px] text-ink-faint uppercase tracking-wide">por mês</span>
          </div>
          <div>
            <b className="font-mono text-lg block">
              {usage.used}/{usage.max}
            </b>
            <span className="text-[10.5px] text-ink-faint uppercase tracking-wide">atletas</span>
          </div>
          {license.daysLeft !== null && (
            <div>
              <b className="font-mono text-lg block">
                {license.daysLeft > 0 ? `${license.daysLeft}d` : "vencido"}
              </b>
              <span className="text-[10.5px] text-ink-faint uppercase tracking-wide">
                {emCortesia ? "de cortesia" : "de teste"}
              </span>
            </div>
          )}
        </div>

        {emCortesia && license.courtesyReason && (
          <p className="text-[12.5px] text-ink-soft mt-3 mb-0 pt-3 border-t border-line">
            Cortesia concedida: {license.courtesyReason}
          </p>
        )}
      </Card>

      {license.priceCents === 0 && (
        <Card>
          <p className="text-[13.5px] text-ink-soft m-0">
            O valor do plano ainda não foi definido. Enquanto isso, o acesso do clube segue
            liberado — fale com o suporte para combinar a contratação.
          </p>
        </Card>
      )}
      </div>
    </div>
  );
}
