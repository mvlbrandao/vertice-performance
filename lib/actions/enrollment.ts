"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAthleteUsage } from "@/lib/platform/license";
import { logAudit } from "@/lib/actions/auditLog";
import { isValidCpf, onlyDigits } from "@/lib/utils/cpf";
import { sendPushToClubCoaches } from "@/lib/push/send";
import type { ActionResult } from "@/lib/actions/athletes";

const enrollmentSchema = z.object({
  slug: z.string().trim().min(1),
  fullName: z.string().trim().min(2, "Informe o nome completo do atleta."),
  birthDate: z.string().min(1, "Informe a data de nascimento."),
  sex: z.enum(["M", "F"]).optional(),
  team: z.string().trim().optional(),
  category: z.string().trim().optional(),
  guardianName: z.string().trim().min(2, "Informe o nome do responsável."),
  guardianCpf: z.string().refine(isValidCpf, "CPF do responsável inválido."),
  guardianEmail: z.string().trim().email("E-mail do responsável inválido."),
  guardianPhone: z.string().trim().optional(),
  instagram: z.string().trim().optional(),
  consent: z.string().optional(),
  website: z.string().optional(),
});

/**
 * Limite por IP pro formulário público de matrícula, no mesmo espírito do
 * cadastro público de clube (lib/actions/signup.ts). Sem captcha no
 * projeto até hoje — em vez de introduzir uma dependência nova (chave de
 * site, script externo), reaproveita o padrão já validado: teto por IP nas
 * últimas 24h, mais o campo-armadilha abaixo. Teto mais alto que o do
 * cadastro de clube (3) porque uma família pode legitimamente inscrever
 * mais de um filho.
 */
async function excedeuLimiteMatricula(admin: ReturnType<typeof createAdminClient>): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return false;

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("athlete_enrollment_requests")
    .select("id", { count: "exact", head: true })
    .eq("submitter_ip", ip)
    .gte("requested_at", desde);

  return (count ?? 0) >= 5;
}

/**
 * Matrícula pública, sem login: só cria um pedido pendente. O atleta de
 * verdade e a cobrança no Asaas nascem quando o treinador aprova em
 * approveEnrollment — nunca aqui.
 */
export async function submitEnrollment(formData: FormData): Promise<ActionResult> {
  const parsed = enrollmentSchema.safeParse({
    slug: formData.get("slug"),
    fullName: formData.get("fullName"),
    birthDate: formData.get("birthDate"),
    sex: formData.get("sex") || undefined,
    team: formData.get("team"),
    // Select desabilitado (sem time escolhido ainda) some do FormData —
    // .get() devolve null, e z.string().optional() só aceita undefined.
    category: formData.get("category") ?? "",
    guardianName: formData.get("guardianName"),
    guardianCpf: formData.get("guardianCpf"),
    guardianEmail: formData.get("guardianEmail"),
    guardianPhone: formData.get("guardianPhone"),
    instagram: formData.get("instagram"),
    consent: formData.get("consent") ?? undefined,
    website: formData.get("website") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Campo-armadilha: invisível pra gente, irresistível pra bot que preenche
  // tudo. Finge sucesso em vez de denunciar a armadilha.
  if (parsed.data.website) {
    return { success: true };
  }

  if (!parsed.data.consent) {
    return { error: "É necessário autorizar o uso dos dados (LGPD) para enviar a matrícula." };
  }

  const admin = createAdminClient();
  if (await excedeuLimiteMatricula(admin)) {
    return { error: "Muitas matrículas enviadas a partir deste acesso. Tente novamente amanhã." };
  }

  const { data: clubRows } = await admin.rpc("club_by_slug", {
    p_slug: parsed.data.slug.toLowerCase(),
  });
  const club = Array.isArray(clubRows) ? clubRows[0] : null;
  if (!club || club.status === "bloqueado") {
    return { error: "Este clube não está aceitando matrículas no momento." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error } = await admin.from("athlete_enrollment_requests").insert({
    club_id: club.id,
    full_name: parsed.data.fullName,
    birth_date: parsed.data.birthDate,
    sex: parsed.data.sex ?? null,
    team: parsed.data.team || null,
    category: parsed.data.category || null,
    guardian_name: parsed.data.guardianName,
    guardian_cpf: onlyDigits(parsed.data.guardianCpf),
    guardian_email: parsed.data.guardianEmail,
    guardian_phone: parsed.data.guardianPhone || null,
    instagram: parsed.data.instagram || null,
    guardian_consent_at: new Date().toISOString(),
    submitter_ip: ip,
  });
  if (error) {
    console.error("[matricula] falha ao registrar pedido:", error.message);
    return { error: "Não foi possível enviar a matrícula. Tente novamente em instantes." };
  }

  await sendPushToClubCoaches(club.id, {
    title: "📝 Nova matrícula pendente",
    body: `${parsed.data.fullName} se inscreveu e aguarda aprovação.`,
    url: "/athletes",
    tag: "new-enrollment",
  });

  return { success: true };
}

const approveSchema = z.object({
  requestId: z.string().uuid(),
  team: z.string().trim().optional(),
  category: z.string().trim().optional(),
});

/**
 * Aprova o pedido: cria o atleta de verdade com os dados já coletados na
 * matrícula (incluindo o consentimento LGPD registrado no envio). Não
 * inicia cobrança nenhuma — o treinador faz isso depois, na ficha
 * financeira do atleta recém-criado, com o fluxo já existente do Asaas.
 */
export async function approveEnrollment(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();
  const parsed = approveSchema.safeParse({
    requestId: formData.get("requestId"),
    team: formData.get("team"),
    category: formData.get("category") ?? "",
  });
  if (!parsed.success) return { error: "Dados inválidos." };

  const usage = await getAthleteUsage(coach.clubId);
  if (!usage.hasRoom) {
    return {
      error: `Sua licença permite ${usage.max} atletas ativos e todos estão ocupados. Desative um atleta ou amplie o plano antes de aprovar.`,
    };
  }

  const supabase = await createClient();
  const { data: request, error: requestError } = await supabase
    .from("athlete_enrollment_requests")
    .select("*")
    .eq("id", parsed.data.requestId)
    .eq("club_id", coach.clubId)
    .eq("status", "Pendente")
    .single();
  if (requestError || !request) return { error: "Solicitação não encontrada ou já revisada." };

  const fallbackColors = ["#111111", "#D72B2B", "#E6C000", "#1A1A1A", "#C0392B"];
  const { data: created, error } = await supabase
    .from("athletes")
    .insert({
      club_id: coach.clubId,
      created_by: coach.userId,
      full_name: request.full_name,
      birth_date: request.birth_date,
      sex: request.sex,
      team: parsed.data.team || request.team,
      category: parsed.data.category || request.category,
      guardian_name: request.guardian_name,
      guardian_phone: request.guardian_phone,
      guardian_cpf: request.guardian_cpf,
      guardian_email: request.guardian_email,
      guardian_consent_at: request.guardian_consent_at,
      instagram: request.instagram,
      photo_color: fallbackColors[Math.floor(Math.random() * fallbackColors.length)],
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Não foi possível criar o atleta." };

  await supabase
    .from("athlete_enrollment_requests")
    .update({
      status: "Aprovado",
      reviewed_by: coach.userId,
      reviewed_at: new Date().toISOString(),
      created_athlete_id: created.id,
    })
    .eq("id", request.id);

  await logAudit({
    clubId: coach.clubId,
    entityType: "athlete",
    entityId: created.id,
    action: "create",
    details: { full_name: request.full_name, source: "matricula_publica" },
    performedBy: coach.userId,
    performedByName: coach.fullName,
    athleteId: created.id,
  });

  revalidatePath("/athletes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function rejectEnrollment(requestId: string, notes: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_enrollment_requests")
    .update({
      status: "Rejeitado",
      reviewed_by: coach.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes || null,
    })
    .eq("id", requestId)
    .eq("club_id", coach.clubId)
    .eq("status", "Pendente");
  if (error) return { error: error.message };
  revalidatePath("/athletes");
  return { success: true };
}
