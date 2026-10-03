"use server";

import { revalidatePath } from "next/cache";
import { requireEntrenador } from "@/lib/auth";
import { exec, getPlantilla } from "@/lib/data";
import { normalizarPlan } from "@/lib/plan-generator";
import { planDesdeRutina } from "@/lib/plan-import";
import { db } from "@/lib/supabase/server";
import type { PlanGenerado } from "@/lib/types";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

// Guarda la rutina vigente de un cliente como plantilla reutilizable
// (sin pesos, para que sirva a cualquiera).
export async function guardarPlantillaDesdeCliente(input: {
  userId: string;
  nombre: string;
  descripcion?: string;
}): Promise<Resultado> {
  const nombre = input.nombre.trim().slice(0, 80);
  if (nombre.length < 3) return { error: "Ponle un nombre a la plantilla." };
  try {
    const { userId: entrenador } = await requireEntrenador();
    const plan = await planDesdeRutina(input.userId);
    if (!plan) return { error: "Este cliente no tiene rutina para guardar." };
    await exec(
      db().from("plantillas_rutina").insert({
        nombre,
        descripcion: (input.descripcion ?? "").trim().slice(0, 300),
        plan: { ...plan, nombre_bloque: nombre },
        creado_por: entrenador
      })
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/entrenador", "layout");
  return { ok: true };
}

// Devuelve el plan de una plantilla para previsualizarlo (y guardarlo
// como borrador con el flujo normal de "Rutina nueva").
export async function cargarPlantilla(input: { id: string }): Promise<{ plan?: PlanGenerado; error?: string }> {
  try {
    await requireEntrenador();
    const p = await getPlantilla(input.id);
    if (!p) return { error: "No se encontró la plantilla." };
    return { plan: normalizarPlan(p.plan) };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

export async function borrarPlantilla(input: { id: string }): Promise<Resultado> {
  try {
    await requireEntrenador();
    await exec(db().from("plantillas_rutina").delete().eq("id", input.id));
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/entrenador", "layout");
  return { ok: true };
}
