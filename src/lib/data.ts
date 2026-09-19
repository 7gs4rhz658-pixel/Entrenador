import { db } from "./supabase/server";
import type {
  Exercise,
  Ingredient,
  LoggedSet,
  MealLog,
  MealPlan,
  MealPlanItem,
  Mesocycle,
  PlannedSet,
  Profile,
  TrainingDay
} from "./types";

// Ejecuta una consulta y tira un error legible si falla.
export async function q<T>(
  p: PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`Base de datos: ${error.message}`);
  return data as T;
}

export async function exec(
  p: PromiseLike<{ error: { message: string } | null }>
): Promise<void> {
  const { error } = await p;
  if (error) throw new Error(`Base de datos: ${error.message}`);
}

// ── Perfiles ────────────────────────────────────────────────────

export async function getPerfil(userId: string): Promise<Profile> {
  const perfil = await q<Profile | null>(
    db().from("profiles").select("*").eq("id", userId).maybeSingle()
  );
  if (!perfil) throw new Error("No se encontró el perfil.");
  return perfil;
}

export async function getClientes(): Promise<Profile[]> {
  return q<Profile[]>(
    db()
      .from("profiles")
      .select("*")
      .eq("rol", "cliente")
      .order("created_at", { ascending: false })
  );
}

// ── Bloques ─────────────────────────────────────────────────────

// Último bloque creado del usuario (activo o finalizado). Null si nunca
// se generó un plan.
export async function getBloque(userId: string): Promise<Mesocycle | null> {
  return q<Mesocycle | null>(
    db()
      .from("mesocycles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  );
}

export async function getMesociclo(id: string): Promise<Mesocycle> {
  const meso = await q<Mesocycle | null>(
    db().from("mesocycles").select("*").eq("id", id).maybeSingle()
  );
  if (!meso) throw new Error("No se encontró el bloque de entrenamiento.");
  return meso;
}

export async function contarBloques(userId: string): Promise<number> {
  const { count, error } = await db()
    .from("mesocycles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(`Base de datos: ${error.message}`);
  return count ?? 0;
}

// ── Días y ejercicios ───────────────────────────────────────────

export async function getDias(userId: string): Promise<TrainingDay[]> {
  return q<TrainingDay[]>(
    db()
      .from("training_days")
      .select("*")
      .eq("user_id", userId)
      .order("dia_semana")
  );
}

export async function getDiaPorId(id: string): Promise<TrainingDay | null> {
  return q<TrainingDay | null>(
    db().from("training_days").select("*").eq("id", id).maybeSingle()
  );
}

export async function getEjercicios(userId: string): Promise<Exercise[]> {
  return q<Exercise[]>(
    db()
      .from("exercises")
      .select("*")
      .eq("user_id", userId)
      .eq("activo", true)
      .order("orden")
  );
}

export async function getEjercicio(id: string): Promise<Exercise | null> {
  return q<Exercise | null>(
    db().from("exercises").select("*").eq("id", id).maybeSingle()
  );
}

// ── Planes y registros ──────────────────────────────────────────

export async function getPlanes(
  mesoId: string,
  semana: number
): Promise<PlannedSet[]> {
  return q<PlannedSet[]>(
    db()
      .from("planned_sets")
      .select("*")
      .eq("mesocycle_id", mesoId)
      .eq("semana", semana)
  );
}

export async function getLogs(
  mesoId: string,
  semana: number
): Promise<LoggedSet[]> {
  return q<LoggedSet[]>(
    db()
      .from("logged_sets")
      .select("*")
      .eq("mesocycle_id", mesoId)
      .eq("semana", semana)
      .order("serie")
  );
}

export async function getLogsEjercicio(
  mesoId: string,
  exerciseId: string
): Promise<LoggedSet[]> {
  return q<LoggedSet[]>(
    db()
      .from("logged_sets")
      .select("*")
      .eq("mesocycle_id", mesoId)
      .eq("exercise_id", exerciseId)
      .order("semana")
      .order("serie")
  );
}

export async function getUltimoRegistro(userId: string): Promise<string | null> {
  const fila = await q<{ logged_at: string } | null>(
    db()
      .from("logged_sets")
      .select("logged_at")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  return fila?.logged_at ?? null;
}

export async function semanaCerrada(
  mesoId: string,
  semana: number
): Promise<boolean> {
  const fila = await q<{ semana: number } | null>(
    db()
      .from("week_closures")
      .select("semana")
      .eq("mesocycle_id", mesoId)
      .eq("semana", semana)
      .maybeSingle()
  );
  return fila != null;
}

// ── Nutrición ───────────────────────────────────────────────────

export async function buscarIngredientesLocal(
  texto: string,
  limite = 12
): Promise<Ingredient[]> {
  const t = texto.trim();
  if (!t) return [];
  return q<Ingredient[]>(
    db()
      .from("ingredients")
      .select("*")
      .ilike("nombre", `%${t.replace(/[%_]/g, "")}%`)
      .order("fuente")
      .order("nombre")
      .limit(limite)
  );
}

export async function getIngrediente(id: string): Promise<Ingredient | null> {
  return q<Ingredient | null>(
    db().from("ingredients").select("*").eq("id", id).maybeSingle()
  );
}

export async function getComidas(
  userId: string,
  fecha: string
): Promise<MealLog[]> {
  return q<MealLog[]>(
    db()
      .from("meal_logs")
      .select("*, ingredient:ingredients(*)")
      .eq("user_id", userId)
      .eq("fecha", fecha)
      .order("created_at")
  );
}

// Comidas de un rango de fechas (para el resumen del entrenador)
export async function getComidasRango(
  userId: string,
  desde: string,
  hasta: string
): Promise<MealLog[]> {
  return q<MealLog[]>(
    db()
      .from("meal_logs")
      .select("*, ingredient:ingredients(*)")
      .eq("user_id", userId)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("created_at")
  );
}

// Días de entreno configurados (para multiplicar el menú por semana)
export async function contarDiasEntreno(userId: string): Promise<number> {
  const { count, error } = await db()
    .from("training_days")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("es_descanso", false);
  if (error) throw new Error(`Base de datos: ${error.message}`);
  return count ?? 0;
}

// ── Recomendación de comidas ────────────────────────────────────

export interface PlanComidasActivo {
  plan: MealPlan;
  items: MealPlanItem[];
}

export async function getPlanComidas(userId: string): Promise<PlanComidasActivo | null> {
  const plan = await q<MealPlan | null>(
    db().from("meal_plans").select("*").eq("user_id", userId).eq("activo", true).maybeSingle()
  );
  if (!plan) return null;
  const items = await q<MealPlanItem[]>(
    db()
      .from("meal_plan_items")
      .select("*, ingredient:ingredients(*)")
      .eq("meal_plan_id", plan.id)
      .order("orden")
  );
  return { plan, items };
}

// Nombres de la base propia (USDA + manuales) para orientar a la IA
export async function nombresBase(limite = 90): Promise<string[]> {
  const filas = await q<{ nombre: string }[]>(
    db().from("ingredients").select("nombre").neq("fuente", "off").order("nombre").limit(limite)
  );
  return filas.map((f) => f.nombre);
}

// ── Helpers de agrupado ─────────────────────────────────────────

export function planesPorEjercicio(
  planes: PlannedSet[]
): Record<string, PlannedSet> {
  const mapa: Record<string, PlannedSet> = {};
  for (const p of planes) mapa[p.exercise_id] = p;
  return mapa;
}

export function logsPorEjercicio(
  logs: LoggedSet[]
): Record<string, LoggedSet[]> {
  const mapa: Record<string, LoggedSet[]> = {};
  for (const l of logs) (mapa[l.exercise_id] ??= []).push(l);
  return mapa;
}

export function ejerciciosPorDia(
  ejercicios: Exercise[]
): Record<string, Exercise[]> {
  const mapa: Record<string, Exercise[]> = {};
  for (const e of ejercicios) (mapa[e.training_day_id] ??= []).push(e);
  return mapa;
}
