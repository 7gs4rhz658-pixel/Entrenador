"use server";

import { revalidatePath } from "next/cache";
import { ErrorIA, iaDisponible } from "@/lib/ai";
import { aplicarAjuste, descartarAjuste } from "@/lib/ajuste-macros";
import { requireEntrenador, resolverUsuario } from "@/lib/auth";
import {
  aplicarRecomendacion,
  prepararRecomendacionIA,
  prepararRecomendacionTxt,
  type RecomendacionPreparada
} from "@/lib/comidas-service";
import { exec, getComidas, getPerfil, getPlanComidas } from "@/lib/data";
import { quitarPlanComidas, sanearHorarios } from "@/lib/meal-plan-db";
import { db } from "@/lib/supabase/server";
import type { MacrosManual, Momento, PlanComidasResuelto, TipoDia } from "@/lib/types";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof ErrorIA || e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

const SIN_IA = "Generar o interpretar la recomendación necesita la IA configurada (GROQ_API_KEY o GEMINI_API_KEY).";

// ── Entrenador: generar, interpretar, aplicar ───────────────────

export async function generarComidasIA(input: {
  userId: string;
}): Promise<{ resultado?: RecomendacionPreparada; error?: string }> {
  if (!iaDisponible()) return { error: SIN_IA };
  try {
    await requireEntrenador();
    const perfil = await getPerfil(input.userId);
    return { resultado: await prepararRecomendacionIA(perfil) };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

export async function interpretarComidasTxtAction(input: {
  userId: string;
  texto: string;
  releer?: boolean; // ignorar la lectura guardada de este texto
}): Promise<{ resultado?: RecomendacionPreparada; lecturaGuardada?: boolean; error?: string }> {
  const texto = input.texto.trim();
  if (texto.length < 20) return { error: "El texto es demasiado corto para ser una recomendación." };
  if (!iaDisponible()) return { error: SIN_IA };
  try {
    await requireEntrenador();
    const perfil = await getPerfil(input.userId);
    const { lecturaGuardada, ...resultado } = await prepararRecomendacionTxt(perfil, texto, !!input.releer);
    return { resultado, lecturaGuardada };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

// Aplica la vista previa (ya revisada y editada por el entrenador). Si el
// texto traía calorías y macros y el entrenador lo pide, pasan a ser la
// referencia diaria del cliente.
export async function aplicarComidas(input: {
  userId: string;
  plan: PlanComidasResuelto;
  origen: "ia" | "txt";
  usarObjetivos?: boolean;
}): Promise<Resultado> {
  try {
    await requireEntrenador();
    const perfil = await getPerfil(input.userId);
    const plan: PlanComidasResuelto = {
      nombre: String(input.plan.nombre ?? "").trim().slice(0, 80) || "Recomendación de comidas",
      notas: input.plan.notas ? String(input.plan.notas).slice(0, 400) : null,
      items: (input.plan.items ?? []).map((i, idx) => ({
        ...i,
        orden: idx + 1,
        plato: String(i.plato ?? "").slice(0, 80),
        cantidad_g: Math.min(2000, Math.max(1, Math.round(Number(i.cantidad_g) || 0))),
        nota: i.nota ? String(i.nota).slice(0, 80) : null
      })),
      horarios: sanearHorarios(input.plan.horarios),
      objetivos: null
    };
    await aplicarRecomendacion(perfil, plan, input.origen);
    if (input.usarObjetivos && input.plan.objetivos) {
      const r = await guardarMacrosManual({ userId: input.userId, macros: input.plan.objetivos });
      if (r.error) return { error: `El menú se guardó, pero la referencia no: ${r.error}` };
    }
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function quitarComidas(input: { userId: string }): Promise<Resultado> {
  try {
    await requireEntrenador();
    await quitarPlanComidas(input.userId);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Referencia diaria fijada a mano (null = volver a la fórmula)
export async function guardarMacrosManual(input: {
  userId: string;
  macros: MacrosManual | null;
}): Promise<Resultado> {
  let macros: MacrosManual | null = null;
  if (input.macros) {
    const limpiar = (m: MacrosManual["entreno"]) => ({
      kcal: Math.round(Number(m.kcal)),
      prot_g: Math.round(Number(m.prot_g)),
      carb_g: Math.round(Number(m.carb_g)),
      grasa_g: Math.round(Number(m.grasa_g))
    });
    macros = { entreno: limpiar(input.macros.entreno), descanso: limpiar(input.macros.descanso) };
    for (const m of [macros.entreno, macros.descanso]) {
      if (![m.kcal, m.prot_g, m.carb_g, m.grasa_g].every((n) => Number.isFinite(n) && n >= 0)) {
        return { error: "Revisá los números de la referencia." };
      }
      if (m.kcal < 1000 || m.kcal > 6000) return { error: "Las calorías tienen que estar entre 1000 y 6000." };
    }
  }
  try {
    await requireEntrenador();
    await exec(db().from("profiles").update({ macros_manual: macros }).eq("id", input.userId));
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Cliente: "La comí" ──────────────────────────────────────────

// Registra (o quita) en el día todos los ingredientes de una comida del
// menú. Cada registro apunta al ítem del plan para poder desmarcarlo y
// medir adherencia.
export async function marcarComida(input: {
  userId?: string;
  fecha: string;
  tipo_dia: TipoDia;
  momento: Momento;
  hecha: boolean;
}): Promise<Resultado> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return { error: "Fecha inválida." };
  try {
    const { userId } = await resolverUsuario(input.userId);
    const plan = await getPlanComidas(userId);
    if (!plan) return { error: "No tenés una recomendación de comidas activa." };
    const items = plan.items.filter((i) => i.tipo_dia === input.tipo_dia && i.momento === input.momento);
    if (!items.length) return { error: "Esa comida no está en tu menú." };
    const ids = items.map((i) => i.id);

    if (input.hecha) {
      const yaHechos = new Set(
        (await getComidas(userId, input.fecha)).map((c) => c.plan_item_id).filter(Boolean)
      );
      const filas = items
        .filter((i) => !yaHechos.has(i.id))
        .map((i) => ({
          user_id: userId,
          fecha: input.fecha,
          momento: i.momento,
          ingredient_id: i.ingredient_id,
          cantidad_g: i.cantidad_g,
          plan_item_id: i.id
        }));
      if (filas.length) await exec(db().from("meal_logs").insert(filas));
    } else {
      await exec(
        db().from("meal_logs").delete().eq("user_id", userId).eq("fecha", input.fecha).in("plan_item_id", ids)
      );
    }
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Ajuste quincenal de la referencia ───────────────────────────

export async function aplicarAjusteMacros(input: { userId: string; deltaKcal: number }): Promise<Resultado> {
  if (![150, -150].includes(input.deltaKcal)) return { error: "Ajuste inválido." };
  try {
    await requireEntrenador();
    const perfil = await getPerfil(input.userId);
    await aplicarAjuste(perfil, input.deltaKcal);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function descartarAjusteMacros(input: { userId: string }): Promise<Resultado> {
  try {
    await requireEntrenador();
    await descartarAjuste(input.userId);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
