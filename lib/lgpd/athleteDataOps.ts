import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubAsaasCredentials } from "@/lib/asaas/credentials";
import { cancelSubscription, AsaasError } from "@/lib/asaas/client";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Tabelas com dado pessoal/de desempenho do atleta, sem peso contábil —
 * apagadas por completo na exclusão. `exercise_videos` também cai por
 * cascade quando `exercises` sai, mas apagar os dois explicitamente não
 * tem custo e não depende dessa ordem.
 */
const TABELAS_PESSOAIS_DO_ATLETA = [
  "mental_notes",
  "game_reports",
  "media_items",
  "exercises",
  "exercise_videos",
  "diet_items",
  "checkins",
  "meetings",
  "game_events",
  "athlete_club_transfers",
  "athlete_swot_items",
  "athlete_swot_cycles",
  "game_lineups",
  "athlete_cancellation_requests",
  "athlete_score_snapshots",
  "challenge_submissions",
  "athlete_injuries",
  "athlete_staff_access",
  "athlete_planning_stage",
] as const;

/**
 * Export completo, em JSON — formato estruturado e legível por máquina,
 * o que a LGPD pede pra portabilidade. Mídia não entra como binário no
 * arquivo: entra como link assinado válido por 7 dias, pro export não
 * virar um arquivo gigante e pra não duplicar o storage.
 */
export async function buildAthleteExport(admin: Admin, athleteId: string) {
  const [
    { data: athlete },
    { data: mentalNotes },
    { data: gameReports },
    { data: mediaItems },
    { data: exercises },
    { data: exerciseVideos },
    { data: dietItems },
    { data: checkins },
    { data: meetings },
    { data: gameEvents },
    { data: clubTransfers },
    { data: swotItems },
    { data: swotCycles },
    { data: gameLineups },
    { data: cancellationRequests },
    { data: scoreSnapshots },
    { data: challengeSubmissions },
    { data: injuries },
    { data: charges },
    { data: subscriptions },
  ] = await Promise.all([
    admin.from("athletes").select("*").eq("id", athleteId).single(),
    admin.from("mental_notes").select("*").eq("athlete_id", athleteId),
    admin.from("game_reports").select("*").eq("athlete_id", athleteId),
    admin.from("media_items").select("*").eq("athlete_id", athleteId),
    admin.from("exercises").select("*").eq("athlete_id", athleteId),
    admin.from("exercise_videos").select("*").eq("athlete_id", athleteId),
    admin.from("diet_items").select("*").eq("athlete_id", athleteId),
    admin.from("checkins").select("*").eq("athlete_id", athleteId),
    admin.from("meetings").select("*").eq("athlete_id", athleteId),
    admin.from("game_events").select("*").eq("athlete_id", athleteId),
    admin.from("athlete_club_transfers").select("*").eq("athlete_id", athleteId),
    admin.from("athlete_swot_items").select("*").eq("athlete_id", athleteId),
    admin.from("athlete_swot_cycles").select("*").eq("athlete_id", athleteId),
    admin.from("game_lineups").select("*").eq("athlete_id", athleteId),
    admin.from("athlete_cancellation_requests").select("*").eq("athlete_id", athleteId),
    admin.from("athlete_score_snapshots").select("*").eq("athlete_id", athleteId),
    admin.from("challenge_submissions").select("*").eq("athlete_id", athleteId),
    admin.from("athlete_injuries").select("*").eq("athlete_id", athleteId),
    admin.from("athlete_charges").select("*").eq("athlete_id", athleteId),
    admin.from("athlete_billing_subscriptions").select("*").eq("athlete_id", athleteId),
  ]);

  const mediaPaths = [
    ...(mediaItems ?? []).map((m) => m.storage_path),
    ...(exerciseVideos ?? []).map((v) => v.storage_path),
  ].filter((p): p is string => !!p);
  const midiaLinks: Record<string, string> = {};
  if (mediaPaths.length > 0) {
    const { data: signed } = await admin.storage
      .from("athlete-media")
      .createSignedUrls(mediaPaths, 7 * 24 * 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) midiaLinks[s.path] = s.signedUrl;
    }
  }
  let fotoLink: string | null = null;
  if (athlete?.photo_url) {
    const { data } = await admin.storage
      .from("athlete-photos")
      .createSignedUrl(athlete.photo_url, 7 * 24 * 3600);
    fotoLink = data?.signedUrl ?? null;
  }

  return {
    gerado_em: new Date().toISOString(),
    aviso:
      "Links de mídia válidos por 7 dias a partir da geração. Cobrança recorrente ativa no Asaas não é reproduzida aqui — está sob custódia do Asaas, processador de pagamento do clube.",
    atleta: athlete,
    foto_url_temporaria: fotoLink,
    links_de_midia_temporarios: midiaLinks,
    checkins,
    exercicios: exercises,
    videos_de_exercicio: exerciseVideos,
    dieta: dietItems,
    encontros: meetings,
    notas_mentais: mentalNotes,
    eventos_de_jogo: gameEvents,
    escalacoes: gameLineups,
    relatorios_de_jogo: gameReports,
    midia: mediaItems,
    transferencias_entre_times: clubTransfers,
    ciclos_swot: swotCycles,
    itens_swot: swotItems,
    lesoes: injuries,
    solicitacoes_de_cancelamento: cancellationRequests,
    historico_de_score: scoreSnapshots,
    submissoes_de_desafio: challengeSubmissions,
    cobrancas: charges,
    assinaturas_de_cobranca: subscriptions,
  };
}

/**
 * Exclusão de dados (LGPD): apaga por completo o que é só desempenho/
 * comportamento (sem peso contábil) e ANONIMIZA — nunca apaga a linha —
 * o que tem peso financeiro/auditoria (`athlete_charges`,
 * `athlete_billing_subscriptions`, `audit_log`, e a própria `athletes`).
 * Cancela também qualquer assinatura ativa no Asaas, senão a família
 * seguiria sendo cobrada por um atleta "excluído".
 *
 * Só roda a partir de um clique explícito do treinador — nunca por cron —
 * exatamente para que a confirmação humana exigida pela decisão de
 * produto aconteça de verdade, não vire um checkbox esquecido.
 */
export async function anonymizeAthleteData(
  admin: Admin,
  athleteId: string,
  clubId: string,
): Promise<void> {
  const { data: athlete } = await admin
    .from("athletes")
    .select("photo_url")
    .eq("id", athleteId)
    .single();

  const [{ data: mediaItems }, { data: exerciseVideos }] = await Promise.all([
    admin.from("media_items").select("storage_path").eq("athlete_id", athleteId),
    admin.from("exercise_videos").select("storage_path").eq("athlete_id", athleteId),
  ]);

  const mediaPaths = [
    ...(mediaItems ?? []).map((m) => m.storage_path),
    ...(exerciseVideos ?? []).map((v) => v.storage_path),
  ].filter((p): p is string => !!p);
  if (mediaPaths.length > 0) {
    await admin.storage.from("athlete-media").remove(mediaPaths).catch(() => {});
  }
  if (athlete?.photo_url) {
    await admin.storage.from("athlete-photos").remove([athlete.photo_url]).catch(() => {});
  }

  for (const tabela of TABELAS_PESSOAIS_DO_ATLETA) {
    const { error } = await admin.from(tabela).delete().eq("athlete_id", athleteId);
    if (error) {
      console.error(`[lgpd] falha ao apagar ${tabela} do atleta ${athleteId}:`, error.message);
    }
  }

  // Cancela cobrança recorrente ativa antes de anonimizar — melhor esforço,
  // uma falha aqui não pode travar o resto da exclusão.
  const { data: activeSubs } = await admin
    .from("athlete_billing_subscriptions")
    .select("id, asaas_subscription_id")
    .eq("athlete_id", athleteId)
    .eq("status", "ACTIVE");
  if (activeSubs && activeSubs.length > 0) {
    const creds = await getClubAsaasCredentials(clubId).catch(() => null);
    if (creds) {
      for (const sub of activeSubs) {
        try {
          await cancelSubscription(creds, sub.asaas_subscription_id);
        } catch (e) {
          if (!(e instanceof AsaasError && e.status === 404)) {
            console.error(`[lgpd] falha ao cancelar assinatura ${sub.asaas_subscription_id}:`, e);
          }
        }
      }
    }
  }
  await admin
    .from("athlete_billing_subscriptions")
    .update({ status: "INACTIVE", checkout_url: null })
    .eq("athlete_id", athleteId);

  await admin.from("athlete_charges").update({ notes: null }).eq("athlete_id", athleteId);

  await admin
    .from("audit_log")
    .update({ details: { anonimizado: true, motivo: "Exclusão de dados (LGPD)" } })
    .eq("athlete_id", athleteId);

  await admin
    .from("athlete_enrollment_requests")
    .update({
      full_name: "Atleta removido (LGPD)",
      guardian_name: "Removido (LGPD)",
      guardian_cpf: "00000000000",
      guardian_email: "removido@lgpd.local",
      guardian_phone: null,
      instagram: null,
    })
    .eq("created_athlete_id", athleteId);

  const placeholder = `Atleta removido (LGPD) — ${athleteId.slice(0, 8)}`;
  await admin
    .from("athletes")
    .update({
      full_name: placeholder,
      guardian_name: null,
      guardian_phone: null,
      guardian_cpf: null,
      guardian_email: null,
      athlete_phone: null,
      instagram: null,
      photo_url: null,
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivation_reason: "Exclusão de dados solicitada (LGPD)",
    })
    .eq("id", athleteId);

  const { data: loginProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("role", "athlete")
    .maybeSingle();
  if (loginProfile) {
    await admin.from("profiles").delete().eq("id", loginProfile.id);
    await admin.auth.admin.deleteUser(loginProfile.id).catch(() => {});
  }
}
