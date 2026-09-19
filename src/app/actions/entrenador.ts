"use server";

import { revalidatePath } from "next/cache";
import { requireEntrenador } from "@/lib/auth";
import {
  ErrorIA,
  generarPlanInicial,
  iaDisponible,
  interpretarPlanTxt
} from "@/lib/ai";
import { exec, getPerfil } from "@/lib/data";
import { normalizarPlan, planPlantilla } from "@/lib/plan-generator";
import { aplicarPlan } from "@/lib/plan-import";
import { db } from "@/lib/supabase/server";
import type { PlanGenerado } from "@/lib/types";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof ErrorIA || e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

// Paso 1 de "reemplazar por .txt": interpretar y devolver una vista previa.
export async function interpretarTxt(input: {
  userId: string;
  texto: string;
}): Promise<{ plan?: PlanGenerado; error?: string }> {
  const texto = input.texto.trim();
  if (texto.length < 20) return { error: "El texto es demasiado corto para ser un plan." };
  if (!iaDisponible()) {
    return { error: "Interpretar un .txt necesita la IA configurada (GROQ_API_KEY o GEMINI_API_KEY)." };
  }
  try {
    await requireEntrenador();
    const perfil = await getPerfil(input.userId);
    const plan = await interpretarPlanTxt(texto, perfil);
    return { plan };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

// Paso 2: aplicar el plan (ya revisado en la vista previa) al cliente.
// Reemplaza por completo la rutina vigente.
export async function aplicarPlanCliente(input: {
  userId: string;
  plan: PlanGenerado;
  origen: "txt" | "ia";
}): Promise<Resultado> {
  try {
    await requireEntrenador();
    const plan = normalizarPlan(input.plan);
    await aplicarPlan(input.userId, plan, input.origen);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Regenera el plan desde el cuestionario (IA si está, plantilla si no).
export async function regenerarPlan(userId: string): Promise<Resultado> {
  try {
    await requireEntrenador();
    const perfil = await getPerfil(userId);
    let plan: PlanGenerado | null = null;
    let origen: "ia" | "plantilla" = "plantilla";
    if (iaDisponible()) {
      plan = await generarPlanInicial(perfil);
      origen = "ia";
    }
    if (!plan) plan = planPlantilla(perfil.cuestionario);
    await aplicarPlan(userId, plan, origen);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function marcarPago(input: {
  userId: string;
  estado: "pendiente" | "pagado";
}): Promise<Resultado> {
  try {
    await requireEntrenador();
    await exec(
      db().from("profiles").update({ estado_pago: input.estado }).eq("id", input.userId)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function marcarActivo(input: {
  userId: string;
  activo: boolean;
}): Promise<Resultado> {
  try {
    await requireEntrenador();
    await exec(db().from("profiles").update({ activo: input.activo }).eq("id", input.userId));
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
