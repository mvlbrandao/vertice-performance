/**
 * "Hoje" no fuso do clube, não em UTC.
 *
 * O app inteiro usava `new Date().toISOString().slice(0, 10)`, que devolve a
 * data em UTC. Como o Brasil está três horas atrás, das 21h à meia-noite o
 * sistema já achava que era o dia seguinte — e as datas guardadas no banco
 * (due_date, checkin_date, fechamento de caixa) são datas civis brasileiras,
 * não instantes UTC. O sintoma que denunciou: um lembrete de cobrança que
 * vencia hoje chegou dizendo "venceu ontem", disparado às 22h.
 *
 * Vale para qualquer lugar que compare com uma coluna `date` do Postgres ou
 * preencha um seletor de data. Para instantes (timestamptz), continue usando
 * `new Date().toISOString()` — ali o UTC está certo.
 */
export const CLUB_TIME_ZONE = "America/Sao_Paulo";

export function hojeISO(timeZone: string = CLUB_TIME_ZONE): string {
  // en-CA formata como YYYY-MM-DD, que é exatamente o formato do Postgres.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Soma dias a uma data civil (YYYY-MM-DD) sem passar por fuso nenhum. */
export function somaDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}
