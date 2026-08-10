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
