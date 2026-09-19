import type { Ingredient, Momento, NivelActividad, Objetivo, Sexo } from "./types";

export interface PerfilNutricion {
  edad: number;
  sexo: Sexo;
  peso_kg: number;
  altura_cm: number;
  nivel_actividad: NivelActividad;
  objetivo: Objetivo;
}

export const FACTORES_ACTIVIDAD: Record<NivelActividad, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725
};

export const ETIQUETAS_ACTIVIDAD: Record<NivelActividad, string> = {
  sedentario: "Sedentario (trabajo de escritorio, poco movimiento)",
  ligero: "Ligero (caminatas, algo de movimiento diario)",
  moderado: "Moderado (trabajo activo o bastante movimiento)",
  alto: "Alto (trabajo físico exigente)"
};

export const MOMENTOS: { valor: Momento; texto: string }[] = [
  { valor: "desayuno", texto: "Desayuno" },
  { valor: "almuerzo", texto: "Almuerzo" },
  { valor: "merienda", texto: "Merienda" },
  { valor: "cena", texto: "Cena" },
  { valor: "snack", texto: "Snack" }
];

export const ETIQUETAS_OBJETIVO: Record<Objetivo, string> = {
  deficit: "Perder grasa (déficit)",
  mantenimiento: "Mantener / recomposición",
  superavit: "Ganar músculo (superávit)"
};

// TMB con Mifflin-St Jeor
export function tmbMifflin(p: PerfilNutricion): number {
  const base = 10 * p.peso_kg + 6.25 * p.altura_cm - 5 * p.edad;
  return p.sexo === "masculino" ? base + 5 : base - 161;
}

export interface Macros {
  kcal: number;
  prot_g: number;
  carb_g: number;
  grasa_g: number;
}

export interface ObjetivosDia extends Macros {
  agua_ml: number;
}

// Ajuste calórico sobre el TDEE según objetivo y si es día de entreno.
// Los días de entreno reciben ~250 kcal más (más gasto y más carbos
// alrededor de la sesión) dentro de cualquier objetivo.
const AJUSTE: Record<Objetivo, { entreno: number; descanso: number }> = {
  deficit: { entreno: -350, descanso: -500 },
  mantenimiento: { entreno: 150, descanso: -100 },
  superavit: { entreno: 350, descanso: 100 }
};

// Reparto de macros:
//  - proteína por kg de peso (más alta en déficit para conservar músculo)
//  - grasa por kg de peso (nunca menos de 0,6 g/kg)
//  - carbohidratos: el resto de las calorías
export function objetivosDiarios(
  p: PerfilNutricion,
  esEntreno: boolean
): ObjetivosDia {
  const tdee = tmbMifflin(p) * FACTORES_ACTIVIDAD[p.nivel_actividad];
  const ajuste = AJUSTE[p.objetivo][esEntreno ? "entreno" : "descanso"];
  const kcal = Math.max(1200, Math.round((tdee + ajuste) / 10) * 10);

  const protKg = p.objetivo === "deficit" ? 2.2 : 2.0;
  const grasaKg = p.objetivo === "deficit" ? 0.7 : 0.9;
  const prot_g = Math.round(protKg * p.peso_kg);
  let grasa_g = Math.round(grasaKg * p.peso_kg);
  let carb_g = Math.round((kcal - prot_g * 4 - grasa_g * 9) / 4);
  if (carb_g < 80) {
    // Si no queda lugar para carbos, bajamos grasa hasta el mínimo
    grasa_g = Math.max(Math.round(0.6 * p.peso_kg), Math.round((kcal - prot_g * 4 - 80 * 4) / 9));
    carb_g = Math.max(0, Math.round((kcal - prot_g * 4 - grasa_g * 9) / 4));
  }

  const aguaBase = 35 * p.peso_kg;
  const agua_ml = Math.round((aguaBase + (esEntreno ? 600 : 0)) / 50) * 50;

  return { kcal, prot_g, carb_g, grasa_g, agua_ml };
}

// Devuelve los datos listos para calcular, o null si el perfil está incompleto.
export function datosNutricion(p: {
  edad: number | null;
  sexo: Sexo | null;
  peso_kg: number | null;
  altura_cm: number | null;
  nivel_actividad: NivelActividad;
  objetivo: Objetivo;
}): PerfilNutricion | null {
  if (p.edad == null || p.sexo == null || p.peso_kg == null || p.altura_cm == null) {
    return null;
  }
  return {
    edad: p.edad,
    sexo: p.sexo,
    peso_kg: p.peso_kg,
    altura_cm: p.altura_cm,
    nivel_actividad: p.nivel_actividad,
    objetivo: p.objetivo
  };
}

// ── Cálculos sobre ingredientes ─────────────────────────────────

export function macrosDe(ing: Ingredient, gramos: number): Macros {
  const f = gramos / 100;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: Math.round(ing.kcal_100 * f),
    prot_g: r1(ing.prot_100 * f),
    carb_g: r1(ing.carb_100 * f),
    grasa_g: r1(ing.grasa_100 * f)
  };
}

export function sumarMacros(lista: Macros[]): Macros {
  const t = { kcal: 0, prot_g: 0, carb_g: 0, grasa_g: 0 };
  for (const m of lista) {
    t.kcal += m.kcal;
    t.prot_g += m.prot_g;
    t.carb_g += m.carb_g;
    t.grasa_g += m.grasa_g;
  }
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { kcal: Math.round(t.kcal), prot_g: r1(t.prot_g), carb_g: r1(t.carb_g), grasa_g: r1(t.grasa_g) };
}

export type CriterioSustitucion = "kcal" | "prot" | "carb";

// Gramos del ingrediente nuevo que igualan el criterio elegido (calorías,
// proteína o carbohidratos) del original. Regla de tres sobre la tabla
// de macros; devuelve null si el nuevo no aporta ese nutriente.
export function gramosEquivalentes(
  original: Ingredient,
  gramosOriginal: number,
  nuevo: Ingredient,
  criterio: CriterioSustitucion
): number | null {
  const campo = { kcal: "kcal_100", prot: "prot_100", carb: "carb_100" }[criterio] as
    | "kcal_100"
    | "prot_100"
    | "carb_100";
  const valOriginal = original[campo] * (gramosOriginal / 100);
  const val100Nuevo = nuevo[campo];
  if (val100Nuevo <= 0) return null;
  return Math.round((valOriginal / val100Nuevo) * 100);
}
