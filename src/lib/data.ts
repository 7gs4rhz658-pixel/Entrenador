import { fechaLocal } from "./format";
import { normalizarTexto, sinPlural } from "./meal-plan";
import { db } from "./supabase/server";
import type {
  AsistenteLog,
  Checkin,
  FotoProgreso,
  Medida,
  SesionEntreno,
  Mensaje,
  PushSubscriptionRow,
  RecordPersonal,
  Exercise,
  Ingredient,
  LoggedSet,
  MealLog,
  MealPlan,
  MealPlanItem,
  Mesocycle,
  PlantillaRutina,
  Protocolo,
  ProtocoloItem,
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

export async function getEntrenadores(): Promise<Profile[]> {
  return q<Profile[]>(db().from("profiles").select("*").eq("rol", "entrenador"));
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

// Último bloque del usuario (activo o finalizado). Por defecto solo los
// publicados (lo que ve el cliente); el entrenador pide también el
// borrador pendiente de enviar. Null si nunca se generó un plan.
export async function getBloque(
  userId: string,
  opciones: { conBorrador?: boolean } = {}
): Promise<Mesocycle | null> {
  let consulta = db().from("mesocycles").select("*").eq("user_id", userId);
  if (!opciones.conBorrador) consulta = consulta.eq("publicado", true);
  return q<Mesocycle | null>(consulta.order("created_at", { ascending: false }).limit(1).maybeSingle());
}

// Borrador de rutina sin enviar (más nuevo que lo publicado), si hay
export async function getBloqueBorrador(userId: string): Promise<Mesocycle | null> {
  return q<Mesocycle | null>(
    db()
      .from("mesocycles")
      .select("*")
      .eq("user_id", userId)
      .eq("publicado", false)
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

// Busca por nombre y otros nombres, sin acentos (columna `busqueda`):
// primero la base propia (USDA + manuales) y después lo guardado de Open
// Food Facts, para que un producto de marca no tape al genérico.
export async function buscarIngredientesLocal(
  texto: string,
  limite = 12
): Promise<Ingredient[]> {
  const t = normalizarTexto(texto);
  if (!t) return [];
  // Palabra por palabra y sin plural: "verdura mixta" encuentra "Verduras mixtas"
  const patron = `%${sinPlural(t).split(" ").join("%")}%`;
  const propios = await q<Ingredient[]>(
    db().from("ingredients").select("*").neq("fuente", "off").ilike("busqueda", patron).order("nombre").limit(limite)
  );
  if (propios.length >= limite) return propios;
  const off = await q<Ingredient[]>(
    db()
      .from("ingredients")
      .select("*")
      .eq("fuente", "off")
      .ilike("busqueda", patron)
      .order("nombre")
      .limit(limite - propios.length)
  );
  return [...propios, ...off];
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

export async function getPlanComidas(
  userId: string,
  opciones: { conBorrador?: boolean } = {}
): Promise<PlanComidasActivo | null> {
  let consulta = db().from("meal_plans").select("*").eq("user_id", userId).eq("activo", true);
  if (!opciones.conBorrador) consulta = consulta.eq("publicado", true);
  const plan = await q<MealPlan | null>(consulta.maybeSingle());
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
export async function nombresBase(limite = 250): Promise<string[]> {
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

// ── Asistente de situaciones ────────────────────────────────────

export async function getConsultasAsistente(
  userId: string,
  opciones: { fecha?: string; limite?: number } = {}
): Promise<AsistenteLog[]> {
  let consulta = db()
    .from("asistente_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(opciones.limite ?? 10);
  if (opciones.fecha) consulta = consulta.eq("fecha", opciones.fecha);
  return q<AsistenteLog[]>(consulta);
}

// La respuesta que el cliente eligió como ajuste de ese día (la última)
export async function getAjusteDelDia(userId: string, fecha: string): Promise<AsistenteLog | null> {
  return q<AsistenteLog | null>(
    db()
      .from("asistente_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("fecha", fecha)
      .eq("aplicado", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  );
}

// ── Check-ins ───────────────────────────────────────────────────

export async function getCheckins(userId: string, limite = 12): Promise<Checkin[]> {
  return q<Checkin[]>(
    db().from("checkins").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limite)
  );
}

export async function getCheckin(mesoId: string, semana: number): Promise<Checkin | null> {
  return q<Checkin | null>(
    db().from("checkins").select("*").eq("mesocycle_id", mesoId).eq("semana", semana).maybeSingle()
  );
}

export async function getSemanasCerradas(mesoId: string): Promise<{ semana: number; cerrada_at: string }[]> {
  return q<{ semana: number; cerrada_at: string }[]>(
    db().from("week_closures").select("semana, cerrada_at").eq("mesocycle_id", mesoId).order("semana")
  );
}

// Registros de series de un rango de fechas (adherencia de la semana)
export async function getLogsRango(userId: string, desdeIso: string, hastaIso: string): Promise<LoggedSet[]> {
  return q<LoggedSet[]>(
    db()
      .from("logged_sets")
      .select("*")
      .eq("user_id", userId)
      .gte("logged_at", desdeIso)
      .lte("logged_at", hastaIso)
      .order("logged_at")
  );
}

// Clientes con informe pendiente de aprobar (para el panel)
export async function getInformesPendientes(): Promise<{ user_id: string; semana: number }[]> {
  return q<{ user_id: string; semana: number }[]>(
    db().from("checkins").select("user_id, semana").eq("informe_estado", "borrador")
  );
}

// ── Mensajes ────────────────────────────────────────────────────

export async function getMensajes(userId: string, limite = 50): Promise<Mensaje[]> {
  return q<Mensaje[]>(
    db().from("mensajes").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limite)
  );
}

// Mensajes del entrenador que el cliente todavía no leyó
export async function contarNoLeidos(userId: string, de: "entrenador" | "cliente"): Promise<number> {
  const { count, error } = await db()
    .from("mensajes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("de", de)
    .is("leido_at", null);
  if (error) throw new Error(`Base de datos: ${error.message}`);
  return count ?? 0;
}

// Último registro de cualquier tipo (series o comidas): para detectar abandono
export async function getUltimaActividad(userId: string): Promise<string | null> {
  const [serie, comida] = await Promise.all([
    getUltimoRegistro(userId),
    q<{ created_at: string } | null>(
      db().from("meal_logs").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle()
    )
  ]);
  const fechas = [serie, comida?.created_at ?? null].filter((f): f is string => !!f).sort();
  return fechas.length ? fechas[fechas.length - 1] : null;
}

// ── Push ────────────────────────────────────────────────────────

export async function getSuscripcionesPush(userId: string): Promise<PushSubscriptionRow[]> {
  return q<PushSubscriptionRow[]>(db().from("push_subscriptions").select("*").eq("user_id", userId));
}

export async function getReferidos(userId: string): Promise<Profile[]> {
  return q<Profile[]>(db().from("profiles").select("*").eq("referido_por", userId).order("created_at"));
}

// ── Medidas corporales ──────────────────────────────────────────

export async function getMedidas(userId: string, limite = 24): Promise<Medida[]> {
  return q<Medida[]>(
    db().from("medidas").select("*").eq("user_id", userId).order("fecha", { ascending: false }).limit(limite)
  );
}

// ── Sesiones de entrenamiento ───────────────────────────────────

export async function getSesiones(userId: string, limite = 30): Promise<SesionEntreno[]> {
  return q<SesionEntreno[]>(
    db().from("sesiones_entreno").select("*").eq("user_id", userId).order("fin_at", { ascending: false }).limit(limite)
  );
}

export async function getSesionesSemana(mesoId: string, semana: number): Promise<SesionEntreno[]> {
  return q<SesionEntreno[]>(
    db().from("sesiones_entreno").select("*").eq("mesocycle_id", mesoId).eq("semana", semana)
  );
}

// ── Fotos de progreso ───────────────────────────────────────────

export async function getFotos(userId: string, limite = 60): Promise<FotoProgreso[]> {
  return q<FotoProgreso[]>(
    db().from("fotos_progreso").select("*").eq("user_id", userId).order("fecha", { ascending: false }).limit(limite)
  );
}

// URL firmada (1 hora) para ver una foto del bucket privado
export async function urlFoto(path: string): Promise<string | null> {
  const { data, error } = await db().storage.from("fotos").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

// ── Récords ─────────────────────────────────────────────────────

export async function getRecords(userId: string, limite = 20): Promise<RecordPersonal[]> {
  return q<RecordPersonal[]>(
    db().from("records").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limite)
  );
}

// Máximo histórico (peso o reps) del ejercicio por nombre, en todos los
// bloques del usuario, sin contar la serie que se está guardando.
export async function maximoHistorico(
  userId: string,
  nombreEjercicio: string,
  campo: "peso_kg" | "reps",
  excluir: { mesoId: string; exerciseId: string; semana: number; serie: number }
): Promise<number | null> {
  const ejercicios = await q<{ id: string }[]>(
    db().from("exercises").select("id").eq("user_id", userId).ilike("nombre", nombreEjercicio)
  );
  if (!ejercicios.length) return null;
  const filas = await q<{ exercise_id: string; semana: number; serie: number; mesocycle_id: string; valor: number | null }[]>(
    db()
      .from("logged_sets")
      .select(`exercise_id, semana, serie, mesocycle_id, valor:${campo}`)
      .eq("user_id", userId)
      .eq("completado", true)
      .in("exercise_id", ejercicios.map((e) => e.id))
      .gt(campo, 0)
      .order(campo, { ascending: false })
      .limit(5)
  );
  const previa = filas.find(
    (f) =>
      !(f.mesocycle_id === excluir.mesoId && f.exercise_id === excluir.exerciseId && f.semana === excluir.semana && f.serie === excluir.serie)
  );
  return previa?.valor ?? null;
}

// ── Plantillas de rutina ────────────────────────────────────────

export async function getPlantillas(): Promise<PlantillaRutina[]> {
  return q<PlantillaRutina[]>(db().from("plantillas_rutina").select("*").order("nombre"));
}

export async function getPlantilla(id: string): Promise<PlantillaRutina | null> {
  return q<PlantillaRutina | null>(db().from("plantillas_rutina").select("*").eq("id", id).maybeSingle());
}

// ── Protocolo del entrenador ────────────────────────────────────

export interface ProtocoloActivo {
  protocolo: Protocolo;
  items: ProtocoloItem[];
  inicio: string; // desde cuándo corre (semana 1)
}

// El publicado (lo que ve el cliente) o, con `borrador`, el que el
// entrenador está editando.
export async function getProtocolo(
  userId: string,
  opciones: { borrador?: boolean } = {}
): Promise<ProtocoloActivo | null> {
  const protocolo = await q<Protocolo | null>(
    db()
      .from("protocolos")
      .select("*")
      .eq("user_id", userId)
      .eq("activo", true)
      .eq("publicado", !opciones.borrador)
      .maybeSingle()
  );
  if (!protocolo) return null;
  const items = await q<ProtocoloItem[]>(
    db().from("protocolo_items").select("*").eq("protocolo_id", protocolo.id).order("orden")
  );
  const inicio = protocolo.fecha_inicio ?? fechaLocal(protocolo.publicado_at ?? protocolo.created_at);
  return { protocolo, items, inicio };
}

// Desde cuándo el cliente tiene plan: el primer bloque que le enviaron
export async function inicioDelPlan(userId: string): Promise<string | null> {
  const fila = await q<{ fecha_inicio: string; publicado_at: string | null } | null>(
    db()
      .from("mesocycles")
      .select("fecha_inicio, publicado_at")
      .eq("user_id", userId)
      .eq("publicado", true)
      .order("fecha_inicio", { ascending: true })
      .limit(1)
      .maybeSingle()
  );
  if (!fila) return null;
  return fila.publicado_at ? fechaLocal(fila.publicado_at) : fila.fecha_inicio;
}
