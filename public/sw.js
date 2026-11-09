// Service worker de los avisos push. Solo muestra el aviso y, al tocarlo,
// lleva a la pantalla correspondiente. No guarda nada en caché.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = {};
  }
  event.waitUntil(
    self.registration.showNotification(d.titulo || "DMC Contingencia", {
      body: d.cuerpo || undefined,
      tag: d.tag || undefined,
      icon: "/DMC-logo.png",
      data: { enlace: d.enlace || "/admin" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.enlace) || "/admin", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url.startsWith(self.location.origin) && "focus" in v) {
          return v.focus().then(() => ("navigate" in v ? v.navigate(destino) : undefined));
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
