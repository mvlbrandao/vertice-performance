"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { logPlatformAction } from "@/lib/platform/audit";
import { successResult, type PlatformActionResult } from "@/lib/platform/auditNotice";
import { revalidateAdmin } from "@/lib/platform/revalidate";
import { isMissingFunction, isMissingRelation, type ClubContractRow } from "@/lib/platform/contracts";
import { contractChanges, truncateForAudit } from "@/lib/platform/contractAudit";
import {
  BUCKET_MISSING_MESSAGE,
  CONTRACT_BUCKET,
  MAX_DOCUMENT_BYTES,
  buildDocumentPath,
  documentDownloadName,
  isBucketMissingError,
  isInContractFolder,
  isOwnDocumentPath,
  validateUploadedObject,
} from "@/lib/platform/contractDocumentPath";
import {
  canChangeDocument,
  canRenew,
  canTransition,
  contractCode,
  editableFields,
  isEditable,
  nextPeriodAfter,
  replacedReason,
  replacementAbortedReason,
  replacementPendingReason,
} from "@/lib/platform/contractRules";
import {
  activateContractSchema,
  cancelContractSchema,
  closeContractSchema,
  confirmDocumentSchema,
  contractIdSchema,
  createContractSchema,
  formDataToRecord,
  renewContractSchema,
  summarizeIssues,
  updateContractSchema,
  type ContractActionResult,
  type ContractDocumentLink,
  type ContractUploadTicket,
} from "@/lib/platform/contractSchema";

/**
 * Ações do módulo de contratos (/admin/contratos). Todas começam por
 * requirePlatformAdmin(): uma server action é um endpoint POST que dispensa a
 * página, então o portão não pode ficar só no layout.
 *
 * Contrato (docs/ADMIN.md): muta, grava a trilha DEPOIS com await, repassa o
 * booleano a successResult e revalida. A trilha que falha não desfaz a ação,
 * mas a tela avisa.
 *
 * O arquivo só exporta funções assíncronas (regra do "use server"); os tipos
 * de resultado moram em lib/platform/contractSchema.ts.
 */

type Admin = ReturnType<typeof createAdminClient>;

const MIGRATION_PENDING =
  "A tabela de contratos ainda não existe no banco (migração 0073 pendente).";
const NOT_FOUND = "Contrato não encontrado.";
const CHANGED_MEANWHILE =
  "O contrato mudou de situação enquanto você trabalhava. Atualize a página e tente de novo.";

interface DbError {
  code?: string;
  message?: string;
}

/** Erro do banco em português. O bruto vai para o log do servidor, não para a tela. */
function friendlyDbError(error: DbError, fallback: string): string {
  if (isMissingRelation(error)) return MIGRATION_PENDING;
  if (error.code === "23505" && /one_active_per_club/.test(error.message ?? "")) {
    // O índice único parcial é a trava de verdade contra dois vigentes: a
    // checagem em código tem janela de corrida entre ler e gravar.
    return "Este clube já tem um contrato vigente (outra alteração aconteceu ao mesmo tempo). Atualize a página e tente de novo.";
  }
  if (error.code === "23514") return "Período inválido: o fim não pode ser anterior ao início.";
  if (error.code === "23503") return "Clube não encontrado.";
  console.error(`[contratos] ${fallback}:`, error.message);
  return `${fallback} Detalhe: ${error.message ?? "erro desconhecido"}.`;
}

function withWarning<T extends PlatformActionResult>(result: T, extra: string | null): T {
  if (!extra) return result;
  return { ...result, warning: result.warning ? `${result.warning} ${extra}` : extra };
}

/** Os campos editáveis de uma linha, no formato que a trilha compara. */
function editableSnapshot(row: ClubContractRow, includeStatus = false): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const field of editableFields("rascunho")) snapshot[field] = row[field];
  if (includeStatus) snapshot.status = row.status;
  return snapshot;
}

type Loaded =
  | { ok: true; contract: ClubContractRow; club: { id: string; name: string | null } }
  | { ok: false; error: string };

/** Contrato + clube (nome para a trilha). Falhas viram mensagem, nunca exceção. */
async function loadContract(admin: Admin, contractId: string): Promise<Loaded> {
  const { data, error } = await admin
    .from("club_contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error, "Não foi possível ler o contrato.") };
  if (!data) return { ok: false, error: NOT_FOUND };

  const { data: club } = await admin.from("clubs").select("id, name").eq("id", data.club_id).maybeSingle();
  return { ok: true, contract: data, club: { id: data.club_id, name: club?.name ?? null } };
}

async function findActiveContract(
  admin: Admin,
  clubId: string,
): Promise<{ current: { id: string; number: number } | null; error?: string }> {
  const { data, error } = await admin
    .from("club_contracts")
    .select("id, number")
    .eq("club_id", clubId)
    .eq("status", "vigente")
    .maybeSingle();
  if (error) return { current: null, error: friendlyDbError(error, "Não foi possível ler os contratos do clube.") };
  return { current: data ?? null };
}

interface ActivationOutcome {
  error?: string;
  needsReplaceConfirmation?: { currentNumber: number };
  recorded?: boolean;
  /** A ativação deu certo, mas há algo que a pessoa precisa saber. */
  warning?: string;
}

/** Devolve a vigência ao contrato que acabou de ser encerrado numa troca. false = não deu. */
async function reopenReplaced(admin: Admin, contractId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("club_contracts")
    .update({ status: "vigente", closed_at: null, closed_reason: null, updated_at: new Date().toISOString() })
    .eq("id", contractId)
    .eq("status", "encerrado")
    .select("id");
  return !error && !!data && data.length > 0;
}

/**
 * Troca o motivo provisório do contrato antigo por outro. O filtro por
 * `closed_reason` garante que só se mexe no marcador que esta troca gravou:
 * nunca se sobrescreve um motivo escrito por uma pessoa. Não toca em `status`,
 * então não esbarra no índice único.
 */
async function swapReplacedReason(
  admin: Admin,
  contractId: string,
  from: string,
  to: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("club_contracts")
    .update({ closed_reason: to, updated_at: new Date().toISOString() })
    .eq("id", contractId)
    .eq("status", "encerrado")
    .eq("closed_reason", from)
    .select("id");
  return !error && !!data && data.length > 0;
}

/**
 * Trilha de uma ativação: contract.activate e, se houve troca, contract.close do
 * antigo. Compartilhada pelos dois caminhos (função atômica e sequencial) para a
 * trilha ser idêntica não importa por qual deles a troca aconteceu.
 */
async function recordActivation(
  club: { id: string; name: string | null },
  contract: { id: string; number: number },
  replaced: { id: string; number: number } | null,
): Promise<boolean> {
  const clubRef = { id: club.id, name: club.name };
  let recorded = await logPlatformAction({
    action: "contract.activate",
    club: clubRef,
    details: {
      contractId: contract.id,
      number: contract.number,
      ...(replaced ? { replaces: replaced.number } : {}),
      changes: contractChanges({ status: "rascunho" }, { status: "vigente" }),
    },
  });
  if (replaced) {
    const closedRecorded = await logPlatformAction({
      action: "contract.close",
      club: clubRef,
      details: {
        contractId: replaced.id,
        number: replaced.number,
        reason: replacedReason(contract.number),
        replacedBy: contract.number,
        changes: contractChanges({ status: "vigente" }, { status: "encerrado" }),
      },
    });
    recorded = recorded && closedRecorded;
  }
  return recorded;
}

/** Resposta de platform_activate_contract (migração 0076). */
type ActivateFunctionResult =
  | { ok: true; replaced_id: string | null; replaced_number: number | null }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "not_draft" }
  | { ok: false; code: "has_active"; active_id: string; active_number: number };

/**
 * Ativa pela função SQL transacional (0076): encerrar o vigente antigo e ativar
 * o novo acontecem juntos ou nenhum acontece, e duas ativações simultâneas no
 * mesmo clube são serializadas no banco. É o caminho principal. Devolve
 * "indisponivel" quando a função não existe (ambiente sem a 0076), e aí quem
 * chama usa o caminho sequencial.
 */
async function activateViaFunction(
  admin: Admin,
  contract: { id: string; number: number },
  club: { id: string; name: string | null },
  replace: boolean,
): Promise<ActivationOutcome | "indisponivel"> {
  const { data, error } = await admin.rpc("platform_activate_contract", {
    p_contract_id: contract.id,
    p_replace: replace,
  });

  if (error) {
    if (isMissingFunction(error)) return "indisponivel";
    return { error: friendlyDbError(error, `Não foi possível ativar o ${contractCode(contract.number)}.`) };
  }

  const result = data as ActivateFunctionResult | null;
  if (!result || typeof result !== "object") {
    return { error: `Não foi possível ativar o ${contractCode(contract.number)}: resposta inesperada do banco.` };
  }
  if (!result.ok) {
    if (result.code === "has_active") {
      return {
        error: `O clube já tem o contrato ${contractCode(result.active_number)} vigente. Confirme a substituição para continuar.`,
        needsReplaceConfirmation: { currentNumber: result.active_number },
      };
    }
    return { error: result.code === "not_found" ? NOT_FOUND : CHANGED_MEANWHILE };
  }

  const replaced =
    result.replaced_id && result.replaced_number !== null
      ? { id: result.replaced_id, number: result.replaced_number }
      : null;
  return { recorded: await recordActivation(club, contract, replaced) };
}

/** Rascunho -> vigente: pela função atômica, ou pelo caminho sequencial se ela não existir. */
async function activateRow(
  admin: Admin,
  contract: { id: string; number: number },
  club: { id: string; name: string | null },
  replace: boolean,
): Promise<ActivationOutcome> {
  const viaFunction = await activateViaFunction(admin, contract, club, replace);
  if (viaFunction !== "indisponivel") return viaFunction;
  return activateRowSequential(admin, contract, club, replace);
}

/**
 * PLANO B (sem a função da 0076). Rascunho -> vigente. Se o clube já tem outro vigente, só troca quando o
 * chamador confirmou: encerra o antigo (closed_at) e ativa o novo.
 *
 * Não existe transação aqui (PostgREST faz uma chamada por vez) e o índice
 * único proíbe dois vigentes ao mesmo tempo, então a ordem é obrigatória:
 * encerrar o antigo, ativar o novo e, se a ativação falhar, REABRIR o antigo.
 * A trava de verdade é o índice único: se alguém criou outro vigente no meio
 * do caminho, a ativação volta 23505 e vira mensagem amigável.
 *
 * O que dá para evitar sem transação é gravar uma mentira. O antigo é
 * encerrado com um motivo PROVISÓRIO ("... em andamento") e só recebe o
 * definitivo ("Substituído pelo CT-n") depois que o novo está vigente. Assim,
 * se o processo cair entre as duas gravações, ou a ativação falhar e a
 * reabertura também, o antigo não afirma uma troca que nunca aconteceu.
 * O conserto definitivo é uma função SQL transacional (migração; ver
 * docs/ADMIN.md).
 */
async function activateRowSequential(
  admin: Admin,
  contract: { id: string; number: number },
  club: { id: string; name: string | null },
  replace: boolean,
): Promise<ActivationOutcome> {
  const lookup = await findActiveContract(admin, club.id);
  if (lookup.error) return { error: lookup.error };

  const current = lookup.current && lookup.current.id !== contract.id ? lookup.current : null;
  const now = new Date().toISOString();
  const finalReason = replacedReason(contract.number);
  const pendingReason = replacementPendingReason(contract.number);

  if (current) {
    if (!replace) {
      return {
        error: `O clube já tem o contrato ${contractCode(current.number)} vigente. Confirme a substituição para continuar.`,
        needsReplaceConfirmation: { currentNumber: current.number },
      };
    }
    const { data: closed, error: closeError } = await admin
      .from("club_contracts")
      .update({ status: "encerrado", closed_at: now, closed_reason: pendingReason, updated_at: now })
      .eq("id", current.id)
      .eq("status", "vigente")
      .select("id");
    if (closeError) {
      return { error: friendlyDbError(closeError, `Não foi possível encerrar o ${contractCode(current.number)}.`) };
    }
    if (!closed || closed.length === 0) return { error: CHANGED_MEANWHILE };
  }

  const { data: activated, error: activateError } = await admin
    .from("club_contracts")
    .update({ status: "vigente", closed_at: null, closed_reason: null, updated_at: now })
    .eq("id", contract.id)
    .eq("status", "rascunho")
    .select("id");

  if (activateError || !activated || activated.length === 0) {
    const base = activateError
      ? friendlyDbError(activateError, `Não foi possível ativar o ${contractCode(contract.number)}.`)
      : CHANGED_MEANWHILE;
    if (!current) return { error: base };

    // Devolve a vigência ao antigo: sem isto o clube ficaria sem contrato vigente.
    if (await reopenReplaced(admin, current.id)) return { error: base };

    console.error(
      `[contratos] ativação do ${contractCode(contract.number)} falhou e o ${contractCode(current.number)} não pôde ser reaberto.`,
    );
    // O antigo ficou encerrado: o motivo provisório vira o que de fato houve (o
    // novo nunca valeu) e a mudança de situação entra na trilha, que de outro
    // modo não saberia dela.
    const abortedReason = replacementAbortedReason(contract.number);
    await swapReplacedReason(admin, current.id, pendingReason, abortedReason);
    const trailed = await logPlatformAction({
      action: "contract.close",
      club,
      details: {
        contractId: current.id,
        number: current.number,
        reason: abortedReason,
        changes: contractChanges({ status: "vigente" }, { status: "encerrado" }),
      },
    });
    return {
      error:
        `${base} ATENÇÃO: o ${contractCode(current.number)} foi encerrado e não pôde ser reaberto ` +
        `(o ${contractCode(contract.number)} não foi ativado); confira o clube.` +
        (trailed ? "" : " O encerramento também não ficou na trilha de auditoria."),
    };
  }

  let warning: string | undefined;
  if (current && !(await swapReplacedReason(admin, current.id, pendingReason, finalReason))) {
    console.error(`[contratos] o motivo provisório do ${contractCode(current.number)} não pôde ser trocado pelo definitivo.`);
    warning = `Substituição feita, mas o motivo do ${contractCode(current.number)} continua como "${pendingReason}".`;
  }

  return { recorded: await recordActivation(club, contract, current), warning };
}

// ---------------------------------------------------------------------------
// Criar, editar, mudar de situação
// ---------------------------------------------------------------------------

/** Cria o contrato como rascunho, ou já vigente (cria o rascunho e o ativa em seguida). */
export async function createContract(formData: FormData): Promise<ContractActionResult> {
  const adminUser = await requirePlatformAdmin();

  const parsed = createContractSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) return summarizeIssues(parsed.error);
  const { clubId, status, replace, fields } = parsed.data;

  const admin = createAdminClient();
  const { data: club, error: clubError } = await admin
    .from("clubs")
    .select("id, name")
    .eq("id", clubId)
    .maybeSingle();
  if (clubError) return { error: friendlyDbError(clubError, "Não foi possível ler o clube.") };
  if (!club) return { error: "Clube não encontrado.", fieldErrors: { clubId: "Clube não encontrado." } };

  // Pergunta antes de gravar qualquer coisa: criar o rascunho e só depois descobrir
  // que precisa de confirmação deixaria um contrato órfão a cada tentativa.
  if (status === "vigente" && !replace) {
    const lookup = await findActiveContract(admin, clubId);
    if (lookup.error) return { error: lookup.error };
    if (lookup.current) {
      return {
        error: `O clube já tem o contrato ${contractCode(lookup.current.number)} vigente. Confirme a substituição para continuar.`,
        needsReplaceConfirmation: { currentNumber: lookup.current.number },
      };
    }
  }

  const { data: created, error: insertError } = await admin
    .from("club_contracts")
    .insert({ club_id: clubId, status: "rascunho", ...fields, created_by_email: adminUser.email })
    .select("id, number")
    .single();
  if (insertError || !created) {
    return { error: friendlyDbError(insertError ?? {}, "Não foi possível criar o contrato.") };
  }

  let warning: string | null = null;
  let recorded = await logPlatformAction({
    action: "contract.create",
    club,
    details: {
      contractId: created.id,
      number: created.number,
      changes: contractChanges({}, { status: "rascunho", ...fields }),
    },
  });

  if (status === "vigente") {
    const outcome = await activateRow(admin, created, club, replace);
    revalidateAdmin();
    if (outcome.error) {
      // O rascunho existe e fica de pé; a tela leva até ele para a pessoa tentar de novo.
      return {
        error: `${contractCode(created.number)} criado como rascunho, mas não foi possível ativá-lo: ${outcome.error}`,
        contractId: created.id,
        needsReplaceConfirmation: outcome.needsReplaceConfirmation,
      };
    }
    recorded = recorded && (outcome.recorded ?? true);
    warning = outcome.warning ?? null;
  }

  revalidateAdmin();
  return withWarning({ ...successResult(recorded), contractId: created.id }, warning);
}

/** Edita rascunho ou vigente. Encerrado e cancelado são somente leitura. */
export async function updateContract(formData: FormData): Promise<ContractActionResult> {
  await requirePlatformAdmin();

  const parsed = updateContractSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) return summarizeIssues(parsed.error);
  const { contractId, fields } = parsed.data;

  const admin = createAdminClient();
  const loaded = await loadContract(admin, contractId);
  if (!loaded.ok) return { error: loaded.error };
  const { contract, club } = loaded;

  if (!isEditable(contract.status)) {
    return {
      error: `O ${contractCode(contract.number)} está ${contract.status} e é somente leitura.`,
    };
  }

  // Salvar sem mexer em nada não é mudança: não polui a trilha.
  const changes = contractChanges(editableSnapshot(contract), { ...fields });
  if (Object.keys(changes).length === 0) return { success: true, contractId };

  const { data: updated, error } = await admin
    .from("club_contracts")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", contract.id)
    // A situação pode ter mudado depois da leitura: não edita o que acabou de virar histórico.
    .in("status", ["rascunho", "vigente"])
    .select("id");
  if (error) return { error: friendlyDbError(error, "Não foi possível salvar o contrato.") };
  if (!updated || updated.length === 0) return { error: CHANGED_MEANWHILE };

  const recorded = await logPlatformAction({
    action: "contract.update",
    club,
    details: { contractId: contract.id, number: contract.number, changes },
  });

  revalidateAdmin();
  return { ...successResult(recorded), contractId };
}

/**
 * Rascunho -> vigente. Se o clube já tem um vigente, recusa com
 * `needsReplaceConfirmation` até o chamador repetir com replace=true.
 */
export async function activateContract(formData: FormData): Promise<ContractActionResult> {
  await requirePlatformAdmin();

  const parsed = activateContractSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) return summarizeIssues(parsed.error);

  const admin = createAdminClient();
  const loaded = await loadContract(admin, parsed.data.contractId);
  if (!loaded.ok) return { error: loaded.error };
  const { contract, club } = loaded;

  if (!canTransition(contract.status, "vigente")) {
    return { error: `Só rascunho pode ser ativado; o ${contractCode(contract.number)} está ${contract.status}.` };
  }

  const outcome = await activateRow(admin, contract, club, parsed.data.replace);
  if (outcome.error) {
    return { error: outcome.error, needsReplaceConfirmation: outcome.needsReplaceConfirmation };
  }

  revalidateAdmin();
  return withWarning(successResult(outcome.recorded ?? true), outcome.warning ?? null);
}

async function finishContract(
  formData: FormData,
  kind: "encerrado" | "cancelado",
): Promise<ContractActionResult> {
  const schema = kind === "encerrado" ? closeContractSchema : cancelContractSchema;
  const parsed = schema.safeParse(formDataToRecord(formData));
  if (!parsed.success) return summarizeIssues(parsed.error);
  const { contractId, reason } = parsed.data;

  const admin = createAdminClient();
  const loaded = await loadContract(admin, contractId);
  if (!loaded.ok) return { error: loaded.error };
  const { contract, club } = loaded;

  if (!canTransition(contract.status, kind)) {
    return {
      error:
        kind === "encerrado"
          ? `Só contrato vigente pode ser encerrado; o ${contractCode(contract.number)} está ${contract.status}.`
          : `Só rascunho ou contrato vigente pode ser cancelado; o ${contractCode(contract.number)} está ${contract.status}.`,
    };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("club_contracts")
    .update({ status: kind, closed_at: now, closed_reason: reason, updated_at: now })
    .eq("id", contract.id)
    .eq("status", contract.status)
    .select("id");
  if (error) {
    return { error: friendlyDbError(error, `Não foi possível ${kind === "encerrado" ? "encerrar" : "cancelar"} o contrato.`) };
  }
  if (!updated || updated.length === 0) return { error: CHANGED_MEANWHILE };

  const recorded = await logPlatformAction({
    action: kind === "encerrado" ? "contract.close" : "contract.cancel",
    club,
    details: {
      contractId: contract.id,
      number: contract.number,
      // Texto livre e a trilha é imutável: o motivo inteiro fica em closed_reason,
      // que se corrige e se apaga com o clube; aqui só o começo (como as notas).
      reason: truncateForAudit(reason),
      changes: contractChanges({ status: contract.status }, { status: kind }),
    },
  });

  revalidateAdmin();
  return successResult(recorded);
}

/** Vigente -> encerrado. Motivo obrigatório. */
export async function closeContract(formData: FormData): Promise<ContractActionResult> {
  await requirePlatformAdmin();
  return finishContract(formData, "encerrado");
}

/** Rascunho ou vigente -> cancelado. Motivo obrigatório. */
export async function cancelContract(formData: FormData): Promise<ContractActionResult> {
  await requirePlatformAdmin();
  return finishContract(formData, "cancelado");
}

/**
 * Cria o RASCUNHO do próximo período (começa no dia seguinte ao fim do atual,
 * mesmo ciclo). Não ativa nada: a renovação só vale quando a pessoa revisar e
 * ativar, e aí o contrato que acabou é encerrado na substituição.
 */
export async function renewContract(formData: FormData): Promise<ContractActionResult> {
  const adminUser = await requirePlatformAdmin();

  const parsed = renewContractSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) return summarizeIssues(parsed.error);

  const admin = createAdminClient();
  const loaded = await loadContract(admin, parsed.data.contractId);
  if (!loaded.ok) return { error: loaded.error };
  const { contract, club } = loaded;

  if (!canRenew(contract)) {
    return {
      error:
        contract.status === "vigente" || contract.status === "encerrado"
          ? `O ${contractCode(contract.number)} tem prazo indeterminado: não há fim a partir do qual renovar.`
          : `Só contrato vigente ou encerrado pode ser renovado; o ${contractCode(contract.number)} está ${contract.status}.`,
    };
  }
  const next = nextPeriodAfter(contract);
  if (!next) return { error: "Não foi possível calcular o período da renovação." };

  // Duas renovações do mesmo contrato (duplo clique, ou outra aba) criariam dois
  // rascunhos para o mesmo período.
  const { data: existing, error: existingError } = await admin
    .from("club_contracts")
    .select("number, status")
    .eq("club_id", contract.club_id)
    .eq("starts_on", next.starts_on)
    .in("status", ["rascunho", "vigente"]);
  if (existingError) return { error: friendlyDbError(existingError, "Não foi possível conferir as renovações.") };
  if (existing && existing.length > 0) {
    return {
      error: `Já existe o ${contractCode(existing[0].number)} (${existing[0].status}) começando em ${next.starts_on.split("-").reverse().join("/")}.`,
    };
  }

  const renewal: Pick<
    ClubContractRow,
    "plan_name" | "price_cents" | "max_athletes" | "billing_cycle" | "starts_on" | "ends_on" | "auto_renew" | "terms_version" | "notes"
  > = {
    plan_name: contract.plan_name,
    price_cents: contract.price_cents,
    max_athletes: contract.max_athletes,
    billing_cycle: next.billing_cycle,
    starts_on: next.starts_on,
    ends_on: next.ends_on,
    auto_renew: contract.auto_renew,
    terms_version: contract.terms_version,
    notes: `Renovação do ${contractCode(contract.number)}.`,
  };

  const { data: created, error } = await admin
    .from("club_contracts")
    .insert({ club_id: contract.club_id, status: "rascunho", ...renewal, created_by_email: adminUser.email })
    .select("id, number")
    .single();
  if (error || !created) return { error: friendlyDbError(error ?? {}, "Não foi possível criar a renovação.") };

  const recorded = await logPlatformAction({
    action: "contract.renew",
    club,
    details: {
      contractId: created.id,
      number: created.number,
      renewedFrom: contract.number,
      changes: contractChanges({}, { status: "rascunho", ...renewal }),
    },
  });

  revalidateAdmin();
  return { ...successResult(recorded), contractId: created.id };
}

// ---------------------------------------------------------------------------
// Documento assinado (PDF, bucket privado club-contracts)
// ---------------------------------------------------------------------------

/** Apaga sem nunca lançar: arquivo órfão num bucket privado é lixo, não risco, e não pode mascarar o resultado da ação. */
async function removeQuietly(
  storage: ReturnType<Admin["storage"]["from"]>,
  paths: string[],
): Promise<boolean> {
  try {
    const { error } = await storage.remove(paths);
    if (error) {
      console.warn("[contratos] não foi possível apagar do armazenamento:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[contratos] erro ao apagar do armazenamento:", (e as Error).message);
    return false;
  }
}

/**
 * Passo 1 do envio: devolve a URL assinada de upload para o NAVEGADOR enviar o
 * PDF direto ao storage. O arquivo não passa pela action (o corpo de uma
 * server action é limitado a 1 MB). O caminho é montado AQUI, com o clube e o
 * contrato lidos do banco e um uuid novo: nada que venha do cliente entra nele.
 */
export async function requestContractDocumentUpload(contractId: string): Promise<ContractUploadTicket> {
  await requirePlatformAdmin();

  const parsed = contractIdSchema.safeParse({ contractId });
  if (!parsed.success) return summarizeIssues(parsed.error);

  const admin = createAdminClient();
  const loaded = await loadContract(admin, parsed.data.contractId);
  if (!loaded.ok) return { error: loaded.error };
  const { contract } = loaded;

  if (!canChangeDocument(contract.status)) {
    return { error: `O ${contractCode(contract.number)} está ${contract.status} e é somente leitura.` };
  }

  const path = buildDocumentPath(contract.club_id, contract.id, crypto.randomUUID());
  const { data, error } = await admin.storage.from(CONTRACT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return {
      error: isBucketMissingError(error)
        ? BUCKET_MISSING_MESSAGE
        : "Não foi possível preparar o envio do arquivo. Tente de novo.",
    };
  }

  return { success: true, upload: { path, token: data.token, maxBytes: MAX_DOCUMENT_BYTES } };
}

/**
 * Passo 2: depois que o navegador enviou, confere NO STORAGE que o objeto
 * existe, é PDF e cabe em 10 MB, e só então grava document_path. O caminho
 * volta do navegador, por isso é revalidado contra o prefixo certo
 * ({club_id}/{contract_id}/{uuid}.pdf) antes de qualquer coisa.
 */
export async function confirmContractDocument(
  contractId: string,
  path: string,
): Promise<PlatformActionResult> {
  await requirePlatformAdmin();

  const parsed = confirmDocumentSchema.safeParse({ contractId, path });
  if (!parsed.success) return summarizeIssues(parsed.error);

  const admin = createAdminClient();
  const loaded = await loadContract(admin, parsed.data.contractId);
  if (!loaded.ok) return { error: loaded.error };
  const { contract, club } = loaded;

  if (!canChangeDocument(contract.status)) {
    return { error: `O ${contractCode(contract.number)} está ${contract.status} e é somente leitura.` };
  }
  if (!isOwnDocumentPath(parsed.data.path, contract.club_id, contract.id)) {
    return { error: "Arquivo inválido. Envie o PDF de novo." };
  }

  const storage = admin.storage.from(CONTRACT_BUCKET);
  const { data: info, error: infoError } = await storage.info(parsed.data.path);
  if (infoError || !info) {
    return {
      error: isBucketMissingError(infoError)
        ? BUCKET_MISSING_MESSAGE
        : "Não encontramos o arquivo enviado. Envie o PDF de novo.",
    };
  }

  const problem = validateUploadedObject({ size: info.size ?? null, contentType: info.contentType ?? null });
  if (problem) {
    // Um objeto recusado não pode ficar no bucket sem dono.
    await removeQuietly(storage, [parsed.data.path]);
    return { error: problem };
  }

  const previous = contract.document_path;
  const { data: updated, error } = await admin
    .from("club_contracts")
    .update({ document_path: parsed.data.path, updated_at: new Date().toISOString() })
    .eq("id", contract.id)
    .in("status", ["rascunho", "vigente"])
    .select("id");
  if (error || !updated || updated.length === 0) {
    await removeQuietly(storage, [parsed.data.path]);
    return { error: error ? friendlyDbError(error, "Não foi possível anexar o documento.") : CHANGED_MEANWHILE };
  }

  // Só apaga o anterior se ele vive na pasta deste contrato: um document_path
  // adulterado não pode virar a exclusão de um arquivo de outro clube.
  const previousRemoved =
    previous && previous !== parsed.data.path && isInContractFolder(previous, contract.club_id, contract.id)
      ? await removeQuietly(storage, [previous])
      : true;

  const recorded = await logPlatformAction({
    action: "contract.document_attach",
    club,
    details: {
      contractId: contract.id,
      number: contract.number,
      replaced: previous !== null,
      sizeBytes: info.size ?? null,
      changes: contractChanges({ document_path: previous }, { document_path: parsed.data.path }),
    },
  });

  revalidateAdmin();
  return withWarning(
    successResult(recorded),
    previousRemoved ? null : "O documento novo foi anexado, mas o arquivo anterior não pôde ser apagado do armazenamento.",
  );
}

/** Desvincula o documento e apaga o arquivo. O vínculo sai primeiro: arquivo órfão é lixo, vínculo para arquivo inexistente é link quebrado. */
export async function removeContractDocument(contractId: string): Promise<PlatformActionResult> {
  await requirePlatformAdmin();

  const parsed = contractIdSchema.safeParse({ contractId });
  if (!parsed.success) return summarizeIssues(parsed.error);

  const admin = createAdminClient();
  const loaded = await loadContract(admin, parsed.data.contractId);
  if (!loaded.ok) return { error: loaded.error };
  const { contract, club } = loaded;

  if (!canChangeDocument(contract.status)) {
    return { error: `O ${contractCode(contract.number)} está ${contract.status} e é somente leitura.` };
  }
  const path = contract.document_path;
  if (!path) return { error: "Este contrato não tem documento anexado." };

  const { data: updated, error } = await admin
    .from("club_contracts")
    .update({ document_path: null, updated_at: new Date().toISOString() })
    .eq("id", contract.id)
    .in("status", ["rascunho", "vigente"])
    .select("id");
  if (error) return { error: friendlyDbError(error, "Não foi possível remover o documento.") };
  if (!updated || updated.length === 0) return { error: CHANGED_MEANWHILE };

  const fileRemoved = isInContractFolder(path, contract.club_id, contract.id)
    ? await removeQuietly(admin.storage.from(CONTRACT_BUCKET), [path])
    : false;

  const recorded = await logPlatformAction({
    action: "contract.document_remove",
    club,
    details: {
      contractId: contract.id,
      number: contract.number,
      changes: contractChanges({ document_path: path }, { document_path: null }),
    },
  });

  revalidateAdmin();
  return withWarning(
    successResult(recorded),
    fileRemoved ? null : "O documento foi desvinculado, mas o arquivo não pôde ser apagado do armazenamento.",
  );
}

const DOWNLOAD_NOT_RECORDED_WARNING =
  "Download liberado, mas NÃO foi registrado na trilha de auditoria. Confira se a migração 0072 foi aplicada e veja o log do servidor.";

/**
 * Link de download que expira em 60 segundos, gerado só depois de checar o
 * administrador. O PDF traz preço, signatário e termos, e a trilha é o único
 * controle detetivo da conta de administrador: cada link emitido fica
 * registrado. Depois de gerar o link, para não anotar download que não houve;
 * e se a anotação falhar o link sai mesmo assim, com aviso (é leitura: não há
 * o que desfazer).
 */
export async function getContractDocumentUrl(contractId: string): Promise<ContractDocumentLink> {
  await requirePlatformAdmin();

  const parsed = contractIdSchema.safeParse({ contractId });
  if (!parsed.success) return { error: summarizeIssues(parsed.error).error };

  const admin = createAdminClient();
  const loaded = await loadContract(admin, parsed.data.contractId);
  if (!loaded.ok) return { error: loaded.error };
  const { contract, club } = loaded;

  const path = contract.document_path;
  if (!path) return { error: "Este contrato não tem documento anexado." };
  // A service role lê o bucket inteiro: um document_path fora da pasta do
  // contrato (adulterado, ou gravado à mão) nunca vira link.
  if (!isInContractFolder(path, contract.club_id, contract.id)) {
    return { error: "O caminho do documento é inválido. Anexe o PDF de novo." };
  }

  const { data, error } = await admin.storage
    .from(CONTRACT_BUCKET)
    .createSignedUrl(path, 60, { download: documentDownloadName(contract.number) });
  if (error || !data) {
    if (isBucketMissingError(error)) return { error: BUCKET_MISSING_MESSAGE };
    return { error: "Não foi possível gerar o link do documento. O arquivo pode ter sido apagado do armazenamento." };
  }

  const recorded = await logPlatformAction({
    action: "contract.document_download",
    club,
    details: { contractId: contract.id, number: contract.number },
  });
  return recorded ? { url: data.signedUrl } : { url: data.signedUrl, warning: DOWNLOAD_NOT_RECORDED_WARNING };
}
