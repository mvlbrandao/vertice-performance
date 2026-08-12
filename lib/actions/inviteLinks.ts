"use server";

import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/actions/athletes";

const VALIDITY_DAYS = 7;

/** Guardamos só o hash; o token em claro vive apenas no link entregue. */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const createSchema = z.object({
  role: z.enum(["athlete", "staff"]),
  athleteId: z.string().uuid().optional().or(z.literal("")),
  fullName: z.string().trim().min(1, "Informe o nome."),
  title: z.string().trim().optional(),
});

export async function createInviteLink(
  input: { role: "athlete" | "staff"; athleteId?: string; fullName: string; title?: string },
): Promise<ActionResult & { token?: string }> {
  const coach = await requireCoach();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.role === "athlete" && !parsed.data.athleteId) {
    return { error: "Convite de atleta precisa apontar pra um atleta." };
  }

  const supabase = await createClient();

  if (parsed.data.athleteId) {
    // Evita gerar convite pra quem já tem login — o link criaria uma
    // segunda conta órfã pro mesmo atleta.
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("athlete_id", parsed.data.athleteId)
      .maybeSingle();
    if (existing) return { error: "Esse atleta já tem uma conta de acesso." };
  }

  const token = randomBytes(24).toString("base64url");
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + VALIDITY_DAYS);

  const { error } = await supabase.from("invite_links").insert({
    club_id: coach.clubId,
    token_hash: hashToken(token),
    role: parsed.data.role,
    athlete_id: parsed.data.role === "athlete" ? parsed.data.athleteId! : null,
    full_name: parsed.data.fullName,
    title: parsed.data.title || null,
    created_by: coach.userId,
    expires_at: expires.toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/equipe");
  return { success: true, token };
}

export async function revokeInviteLink(inviteId: string): Promise<ActionResult> {
  const coach = await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invite_links")
    .delete()
    .eq("id", inviteId)
    .eq("club_id", coach.clubId)
    .is("used_at", null);
  if (error) return { error: error.message };

  revalidatePath("/equipe");
  return { success: true };
}

const redeemSchema = z.object({
  token: z.string().min(10),
  email: z.string().trim().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
});

/**
 * Troca o token por uma conta. Roda com a chave de serviço porque quem
 * está resgatando ainda não tem sessão — mas só cria a conta se o token
 * existir, não estiver usado e não estiver vencido.
 */
export async function redeemInviteLink(input: {
  token: string;
  email: string;
  password: string;
}): Promise<ActionResult> {
  const parsed = redeemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invite_links")
    .select("id, club_id, role, athlete_id, full_name, title, expires_at, used_at")
    .eq("token_hash", hashToken(parsed.data.token))
    .maybeSingle();

  if (!invite) return { error: "Convite inválido." };
  if (invite.used_at) return { error: "Esse convite já foi usado." };
  if (new Date(invite.expires_at) < new Date()) return { error: "Esse convite expirou." };

  // Reserva o convite ANTES de criar a conta. Fazer o contrário deixaria
  // dois envios simultâneos criarem duas contas pro mesmo convite — o
  // update condicionado a used_at nulo garante que só um passa daqui.
  const { data: claimed } = await admin
    .from("invite_links")
    .update({ used_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { error: "Esse convite já foi usado." };

  async function releaseClaim() {
    await admin.from("invite_links").update({ used_at: null }).eq("id", invite!.id);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: invite.full_name },
  });
  if (createError || !created.user) {
    // Devolve o convite: o e-mail pode já estar em uso e a pessoa vai
    // querer tentar de novo com outro.
    await releaseClaim();
    return { error: createError?.message ?? "Não foi possível criar a conta." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    club_id: invite.club_id,
    role: invite.role,
    full_name: invite.full_name,
    athlete_id: invite.athlete_id,
    title: invite.title,
  });
  if (profileError) {
    // Não deixa uma conta de login órfã (sem perfil) para trás.
    await admin.auth.admin.deleteUser(created.user.id);
    await releaseClaim();
    return { error: profileError.message };
  }

  await admin.from("invite_links").update({ used_by: created.user.id }).eq("id", invite.id);
  return { success: true };
}
