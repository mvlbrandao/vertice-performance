"use client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/** Formato que a server action espera, a partir de uma inscrição do navegador. */
export function serializeSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint!,
    p256dh: json.keys!.p256dh,
    auth: json.keys!.auth,
    userAgent: navigator.userAgent,
  };
}

export class PushConfigError extends Error {}

export async function subscribeToPushBrowser() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    // Acontece quando NEXT_PUBLIC_VAPID_PUBLIC_KEY não foi definida no
    // ambiente do deploy (ela é embutida no bundle no momento do build).
    throw new PushConfigError(
      "Notificações não estão configuradas neste servidor. Avise o administrador.",
    );
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();

  // Uma inscrição criada com outra chave VAPID (chave rotacionada, ou
  // ambiente diferente) continua existindo no navegador mas o servidor não
  // consegue mais mandar push por ela — e tentar re-inscrever com chave
  // diferente estoura. Nesse caso, descarta a antiga e inscreve de novo.
  if (subscription) {
    const current = new Uint8Array(subscription.options.applicationServerKey ?? new ArrayBuffer(0));
    const matches =
      current.length === applicationServerKey.length &&
      current.every((byte, i) => byte === applicationServerKey[i]);
    if (!matches) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint!,
    p256dh: json.keys!.p256dh,
    auth: json.keys!.auth,
    userAgent: navigator.userAgent,
  };
}

export async function unsubscribeBrowser() {
  const sub = await getExistingSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    return endpoint;
  }
  return null;
}
