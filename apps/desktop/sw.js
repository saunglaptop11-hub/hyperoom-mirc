self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "HYPEROOM", body: "New activity", notificationId: null, payload: {} };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.notificationId || "hyperoom",
    renotify: true,
    data: data.payload || {},
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const payload = event.notification.data || {};
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const current = clients.find((client) => "focus" in client);
    if (current) {
      await current.focus();
      current.postMessage({ type: "OPEN_NOTIFICATION_CONTEXT", payload });
      return;
    }
    await self.clients.openWindow("/");
  }));
});
