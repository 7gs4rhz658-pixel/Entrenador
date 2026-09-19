// Planes generados (IA, .txt o plantilla), en memoria y sin tocar la base.
// normalizarPlan sanea lo que devuelva la IA; planPlantilla es el camino
// sin IA. Escribirlos en la base es tarea de plan-import.ts.

import { infoEjercicio } from "./exercise-info";
import type {
  Cuestionario,
  DiaGenerado,
  EjercicioGenerado,
  ModoProgresion,
  PlanGenerado,
  Unidad
} from "./types";

const GRUPOS = ["pecho", "espalda", "pierna", "hombro", "brazo", "core", "otro"];
const UNIDADES: Unidad[] = ["kg", "peso_corporal", "sin_peso"];
const PROGRESIONES: ModoProgresion[] = ["compuesto", "aislamiento", "solo_reps", "al_fallo"];
const INCREMENTOS = [1, 1.25, 2.5, 5];

const clamp = (n: unknown, min: number, max: number, def: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def;
};

// Deja el JSON de la IA en una forma segura para escribir en la base.
// `diasPermitidos` (del cuestionario) corrige días fuera de rango.
export function normalizarPlan(raw: unknown, diasPermitidos?: number[]): PlanGenerado {
  const r = (raw ?? {}) as Partial<PlanGenerado>;
  const diasRaw = Array.isArray(r.dias) ? r.dias : [];
  const usados = new Set<number>();
  const dias: DiaGenerado[] = [];

  for (const d of diasRaw) {
    const dd = (d ?? {}) as Partial<DiaGenerado>;
    const diaRaw = Number(dd.dia_semana);
    let dia = Number.isInteger(diaRaw) && diaRaw >= 1 && diaRaw <= 7 ? diaRaw : 0;
    if (!dia || usados.has(dia)) {
      // Buscar el primer día libre (preferentemente de los disponibles)
      const candidatos = [...(diasPermitidos ?? []), 1, 2, 3, 4, 5, 6, 7];
      dia = candidatos.find((c) => !usados.has(c)) ?? 0;
      if (!dia) continue;
    }
    usados.add(dia);

    const ejercicios: EjercicioGenerado[] = [];
    for (const e of Array.isArray(dd.ejercicios) ? dd.ejercicios : []) {
      const ee = (e ?? {}) as Partial<EjercicioGenerado>;
      const nombre = String(ee.nombre ?? "").trim();
      if (!nombre) continue;
      const unidad = UNIDADES.includes(ee.unidad as Unidad) ? (ee.unidad as Unidad) : "kg";
      let progresion = PROGRESIONES.includes(ee.progresion as ModoProgresion)
        ? (ee.progresion as ModoProgresion)
        : "aislamiento";
      if (unidad !== "kg" && progresion !== "al_fallo") progresion = "solo_reps";
      const rep_min = clamp(ee.rep_min, 1, 50, progresion === "compuesto" ? 8 : 10);
      const rep_max = Math.max(rep_min, clamp(ee.rep_max, 1, 60, progresion === "compuesto" ? 12 : 15));
      const grupo = GRUPOS.includes(String(ee.grupo_muscular)) ? String(ee.grupo_muscular) : "otro";
      const pesoRaw = Number(ee.peso_inicial_kg);
      const peso_inicial_kg =
        unidad === "kg" && Number.isFinite(pesoRaw) && pesoRaw > 0
          ? Math.round(pesoRaw * 4) / 4
          : null;
      const incRaw = Number(ee.incremento_kg);
      const incremento_kg = INCREMENTOS.includes(incRaw) ? incRaw : 2.5;
      const auto = infoEjercicio(nombre, grupo);
      const tips = Array.isArray(ee.tips)
        ? ee.tips.map((t) => String(t).trim()).filter(Boolean).slice(0, 5)
        : [];

      ejercicios.push({
        nombre: nombre.slice(0, 80),
        grupo_muscular: grupo,
        unidad,
        progresion,
        series: clamp(ee.series, 1, 8, 3),
        rep_min,
        rep_max,
        peso_inicial_kg,
        incremento_kg,
        descanso_seg: clamp(ee.descanso_seg, 15, 600, progresion === "compuesto" ? 120 : 90),
        descripcion: String(ee.descripcion ?? "").trim() || auto.descripcion,
        tips: tips.length ? tips : auto.tips
      });
    }
    if (ejercicios.length) {
      dias.push({
        dia_semana: dia,
        nombre: String(dd.nombre ?? "").trim().slice(0, 40) || `Día ${dias.length + 1}`,
        ejercicios
      });
    }
  }
  if (!dias.length) throw new Error("El plan no tiene ningún día con ejercicios.");
  dias.sort((a, b) => a.dia_semana - b.dia_semana);

  return {
    nombre_bloque: String(r.nombre_bloque ?? "").trim().slice(0, 60) || "Bloque de hipertrofia",
    notas: String(r.notas ?? "").trim().slice(0, 400) || undefined,
    dias
  };
}

// ── Plantilla sin IA ────────────────────────────────────────────

type Ej = Omit<EjercicioGenerado, "descripcion" | "tips"> & { descripcion?: string; tips?: string[] };

const ej = (
  nombre: string,
  grupo: string,
  progresion: ModoProgresion,
  unidad: Unidad = "kg",
  extra: Partial<Ej> = {}
): EjercicioGenerado => {
  const compuesto = progresion === "compuesto";
  const auto = infoEjercicio(nombre, grupo);
  return {
    nombre,
    grupo_muscular: grupo,
    unidad,
    progresion,
    series: compuesto ? 4 : 3,
    rep_min: compuesto ? 8 : 10,
    rep_max: compuesto ? 12 : 15,
    peso_inicial_kg: null,
    incremento_kg: 2.5,
    descanso_seg: compuesto ? 120 : 90,
    descripcion: auto.descripcion,
    tips: auto.tips,
    ...extra
  };
};

const GYM = {
  empuje: [
    ej("Press plano (barra)", "pecho", "compuesto"),
    ej("Press inclinado con mancuernas", "pecho", "compuesto"),
    ej("Press militar", "hombro", "compuesto"),
    ej("Vuelos laterales", "hombro", "aislamiento", "kg", { rep_min: 12, rep_max: 20, incremento_kg: 1 }),
    ej("Tríceps en polea", "brazo", "aislamiento")
  ],
  traccion: [
    ej("Jalón al pecho", "espalda", "compuesto"),
    ej("Remo con polea", "espalda", "compuesto"),
    ej("Hombro posterior con mancuernas", "hombro", "aislamiento", "kg", { rep_min: 12, rep_max: 20, incremento_kg: 1 }),
    ej("Curl de bíceps con mancuernas", "brazo", "aislamiento"),
    ej("Encogimientos de trapecio", "espalda", "aislamiento")
  ],
  pierna: [
    ej("Sentadilla (barra)", "pierna", "compuesto"),
    ej("Peso muerto rumano", "pierna", "compuesto"),
    ej("Extensión de cuádriceps", "pierna", "aislamiento"),
    ej("Femoral en máquina", "pierna", "aislamiento"),
    ej("Gemelos", "pierna", "solo_reps", "kg", { rep_min: 15, rep_max: 20 }),
    ej("Abdominales", "core", "al_fallo", "sin_peso")
  ],
  fullbody: [
    ej("Sentadilla (barra)", "pierna", "compuesto"),
    ej("Press plano (barra)", "pecho", "compuesto"),
    ej("Remo con polea", "espalda", "compuesto"),
    ej("Press militar", "hombro", "compuesto"),
    ej("Curl de bíceps con mancuernas", "brazo", "aislamiento"),
    ej("Abdominales", "core", "al_fallo", "sin_peso")
  ]
};

const CASA = {
  empuje: [
    ej("Flexiones de brazos", "pecho", "solo_reps", "peso_corporal", { rep_min: 10, rep_max: 15 }),
    ej("Flexiones declinadas", "pecho", "solo_reps", "peso_corporal", { rep_min: 8, rep_max: 12 }),
    ej("Fondos en silla", "brazo", "solo_reps", "peso_corporal", { rep_min: 10, rep_max: 15 }),
    ej("Vuelos laterales", "hombro", "aislamiento", "kg", { rep_min: 12, rep_max: 20, incremento_kg: 1 })
  ],
  traccion: [
    ej("Remo con mancuerna", "espalda", "compuesto"),
    ej("Dominadas", "espalda", "solo_reps", "peso_corporal", { rep_min: 5, rep_max: 10 }),
    ej("Curl de bíceps con mancuernas", "brazo", "aislamiento"),
    ej("Superman", "espalda", "solo_reps", "sin_peso", { rep_min: 12, rep_max: 20 })
  ],
  pierna: [
    ej("Sentadilla goblet", "pierna", "compuesto"),
    ej("Zancadas", "pierna", "solo_reps", "peso_corporal", { rep_min: 10, rep_max: 15 }),
    ej("Puente de glúteo", "pierna", "solo_reps", "peso_corporal", { rep_min: 15, rep_max: 20 }),
    ej("Gemelos", "pierna", "solo_reps", "peso_corporal", { rep_min: 15, rep_max: 25 }),
    ej("Plancha", "core", "al_fallo", "sin_peso")
  ],
  fullbody: [
    ej("Sentadilla goblet", "pierna", "compuesto"),
    ej("Flexiones de brazos", "pecho", "solo_reps", "peso_corporal", { rep_min: 10, rep_max: 15 }),
    ej("Remo con mancuerna", "espalda", "compuesto"),
    ej("Zancadas", "pierna", "solo_reps", "peso_corporal", { rep_min: 10, rep_max: 15 }),
    ej("Plancha", "core", "al_fallo", "sin_peso")
  ]
};

// Plan de respaldo cuando la IA no está disponible: reparte empuje /
// tracción / pierna según la cantidad de días.
export function planPlantilla(c: Cuestionario | null): PlanGenerado {
  const dias = (c?.dias_disponibles?.length ? c.dias_disponibles : [1, 3, 5])
    .slice()
    .sort((a, b) => a - b)
    .slice(0, 6);
  const set = c?.equipamiento === "gimnasio" ? GYM : CASA;
  let bloques: { nombre: string; ejercicios: EjercicioGenerado[] }[];
  if (dias.length <= 2) {
    bloques = [{ nombre: "Cuerpo completo", ejercicios: set.fullbody }];
  } else if (dias.length === 3) {
    bloques = [
      { nombre: "Empuje", ejercicios: set.empuje },
      { nombre: "Tracción", ejercicios: set.traccion },
      { nombre: "Pierna", ejercicios: set.pierna }
    ];
  } else {
    bloques = [
      { nombre: "Empuje", ejercicios: set.empuje },
      { nombre: "Pierna", ejercicios: set.pierna },
      { nombre: "Tracción", ejercicios: set.traccion },
      { nombre: "Pierna B", ejercicios: set.pierna.slice(0, 4) },
      { nombre: "Cuerpo completo", ejercicios: set.fullbody },
      { nombre: "Brazos y core", ejercicios: [...set.empuje.slice(-2), ...set.traccion.slice(-2)] }
    ];
  }
  return {
    nombre_bloque: "Bloque 1 · plantilla",
    notas: "Plan base generado sin IA. Tu entrenador puede ajustarlo desde su panel.",
    dias: dias.map((dia, i) => {
      const b = bloques[i % bloques.length];
      return { dia_semana: dia, nombre: b.nombre, ejercicios: b.ejercicios };
    })
  };
}

