// Operaciones de negocio sobre semanas y bloques: cerrar semana,
// recalcular la semana siguiente y crear un bloque nuevo.

import { db } from "./supabase/server";
import {
  contarBloques,
  exec,
  getBloque,
  getEjercicios,
  getLogs,
  getMesociclo,
  getPlanes,
  logsPorEjercicio,
  planesPorEjercicio,
  semanaCerrada
} from "./data";
import { iaDisponible, sugerirAjustes, type ItemAjuste } from "./ai";
import {
  acotarSugerencia,
  faseDe,
  planSiguiente,
  planSiguienteFijo,
  usaPeso
} from "./progression";
import { activoEnSemana } from "./rutina";
import type { Exercise, LoggedSet, Mesocycle, PlannedSet } from "./types";

interface FilaPlan {
  user_id: string;
  mesocycle_id: string;
  exercise_id: string;
  semana: number;
  series: number;
  reps: number | null;
  peso_kg: number | null;
  al_fallo: boolean;
  rir_objetivo: number | null;
  nota_ia: string | null;
}

// Propuestas deterministas para la semana `semanaBase + 1`. Los
// ejercicios que terminan con su fase no siguen; los de la fase que
// empieza ya tienen su plan desde que se envió la rutina.
async function proponerSemana(
  meso: Mesocycle,
  semanaBase: number,
  nuevoBloque = false
): Promise<{ filas: FilaPlan[]; items: ItemAjuste[] }> {
  const [ejercicios, planes, logs] = await Promise.all([
    getEjercicios(meso.user_id),
    getPlanes(meso.id, semanaBase),
    getLogs(meso.id, semanaBase)
  ]);
  const planesPrev = semanaBase > 1 ? await getPlanes(meso.id, semanaBase - 1) : [];

  const mPlanes = planesPorEjercicio(planes);
  const mLogs = logsPorEjercicio(logs);
  const mPlanesPrev = planesPorEjercicio(planesPrev);

  const filas: FilaPlan[] = [];
  const items: ItemAjuste[] = [];
  const delEntrenador = meso.progresion === "plan";
  for (const ex of ejercicios) {
    const plan = mPlanes[ex.id];
    if (!plan || (!nuevoBloque && !activoEnSemana(ex, semanaBase + 1))) continue;
    const registros = mLogs[ex.id] ?? [];
    const sig = delEntrenador
      ? planSiguienteFijo(ex, plan, registros)
      : planSiguiente(ex, semanaBase, plan, mPlanesPrev[ex.id] ?? null, registros);
    filas.push({
      user_id: meso.user_id,
      mesocycle_id: meso.id,
      exercise_id: ex.id,
      semana: semanaBase + 1,
      series: sig.series,
      reps: sig.reps,
      peso_kg: sig.peso_kg,
      al_fallo: sig.al_fallo,
      rir_objetivo: plan.rir_objetivo,
      nota_ia: sig.nota || null
    });
    // Solo pedimos ajuste a la IA si hay peso y registros reales que mirar
    // (el plan del entrenador sigue su regla, sin IA)
    if (!delEntrenador && usaPeso(ex) && plan.peso_kg != null && sig.peso_kg != null && registros.length) {
      items.push(itemAjuste(ex, semanaBase, plan, registros, sig));
    }
  }
  return { filas, items };
}

function itemAjuste(
  ex: Exercise,
  semana: number,
  plan: PlannedSet,
  registros: LoggedSet[],
  sig: { reps: number | null; peso_kg: number | null; nota: string }
): ItemAjuste {
  return {
    exercise_id: ex.id,
    nombre: ex.nombre,
    fase_actual: faseDe(semana),
    plan_actual: { series: plan.series, reps: plan.reps, peso_kg: plan.peso_kg! },
    registros: registros.map((r) => ({
      serie: r.serie,
      reps: r.reps,
      peso_kg: r.peso_kg,
      rir: r.rir,
      al_fallo: r.al_fallo
    })),
    propuesta: { reps: sig.reps, peso_kg: sig.peso_kg!, nota: sig.nota },
    incremento_kg: ex.incremento_kg
  };
}

// Aplica las sugerencias de la IA sobre las filas (acotadas ±15 %).
// Si la IA no está configurada o falla, quedan las propuestas.
async function ajustarConIA(filas: FilaPlan[], items: ItemAjuste[]): Promise<void> {
  if (!items.length || !iaDisponible()) return;
  try {
    const ajustes = await sugerirAjustes(items);
    const porId = new Map(items.map((i) => [i.exercise_id, i]));
    for (const a of ajustes) {
      const item = porId.get(a.exercise_id);
      const fila = filas.find((f) => f.exercise_id === a.exercise_id);
      if (!item || !fila || fila.peso_kg == null) continue;
      const peso = acotarSugerencia(item.propuesta.peso_kg, a.peso_kg, item.incremento_kg);
      fila.peso_kg = peso;
      const motivo = String(a.motivo ?? "").trim().slice(0, 140);
      fila.nota_ia = `IA: ${motivo || item.propuesta.nota}`;
    }
  } catch (e) {
    // La IA es opcional: si falla, seguimos con la regla determinista
    console.error("Ajuste IA falló:", e instanceof Error ? e.message : e);
  }
}

// Calcula y guarda los planes de la semana `semanaBase + 1`.
async function generarPlanesSiguiente(meso: Mesocycle, semanaBase: number): Promise<void> {
  if (semanaBase >= meso.total_semanas) return;
  const { filas, items } = await proponerSemana(meso, semanaBase);
  await ajustarConIA(filas, items);
  if (filas.length) {
    await exec(
      db()
        .from("planned_sets")
        .upsert(filas, { onConflict: "mesocycle_id,exercise_id,semana" })
    );
  }
}

// Botón "Finalizar semana": genera el plan de la semana siguiente,
// marca la semana como cerrada y avanza (o finaliza el bloque en la 8).
export async function cerrarSemana(mesoId: string): Promise<void> {
  const meso = await getMesociclo(mesoId);
  if (meso.estado !== "activo") {
    throw new Error("Este bloque ya está finalizado.");
  }
  const w = meso.semana_actual;

  await generarPlanesSiguiente(meso, w);
  await exec(
    db()
      .from("week_closures")
      .upsert(
        { user_id: meso.user_id, mesocycle_id: mesoId, semana: w },
        { onConflict: "mesocycle_id,semana" }
      )
  );

  if (w < meso.total_semanas) {
    await exec(
      db().from("mesocycles").update({ semana_actual: w + 1 }).eq("id", mesoId)
    );
  } else {
    await exec(
      db().from("mesocycles").update({ estado: "finalizado" }).eq("id", mesoId)
    );
  }
}

// Si se edita lo realizado de una semana ya cerrada, la semana siguiente
// se recalcula sola (mientras no esté cerrada también).
export async function recalcularSemanaSiguiente(
  mesoId: string,
  semana: number
): Promise<void> {
  const meso = await getMesociclo(mesoId);
  if (semana >= meso.total_semanas) return;
  if (!(await semanaCerrada(mesoId, semana))) return;
  if (await semanaCerrada(mesoId, semana + 1)) return;
  await generarPlanesSiguiente(meso, semana);
}

// Al terminar la semana 8: nuevo bloque de 8 semanas. La semana 1 del
// nuevo bloque es la fase 1 del ciclo siguiente (arranca con el peso de
// la última semana de carga).
export async function crearNuevoBloque(userId: string): Promise<void> {
  const anterior = await getBloque(userId);
  if (!anterior) throw new Error("No hay ningún bloque anterior.");
  if (anterior.estado !== "finalizado") {
    throw new Error("El bloque actual todavía está activo.");
  }

  // Siguen los ejercicios de la última semana (en un plan por fases, los
  // de la última fase); el resto se da de baja (el historial queda)
  const { filas, items } = await proponerSemana(anterior, anterior.total_semanas, true);
  await ajustarConIA(filas, items);

  const n = await contarBloques(userId);
  const { data: nuevo, error } = await db()
    .from("mesocycles")
    .insert({
      user_id: userId,
      nombre: `Bloque ${n + 1}`,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      total_semanas: 8,
      origen: "manual",
      progresion: anterior.progresion,
      notas: anterior.fases.length ? null : anterior.notas
    })
    .select()
    .single();
  if (error || !nuevo) {
    throw new Error(`Base de datos: ${error?.message ?? "no se pudo crear el bloque"}`);
  }

  if (filas.length) {
    await exec(
      db()
        .from("planned_sets")
        .insert(filas.map((f) => ({ ...f, mesocycle_id: nuevo.id as string, semana: 1 })))
    );
  }
  if (anterior.fases.length) {
    const siguen = filas.map((f) => f.exercise_id);
    const ejercicios = await getEjercicios(userId);
    const bajas = ejercicios.filter((e) => !siguen.includes(e.id)).map((e) => e.id);
    if (siguen.length) {
      await exec(db().from("exercises").update({ semana_desde: null, semana_hasta: null }).in("id", siguen));
    }
    if (bajas.length) await exec(db().from("exercises").update({ activo: false }).in("id", bajas));
  }
}
