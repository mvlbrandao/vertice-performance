const CACHE = "vertice-v3";
const SHELL = ["/icon-192.png", "/icon-512.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Rede primeiro, cache como rede de segurança. O app é quase todo dado vivo
 * (escalação muda, cobrança muda), então servir cache primeiro mostraria
 * informação velha. Mas no ginásio, onde o sinal cai, ver a última versão
 * carregada da escalação e do treino é melhor que uma tela de erro.
 *
 * Só navegações e GET entram nessa lógica: POST é ação (lançar evento,
 * marcar pago) e nunca pode ser servido de cache.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Chamada de dado/ação do Next e rotas de API sempre vão à rede.
  if (url.pathname.startsWith("/api/")) return;

  // Bundle do Next tem nome com hash do conteúdo, então nunca fica velho:
  // pode servir do cache primeiro. Sem isso a página até abria offline, mas
  // vinha sem CSS nenhum — HTML cru (descoberto testando com o servidor
  // desligado de verdade).
  //
  // Em desenvolvimento isso não vale: o Turbopack reaproveita o nome do
  // arquivo entre recompilações, então o cache-first passa a servir código
  // velho e a tela para de refletir o que foi editado.
  const isDev = ["localhost", "127.0.0.1"].includes(self.location.hostname);
  const isStaticAsset = !isDev && url.pathname.startsWith("/_next/static/");
  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (request.mode === "navigate" || url.pathname.startsWith("/icon"))) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const home = await caches.match("/perfil");
          if (home) return home;
        }
        return new Response(
          "<!doctype html><meta charset='utf-8'><title>Sem conexão</title>" +
            "<div style=\"font-family:system-ui;padding:40px 24px;text-align:center;color:#111\">" +
            "<h1 style='font-size:20px'>Sem conexão</h1>" +
            "<p style='color:#666;font-size:14px'>Abra esta tela uma vez com internet para poder vê-la offline depois.</p></div>",
          { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
        );
      }),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Vértice Performance", body: event.data.text() };
  }

  const { title, body, url, tag } = payload;
  event.waitUntil(
    self.registration.showNotification(title || "Vértice Performance", {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: tag || undefined,
      data: { url: url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      for (const client of clientsList) {
        if ("focus" in client && "navigate" in client) {
          return client.focus().then(() => client.navigate(targetUrl));
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
