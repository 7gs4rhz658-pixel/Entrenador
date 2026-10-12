// Orquesta la recomendación de comidas: IA o .txt → resolver
// ingredientes → cuadrar → aplicar con su guía de batch cooking. Lo usan
// las server actions del entrenador y el alta del cliente (pago).

import {
  VERSION_MENU_TXT,
  actualizarGramosGuia,
  generarRecomendacionComidas,
  pedirAjusteMenu,
  pedirComidasTxt,
  planificarBatchCooking,
  type MenuParaAjustar
} from "./ai-comidas";
import { iaDisponible } from "./ai";
import { contarDiasEntreno, getPlanComidas, nombresBase } from "./data";
import { conLectura } from "./ia-lecturas";
import {
  MENCIONA_GRAMOS,
  TIPOS_DIA,
  ajusteDeCantidades,
  ajustarAMacros,
  avisoSinLlegar,
  batchBasico,
  calcularTandas,
  cambiosDeGramos,
  metasDelAjuste,
  mismosAlimentos,
  normalizarPlanComidas,
  palabrasAEvitar,
  soloCambianCifras,
  totalesDe,
  type CambioGramos
} from "./meal-plan";
import { aplicarPlanComidas, resolverPlanComidas } from "./meal-plan-db";
import { objetivosCliente, type Macros } from "./nutrition";
import type { BatchCooking, MealPlanItem, PlanComidasResuelto, Profile, TipoDia } from "./types";

export interface RecomendacionPreparada {
  plan: PlanComidasResuelto;
  objetivos: Record<TipoDia, Macros>;
  cambios?: string[]; // lo que cambió la IA al ajustar el menú
  aviso?: string;
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
  return { plan: { ...resuelto, items: ajustarAMacros(resuelto.items, objetivos) }, objetivos };
}

const SIN_OBJETIVOS = { kcal: 0, prot_g: 0, carb_g: 0, grasa_g: 0 };

// El menú que tiene el cliente (el borrador si hay uno, si no el
// enviado), listo para editarlo en la vista previa
export async function menuActual(perfil: Profile): Promise<RecomendacionPreparada> {
  const actual = await getPlanComidas(perfil.id, { conBorrador: true });
  if (!actual) throw new Error("El cliente todavía no tiene menú.");
  return {
    plan: {
      nombre: actual.plan.nombre,
      notas: actual.plan.notas,
      horarios: actual.plan.horarios,
      objetivos: null,
      items: actual.items.map((i) => ({
        tipo_dia: i.tipo_dia,
        momento: i.momento,
        orden: i.orden,
        plato: i.plato,
        nombre_pedido: i.ingredient.nombre,
        ingredient: i.ingredient,
        cantidad_g: Number(i.cantidad_g),
        nota: i.nota
      }))
    },
    objetivos: objetivosDeReferencia(perfil) ?? { entreno: SIN_OBJETIVOS, descanso: SIN_OBJETIVOS }
  };
}

// Lo que el cliente dijo que no come o le da alergia
export function evitarDe(perfil: Profile): string[] {
  const cn = perfil.cuestionario_nutricion;
  return palabrasAEvitar(cn?.alergias, cn?.no_come, perfil.cuestionario?.preferencias);
}

// Ajusta el menú actual a unas calorías (o a la referencia diaria). Solo
// cantidades: mismos alimentos y el código mueve los gramos. Con IA: la IA
// propone los cambios (mismas comidas, sobre todo gramos) y el código
// cierra los macros; si falla, se ajustan solo los gramos.
export async function prepararAjusteMenu(
  perfil: Profile,
  opciones: { indicacion: string; cambiarEvitados: boolean; kcal?: Record<TipoDia, number>; soloCantidades?: boolean }
): Promise<RecomendacionPreparada> {
  const referencia = objetivosDeReferencia(perfil);
  const actual = await menuActual(perfil);
  let items = actual.plan.items;
  const kcal = opciones.kcal;
  if (!kcal && !referencia) throw new Error("Falta la referencia diaria: fíjala a mano o completa edad, sexo, peso y altura.");
  const objetivos: Record<TipoDia, Macros> = kcal
    ? {
        entreno: metasDelAjuste(totalesDe(items, "entreno"), referencia?.entreno ?? null, kcal.entreno),
        descanso: metasDelAjuste(totalesDe(items, "descanso"), referencia?.descanso ?? null, kcal.descanso)
      }
    : referencia!;
  // Otras calorías que la referencia: al guardar se ofrece dejarlas como su referencia
  const nuevaReferencia = TIPOS_DIA.some((t) => objetivos[t] !== referencia?.[t]) ? objetivos : null;
  if (opciones.soloCantidades) {
    const r = ajusteDeCantidades(items, objetivos);
    return { plan: { ...actual.plan, items: r.items, objetivos: nuevaReferencia }, objetivos, cambios: r.cambios, aviso: r.aviso };
  }
  let cambios: string[] = [];
  let aviso: string | undefined;
  if (iaDisponible()) {
    try {
      const menus: MenuParaAjustar[] = TIPOS_DIA.map((tipo) => {
        const del = items.filter((i) => i.tipo_dia === tipo && i.ingredient);
        const momentos = [...new Set(del.map((i) => i.momento))];
        return {
          tipo,
          totales: totalesDe(items, tipo),
          objetivo: objetivos[tipo],
          comidas: momentos.map((m) => ({
            momento: m,
            plato: del.find((i) => i.momento === m && i.plato)?.plato ?? "",
            ingredientes: del
              .filter((i) => i.momento === m)
              .map((i) => ({
                nombre: i.ingredient!.nombre,
                gramos: i.cantidad_g,
                kcal_100: i.ingredient!.kcal_100,
                prot_100: i.ingredient!.prot_100,
                carb_100: i.ingredient!.carb_100,
                grasa_100: i.ingredient!.grasa_100,
                nota: i.nota
              }))
          }))
        };
      });
      const raw = await pedirAjusteMenu(menus, perfil, await nombresBase(), {
        indicacion: opciones.indicacion.slice(0, 500),
        evitar: opciones.cambiarEvitados ? evitarDe(perfil) : []
      });
      const momentos = [...new Set(items.map((i) => i.momento))];
      const generado = normalizarPlanComidas(raw, momentos);
      if (!generado.entreno.length) throw new Error("La IA devolvió un menú vacío.");
      const resuelto = await resolverPlanComidas(generado, perfil.id);
      // Las notas del entrenador ("3 piezas", "peso en crudo") se conservan
      // aunque la IA no las repita: "3 piezas" además evita que se escale
      const original = items;
      items = resuelto.items.map((i) => {
        if (i.nota || !i.ingredient) return i;
        const antes = original.find(
          (o) => o.tipo_dia === i.tipo_dia && o.momento === i.momento && o.ingredient?.id === i.ingredient!.id && o.nota
        );
        return antes ? { ...i, nota: antes.nota } : i;
      });
      const r = (raw ?? {}) as { cambios?: unknown };
      cambios = (Array.isArray(r.cambios) ? r.cambios : []).map((c) => String(c).trim().slice(0, 160)).filter(Boolean).slice(0, 5);
    } catch (e) {
      aviso = `La IA no pudo ajustar el menú (${e instanceof Error ? e.message : "error"}): se ajustaron solo los gramos.`;
    }
  } else {
    aviso = "Sin IA configurada: se ajustaron solo los gramos.";
  }
  const ajustados = ajustarAMacros(items, objetivos);
  return {
    plan: { ...actual.plan, items: ajustados, objetivos: nuevaReferencia },
    objetivos,
    cambios,
    aviso: [aviso, avisoSinLlegar(ajustados, objetivos)].filter(Boolean).join(" ") || undefined
  };
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
// cocción de la IA (o la guía básica si la IA no responde). Si el menú
// tiene los mismos alimentos que el actual (solo cambiaron gramos), la
// guía que ya tenía (puede ser la del entrenador) se conserva: se rehacen
// las tandas y la IA pone al día los gramos que mencione.
async function guiaBatch(perfil: Profile, plan: PlanComidasResuelto): Promise<BatchCooking | null> {
  const diasEntreno = await contarDiasEntreno(perfil.id);
  const comoItems = plan.items
    .filter((i) => i.ingredient)
    .map((i) => ({ tipo_dia: i.tipo_dia, ingredient_id: i.ingredient!.id, ingredient: i.ingredient!, cantidad_g: i.cantidad_g })) as MealPlanItem[];
  const tandas = calcularTandas(comoItems, diasEntreno || 3);
  if (!tandas.length) return null;
  const actual = await getPlanComidas(perfil.id, { conBorrador: true });
  const previa = actual?.plan.batch_cooking;
  if (actual && previa?.pasos?.length && mismosAlimentos(actual.items, plan.items)) {
    return { ...previa, tandas, ...(await gramosAlDia(previa, cambiosDeGramos(actual.items, plan.items), tandas)) };
  }
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

// Las cantidades que menciona la guía ("tápers de 250g", "2.6 kg de
// camote") con las porciones y los totales nuevos. Si la IA cambia algo
// más que cifras, queda el texto como estaba.
async function gramosAlDia(
  guia: BatchCooking,
  cambios: CambioGramos[],
  tandas: BatchCooking["tandas"]
): Promise<Pick<BatchCooking, "pasos" | "conservacion">> {
  const sin = { pasos: guia.pasos, conservacion: guia.conservacion ?? [] };
  if (!cambios.length || !iaDisponible() || ![...sin.pasos, ...sin.conservacion].some((t) => MENCIONA_GRAMOS.test(t))) return sin;
  const previos = new Map((guia.tandas ?? []).flatMap((t) => t.items).map((i) => [i.nombre, Math.round(i.gramos_semana)]));
  const totales = tandas
    .flatMap((t) => t.items)
    .map((i) => ({ nombre: i.nombre, antes: previos.get(i.nombre) ?? 0, despues: Math.round(i.gramos_semana) }))
    .filter((t) => t.antes && t.antes !== t.despues);
  // Guardar tiene 60 s: si la IA tarda, la guía queda como estaba
  const tope = new Promise<null>((r) => setTimeout(() => r(null), 25_000));
  const nueva = await Promise.race([actualizarGramosGuia(sin, cambios, totales).catch(() => null), tope]);
  return nueva && soloCambianCifras(sin.pasos, nueva.pasos) && soloCambianCifras(sin.conservacion, nueva.conservacion) ? nueva : sin;
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
