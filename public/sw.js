// Este archivo corre en segundo plano en tu navegador (aunque la página
// esté cerrada) y es el encargado de mostrar la notificación cuando
// InvestPanel te avisa que un precio llegó a tu línea marcada.

self.addEventListener("push", (event) => {
  let data = {
    title: "InvestPanel",
    body: "Un activo llegó al precio que marcaste.",
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    // si el mensaje no viene en JSON, usamos el texto por defecto de arriba
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "InvestPanel", {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/graficos") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/graficos");
      }
    })
  );
});
