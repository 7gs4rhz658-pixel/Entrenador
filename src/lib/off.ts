// Open Food Facts: búsqueda de alimentos con macros por 100 g y caché en
// la tabla `ingredients`. Los números salen de la base abierta, no de la
// IA. Solo se usa desde el servidor.

import { db } from "./supabase/server";
import { buscarIngredientesLocal } from "./data";
import type { Ingredient } from "./types";

interface ProductoOFF {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
}

const USER_AGENT = "MiEntrenadorPersonal/2.0 (app de entrenamiento; contacto via GitHub)";

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function aIngrediente(p: ProductoOFF): Omit<Ingredient, "id"> | null {
  const n = p.nutriments ?? {};
  const kcal =
    num(n["energy-kcal_100g"]) ??
    (num(n["energy_100g"]) != null ? Math.round(num(n["energy_100g"])! / 4.184) : null);
  const prot = num(n["proteins_100g"]);
  const carb = num(n["carbohydrates_100g"]);
  const grasa = num(n["fat_100g"]);
  const nombre = (p.product_name_es || p.product_name || "").trim();
  if (!nombre || kcal == null || kcal < 0 || kcal > 950) return null;
  if (prot == null && carb == null && grasa == null) return null;
  return {
    nombre: nombre.slice(0, 80),
    marca: (p.brands ?? "").split(",")[0]?.trim().slice(0, 40) || null,
    fuente: "off",
    off_code: p.code ?? null,
    kcal_100: Math.round(kcal * 10) / 10,
    prot_100: Math.round((prot ?? 0) * 10) / 10,
    carb_100: Math.round((carb ?? 0) * 10) / 10,
    grasa_100: Math.round((grasa ?? 0) * 10) / 10
  };
}

// Busca en OFF (texto libre, prioriza español) y devuelve hasta `limite`
// productos con macros completos. Sin caché aún: ver buscarYCachear.
export async function buscarEnOFF(texto: string, limite = 10): Promise<Omit<Ingredient, "id">[]> {
  const t = texto.trim();
  if (t.length < 2) return [];
  const params = new URLSearchParams({
    search_terms: t,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(Math.min(limite * 2, 40)),
    lc: "es",
    fields: "code,product_name,product_name_es,brands,nutriments"
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store"
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: ProductoOFF[] };
    const vistos = new Set<string>();
    const lista: Omit<Ingredient, "id">[] = [];
    for (const p of data.products ?? []) {
      const ing = aIngrediente(p);
      if (!ing) continue;
      const clave = `${ing.nombre.toLowerCase()}|${(ing.marca ?? "").toLowerCase()}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      lista.push(ing);
      if (lista.length >= limite) break;
    }
    return lista;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Búsqueda combinada: primero la base local (USDA + manuales + caché OFF);
// si hay pocos resultados, consulta OFF y guarda lo nuevo en la base.
export async function buscarIngredientes(
  texto: string,
  userId: string
): Promise<Ingredient[]> {
  const locales = await buscarIngredientesLocal(texto, 12);
  if (locales.length >= 6) return locales;

  const remotos = await buscarEnOFF(texto, 10);
  if (!remotos.length) return locales;

  const codigos = new Set(locales.map((l) => l.off_code).filter(Boolean));
  const nuevos = remotos
    .filter((r) => r.off_code && !codigos.has(r.off_code))
    .map((r) => ({ ...r, creado_por: userId }));
  if (!nuevos.length) return locales;

  const { data, error } = await db()
    .from("ingredients")
    .upsert(nuevos, { onConflict: "off_code", ignoreDuplicates: true })
    .select("*");
  if (error) throw new Error(`Base de datos: ${error.message}`);
  const insertados = (data ?? []) as Ingredient[];
  // upsert con ignoreDuplicates no devuelve los que ya existían: los
  // recuperamos por código para que la lista quede completa.
  if (insertados.length < nuevos.length) {
    const faltan = nuevos
      .filter((n) => !insertados.some((i) => i.off_code === n.off_code))
      .map((n) => n.off_code!);
    const { data: existentes } = await db().from("ingredients").select("*").in("off_code", faltan);
    insertados.push(...((existentes ?? []) as Ingredient[]));
  }
  return [...locales, ...insertados].slice(0, 16);
}
