"use server";

import { revalidatePath } from "next/cache";
import { ErrorIA, iaDisponible } from "@/lib/ai";
import { redactarMensaje, type ContextoMensaje } from "@/lib/ai-mensajes";
import { requireEntrenador, requireSesion } from "@/lib/auth";
import { exec, getCheckins, getPerfil, getUltimaActividad } from "@/lib/data";
import { hoyFecha } from "@/lib/format";
import { estadoPago } from "@/lib/pagos";
import { enviarPush } from "@/lib/push";
import { adherenciaSemanaActual, checkinPendiente } from "@/lib/stats";
import { db } from "@/lib/supabase/server";
import type { Mensaje } from "@/lib/types";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof ErrorIA || e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

// El entrenador escribe a un cliente (llega push) o el cliente responde.
export async function enviarMensaje(input: { userId?: string; texto: string }): Promise<{ mensaje?: Mensaje; error?: string }> {
  const texto = input.texto.trim().slice(0, 2000);
  if (texto.length < 2) return { error: "Escribí algo." };
  try {
    const sesion = await requireSesion();
    const esEntrenador = sesion.perfil.rol === "entrenador";
    const userId = esEntrenador ? input.userId : sesion.userId;
    if (!userId) return { error: "Falta el cliente." };
    const { data, error } = await db()
      .from("mensajes")
      .insert({ user_id: userId, de: esEntrenador ? "entrenador" : "cliente", texto })
      .select("*")
      .single();
    if (error || !data) throw new Error(`Base de datos: ${error?.message ?? "no se guardó el mensaje"}`);
    if (esEntrenador) {
      await enviarPush(userId, {
        titulo: "Mensaje de tu entrenador",
        cuerpo: texto.length > 120 ? `${texto.slice(0, 117)}…` : texto,
        url: "/mensajes",
        tag: "mensaje"
      });
    }
    revalidatePath("/", "layout");
    return { mensaje: data as Mensaje };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

// Marca como leídos los mensajes del otro lado del hilo
export async function marcarLeidos(input: { userId?: string }): Promise<Resultado> {
  try {
    const sesion = await requireSesion();
    const esEntrenador = sesion.perfil.rol === "entrenador";
    const userId = esEntrenador ? input.userId : sesion.userId;
    if (!userId) return { error: "Falta el cliente." };
    await exec(
      db()
        .from("mensajes")
        .update({ leido_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("de", esEntrenador ? "cliente" : "entrenador")
        .is("leido_at", null)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  return { ok: true };
}

// Borrador con IA para el entrenador, con el contexto real del cliente
export async function borradorMensaje(input: {
  userId: string;
  motivo: ContextoMensaje["motivo"];
}): Promise<{ texto?: string; error?: string }> {
  if (!iaDisponible()) return { error: "La IA no está configurada." };
  try {
    await requireEntrenador();
    const perfil = await getPerfil(input.userId);
    const [ultima, adherencia, checkins, pendiente] = await Promise.all([
      getUltimaActividad(perfil.id),
      adherenciaSemanaActual(perfil),
      getCheckins(perfil.id, 1),
      checkinPendiente(perfil.id)
    ]);
    const texto = await redactarMensaje({
      perfil,
      diasSinRegistro: ultima ? Math.floor((Date.now() - new Date(ultima).getTime()) / 86_400_000) : null,
      adherencia,
      ultimoCheckin: checkins[0] ?? null,
      checkinPendiente: pendiente?.semana ?? null,
      pagoVencido: estadoPago(perfil, hoyFecha()).vencido,
      motivo: input.motivo
    });
    return { texto };
  } catch (e) {
    return { error: mensaje(e) };
  }
}
