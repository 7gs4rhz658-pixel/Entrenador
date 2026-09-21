"use server";

import { revalidatePath } from "next/cache";
import { requireEntrenador } from "@/lib/auth";
import {
  ErrorIA,
  generarPlanInicial,
  iaDisponible,
  interpretarPlanTxt
} from "@/lib/ai";
import { exec, getBloqueBorrador, getPerfil } from "@/lib/data";
import { hoyFecha } from "@/lib/format";
import { publicarPlanComidas } from "@/lib/meal-plan-db";
import { nuevoVencimiento } from "@/lib/pagos";
import { enviarPush } from "@/lib/push";
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
  origen: "txt" | "ia" | "plantilla";
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

// Propone un plan desde el cuestionario (IA si está, plantilla si no)
// para que el entrenador lo revise antes de aplicarlo como borrador.
export async function previsualizarPlan(input: {
  userId: string;
}): Promise<{ plan?: PlanGenerado; origen?: "ia" | "plantilla"; error?: string }> {
  try {
    await requireEntrenador();
    const perfil = await getPerfil(input.userId);
    if (iaDisponible()) return { plan: await generarPlanInicial(perfil), origen: "ia" };
    return { plan: planPlantilla(perfil.cuestionario), origen: "plantilla" };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

// "Enviar al cliente": publica el borrador de rutina, le avisa y le deja
// un mensaje en el hilo.
export async function enviarRutina(input: { userId: string }): Promise<Resultado> {
  try {
    await requireEntrenador();
    const borrador = await getBloqueBorrador(input.userId);
    if (!borrador) return { error: "No hay una rutina pendiente de enviar." };
    await exec(
      db()
        .from("mesocycles")
        .update({ publicado: true, publicado_at: new Date().toISOString() })
        .eq("id", borrador.id)
    );
    await exec(
      db().from("mensajes").insert({
        user_id: input.userId,
        de: "entrenador",
        texto: `Tu rutina "${borrador.nombre}" ya está lista. Entrá a Inicio y arrancá con el día de hoy.`
      })
    );
    await enviarPush(input.userId, {
      titulo: "Tu rutina está lista",
      cuerpo: "Tu entrenador ya la revisó. Entrá y mirá tu semana.",
      url: "/",
      tag: "rutina"
    });
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function enviarMenu(input: { userId: string }): Promise<Resultado> {
  try {
    await requireEntrenador();
    const publicado = await publicarPlanComidas(input.userId);
    if (!publicado) return { error: "No hay una recomendación de comidas pendiente de enviar." };
    await exec(
      db().from("mensajes").insert({
        user_id: input.userId,
        de: "entrenador",
        texto: "Tu recomendación de comidas ya está lista: la ves en Comida, con la lista de compras y la guía para cocinar la semana."
      })
    );
    await enviarPush(input.userId, {
      titulo: "Tu menú está listo",
      cuerpo: "Tu entrenador ya lo revisó. Mirá qué te toca hoy en Comida.",
      url: "/nutricion",
      tag: "menu"
    });
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
    // "Marcar pagado" cubre 30 días desde hoy (o desde el vencimiento
    // vigente si todavía no pasó)
    const perfil = await getPerfil(input.userId);
    const cambios =
      input.estado === "pagado"
        ? { estado_pago: "pagado", pagado_at: new Date().toISOString(), pago_vence_at: nuevoVencimiento(perfil.pago_vence_at, hoyFecha()) }
        : { estado_pago: "pendiente" };
    await exec(db().from("profiles").update(cambios).eq("id", input.userId));
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
