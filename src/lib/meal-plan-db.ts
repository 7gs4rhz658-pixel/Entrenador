// Recomendación de comidas: lo que toca la base. Resuelve cada
// ingrediente que propone la IA contra la tabla `ingredients` (los
// macros salen de ahí, nunca del modelo), escribe el menú y lo lee para
// las pantallas del cliente.

import { db } from "./supabase/server";
import { buscarIngredientesLocal, exec, getPlanComidas } from "./data";
import { buscarIngredientes } from "./off";
import {
  TIPOS_DIA,
  avisosPreparacion,
  comidasPorMomento,
  elegir,
  elegirBuscando,
  horaValida,
  normalizarTexto,
  ordenarPorHorario,
  type RecomendacionDia
} from "./meal-plan";
import type {
  BatchCooking,
  CuestionarioNutricion,
  HorariosMenu,
  Ingredient,
  ItemComidaResuelto,
  Momento,
  PlanComidasGenerado,
  PlanComidasResuelto,
  TipoDia
} from "./types";

// ── 2. Resolver ingredientes contra la base ─────────────────────

// Busca en la base propia (por nombre y otros nombres, sin acentos) y
// recién si no aparece, en Open Food Facts. La elección es la de
// meal-plan.ts (elegirBuscando), igual en la app que en las pruebas.
async function resolverNombre(
  nombre: string,
  nota: string,
  userId: string,
  cache: Map<string, Ingredient | null>
): Promise<Ingredient | null> {
  const clave = normalizarTexto(`${nombre}|${nota}`);
  if (cache.has(clave)) return cache.get(clave)!;
  let ing = await elegirBuscando(nombre, nota, (t) => buscarIngredientesLocal(t, 15));
  if (!ing) ing = elegir(nombre, await buscarIngredientes(nombre, userId), nota);
  cache.set(clave, ing);
  return ing;
}

export async function resolverPlanComidas(
  plan: PlanComidasGenerado,
  userId: string
): Promise<PlanComidasResuelto> {
  const cache = new Map<string, Ingredient | null>();
  const items: ItemComidaResuelto[] = [];
  for (const tipo of TIPOS_DIA) {
    let orden = 0;
    for (const comida of plan[tipo]) {
      for (const ing of comida.ingredientes) {
        orden += 1;
        items.push({
          tipo_dia: tipo,
          momento: comida.momento,
          orden,
          plato: comida.plato,
          nombre_pedido: ing.nombre,
          ingredient: await resolverNombre(ing.nombre, ing.nota ?? "", userId, cache),
          cantidad_g: ing.gramos,
          nota: ing.nota ?? null
        });
      }
    }
  }
  return {
    nombre: plan.nombre,
    notas: plan.notas ?? null,
    items,
    horarios: plan.horarios ?? null,
    objetivos: plan.objetivos ?? null
  };
}

// Las horas del menú que llegan de la vista previa: solo "HH:MM" en
// momentos y tipos de día válidos
export function sanearHorarios(raw: unknown): HorariosMenu | null {
  const r = (raw ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const out: HorariosMenu = {};
  for (const tipo of TIPOS_DIA) {
    const del: Partial<Record<Momento, string>> = {};
    for (const [m, h] of Object.entries(r[tipo] ?? {})) {
      const hora = horaValida(h);
      if (hora && MOMENTOS_VALIDOS.includes(m as Momento)) del[m as Momento] = hora;
    }
    if (Object.keys(del).length) out[tipo] = del;
  }
  return Object.keys(out).length ? out : null;
}

const MOMENTOS_VALIDOS: Momento[] = ["desayuno", "almuerzo", "merienda", "cena", "snack", "pre_entreno", "post_entreno"];

// ── 4. Escritura en la base ─────────────────────────────────────

// Reemplaza la recomendación activa del cliente. Los ítems sin
// ingrediente resuelto no se aceptan: el entrenador los corrige antes.
export async function aplicarPlanComidas(
  userId: string,
  plan: PlanComidasResuelto,
  origen: "ia" | "txt",
  batch: BatchCooking | null,
  publicado = false
): Promise<{ mealPlanId: string }> {
  const validos = plan.items.filter((i) => i.ingredient && i.cantidad_g > 0);
  if (!validos.length) throw new Error("La recomendación no tiene ingredientes válidos.");
  if (validos.length !== plan.items.length) {
    throw new Error("Hay ingredientes sin resolver: elegilos de la base o quitalos antes de aplicar.");
  }
  const supabase = db();
  await exec(supabase.from("meal_plans").update({ activo: false }).eq("user_id", userId).eq("activo", true));
  const { data: nuevo, error } = await supabase
    .from("meal_plans")
    .insert({
      user_id: userId,
      nombre: plan.nombre,
      origen,
      notas: plan.notas,
      batch_cooking: batch,
      horarios: sanearHorarios(plan.horarios),
      publicado,
      publicado_at: publicado ? new Date().toISOString() : null
    })
    .select("id")
    .single();
  if (error || !nuevo) throw new Error(`Base de datos: ${error?.message ?? "no se pudo crear la recomendación"}`);
  const mealPlanId = nuevo.id as string;
  await exec(
    supabase.from("meal_plan_items").insert(
      validos.map((i) => ({
        user_id: userId,
        meal_plan_id: mealPlanId,
        tipo_dia: i.tipo_dia,
        momento: i.momento,
        orden: i.orden,
        plato: i.plato,
        ingredient_id: i.ingredient!.id,
        cantidad_g: i.cantidad_g,
        nota: i.nota
      }))
    )
  );
  return { mealPlanId };
}

export async function quitarPlanComidas(userId: string): Promise<void> {
  await exec(db().from("meal_plans").update({ activo: false }).eq("user_id", userId).eq("activo", true));
}

// "Enviar al cliente": el borrador activo pasa a publicado
export async function publicarPlanComidas(userId: string): Promise<boolean> {
  const { data, error } = await db()
    .from("meal_plans")
    .update({ publicado: true, publicado_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("activo", true)
    .eq("publicado", false)
    .select("id");
  if (error) throw new Error(`Base de datos: ${error.message}`);
  return (data ?? []).length > 0;
}

// ── 9. Lectura para las pantallas del cliente ───────────────────

// Menú del cliente para un tipo de día, ordenado según sus horarios.
export async function recomendacionPara(
  userId: string,
  tipo: TipoDia,
  cn: CuestionarioNutricion | null
): Promise<RecomendacionDia | null> {
  const plan = await getPlanComidas(userId);
  if (!plan) return null;
  const comidas = ordenarPorHorario(comidasPorMomento(plan.items, tipo, plan.plan.horarios), cn);
  if (!comidas.length) return null;
  return { tipo, comidas, avisos: avisosPreparacion(comidas, cn), notas: plan.plan.notas };
}

