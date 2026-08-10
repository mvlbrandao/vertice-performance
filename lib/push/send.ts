import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

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
