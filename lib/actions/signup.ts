"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/platform/license";
import { somaDias, hojeISO } from "@/lib/utils/date";
import { translateAuthError } from "@/lib/utils/authErrors";

const signupSchema = z.object({
  clubName: z.string().trim().min(2, "Informe o nome do clube.").max(60, "Nome muito longo."),
  fullName: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
});

export interface SignupResult {
  error?: string;
  success?: boolean;
  slug?: string;
}

/**
 * Transforma o nome do clube num slug de URL. Acento vira letra simples e
 * o resto vira hífen — o slug entra em `/c/<slug>` e precisa sobreviver a
 * uma URL, a um print e a alguém digitando à mão.
 */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Encontra um slug livre. Colisão é esperada — "Vértice FC" existe em
 * muitas cidades —, então tenta sufixos numéricos em vez de recusar o
 * cadastro e mandar a pessoa inventar outro nome.
 */
async function slugDisponivel(admin: ReturnType<typeof createAdminClient>, base: string) {
  const raiz = base || "clube";
  for (let i = 0; i < 50; i++) {
    const tentativa = i === 0 ? raiz : `${raiz}-${i + 1}`;
    if (tentativa.length < 3) continue;
    const { data } = await admin.from("clubs").select("id").eq("slug", tentativa).maybeSingle();
    if (!data) return tentativa;
  }
  return `${raiz}-${Date.now().toString(36)}`.slice(0, 50);
}

/**
 * Limite por IP. Cadastro aberto sem freio vira alvo de robô, e cada clube
 * criado ocupa espaço e polui a lista de clientes. Usa a própria tabela de
 * clubes como contador — não vale a pena uma tabela só pra isso enquanto o
 * volume for este.
 */
async function excedeuLimite(admin: ReturnType<typeof createAdminClient>): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return false;

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("clubs")
    .select("id", { count: "exact", head: true })
    .eq("signup_ip", ip)
    .gte("created_at", desde);

  return (count ?? 0) >= 3;
}

/**
 * Cadastro público: cria o clube e o treinador dono, já em teste.
 *
 * Cria o clube primeiro e a conta depois. Se a conta falhar (e-mail já em
 * uso é o caso comum), o clube recém-criado é removido — senão a base
 * acumularia clubes fantasma sem dono, que aparecem no painel e contam
 * como cliente.
 */
export async function signup(formData: FormData): Promise<SignupResult> {
  const parsed = signupSchema.safeParse({
    clubName: formData.get("clubName"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();

  if (await excedeuLimite(admin)) {
    return { error: "Muitos cadastros a partir deste acesso. Tente novamente amanhã." };
  }

  const settings = await getPlatformSettings();
  const slug = await slugDisponivel(admin, slugify(parsed.data.clubName));

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { data: club, error: clubError } = await admin
    .from("clubs")
    .insert({
      name: parsed.data.clubName,
      slug,
      status: "trial",
      trial_ends_at: `${somaDias(hojeISO(), settings.trialDays)}T23:59:59Z`,
      signup_ip: ip,
    })
    .select("id, slug")
    .single();
  if (clubError || !club) {
    return { error: clubError?.message ?? "Não foi possível criar o clube." };
  }

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (userError || !created.user) {
    await admin.from("clubs").delete().eq("id", club.id);
    return { error: translateAuthError(userError?.message ?? "Não foi possível criar a conta.") };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    club_id: club.id,
    role: "coach",
    full_name: parsed.data.fullName,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("clubs").delete().eq("id", club.id);
    return { error: profileError.message };
  }

  await admin.from("clubs").update({ owner_profile_id: created.user.id }).eq("id", club.id);

  return { success: true, slug: club.slug };
}
