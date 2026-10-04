// Service worker mínimo: recibe las notificaciones push y abre la app al
// tocarlas. No cachea nada (la app siempre muestra datos frescos).
self.addEventListener("push", (event) => {
  let datos = { title: "Mi Entrenador Personal", body: "", url: "/", tag: undefined };
  try {
    datos = { ...datos, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(datos.title, {
      body: datos.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: datos.tag,
      data: { url: datos.url }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
