import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let vapidReady: boolean | null = null;

/**
 * Configura o web-push na primeira vez que alguém for enviar, não na
 * importação do módulo.
 *
 * Configurar no topo quebrava o build inteiro quando as chaves VAPID não
 * estavam no ambiente: o `next build` importa cada rota pra coletar dados
 * de página, o setVapidDetails lançava "No subject set in
 * vapidDetails.subject" e a publicação parava — mesmo em quem nem usa
 * notificação. Passou despercebido porque na máquina local as chaves
 * existem no .env.local e o build passava.
 *
 * Faltando configuração, o envio vira no-op: notificação é acessório e não
 * pode derrubar a ação que a disparou (aprovar desafio, publicar escalação).
 */
function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    console.warn(
      "[push] VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ausentes — notificações desativadas.",
    );
    vapidReady = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Manda push pra todos os dispositivos inscritos de um profile. Usa o
 * client admin porque quem dispara (ex.: treinador aprovando um desafio)
 * quase sempre não é o dono da inscrição — RLS normal bloquearia a leitura.
 * Inscrições que o navegador não reconhece mais (410/404) são removidas.
 */
export async function sendPushToProfile(profileId: string, payload: PushPayload) {
  if (!ensureVapid()) return;

  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("profile_id", profileId);

  if (!subscriptions || subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  );
}

export async function sendPushToProfiles(profileIds: string[], payload: PushPayload) {
  await Promise.all(profileIds.map((id) => sendPushToProfile(id, payload)));
}

/** Atleta só recebe push se tiver login provisionado (linha em profiles). */
export async function sendPushToAthlete(athleteId: string, payload: PushPayload) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("role", "athlete")
    .maybeSingle();
  if (!profile) return;
  await sendPushToProfile(profile.id, payload);
}

/** Manda pra todos os coaches do clube (o app não distingue "dono" de staff). */
export async function sendPushToClubCoaches(clubId: string, payload: PushPayload) {
  const admin = createAdminClient();
  const { data: coaches } = await admin
    .from("profiles")
    .select("id")
    .eq("club_id", clubId)
    .eq("role", "coach");
  if (!coaches || coaches.length === 0) return;
  await sendPushToProfiles(
    coaches.map((c) => c.id),
    payload,
  );
}
