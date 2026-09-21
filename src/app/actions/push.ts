"use server";

import { requireSesion } from "@/lib/auth";
import { exec } from "@/lib/data";
import { db } from "@/lib/supabase/server";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

// El navegador del cliente se suscribe con la clave pública y nos manda
// el endpoint + claves; con eso el servidor puede avisarle.
export async function guardarSuscripcionPush(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<Resultado> {
  if (!input.endpoint?.startsWith("https://") || !input.keys?.p256dh || !input.keys?.auth) {
    return { error: "Suscripción inválida." };
  }
  try {
    const { userId } = await requireSesion();
    await exec(
      db()
        .from("push_subscriptions")
        .upsert({ user_id: userId, endpoint: input.endpoint, keys: input.keys }, { onConflict: "endpoint" })
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  return { ok: true };
}

export async function borrarSuscripcionPush(input: { endpoint: string }): Promise<Resultado> {
  try {
    const { userId } = await requireSesion();
    await exec(db().from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", input.endpoint));
  } catch (e) {
    return { error: mensaje(e) };
  }
  return { ok: true };
}
