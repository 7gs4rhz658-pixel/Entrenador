export type Sexo = "masculino" | "femenino";
export type NivelActividad = "sedentario" | "ligero" | "moderado" | "alto";
export type Objetivo = "deficit" | "mantenimiento" | "superavit";
export type Rol = "cliente" | "entrenador";
export type Unidad = "kg" | "peso_corporal" | "sin_peso";
export type TipoEjercicio = "compuesto" | "aislamiento";
// Cómo progresa el ejercicio (motor ondulado de 4 semanas, ver progression.ts):
//  - compuesto / aislamiento: ondula reps y peso (difieren en el rango por defecto)
//  - solo_reps:   ondula solo repeticiones (flexiones, gemelos a RIR...)
//  - al_fallo:    se mantiene igual (series al fallo, sin objetivo fijo)
export type ModoProgresion = "compuesto" | "aislamiento" | "solo_reps" | "al_fallo";

export interface Cuestionario {
  experiencia: "principiante" | "intermedio" | "avanzado";
  dias_disponibles: number[]; // 1 = lunes ... 7 = domingo
  minutos_sesion: number;
  equipamiento: "gimnasio" | "casa_basico" | "sin_equipo";
  lesiones: string;
  preferencias: string;
}

// Cómo come el cliente: define los momentos del menú y las restricciones
// duras (alergias) de la recomendación de comidas.
export interface CuestionarioNutricion {
  comidas: { momento: Momento; hora: string }[]; // 3 a 6, en orden del día
  hora_entreno: string; // "18:30" o "" si varía
  alergias: string; // restricción dura: nunca aparecen en el menú
  no_come: string; // preferencias: se evitan
  cocina: "cocino" | "mixto" | "como_fuera";
  batch_cooking: boolean;
  dia_batch: number | null; // 1 = lunes ... 7 = domingo
  presupuesto: "bajo" | "medio" | "alto";
  pais: string;
}

// Macros fijados a mano por el entrenador (pisan la fórmula)
export interface MacrosManual {
  entreno: MacrosBase;
  descanso: MacrosBase;
}

export interface MacrosBase {
  kcal: number;
  prot_g: number;
  carb_g: number;
  grasa_g: number;
}

export interface Profile {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  edad: number | null;
  sexo: Sexo | null;
  peso_kg: number | null;
  altura_cm: number | null;
  nivel_actividad: NivelActividad;
  objetivo: Objetivo;
  cuestionario: Cuestionario | null;
  cuestionario_nutricion: CuestionarioNutricion | null;
  macros_manual: MacrosManual | null;
  acepto_descargo_at: string | null;
  onboarding_completo: boolean;
  estado_pago: "pendiente" | "pagado";
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Mesocycle {
  id: string;
  user_id: string;
  nombre: string;
  fecha_inicio: string;
  total_semanas: number;
  semana_actual: number;
  estado: "activo" | "finalizado";
  origen: "ia" | "txt" | "plantilla" | "manual";
}

export interface TrainingDay {
  id: string;
  user_id: string;
  dia_semana: number; // 1 = lunes ... 7 = domingo
  nombre: string | null;
  es_descanso: boolean;
}

export interface Exercise {
  id: string;
  user_id: string;
  training_day_id: string;
  nombre: string;
  grupo_muscular: string | null;
  descripcion: string | null;
  tips: string[];
  tipo: TipoEjercicio;
  progresion: ModoProgresion;
  unidad: Unidad;
  incremento_kg: number;
  rep_min: number | null;
  rep_max: number | null;
  descanso_seg: number;
  orden: number;
  activo: boolean;
}

export interface PlannedSet {
  id: string;
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

export interface LoggedSet {
  id: string;
  user_id: string;
  mesocycle_id: string;
  exercise_id: string;
  semana: number;
  serie: number;
  reps: number | null;
  peso_kg: number | null;
  rir: number | null;
  al_fallo: boolean;
  descanso_seg: number | null;
  completado: boolean;
  logged_at: string;
}

export type Momento = "desayuno" | "almuerzo" | "merienda" | "cena" | "snack";
export type TipoDia = "entreno" | "descanso";

export interface Ingredient {
  id: string;
  nombre: string;
  marca: string | null;
  fuente: "off" | "usda" | "manual";
  off_code: string | null;
  kcal_100: number;
  prot_100: number;
  carb_100: number;
  grasa_100: number;
}

export interface MealLog {
  id: string;
  user_id: string;
  fecha: string;
  momento: Momento;
  ingredient_id: string;
  cantidad_g: number;
  plan_item_id: string | null;
  created_at: string;
  ingredient: Ingredient;
}

// ── Recomendación de comidas ────────────────────────────────────

export interface MealPlan {
  id: string;
  user_id: string;
  nombre: string;
  origen: "ia" | "txt";
  activo: boolean;
  notas: string | null;
  batch_cooking: BatchCooking | null;
  created_at: string;
}

export interface MealPlanItem {
  id: string;
  user_id: string;
  meal_plan_id: string;
  tipo_dia: TipoDia;
  momento: Momento;
  orden: number;
  plato: string;
  ingredient_id: string;
  cantidad_g: number;
  nota: string | null;
  ingredient: Ingredient;
}

// Lo que devuelve la IA (o el intérprete del .txt) antes de resolver
// cada ingrediente contra la tabla. Ver lib/meal-plan.ts.
export interface IngredienteGenerado {
  nombre: string;
  gramos: number;
  nota?: string;
}

export interface ComidaGenerada {
  momento: Momento;
  plato: string;
  ingredientes: IngredienteGenerado[];
}

export interface PlanComidasGenerado {
  nombre: string;
  notas?: string;
  entreno: ComidaGenerada[];
  descanso: ComidaGenerada[];
}

// Ítem ya resuelto contra la base (ingredient null = no se encontró; el
// entrenador lo corrige en la vista previa antes de aplicar).
export interface ItemComidaResuelto {
  tipo_dia: TipoDia;
  momento: Momento;
  orden: number;
  plato: string;
  nombre_pedido: string;
  ingredient: Ingredient | null;
  cantidad_g: number;
  nota: string | null;
}

export interface PlanComidasResuelto {
  nombre: string;
  notas: string | null;
  items: ItemComidaResuelto[];
}

// Guía de batch cooking guardada en meal_plans.batch_cooking
export interface BatchCooking {
  dia_semana: number;
  tiempo_min: number;
  tandas: { tecnica: string; items: { nombre: string; gramos_semana: number }[] }[];
  pasos: string[];
  conservacion: string[];
}

// Plan generado (por IA, por plantilla o interpretado de un .txt) antes
// de escribirse en la base. Es lo que produce y consume plan-import.ts.
export interface EjercicioGenerado {
  nombre: string;
  grupo_muscular: string;
  unidad: Unidad;
  progresion: ModoProgresion;
  series: number;
  rep_min: number;
  rep_max: number;
  peso_inicial_kg: number | null;
  incremento_kg: number;
  descanso_seg: number;
  descripcion?: string;
  tips?: string[];
}

export interface DiaGenerado {
  dia_semana: number;
  nombre: string;
  ejercicios: EjercicioGenerado[];
}

export interface PlanGenerado {
  nombre_bloque: string;
  notas?: string;
  dias: DiaGenerado[];
}

// ── Asistente de situaciones ────────────────────────────────────

export type TipoSituacion =
  | "evento"
  | "restaurante"
  | "falta_ingrediente"
  | "antojo"
  | "viaje"
  | "me_pase"
  | "otro";

export interface RespuestaAsistente {
  tipo: TipoSituacion;
  resumen: string;
  que_comer: { opcion: string; cantidad: string; por_que: string }[];
  reacomodo_dia: { momento: Momento | "general"; cambio: string }[];
  mensaje: string;
}

export interface AsistenteLog {
  id: string;
  user_id: string;
  fecha: string;
  pregunta: string;
  tipo: TipoSituacion;
  respuesta: RespuestaAsistente;
  aplicado: boolean;
  created_at: string;
}
