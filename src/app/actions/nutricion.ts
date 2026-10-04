"use server";

import { revalidatePath } from "next/cache";
import { resolverUsuario } from "@/lib/auth";
import {
  ErrorIA,
  iaDisponible,
  interpretarSustitucion,
  sugerirRecetas,
  type Receta
} from "@/lib/ai";
import { buscarIngredientesLocal, exec, getComidas, getIngrediente, q } from "@/lib/data";
import { gramosEquivalentes, macrosDe, type CriterioSustitucion } from "@/lib/nutrition";
import { buscarIngredientes } from "@/lib/off";
import { permitirIA } from "@/lib/uso-ia";
import { db } from "@/lib/supabase/server";
import type { Ingredient, MealLog, Momento } from "@/lib/types";
import type { Macros } from "@/lib/nutrition";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

const MOMENTOS: Momento[] = ["desayuno", "almuerzo", "merienda", "cena", "snack", "pre_entreno", "post_entreno"];

// ── Búsqueda de alimentos (base local + Open Food Facts) ────────

export async function buscarAlimentos(
  texto: string
): Promise<{ resultados: Ingredient[]; error?: string }> {
  try {
    const { userId } = await resolverUsuario(null);
    const resultados = await buscarIngredientes(texto, userId);
    return { resultados };
  } catch (e) {
    return { resultados: [], error: mensaje(e) };
  }
}

export async function crearIngredienteManual(input: {
  nombre: string;
  kcal_100: number;
  prot_100: number;
  carb_100: number;
  grasa_100: number;
}): Promise<{ ingrediente?: Ingredient; error?: string }> {
  const nombre = input.nombre.trim();
  if (nombre.length < 2) return { error: "Pon el nombre del alimento." };
  const nums = [input.kcal_100, input.prot_100, input.carb_100, input.grasa_100];
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return { error: "Revisa los macros." };
  try {
    const { userId } = await resolverUsuario(null);
    const { data, error } = await db()
      .from("ingredients")
      .insert({
        nombre,
        fuente: "manual",
        kcal_100: input.kcal_100,
        prot_100: input.prot_100,
        carb_100: input.carb_100,
        grasa_100: input.grasa_100,
        creado_por: userId
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") return { error: "Ya existe un alimento con ese nombre." };
      throw new Error(`Base de datos: ${error.message}`);
    }
    return { ingrediente: data as Ingredient };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

// ── Registro de comidas ─────────────────────────────────────────

export async function agregarComida(input: {
  userId?: string;
  fecha: string;
  momento: Momento;
  ingredientId: string;
  cantidad_g: number;
}): Promise<Resultado> {
  if (!MOMENTOS.includes(input.momento)) return { error: "Momento inválido." };
  if (!Number.isFinite(input.cantidad_g) || input.cantidad_g <= 0 || input.cantidad_g > 5000)
    return { error: "Revisa la cantidad en gramos." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return { error: "Fecha inválida." };
  try {
    const { userId } = await resolverUsuario(input.userId);
    await exec(
      db().from("meal_logs").insert({
        user_id: userId,
        fecha: input.fecha,
        momento: input.momento,
        ingredient_id: input.ingredientId,
        cantidad_g: Math.round(input.cantidad_g)
      })
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function actualizarComida(input: {
  id: string;
  cantidad_g: number;
}): Promise<Resultado> {
  if (!Number.isFinite(input.cantidad_g) || input.cantidad_g <= 0 || input.cantidad_g > 5000)
    return { error: "Revisa la cantidad en gramos." };
  try {
    await resolverUsuario(null);
    await exec(
      db()
        .from("meal_logs")
        .update({ cantidad_g: Math.round(input.cantidad_g) })
        .eq("id", input.id)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarComida(id: string): Promise<Resultado> {
  try {
    await resolverUsuario(null);
    await exec(db().from("meal_logs").delete().eq("id", id));
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Sustitución de ingredientes ─────────────────────────────────

export interface OpcionSustitucion {
  ingrediente: Ingredient;
  gramos: number;
  macros: Macros;
}

export interface ResultadoSustitucion {
  comida?: MealLog; // la comida que se reemplaza
  criterio?: CriterioSustitucion;
  macrosOriginal?: Macros;
  opciones?: OpcionSustitucion[];
  interpretacion?: string;
  error?: string;
}

// Sin IA: entiende "cambiar X por Y", "X por Y", "reemplazar X con Y".
function parsearSimple(texto: string): { quitar: string; poner: string } | null {
  const t = texto.trim().toLowerCase();
  const m =
    t.match(/^(?:cambiar|cambia|reemplazar|reemplaza|sustituir|sustituye|quiero cambiar)?\s*(?:el|la|los|las)?\s*(.+?)\s+(?:por|con)\s+(?:el|la|los|las)?\s*(.+?)\.?$/) ??
    null;
  if (!m) return null;
  return { quitar: m[1].trim(), poner: m[2].trim() };
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function esProteico(i: Ingredient): boolean {
  return i.prot_100 * 4 >= i.kcal_100 * 0.4;
}
function esHidrato(i: Ingredient): boolean {
  return i.carb_100 * 4 >= i.kcal_100 * 0.55;
}

export async function sustituirIngrediente(input: {
  userId?: string;
  fecha: string;
  texto: string;
  criterio?: CriterioSustitucion;
}): Promise<ResultadoSustitucion> {
  try {
    const { userId } = await resolverUsuario(input.userId);
    const comidas = await getComidas(userId, input.fecha);
    if (!comidas.length) return { error: "Todavía no registraste comidas ese día." };

    let quitar: string;
    let poner: string;
    let criterio: CriterioSustitucion | undefined = input.criterio;
    let alternativas: string[] = [];
    let interpretacion = "";

    if (iaDisponible()) {
      const tope = await permitirIA("sustituir");
      if (tope) return { error: tope };
      const p = await interpretarSustitucion(
        input.texto,
        comidas.map((c) => ({ nombre: c.ingredient.nombre, cantidad_g: c.cantidad_g, momento: c.momento }))
      );
      quitar = p.quitar;
      poner = p.poner;
      criterio ??= p.criterio;
      alternativas = p.candidatos_alternativos;
      interpretacion = `Cambiar "${p.quitar}" por "${p.poner}"`;
    } else {
      const p = parsearSimple(input.texto);
      if (!p) return { error: 'No entendí el pedido. Prueba con "cambiar frutos rojos por manzana".' };
      quitar = p.quitar;
      poner = p.poner;
      interpretacion = `Cambiar "${p.quitar}" por "${p.poner}"`;
    }

    // La comida a reemplazar: la que mejor coincide con "quitar"
    const nq = normalizar(quitar);
    const comida =
      comidas.find((c) => normalizar(c.ingredient.nombre) === nq) ??
      comidas.find((c) => normalizar(c.ingredient.nombre).includes(nq)) ??
      comidas.find((c) => nq.includes(normalizar(c.ingredient.nombre).split(" ")[0]));
    if (!comida) {
      return { error: `No encontré "${quitar}" entre las comidas registradas ese día.` };
    }
    const original = comida.ingredient;
    criterio ??= esProteico(original) ? "prot" : esHidrato(original) ? "carb" : "kcal";

    // Candidatos: el ingrediente pedido + alternativas, en base local y OFF
    const nombres = [poner, ...alternativas].filter(Boolean);
    const vistos = new Set<string>([original.id]);
    const candidatos: Ingredient[] = [];
    for (const nombre of nombres) {
      const encontrados =
        (await buscarIngredientesLocal(nombre, 4)).length > 0
          ? await buscarIngredientesLocal(nombre, 4)
          : await buscarIngredientes(nombre, userId);
      for (const i of encontrados) {
        if (vistos.has(i.id)) continue;
        vistos.add(i.id);
        candidatos.push(i);
        if (candidatos.length >= 6) break;
      }
      if (candidatos.length >= 6) break;
    }
    if (!candidatos.length) {
      return { error: `No encontré "${poner}" en la base de alimentos. Prueba con otro nombre o agrégalo a mano.` };
    }

    const opciones: OpcionSustitucion[] = [];
    for (const ing of candidatos) {
      const gramos = gramosEquivalentes(original, comida.cantidad_g, ing, criterio);
      if (gramos == null || gramos <= 0 || gramos > 3000) continue;
      opciones.push({ ingrediente: ing, gramos, macros: macrosDe(ing, gramos) });
    }
    if (!opciones.length) {
      return { error: "Ninguna opción aporta el nutriente elegido; prueba igualar por calorías." };
    }

    return {
      comida,
      criterio,
      macrosOriginal: macrosDe(original, comida.cantidad_g),
      opciones,
      interpretacion
    };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

// Aplica la sustitución elegida: reemplaza ingrediente y cantidad.
export async function aplicarSustitucion(input: {
  mealLogId: string;
  ingredientId: string;
  gramos: number;
}): Promise<Resultado> {
  if (!Number.isFinite(input.gramos) || input.gramos <= 0) return { error: "Cantidad inválida." };
  try {
    await resolverUsuario(null);
    const ing = await getIngrediente(input.ingredientId);
    if (!ing) return { error: "No se encontró el ingrediente." };
    await exec(
      db()
        .from("meal_logs")
        .update({ ingredient_id: input.ingredientId, cantidad_g: Math.round(input.gramos) })
        .eq("id", input.mealLogId)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Recetas dentro de los macros restantes ──────────────────────

export async function pedirRecetas(input: {
  restantes: Macros;
  preferencias: string;
  momentos: Momento[];
}): Promise<{ recetas?: Receta[]; error?: string }> {
  if (!iaDisponible()) {
    return { error: "Las recetas necesitan la IA configurada (GROQ_API_KEY o GEMINI_API_KEY)." };
  }
  try {
    await resolverUsuario(null);
    const tope = await permitirIA("recetas");
    if (tope) return { error: tope };
    const base = await q<{ nombre: string }[]>(
      db().from("ingredients").select("nombre").neq("fuente", "off").order("nombre").limit(80)
    );
    const recetas = await sugerirRecetas(
      input.restantes,
      input.preferencias.slice(0, 300),
      base.map((b) => b.nombre),
      (input.momentos ?? []).filter((m) => MOMENTOS.includes(m)).slice(0, 6)
    );
    return { recetas };
  } catch (e) {
    return { error: e instanceof ErrorIA ? e.message : mensaje(e) };
  }
}
