"use server";

import { revalidatePath } from "next/cache";
import { resolverUsuario } from "@/lib/auth";
import { exec, getBloque, getDiaPorId, getEjercicio, getEjercicios, semanaCerrada } from "@/lib/data";
import { infoEjercicio } from "@/lib/exercise-info";
import { recalcularSemanaSiguiente } from "@/lib/plan-service";
import { activoEnSemana, parsearTempo } from "@/lib/rutina";
import { db } from "@/lib/supabase/server";
import type { ModoProgresion, TipoEjercicio, Unidad } from "@/lib/types";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

export async function actualizarDia(input: {
  dayId: string;
  nombre: string | null;
  es_descanso: boolean;
}): Promise<Resultado> {
  try {
    const dia = await getDiaPorId(input.dayId);
    if (!dia) return { error: "No se encontró el día." };
    await resolverUsuario(dia.user_id);
    await exec(
      db()
        .from("training_days")
        .update({
          nombre: input.nombre?.trim() || null,
          es_descanso: input.es_descanso
        })
        .eq("id", input.dayId)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export interface EjercicioInput {
  id: string | null; // null = crear nuevo
  training_day_id: string;
  nombre: string;
  grupo_muscular: string;
  tipo: TipoEjercicio;
  progresion: ModoProgresion;
  unidad: Unidad;
  incremento_kg: number;
  rep_min: number | null;
  rep_max: number | null;
  descanso_seg: number;
  descripcion: string;
  tips: string[];
  // Plan del entrenador por fases y cómo se ejecuta
  semana_desde: number | null;
  semana_hasta: number | null;
  tempo: string; // "3-5-3-0" o vacío
  parciales: number | null;
  por_lado: boolean;
  superserie: string;
  nota: string;
  pasos: string[];
  clave: string;
  // Plan de la semana actual (o de la primera de su fase)
  series: number;
  reps: number | null;
  peso_kg: number | null;
  al_fallo: boolean;
  rir_objetivo: number | null;
}

export async function guardarEjercicio(
  input: EjercicioInput
): Promise<Resultado> {
  const nombre = input.nombre.trim();
  if (!nombre) return { error: "El ejercicio necesita un nombre." };
  if (input.series < 1 || input.series > 12)
    return { error: "Las series tienen que estar entre 1 y 12." };
  if (input.descanso_seg < 0 || input.descanso_seg > 600)
    return { error: "El descanso tiene que estar entre 0 y 600 segundos." };
  if (input.rep_min != null && input.rep_max != null && input.rep_max < input.rep_min)
    return { error: "El tope del rango de reps no puede ser menor que el piso." };
  if (input.semana_desde != null && input.semana_hasta != null && input.semana_hasta < input.semana_desde)
    return { error: "La semana final no puede ser antes de la inicial." };
  const tempo = input.tempo.trim() ? parsearTempo(input.tempo) : null;
  if (input.tempo.trim() && !tempo) return { error: "La cadencia va como 3-5-3-0 (sube, aprieta, baja, pausa abajo)." };

  try {
    const dia = await getDiaPorId(input.training_day_id);
    if (!dia) return { error: "No se encontró el día." };
    const { userId } = await resolverUsuario(dia.user_id);

    // Descripción/tips automáticos si quedaron vacíos
    let descripcion = input.descripcion.trim();
    let tips = input.tips.map((t) => t.trim()).filter(Boolean);
    if (!descripcion || tips.length === 0) {
      const auto = infoEjercicio(nombre, input.grupo_muscular);
      if (!descripcion) descripcion = auto.descripcion;
      if (tips.length === 0) tips = auto.tips;
    }

    const campos = {
      training_day_id: input.training_day_id,
      nombre,
      grupo_muscular: input.grupo_muscular,
      tipo: input.tipo,
      progresion: input.progresion,
      unidad: input.unidad,
      incremento_kg: input.incremento_kg,
      rep_min: input.rep_min,
      rep_max: input.rep_max,
      descanso_seg: Math.round(input.descanso_seg),
      descripcion,
      tips,
      semana_desde: input.semana_desde,
      semana_hasta: input.semana_hasta,
      tempo,
      parciales: input.parciales && input.parciales > 0 ? Math.round(input.parciales) : null,
      por_lado: input.por_lado,
      superserie: input.superserie.trim().slice(0, 10) || null,
      nota: input.nota.trim().slice(0, 200) || null,
      pasos: input.pasos.map((p) => p.trim()).filter(Boolean).slice(0, 10),
      clave: input.clave.trim().slice(0, 220) || null
    };

    let exerciseId = input.id;
    if (exerciseId) {
      await exec(db().from("exercises").update(campos).eq("id", exerciseId));
    } else {
      const ejercicios = await getEjercicios(userId);
      const delDia = ejercicios.filter(
        (e) => e.training_day_id === input.training_day_id
      );
      const orden = delDia.length
        ? Math.max(...delDia.map((e) => e.orden)) + 1
        : 1;
      const { data, error } = await db()
        .from("exercises")
        .insert({ ...campos, user_id: userId, orden })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Base de datos: ${error?.message ?? "no se pudo crear"}`);
      }
      exerciseId = data.id as string;
    }

    // Actualiza el plan de la semana actual del bloque vigente (o el de
    // la primera semana de su fase, si todavía no le toca)
    const meso = await getBloque(userId);
    if (meso) {
      const semana = activoEnSemana(campos, meso.semana_actual) ? meso.semana_actual : Math.max(meso.semana_actual, campos.semana_desde ?? 1);
      await exec(
        db()
          .from("planned_sets")
          .upsert(
            {
              user_id: userId,
              mesocycle_id: meso.id,
              exercise_id: exerciseId,
              semana,
              series: input.series,
              reps: input.al_fallo ? null : input.reps,
              peso_kg: input.unidad === "kg" ? input.peso_kg : null,
              al_fallo: input.al_fallo,
              rir_objetivo: input.rir_objetivo
            },
            { onConflict: "mesocycle_id,exercise_id,semana" }
          )
      );
      // Si la semana actual ya estaba cerrada, que impacte en la siguiente
      if (semana === meso.semana_actual && (await semanaCerrada(meso.id, meso.semana_actual))) {
        await recalcularSemanaSiguiente(meso.id, meso.semana_actual);
      }
    }
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarEjercicio(exerciseId: string): Promise<Resultado> {
  try {
    const ex = await getEjercicio(exerciseId);
    if (!ex) return { error: "No se encontró el ejercicio." };
    await resolverUsuario(ex.user_id);
    // Baja lógica: conserva el historial de registros
    await exec(
      db().from("exercises").update({ activo: false }).eq("id", exerciseId)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Descanso por defecto de un ejercicio (desde el cronómetro del logger)
export async function guardarDescanso(input: {
  exerciseId: string;
  descanso_seg: number;
}): Promise<Resultado> {
  const seg = Math.round(input.descanso_seg);
  if (seg < 0 || seg > 600) return { error: "Descanso fuera de rango." };
  try {
    const ex = await getEjercicio(input.exerciseId);
    if (!ex) return { error: "No se encontró el ejercicio." };
    await resolverUsuario(ex.user_id);
    await exec(
      db().from("exercises").update({ descanso_seg: seg }).eq("id", input.exerciseId)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
