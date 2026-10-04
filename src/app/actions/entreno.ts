"use server";

import { revalidatePath } from "next/cache";
import { requireSesion, resolverUsuario } from "@/lib/auth";
import { exec, getEjercicio, getMesociclo, getPlanes, maximoHistorico } from "@/lib/data";
import { hoyFecha } from "@/lib/format";
import { estadoPago } from "@/lib/pagos";
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

// Con el mes vencido el cliente sigue viendo y registrando, pero no
// avanza de semana ni arranca bloques nuevos hasta renovar. El
// entrenador no tiene esa restricción.
async function exigirMesVigente(): Promise<void> {
  const s = await requireSesion();
  if (s.perfil.rol === "entrenador") return;
  if (estadoPago(s.perfil, hoyFecha()).vencido) {
    throw new Error("Tu mes venció. Renueva desde Inicio para cerrar la semana y seguir con el plan.");
  }
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
  logged_at?: string | null; // la serie quedó en el teléfono sin señal y se sube después
}

// Una serie que se subió tarde conserva su hora real (hasta 7 días atrás);
// si no viene o no es creíble, vale la del servidor.
function horaRegistro(iso?: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  const ahora = Date.now();
  const creible = Number.isFinite(t) && t <= ahora + 5 * 60_000 && t >= ahora - 7 * 86_400_000;
  return new Date(creible ? t : ahora).toISOString();
}

export async function guardarSerie(input: SerieInput): Promise<Resultado & { record?: RecordDetectado | null }> {
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
            logged_at: horaRegistro(input.logged_at)
          },
          { onConflict: "mesocycle_id,exercise_id,semana,serie" }
        )
    );
    // Semana ya cerrada → la siguiente se recalcula sola
    await recalcularSemanaSiguiente(input.mesoId, input.semana);
    const record = await detectarRecord(userId, input);
    revalidatePath("/", "layout");
    return { ok: true, record };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

export interface RecordDetectado {
  tipo: "peso" | "reps";
  valor: number;
  anterior: number | null;
  ejercicio: string;
}

// ¿La serie supera el máximo histórico del ejercicio? Peso en los que
// usan kg (con al menos 1 rep), reps en los demás. Se guarda como récord
// y se devuelve para mostrarlo en el momento.
async function detectarRecord(userId: string, input: SerieInput): Promise<RecordDetectado | null> {
  const ex = await getEjercicio(input.exerciseId);
  if (!ex || ex.progresion === "al_fallo") return null;
  const excluir = { mesoId: input.mesoId, exerciseId: input.exerciseId, semana: input.semana, serie: input.serie };
  const esPeso = ex.unidad === "kg";
  const valor = esPeso ? input.peso_kg : input.reps;
  if (valor == null || valor <= 0 || (esPeso && (input.reps ?? 0) < 1)) return null;
  const anterior = await maximoHistorico(userId, ex.nombre, esPeso ? "peso_kg" : "reps", excluir);
  // Sin historial previo (o solo series a 0 kg) no es un récord, es la primera vez
  if (anterior == null || anterior <= 0 || valor <= anterior) return null;
  await exec(
    db().from("records").insert({
      user_id: userId,
      ejercicio: ex.nombre,
      tipo: esPeso ? "peso" : "reps",
      valor,
      reps: esPeso ? input.reps : null,
      anterior
    })
  );
  return { tipo: esPeso ? "peso" : "reps", valor, anterior, ejercicio: ex.nombre };
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
    await exigirMesVigente();
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
    await exigirMesVigente();
    const { userId } = await resolverUsuario(userIdObjetivo);
    await crearNuevoBloque(userId);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Duración de la sesión ───────────────────────────────────────

// Al terminar la rutina guiada: guarda cuánto duró (una sesión por día
// y semana; si se repite, se queda con la última).
export async function guardarSesion(input: {
  mesoId: string;
  diaId: string;
  semana: number;
  inicioIso: string;
  series: number;
}): Promise<Resultado & { duracion_seg?: number }> {
  const inicio = new Date(input.inicioIso).getTime();
  if (!Number.isFinite(inicio)) return { error: "Inicio inválido." };
  const fin = Date.now();
  // Entre 1 minuto y 6 horas: fuera de eso el reloj quedó abierto de otro día
  const duracion = Math.round((fin - inicio) / 1000);
  if (duracion < 60 || duracion > 6 * 3600) return { ok: true, duracion_seg: 0 };
  try {
    const userId = await duenoDe(input.mesoId);
    await exec(
      db()
        .from("sesiones_entreno")
        .upsert(
          {
            user_id: userId,
            mesocycle_id: input.mesoId,
            training_day_id: input.diaId,
            semana: input.semana,
            inicio_at: new Date(inicio).toISOString(),
            fin_at: new Date(fin).toISOString(),
            duracion_seg: duracion,
            series: Math.max(0, Math.round(input.series))
          },
          { onConflict: "mesocycle_id,training_day_id,semana" }
        )
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, duracion_seg: duracion };
}
