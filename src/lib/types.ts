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
  created_at: string;
  ingredient: Ingredient;
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
