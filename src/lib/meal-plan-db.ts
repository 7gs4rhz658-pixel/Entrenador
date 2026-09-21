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
  normalizarTexto,
  ordenarPorHorario,
  type RecomendacionDia
} from "./meal-plan";
import type {
  BatchCooking,
  CuestionarioNutricion,
  Ingredient,
  ItemComidaResuelto,
  PlanComidasGenerado,
  PlanComidasResuelto,
  TipoDia
} from "./types";

// ── 2. Resolver ingredientes contra la base ─────────────────────

// Elige el ingrediente que mejor coincide con el nombre pedido: exacto >
// empieza igual > contiene > misma primera palabra; a igualdad, USDA/manual
// antes que Open Food Facts, "cocido" si el pedido lo dice (o por defecto),
// y el nombre más parecido en largo.
const STOP = new Set(["de", "del", "la", "el", "con", "a", "al", "en", "y"]);

function palabras(s: string): string[] {
  return normalizarTexto(s).split(" ").filter((p) => p && !STOP.has(p));
}

function elegir(nombre: string, candidatos: Ingredient[], nota = ""): Ingredient | null {
  const n = normalizarTexto(nombre);
  if (!n) return null;
  const pedido = palabras(nombre);
  const pide = normalizarTexto(`${nombre} ${nota}`);
  const pideCocido = /cocid|hervid|horno|plancha|asad/.test(pide);
  const pideCrudo = /crud/.test(pide);
  let mejor: { ing: Ingredient; score: number } | null = null;
  for (const ing of candidatos) {
    const c = normalizarTexto(ing.nombre);
    const cp = palabras(ing.nombre);
    let score = 0;
    if (c === n) score = 40;
    else if (c.startsWith(n) || n.startsWith(c)) score = 30;
    else if (c.includes(n) || n.includes(c)) score = 20;
    else if (pedido.length && cp.length && pedido.every((p) => cp.includes(p))) score = 18;
    else if (pedido[0] && cp[0] === pedido[0]) score = 10;
    if (!score) continue;
    if (ing.fuente !== "off") score += 5;
    const esCocido = /cocid|hervid/.test(c);
    const esCrudo = /crud/.test(c);
    if (pideCocido && esCocido) score += 3;
    if (pideCrudo && esCrudo) score += 3;
    if (!pideCrudo && esCrudo) score -= 2;
    score -= Math.min(4, Math.abs(c.length - n.length) / 8);
    if (!mejor || score > mejor.score) mejor = { ing, score };
  }
  return mejor?.ing ?? null;
}

// Busca local con el nombre completo, luego con menos palabras
// ("batata hervida" → "batata"), y recién después en Open Food Facts.
async function resolverNombre(
  nombre: string,
  nota: string,
  userId: string,
  cache: Map<string, Ingredient | null>
): Promise<Ingredient | null> {
  const clave = normalizarTexto(`${nombre}|${nota}`);
  if (cache.has(clave)) return cache.get(clave)!;
  let ing: Ingredient | null = null;
  // Los intentos usan las palabras originales (con acento): el ilike de
  // la base no ignora acentos, "salmon" no encuentra "Salmón".
  const intentos = [nombre];
  const ps = nombre
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !STOP.has(normalizarTexto(p)));
  if (ps.length > 2) intentos.push(ps.slice(0, 2).join(" "));
  if (ps.length > 1 && ps[0].length >= 4) intentos.push(ps[0]);
  for (const t of intentos) {
    ing = elegir(nombre, await buscarIngredientesLocal(t, 15), nota);
    if (ing) break;
  }
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
  return { nombre: plan.nombre, notas: plan.notas ?? null, items };
}

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
  const comidas = ordenarPorHorario(comidasPorMomento(plan.items, tipo), cn);
  if (!comidas.length) return null;
  return { tipo, comidas, avisos: avisosPreparacion(comidas, cn), notas: plan.plan.notas };
}

