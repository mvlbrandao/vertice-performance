import type { ClubStatus, ContractBillingCycle, ContractStatus } from "@/lib/types/database";
import { somaDias } from "@/lib/utils/date";

/**
 * Regras puras de contrato (sem banco, sem "server-only") para poderem ser
 * testadas e usadas tanto nas telas de contrato quanto na visão geral e nos
 * alertas. Datas são datas civis "YYYY-MM-DD" (fuso do clube), nunca
 * instantes — por isso a aritmética de dias passa por Date.UTC e não por
 * fuso local.
 */

export const CYCLE_MONTHS: Record<ContractBillingCycle, number> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Ciclos na ordem em que aparecem nas telas. */
export const BILLING_CYCLES = ["mensal", "trimestral", "semestral", "anual"] as const satisfies readonly ContractBillingCycle[];

/**
 * Limites de texto dos campos do contrato. Espelham o que cabe numa linha de
 * contrato, não o do banco (que é `text`). Moram aqui, e não no esquema Zod,
 * para o formulário (cliente) usá-los em `maxLength` sem puxar o Zod no pacote.
 */
export const CONTRACT_LIMITS = {
  planName: 80,
  signerName: 120,
  signerRole: 80,
  termsVersion: 40,
  notes: 2000,
  reason: 500,
  maxAthletes: 100_000,
} as const;

export const CYCLE_LABEL: Record<ContractBillingCycle, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const STATUS_LABEL: Record<ContractStatus, string> = {
  rascunho: "Rascunho",
  vigente: "Vigente",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

/**
 * Receita mensal equivalente de um contrato. price_cents é o valor de CADA
 * ciclo (anual de R$ 1.200 = 120000), então comparar com a licença — que é
 * mensal — e somar receita recorrente exige normalizar para mês.
 */
export function monthlyEquivalentCents(priceCents: number, cycle: ContractBillingCycle): number {
  return Math.round(priceCents / CYCLE_MONTHS[cycle]);
}

function toUtcDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Dias corridos de `fromISO` até `toISO` (negativo se `toISO` já passou). */
export function diffDays(fromISO: string, toISO: string): number {
  return Math.round(toUtcDay(toISO) - toUtcDay(fromISO));
}

export type ExpiryState =
  | "indeterminado"
  | "em_dia"
  | "vence_90"
  | "vence_60"
  | "vence_30"
  | "vencido";

export interface ContractExpiry {
  state: ExpiryState;
  /** Dias até o fim (negativo = vencido há N dias). null se prazo indeterminado. */
  days: number | null;
}

/**
 * Situação de prazo. Só faz sentido para contrato vigente: rascunho ainda não
 * começou e encerrado/cancelado já acabou, então qualquer um deles devolve
 * "em_dia" sem dias — a tela não deve alarmar por contrato que não conta.
 */
export function classifyExpiry(
  contract: { status: ContractStatus; ends_on: string | null },
  todayISO: string,
): ContractExpiry {
  if (contract.status !== "vigente") return { state: "em_dia", days: null };
  if (!contract.ends_on) return { state: "indeterminado", days: null };

  const days = diffDays(todayISO, contract.ends_on);
  if (days < 0) return { state: "vencido", days };
  if (days <= 30) return { state: "vence_30", days };
  if (days <= 60) return { state: "vence_60", days };
  if (days <= 90) return { state: "vence_90", days };
  return { state: "em_dia", days };
}

/** Transições permitidas. Encerrado e cancelado são estados finais. */
export const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  rascunho: ["vigente", "cancelado"],
  vigente: ["encerrado", "cancelado"],
  encerrado: [],
  cancelado: [],
};

export function canTransition(from: ContractStatus, to: ContractStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Datas civis
// ---------------------------------------------------------------------------

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
  // Dia 0 do mês seguinte é o último deste. Date.UTC trata 0000-0099 como
  // 1900-1999, mas os anos aceitos aqui já passam por isValidCivilDate.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatCivil(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * "AAAA-MM-DD" que existe no calendário. A regex sozinha deixaria passar
 * 2026-02-30, que o Postgres recusa com um erro críptico depois de a pessoa
 * ter preenchido o formulário inteiro; aqui a recusa é na hora e em português.
 * Anos abaixo de 1900 são recusados: um contrato de "0026" é erro de digitação.
 */
export function isValidCivilDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = CIVIL_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1900 || year > 2999) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

/**
 * Soma meses a uma data civil. Quando o dia não existe no mês de destino, vai
 * para o último dia dele (31/01 + 1 mês = 28/02, ou 29/02 em ano bissexto):
 * deixar o JavaScript "transbordar" daria 03/03, um mês errado para quem
 * contratou "a partir do dia 31".
 */
export function addMonthsCivil(iso: string, months: number): string {
  if (!isValidCivilDate(iso)) throw new RangeError(`addMonthsCivil: data inválida (${iso}).`);
  if (!Number.isInteger(months)) throw new RangeError(`addMonthsCivil: meses deve ser inteiro (${months}).`);
  const [year, month, day] = iso.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = total - newYear * 12 + 1;
  return formatCivil(newYear, newMonth, Math.min(day, daysInMonth(newYear, newMonth)));
}

export interface ContractPeriod {
  starts_on: string;
  ends_on: string | null;
  billing_cycle: ContractBillingCycle;
}

/**
 * Quantos meses inteiros o período [início, fim] cobre, ou null se não for um
 * número exato (ex.: de 08/10 a 15/12). "Exato" é o mesmo critério que gera o
 * fim: fim = início + N meses - 1 dia. Procura em volta da estimativa por
 * dias, porque meses têm tamanhos diferentes.
 */
export function wholeMonthsOfPeriod(startsOn: string, endsOn: string): number | null {
  const estimate = Math.round((diffDays(startsOn, endsOn) + 1) / 30.4375);
  for (const months of [estimate, estimate - 1, estimate + 1]) {
    if (months < 1) continue;
    if (somaDias(addMonthsCivil(startsOn, months), -1) === endsOn) return months;
  }
  return null;
}

export interface NextPeriod {
  starts_on: string;
  ends_on: string;
  billing_cycle: ContractBillingCycle;
  /** Duração do novo período, em meses. */
  months: number;
}

/**
 * Período de uma renovação: começa no dia seguinte ao fim do anterior (sem
 * buraco nem sobreposição) e mantém o ciclo de cobrança.
 *
 * A duração repete a do período anterior quando ele cobre um número exato de
 * meses (contrato de 12 meses cobrado por mês renova por 12, e não por 1);
 * senão, cai para a duração de um ciclo. Devolve null para prazo
 * indeterminado: não há fim a partir do qual renovar.
 */
export function nextPeriodAfter(previous: ContractPeriod): NextPeriod | null {
  if (!previous.ends_on) return null;
  if (!isValidCivilDate(previous.starts_on) || !isValidCivilDate(previous.ends_on)) return null;

  const startsOn = somaDias(previous.ends_on, 1);
  const months =
    wholeMonthsOfPeriod(previous.starts_on, previous.ends_on) ?? CYCLE_MONTHS[previous.billing_cycle];
  return {
    starts_on: startsOn,
    ends_on: somaDias(addMonthsCivil(startsOn, months), -1),
    billing_cycle: previous.billing_cycle,
    months,
  };
}

// ---------------------------------------------------------------------------
// Número do contrato e mensagens
// ---------------------------------------------------------------------------

/** "CT-7": o número que se cita por telefone. */
export function contractCode(number: number): string {
  return `CT-${number}`;
}

/** Motivo gravado no contrato que perdeu a vigência para outro. */
export function replacedReason(newNumber: number): string {
  return `Substituído pelo ${contractCode(newNumber)}`;
}

/**
 * Motivo provisório do contrato antigo durante a troca. Não há transação: entre
 * encerrar o antigo e ativar o novo existe uma janela, e gravar já o motivo
 * final ("Substituído pelo CT-n") afirmaria uma troca que, se o processo cair
 * ou a ativação falhar, nunca aconteceu. O definitivo só entra depois que o
 * novo está vigente; se ficar este, a troca não terminou e dá para ver.
 */
export function replacementPendingReason(newNumber: number): string {
  return `Substituição pelo ${contractCode(newNumber)} em andamento`;
}

/** Motivo do antigo quando a troca falhou e ele não pôde ser reaberto: diz o que houve, sem culpar um CT que nunca valeu. */
export function replacementAbortedReason(newNumber: number): string {
  return `Encerrado numa substituição que não terminou (o ${contractCode(newNumber)} não chegou a valer)`;
}

// ---------------------------------------------------------------------------
// Regras de edição por status
// ---------------------------------------------------------------------------

export type ContractEditableField =
  | "plan_name"
  | "price_cents"
  | "max_athletes"
  | "billing_cycle"
  | "starts_on"
  | "ends_on"
  | "auto_renew"
  | "signed_on"
  | "signer_name"
  | "signer_role"
  | "terms_version"
  | "notes";

const ALL_EDITABLE_FIELDS: readonly ContractEditableField[] = [
  "plan_name",
  "price_cents",
  "max_athletes",
  "billing_cycle",
  "starts_on",
  "ends_on",
  "auto_renew",
  "signed_on",
  "signer_name",
  "signer_role",
  "terms_version",
  "notes",
];

/**
 * Campos editáveis por status. Encerrado e cancelado são o retrato histórico
 * do que foi combinado: mexer neles reescreveria o passado (e a trilha de
 * auditoria só mostra o que mudou, não restaura). Vigente edita tudo, porque
 * corrigir um erro de digitação no acordo em curso é legítimo — fica na trilha.
 * O clube e a situação nunca se editam aqui: situação muda só por ação própria.
 */
export function editableFields(status: ContractStatus): readonly ContractEditableField[] {
  return status === "rascunho" || status === "vigente" ? ALL_EDITABLE_FIELDS : [];
}

export function isEditable(status: ContractStatus): boolean {
  return editableFields(status).length > 0;
}

/** O documento assinado segue a mesma regra de edição: contrato final é somente leitura. */
export function canChangeDocument(status: ContractStatus): boolean {
  return isEditable(status);
}

/**
 * Renovar cria o rascunho do próximo período. Vale para o vigente (preparar a
 * renovação antes do vencimento) e para o encerrado (renovar depois); rascunho
 * ainda nem começou e cancelado foi desfeito. Sem data de fim não há de onde
 * renovar.
 */
export function canRenew(contract: { status: ContractStatus; ends_on: string | null }): boolean {
  return (contract.status === "vigente" || contract.status === "encerrado") && contract.ends_on !== null;
}

/** Mínimo de letras para o motivo de encerrar/cancelar: "x" não é motivo. */
export const MIN_REASON_LENGTH = 3;

// ---------------------------------------------------------------------------
// Contrato x licença
// ---------------------------------------------------------------------------

/**
 * O que a comparação precisa saber da licença do clube. É um retrato plano (e
 * não o ClubLicense do servidor) para esta regra poder ser pura e testada;
 * lib/platform/licenseSnapshot.ts monta o retrato a partir da linha do clube.
 */
export interface LicenseSnapshot {
  status: ClubStatus;
  /** A licença deixa o clube usar o sistema agora? */
  allowed: boolean;
  courtesyActive: boolean;
  /** Fim da cortesia, "AAAA-MM-DD" (só para a mensagem). */
  courtesyUntil: string | null;
  /** Mensalidade da licença: preço próprio do clube, senão o do plano padrão. */
  priceCents: number;
  /** Cota da licença: própria do clube, senão a do plano padrão. */
  maxAthletes: number;
  /** Cota do plano padrão: é o que vale num contrato sem cota própria. */
  defaultMaxAthletes: number;
  isDemo: boolean;
}

export interface ContractForComparison {
  status: ContractStatus;
  price_cents: number;
  max_athletes: number | null;
  billing_cycle: ContractBillingCycle;
}

export type DivergenceCode =
  | "preco"
  | "cota"
  | "licenca_sem_acesso"
  | "clube_em_teste"
  | "cortesia"
  | "sem_contrato_vigente";

export interface ContractDivergence {
  code: DivergenceCode;
  /** "alerta": cobrança ou acesso errado; "aviso": situação legítima que vale saber. */
  severity: "alerta" | "aviso";
  message: string;
}

const CYCLE_NOUN: Record<ContractBillingCycle, string> = {
  mensal: "mês",
  trimestral: "trimestre",
  semestral: "semestre",
  anual: "ano",
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCivilBR(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Clube que paga (ou está em atraso) e portanto deveria ter contrato vigente. */
export function licenseWithoutActiveContract(license: LicenseSnapshot): ContractDivergence | null {
  if (license.isDemo) return null;
  if (license.status !== "ativo" && license.status !== "atrasado") return null;
  return {
    code: "sem_contrato_vigente",
    severity: "alerta",
    message:
      license.status === "atrasado"
        ? "A licença do clube é paga (em atraso), mas não há contrato vigente registrado."
        : "A licença do clube é paga, mas não há contrato vigente registrado.",
  };
}

/**
 * Onde o registro comercial (contrato) e o que de fato vale (licença) não
 * batem. A licença continua mandando no acesso: isto só ACUSA a diferença,
 * nunca a corrige.
 *
 *  - contrato null: o clube não tem contrato vigente; avisa se a licença é paga.
 *  - vigente: preço, cota e se a licença permite o uso.
 *  - rascunho: só preço e cota (o que mudaria ao ativar).
 *  - encerrado/cancelado: histórico, nada a comparar.
 *
 * O preço compara o equivalente MENSAL do contrato com a mensalidade da
 * licença; contrato anual de R$ 1.200 e licença de R$ 100/mês são o mesmo.
 */
export function compareWithLicense(
  contract: ContractForComparison | null,
  license: LicenseSnapshot,
): ContractDivergence[] {
  if (contract === null) {
    const semContrato = licenseWithoutActiveContract(license);
    return semContrato ? [semContrato] : [];
  }
  if (contract.status === "encerrado" || contract.status === "cancelado") return [];

  const divergences: ContractDivergence[] = [];

  const equivalent = monthlyEquivalentCents(contract.price_cents, contract.billing_cycle);
  if (equivalent !== license.priceCents) {
    const porCiclo =
      contract.billing_cycle === "mensal"
        ? ""
        : ` (${formatBRL(contract.price_cents)} por ${CYCLE_NOUN[contract.billing_cycle]})`;
    divergences.push({
      code: "preco",
      severity: "alerta",
      message: `O contrato vale ${formatBRL(equivalent)} por mês${porCiclo}, mas a licença cobra ${formatBRL(license.priceCents)} por mês.`,
    });
  }

  const contractQuota = contract.max_athletes ?? license.defaultMaxAthletes;
  if (contractQuota !== license.maxAthletes) {
    divergences.push({
      code: "cota",
      severity: "alerta",
      message: `O contrato prevê ${contractQuota} atletas${contract.max_athletes === null ? " (cota padrão da plataforma)" : ""}, mas a licença permite ${license.maxAthletes}.`,
    });
  }

  if (contract.status !== "vigente") return divergences;

  if (!license.allowed) {
    const motivo =
      license.status === "cancelado"
        ? "o clube está cancelado"
        : license.status === "bloqueado"
          ? "o clube está bloqueado"
          : "o teste do clube expirou";
    divergences.push({
      code: "licenca_sem_acesso",
      severity: "alerta",
      message: `O contrato está vigente, mas ${motivo}: a licença não permite o uso do sistema.`,
    });
  } else if (license.courtesyActive) {
    // Cortesia vence tudo na licença (ver getClubLicense), então só avisa — e só
    // faz sentido se o contrato prevê cobrança.
    if (contract.price_cents > 0) {
      const ate = license.courtesyUntil ? ` até ${formatCivilBR(license.courtesyUntil)}` : "";
      divergences.push({
        code: "cortesia",
        severity: "aviso",
        message: `O clube está em cortesia${ate}: o contrato prevê cobrança, mas a licença libera o uso sem cobrar enquanto a cortesia durar.`,
      });
    }
  } else if (license.status === "trial") {
    divergences.push({
      code: "clube_em_teste",
      severity: "alerta",
      message: "O contrato está vigente, mas o clube ainda está em teste: a licença não está cobrando.",
    });
  }

  return divergences;
}
