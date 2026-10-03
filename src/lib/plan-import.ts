// Escribe un plan generado (ver plan-generator.ts) en la base.
//  - Borrador: el plan completo queda en mesocycles.plan (jsonb) y el
//    cliente sigue con su rutina mientras el entrenador lo revisa.
//  - Al enviarlo: días, ejercicios y el plan de la primera semana de cada
//    ejercicio (la 1, o la primera de su fase).

import { db } from "./supabase/server";
import {
  contarBloques,
  ejerciciosPorDia,
  exec,
  getBloque,
  getBloqueBorrador,
  getDias,
  getEjercicios,
  q
} from "./data";
import { hoyFecha } from "./format";
import { normalizarPlan } from "./plan-generator";
import { faseDeSemana } from "./rutina";
import type { DiaGenerado, Mesocycle, PlanGenerado, PlannedSet } from "./types";

type Origen = "ia" | "txt" | "plantilla";

function camposBloque(plan: PlanGenerado) {
  return {
    total_semanas: plan.total_semanas ?? 8,
    fases: plan.fases ?? [],
    notas: plan.notas ?? null,
    notas_entrenador: plan.notas_entrenador ?? null,
    progresion: plan.progresion ?? "ondulada"
  };
}

// ── Borrador ────────────────────────────────────────────────────

// Guarda el plan como borrador (reemplaza el borrador anterior, si hay).
// No toca la rutina que el cliente está usando.
export async function guardarBorradorRutina(userId: string, plan: PlanGenerado, origen: Origen): Promise<string> {
  const supabase = db();
  await exec(supabase.from("mesocycles").delete().eq("user_id", userId).eq("publicado", false).not("plan", "is", null));
  const n = await contarBloques(userId);
  const { data, error } = await supabase
    .from("mesocycles")
    .insert({
      user_id: userId,
      nombre: n === 0 ? plan.nombre_bloque : `Bloque ${n + 1} · ${plan.nombre_bloque}`,
      fecha_inicio: plan.fecha_inicio ?? hoyFecha(),
      origen,
      publicado: false,
      plan,
      ...camposBloque(plan)
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Base de datos: ${error?.message ?? "no se pudo guardar el borrador"}`);
  return data.id as string;
}

// El borrador con su plan (los borradores viejos, ya escritos como
// ejercicios, no tienen `plan`)
export async function getBorradorRutina(userId: string): Promise<(Mesocycle & { plan: PlanGenerado }) | null> {
  const b = await getBloqueBorrador(userId);
  return b?.plan ? (b as Mesocycle & { plan: PlanGenerado }) : null;
}

// `nombre`: si el entrenador renombró el bloque (se conserva "Bloque N · ")
export async function actualizarBorradorRutina(mesoId: string, plan: PlanGenerado, nombre?: string): Promise<void> {
  await exec(db().from("mesocycles").update({ plan, ...camposBloque(plan), ...(nombre ? { nombre } : {}) }).eq("id", mesoId));
}

// ── Envío: el plan pasa a ser la rutina del cliente ─────────────

// Publica el borrador. Devuelve null si no hay ninguno.
export async function publicarBorradorRutina(userId: string): Promise<Mesocycle | null> {
  const borrador = await getBloqueBorrador(userId);
  if (!borrador) return null;
  const ahora = new Date().toISOString();
  if (!borrador.plan) {
    await exec(db().from("mesocycles").update({ publicado: true, publicado_at: ahora }).eq("id", borrador.id));
    return borrador;
  }
  const plan = normalizarPlan(borrador.plan);
  await escribirRutina(userId, plan, borrador.id);
  return borrador;
}

// Reemplaza la rutina del cliente: finaliza el bloque activo, da de baja
// los ejercicios viejos (se conserva el historial), deja los 7 días
// configurados y escribe los ejercicios con su primera semana.
async function escribirRutina(userId: string, plan: PlanGenerado, mesoId: string): Promise<void> {
  const supabase = db();
  const anterior = await getBloque(userId);
  if (anterior && anterior.estado === "activo" && anterior.id !== mesoId) {
    await exec(supabase.from("mesocycles").update({ estado: "finalizado" }).eq("id", anterior.id));
  }
  await exec(supabase.from("exercises").update({ activo: false }).eq("user_id", userId).eq("activo", true));

  // Los 7 días existen siempre; los del plan quedan como entreno
  const porDia = new Map(plan.dias.map((d) => [d.dia_semana, d]));
  const filasDias = Array.from({ length: 7 }, (_, i) => {
    const d = porDia.get(i + 1);
    return { user_id: userId, dia_semana: i + 1, nombre: d?.nombre ?? null, es_descanso: !d };
  });
  const { data: dias, error: eDias } = await supabase
    .from("training_days")
    .upsert(filasDias, { onConflict: "user_id,dia_semana" })
    .select("id, dia_semana");
  if (eDias || !dias) throw new Error(`Base de datos: ${eDias?.message ?? "sin días"}`);
  const idDia = new Map((dias as { id: string; dia_semana: number }[]).map((d) => [d.dia_semana, d.id]));

  await exec(
    supabase
      .from("mesocycles")
      .update({
        publicado: true,
        publicado_at: new Date().toISOString(),
        plan: null,
        estado: "activo",
        semana_actual: 1,
        fecha_inicio: plan.fecha_inicio ?? hoyFecha(),
        ...camposBloque(plan)
      })
      .eq("id", mesoId)
  );

  const filasEj = plan.dias.flatMap((d) =>
    d.ejercicios.map((e, i) => ({
      user_id: userId,
      training_day_id: idDia.get(d.dia_semana)!,
      nombre: e.nombre,
      grupo_muscular: e.grupo_muscular,
      descripcion: e.descripcion ?? null,
      tips: e.tips ?? [],
      tipo: e.progresion === "compuesto" ? "compuesto" : "aislamiento",
      progresion: e.progresion,
      unidad: e.unidad,
      incremento_kg: e.incremento_kg,
      rep_min: e.rep_min,
      rep_max: e.rep_max,
      descanso_seg: e.descanso_seg,
      orden: i + 1,
      semana_desde: e.semana_desde ?? null,
      semana_hasta: e.semana_hasta ?? null,
      tempo: e.tempo ?? null,
      parciales: e.parciales ?? null,
      por_lado: e.por_lado ?? false,
      superserie: e.superserie ?? null,
      nota: e.nota ?? null,
      pasos: e.pasos ?? [],
      clave: e.clave ?? null,
      verbos: e.verbos ?? null
    }))
  );
  const { data: ejercicios, error: eEj } = await supabase
    .from("exercises")
    .insert(filasEj)
    .select("id, training_day_id, orden");
  if (eEj || !ejercicios) throw new Error(`Base de datos: ${eEj?.message ?? "no se pudieron crear los ejercicios"}`);

  // Primera semana de cada ejercicio: piso del rango al peso inicial
  const porClave = new Map(
    (ejercicios as { id: string; training_day_id: string; orden: number }[]).map((e) => [`${e.training_day_id}:${e.orden}`, e.id])
  );
  const delEntrenador = (plan.progresion ?? "ondulada") === "plan";
  const filasPlan = plan.dias.flatMap((d) =>
    d.ejercicios.map((e, i) => {
      const alFallo = e.progresion === "al_fallo";
      const semana = e.semana_desde ?? 1;
      const rirFase = faseDeSemana(plan.fases, semana)?.fase.rir ?? null;
      return {
        user_id: userId,
        mesocycle_id: mesoId,
        exercise_id: porClave.get(`${idDia.get(d.dia_semana)}:${i + 1}`)!,
        semana,
        series: e.series,
        reps: alFallo ? null : e.rep_min,
        peso_kg: e.unidad === "kg" ? e.peso_inicial_kg : null,
        al_fallo: alFallo,
        rir_objetivo: alFallo ? null : delEntrenador ? rirFase : 2,
        nota_ia: null
      };
    })
  );
  await exec(supabase.from("planned_sets").insert(filasPlan));
}

// ── Lectura: rutina → plan (para guardarla como plantilla) ──────

// El borrador si hay; si no, la rutina vigente del cliente (días,
// ejercicios, series/rangos y fases). Sin pesos: la plantilla sirve para
// otros clientes y cada uno define los suyos en el primer entreno.
export async function planDesdeRutina(userId: string): Promise<PlanGenerado | null> {
  const borrador = await getBorradorRutina(userId);
  if (borrador) {
    const p = normalizarPlan(borrador.plan);
    return { ...p, fecha_inicio: null, dias: p.dias.map((d) => ({ ...d, ejercicios: d.ejercicios.map((e) => ({ ...e, peso_inicial_kg: null })) })) };
  }
  const meso = await getBloque(userId);
  const [dias, ejercicios] = await Promise.all([getDias(userId), getEjercicios(userId)]);
  if (!ejercicios.length) return null;
  // Series de cada ejercicio: su plan más reciente del bloque
  const planes = meso
    ? await q<PlannedSet[]>(db().from("planned_sets").select("*").eq("mesocycle_id", meso.id).order("semana"))
    : [];
  const series = new Map(planes.map((p) => [p.exercise_id, p.series]));
  const porDia = ejerciciosPorDia(ejercicios);
  const diasPlan: DiaGenerado[] = dias
    .filter((d) => !d.es_descanso && (porDia[d.id] ?? []).length > 0)
    .map((d) => ({
      dia_semana: d.dia_semana,
      nombre: d.nombre ?? "",
      ejercicios: (porDia[d.id] ?? [])
        .sort((a, b) => a.orden - b.orden)
        .map((e) => ({
          nombre: e.nombre,
          grupo_muscular: e.grupo_muscular ?? "otro",
          unidad: e.unidad,
          progresion: e.progresion,
          series: series.get(e.id) ?? 3,
          rep_min: e.rep_min ?? 8,
          rep_max: e.rep_max ?? 12,
          peso_inicial_kg: null,
          incremento_kg: e.incremento_kg,
          descanso_seg: e.descanso_seg,
          descripcion: e.descripcion ?? undefined,
          tips: e.tips,
          semana_desde: e.semana_desde,
          semana_hasta: e.semana_hasta,
          tempo: e.tempo,
          parciales: e.parciales,
          por_lado: e.por_lado,
          superserie: e.superserie,
          nota: e.nota,
          pasos: e.pasos,
          clave: e.clave,
          verbos: e.verbos
        }))
    }));
  if (!diasPlan.length) return null;
  return normalizarPlan({
    nombre_bloque: meso?.nombre.replace(/^Bloque \d+ · /, "") ?? "Rutina",
    notas: meso?.notas ?? undefined,
    total_semanas: meso?.total_semanas,
    fases: meso?.fases ?? [],
    notas_entrenador: meso?.notas_entrenador ?? undefined,
    progresion: meso?.progresion,
    dias: diasPlan
  });
}
