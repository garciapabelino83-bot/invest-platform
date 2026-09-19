import webpush from "web-push";

let configured = false;

// Configura la librería de notificaciones push con nuestras llaves.
// Solo se hace una vez por instancia del servidor.
export function getWebPush() {
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:soporte@investpanel.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    configured = true;
  }
  return webpush;
}
