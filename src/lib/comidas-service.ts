// Orquesta la recomendación de comidas: IA o .txt → resolver
// ingredientes → cuadrar → aplicar con su guía de batch cooking. Lo usan
// las server actions del entrenador y el alta del cliente (pago).

import { VERSION_MENU_TXT, generarRecomendacionComidas, pedirComidasTxt, planificarBatchCooking } from "./ai-comidas";
import { iaDisponible } from "./ai";
import { contarDiasEntreno, nombresBase } from "./data";
import { conLectura } from "./ia-lecturas";
import { batchBasico, calcularTandas, cuadrarMacros, normalizarPlanComidas } from "./meal-plan";
import { aplicarPlanComidas, resolverPlanComidas } from "./meal-plan-db";
import { objetivosCliente, type Macros } from "./nutrition";
import type { BatchCooking, MealPlanItem, PlanComidasResuelto, Profile, TipoDia } from "./types";

export interface RecomendacionPreparada {
  plan: PlanComidasResuelto;
  objetivos: Record<TipoDia, Macros>;
}

export function objetivosDeReferencia(perfil: Profile): Record<TipoDia, Macros> | null {
  const entreno = objetivosCliente(perfil, true);
  const descanso = objetivosCliente(perfil, false);
  if (!entreno || !descanso) return null;
  return { entreno, descanso };
}

// Menú generado por la IA y cuadrado con la referencia del cliente.
export async function prepararRecomendacionIA(perfil: Profile): Promise<RecomendacionPreparada> {
  const objetivos = objetivosDeReferencia(perfil);
  if (!objetivos) throw new Error("Faltan edad, sexo, peso o altura del cliente para calcular su referencia diaria.");
  const generado = await generarRecomendacionComidas(perfil, objetivos, await nombresBase());
  const resuelto = await resolverPlanComidas(generado, perfil.id);
  return { plan: { ...resuelto, items: cuadrarMacros(resuelto.items, objetivos) }, objetivos };
}

// Menú del entrenador en texto: se respeta tal cual (sin cuadrar). Lo que
// leyó la IA de ese texto queda guardado: el mismo texto da el mismo menú.
export async function prepararRecomendacionTxt(
  perfil: Profile,
  texto: string,
  releer = false
): Promise<RecomendacionPreparada & { lecturaGuardada: boolean }> {
  const objetivos = objetivosDeReferencia(perfil) ?? {
    entreno: { kcal: 0, prot_g: 0, carb_g: 0, grasa_g: 0 },
    descanso: { kcal: 0, prot_g: 0, carb_g: 0, grasa_g: 0 }
  };
  const base = await nombresBase();
  const { resultado, guardada } = await conLectura("menu", VERSION_MENU_TXT, texto, releer, () =>
    pedirComidasTxt(texto, perfil, base)
  );
  const plan = await resolverPlanComidas(normalizarPlanComidas(resultado), perfil.id);
  return { plan, objetivos, lecturaGuardada: guardada };
}

// Guía de batch cooking para el menú: tandas deterministas + orden de
// cocción de la IA (o la guía básica si la IA no responde).
async function guiaBatch(perfil: Profile, plan: PlanComidasResuelto): Promise<BatchCooking | null> {
  const diasEntreno = await contarDiasEntreno(perfil.id);
  const comoItems = plan.items
    .filter((i) => i.ingredient)
    .map((i) => ({ tipo_dia: i.tipo_dia, ingredient_id: i.ingredient!.id, ingredient: i.ingredient!, cantidad_g: i.cantidad_g })) as MealPlanItem[];
  const tandas = calcularTandas(comoItems, diasEntreno || 3);
  if (!tandas.length) return null;
  const dia = perfil.cuestionario_nutricion?.dia_batch ?? 7;
  const basico = batchBasico(dia, tandas);
  if (!iaDisponible()) return basico;
  try {
    const ia = await planificarBatchCooking(tandas);
    return {
      ...basico,
      tiempo_min: ia.tiempo_min,
      pasos: ia.pasos.length ? ia.pasos : basico.pasos,
      conservacion: ia.conservacion.length ? ia.conservacion : basico.conservacion
    };
  } catch {
    return basico;
  }
}

export async function aplicarRecomendacion(
  perfil: Profile,
  plan: PlanComidasResuelto,
  origen: "ia" | "txt",
  publicado = false
): Promise<void> {
  const batch = await guiaBatch(perfil, plan);
  await aplicarPlanComidas(perfil.id, plan, origen, batch, publicado);
}
