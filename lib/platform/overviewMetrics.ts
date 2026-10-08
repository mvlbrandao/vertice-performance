import type { ClubStatus } from "@/lib/types/database";
import { somaDias } from "@/lib/utils/date";

/**
 * Indicadores da visão geral do administrador. Pura (sem banco, sem
 * "server-only"): o que o painel mostra como "receita" e "conversão" é número
 * que o dono usa para decidir, então a conta precisa de teste.
 *
 * Clube de demonstração não é cliente. Ele vive com status "ativo" e cortesia
 * até 2030 só para o ambiente de demo funcionar; contá-lo como pagante
 * inflaria a receita recorrente com uma mensalidade que ninguém paga.
 */
export interface MetricsClub {
  status: ClubStatus;
  is_demo: boolean;
  created_at: string;
  converted_at: string | null;
  price_cents_override: number | null;
}

export interface OverviewMetrics {
  /** Clubes que são clientes (sem demonstração). */
  clientes: number;
  demos: number;
  pagantes: number;
  emTeste: number;
  /** Soma da mensalidade dos pagantes (preço próprio, senão o padrão). */
  receitaRecorrenteCents: number;
  cohort30: number;
  conversoes30: number;
  cohort90: number;
  conversoes90: number;
  /** Dias entre o cadastro e a conversão, em média; null sem nenhuma conversão. */
  tempoMedioConversaoDias: number | null;
}

const isConvertido = (c: MetricsClub) => c.status === "ativo" || c.status === "atrasado";

export function computeOverviewMetrics(
  clubs: readonly MetricsClub[],
  defaultPriceCents: number,
  todayISO: string,
): OverviewMetrics {
  const clientes = clubs.filter((c) => !c.is_demo);
  const pagantes = clientes.filter((c) => c.status === "ativo");

  // Coorte = quem se cadastrou nos últimos N dias; conversão = dessa coorte,
  // quem hoje paga (ou está atrasado, o que também é cliente convertido).
  const cohort = (dias: number) => {
    const desde = new Date(somaDias(todayISO, -dias));
    return clientes.filter((c) => new Date(c.created_at) >= desde);
  };
  const c30 = cohort(30);
  const c90 = cohort(90);

  const comTempo = clientes.filter((c) => c.converted_at);
  const tempoMedioConversaoDias = comTempo.length
    ? Math.round(
        comTempo.reduce(
          (sum, c) =>
            sum + (new Date(c.converted_at!).getTime() - new Date(c.created_at).getTime()) / 86_400_000,
          0,
        ) / comTempo.length,
      )
    : null;

  return {
    clientes: clientes.length,
    demos: clubs.length - clientes.length,
    pagantes: pagantes.length,
    emTeste: clientes.filter((c) => c.status === "trial").length,
    receitaRecorrenteCents: pagantes.reduce(
      (sum, c) => sum + (c.price_cents_override ?? defaultPriceCents),
      0,
    ),
    cohort30: c30.length,
    conversoes30: c30.filter(isConvertido).length,
    cohort90: c90.length,
    conversoes90: c90.filter(isConvertido).length,
    tempoMedioConversaoDias,
  };
}
