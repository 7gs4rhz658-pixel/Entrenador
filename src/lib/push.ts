// Notificaciones push (Web Push / PWA). Solo servidor: la clave VAPID
// privada vive en el entorno. Sin claves configuradas no se manda nada
// y la app sigue funcionando igual.

import webpush from "web-push";
import { db } from "./supabase/server";
import { exec, getSuscripcionesPush } from "./data";

export interface CargaPush {
  titulo: string;
  cuerpo: string;
  url?: string; // a dónde abre la app al tocar
  tag?: string; // agrupa avisos del mismo tipo
}

let configurado = false;

export function pushDisponible(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function preparar(): boolean {
  if (!pushDisponible()) return false;
  if (!configurado) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    configurado = true;
  }
  return true;
}

// Manda a todos los dispositivos del usuario; las suscripciones que ya
// no existen (410/404) se borran. Devuelve cuántas llegaron.
export async function enviarPush(userId: string, carga: CargaPush): Promise<number> {
  if (!preparar()) return 0;
  const subs = await getSuscripcionesPush(userId);
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify({ title: carga.titulo, body: carga.cuerpo, url: carga.url ?? "/", tag: carga.tag }),
        { TTL: 60 * 60 * 12 }
      );
      ok += 1;
      await exec(db().from("push_subscriptions").update({ ultimo_envio_at: new Date().toISOString() }).eq("id", s.id));
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await exec(db().from("push_subscriptions").delete().eq("id", s.id));
      } else {
        console.error("Push falló:", e instanceof Error ? e.message : e);
      }
    }
  }
  return ok;
}
