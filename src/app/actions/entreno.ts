"use server";

import { revalidatePath } from "next/cache";
import { resolverUsuario } from "@/lib/auth";
import { exec, getMesociclo, getPlanes } from "@/lib/data";
import {
  cerrarSemana,
  crearNuevoBloque,
  recalcularSemanaSiguiente
} from "@/lib/plan-service";
import { db } from "@/lib/supabase/server";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

// El dueño del bloque es quien manda: el cliente solo puede tocar los
// suyos y el entrenador los de cualquiera (RLS lo vuelve a verificar).
async function duenoDe(mesoId: string): Promise<string> {
  const meso = await getMesociclo(mesoId);
  const { userId } = await resolverUsuario(meso.user_id);
  return userId;
}

// ── Registro de series ──────────────────────────────────────────

export interface SerieInput {
  mesoId: string;
  exerciseId: string;
  semana: number;
  serie: number;
  reps: number | null;
  peso_kg: number | null;
  rir: number | null;
  al_fallo: boolean;
  descanso_seg?: number | null;
}

export async function guardarSerie(input: SerieInput): Promise<Resultado> {
  try {
    const userId = await duenoDe(input.mesoId);
    await exec(
      db()
        .from("logged_sets")
        .upsert(
          {
            user_id: userId,
            mesocycle_id: input.mesoId,
            exercise_id: input.exerciseId,
            semana: input.semana,
            serie: input.serie,
            reps: input.reps,
            peso_kg: input.peso_kg,
            rir: input.rir,
            al_fallo: input.al_fallo,
            descanso_seg: input.descanso_seg ?? null,
            completado: true,
            logged_at: new Date().toISOString()
          },
          { onConflict: "mesocycle_id,exercise_id,semana,serie" }
        )
    );
    // Semana ya cerrada → la siguiente se recalcula sola
    await recalcularSemanaSiguiente(input.mesoId, input.semana);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarSerie(input: {
  mesoId: string;
  exerciseId: string;
  semana: number;
  serie: number;
}): Promise<Resultado> {
  try {
    await duenoDe(input.mesoId);
    await exec(
      db()
        .from("logged_sets")
        .delete()
        .eq("mesocycle_id", input.mesoId)
        .eq("exercise_id", input.exerciseId)
        .eq("semana", input.semana)
        .eq("serie", input.serie)
    );
    await recalcularSemanaSiguiente(input.mesoId, input.semana);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// "Todo según plan": registra todas las series con los valores planificados
export async function registrarSegunPlan(input: {
  mesoId: string;
  exerciseId: string;
  semana: number;
}): Promise<Resultado> {
  try {
    const userId = await duenoDe(input.mesoId);
    const planes = await getPlanes(input.mesoId, input.semana);
    const plan = planes.find((p) => p.exercise_id === input.exerciseId);
    if (!plan) return { error: "Este ejercicio no tiene plan esta semana." };
    const filas = Array.from({ length: plan.series }, (_, i) => ({
      user_id: userId,
      mesocycle_id: input.mesoId,
      exercise_id: input.exerciseId,
      semana: input.semana,
      serie: i + 1,
      reps: plan.reps,
      peso_kg: plan.peso_kg,
      rir: plan.rir_objetivo,
      al_fallo: plan.al_fallo,
      completado: true,
      logged_at: new Date().toISOString()
    }));
    await exec(
      db()
        .from("logged_sets")
        .upsert(filas, { onConflict: "mesocycle_id,exercise_id,semana,serie" })
    );
    await recalcularSemanaSiguiente(input.mesoId, input.semana);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Semanas y bloques ───────────────────────────────────────────

export async function finalizarSemana(mesoId: string): Promise<Resultado> {
  try {
    await duenoDe(mesoId);
    await cerrarSemana(mesoId);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function crearBloque(userIdObjetivo?: string): Promise<Resultado> {
  try {
    const { userId } = await resolverUsuario(userIdObjetivo);
    await crearNuevoBloque(userId);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
