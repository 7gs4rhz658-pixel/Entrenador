"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErrorIA, iaDisponible } from "@/lib/ai";
import { informeATexto, redactarInforme } from "@/lib/ai-informe";
import { requireCliente, requireEntrenador } from "@/lib/auth";
import { exec, getCheckin, getMesociclo, getPerfil } from "@/lib/data";
import { ETIQUETAS_OBJETIVO } from "@/lib/nutrition";
import { resumenDeSemana } from "@/lib/stats";
import { db } from "@/lib/supabase/server";
import type { Checkin } from "@/lib/types";

type Estado = { error?: string };
type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof ErrorIA || e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

const escala = (v: FormDataEntryValue | null): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

// Check-in del cliente al cerrar la semana: guarda, calcula los números
// de la semana, actualiza el peso del perfil y deja el borrador del
// informe para que el entrenador lo apruebe.
export async function guardarCheckin(_prev: Estado, formData: FormData): Promise<Estado> {
  const { userId, perfil } = await requireCliente();
  const mesoId = String(formData.get("meso") ?? "");
  const semana = Number(formData.get("semana"));
  const peso = Number(String(formData.get("peso_kg") ?? "").replace(",", "."));
  const cinturaRaw = String(formData.get("cintura_cm") ?? "").replace(",", ".").trim();
  const cintura = cinturaRaw ? Number(cinturaRaw) : null;
  const energia = escala(formData.get("energia"));
  const sueno = escala(formData.get("sueno"));
  const adherencia = escala(formData.get("adherencia"));
  const comentario = String(formData.get("comentario") ?? "").trim().slice(0, 500);

  if (!mesoId || !Number.isInteger(semana) || semana < 1) return { error: "Falta la semana del check-in." };
  if (!Number.isFinite(peso) || peso < 30 || peso > 300) return { error: "Revisá el peso (en kg)." };
  if (cintura != null && (!Number.isFinite(cintura) || cintura < 40 || cintura > 200)) return { error: "Revisá la cintura (en cm)." };
  if (!energia || !sueno || !adherencia) return { error: "Marcá energía, sueño y cómo te fue con el plan." };

  let meso;
  try {
    meso = await getMesociclo(mesoId);
  } catch (e) {
    return { error: mensaje(e) };
  }
  if (meso.user_id !== userId) return { error: "Ese bloque no es tuyo." };
  // Ya lo respondió (doble envío): no hay nada que hacer
  if (await getCheckin(mesoId, semana)) redirect("/");

  try {
    const resumen = await resumenDeSemana(perfil, meso, semana);
    resumen.peso_actual_kg = peso;

    const { data, error } = await db()
      .from("checkins")
      .insert({
        user_id: userId,
        mesocycle_id: mesoId,
        semana,
        peso_kg: peso,
        cintura_cm: cintura,
        energia,
        sueno,
        adherencia,
        comentario,
        resumen,
        informe_estado: "pendiente"
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(`Base de datos: ${error?.message ?? "no se guardó el check-in"}`);
    const checkin = data as Checkin;

    // El peso nuevo recalcula las calorías y macros de referencia
    await exec(db().from("profiles").update({ peso_kg: peso }).eq("id", userId));

    if (iaDisponible()) {
      try {
        const informe = await redactarInforme(perfil.nombre.split(" ")[0], ETIQUETAS_OBJETIVO[perfil.objetivo], checkin, resumen);
        await exec(db().from("checkins").update({ informe, informe_estado: "borrador" }).eq("id", checkin.id));
      } catch (e) {
        console.error("Informe IA falló:", mensaje(e));
      }
    }
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  redirect("/?checkin=ok");
}

// El entrenador aprueba (o edita) el borrador: recién ahí lo ve el cliente.
export async function aprobarInforme(input: { checkinId: string; texto: string }): Promise<Resultado> {
  const texto = input.texto.trim();
  if (texto.length < 20) return { error: "El informe está muy corto." };
  try {
    await requireEntrenador();
    await exec(
      db()
        .from("checkins")
        .update({ informe_final: texto.slice(0, 4000), informe_estado: "aprobado", aprobado_at: new Date().toISOString() })
        .eq("id", input.checkinId)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Volver a pedir el borrador a la IA (por si falló o no convence)
export async function regenerarInforme(input: { checkinId: string }): Promise<{ informe?: string; error?: string }> {
  if (!iaDisponible()) return { error: "La IA no está configurada." };
  try {
    await requireEntrenador();
    const c = await db().from("checkins").select("*").eq("id", input.checkinId).maybeSingle();
    const checkin = c.data as Checkin | null;
    if (!checkin?.resumen) return { error: "No se encontró el check-in." };
    const perfil = await getPerfil(checkin.user_id);
    const informe = await redactarInforme(perfil.nombre.split(" ")[0], ETIQUETAS_OBJETIVO[perfil.objetivo], checkin, checkin.resumen);
    await exec(db().from("checkins").update({ informe, informe_estado: "borrador" }).eq("id", checkin.id));
    return { informe: informeATexto(informe) };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

export async function marcarInformeVisto(input: { checkinId: string }): Promise<Resultado> {
  try {
    const { userId } = await requireCliente();
    await exec(db().from("checkins").update({ visto_at: new Date().toISOString() }).eq("id", input.checkinId).eq("user_id", userId));
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
