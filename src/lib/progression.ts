// Motor de progresión ondulada de 4 semanas (funciones puras).
//
// Cada bloque de 8 semanas son 2 ciclos de 4. Fase = posición dentro del
// ciclo (semana 1 → fase 1, semana 5 → fase 1 otra vez):
//  - Fase 1: piso del rango de reps (ej. 10) al peso base del ciclo.
//  - Fase 2: mismo peso, tope del rango (ej. 15).
//  - Fase 3: sube el peso, vuelve al piso del rango.
//  - Fase 4: descarga, 50 % del peso.
//  - Fase 1 del ciclo siguiente: reinicia con el peso de la fase 3.
//
// Las reglas dan una propuesta determinista. La IA (ver ai.ts) puede
// ajustar el peso concreto mirando los registros reales; si no está
// configurada, vale la propuesta tal cual.
//
// Ejercicios sin peso (peso corporal, sin peso o modo solo_reps) ondulan
// solo en repeticiones: piso → tope → piso + 2 → mitad → reinicia.
// Modo al_fallo: se mantiene igual siempre.

import type { ModoProgresion, Unidad } from "./types";

export type Fase = 1 | 2 | 3 | 4;

export interface PlanBase {
  series: number;
  reps: number | null;
  peso_kg: number | null;
  al_fallo: boolean;
}

export interface RegistroSerie {
  serie: number;
  reps: number | null;
  peso_kg: number | null;
  rir: number | null;
  al_fallo: boolean;
  completado: boolean;
}

export interface ConfigEjercicio {
  progresion: ModoProgresion;
  unidad: Unidad;
  incremento_kg: number;
  rep_min: number | null;
  rep_max: number | null;
}

export interface Propuesta extends PlanBase {
  // Explicación corta de la regla aplicada (se guarda en nota_ia si la
  // IA no la reemplaza por la suya).
  nota: string;
}

const red2 = (n: number) => Math.round(n * 100) / 100;

export function faseDe(semana: number): Fase {
  return ((((semana - 1) % 4) + 4) % 4 + 1) as Fase;
}

export function nombreFase(fase: Fase): string {
  return {
    1: "Base · piso de reps",
    2: "Volumen · tope de reps",
    3: "Carga · sube el peso",
    4: "Descarga · 50 % del peso"
  }[fase];
}

// Rango de reps del ejercicio (con defaults según el tipo).
export function rangoReps(ex: ConfigEjercicio): { min: number; max: number } {
  const esCompuesto = ex.progresion === "compuesto";
  const min = ex.rep_min ?? (esCompuesto ? 8 : 10);
  const max = ex.rep_max ?? (esCompuesto ? 12 : 15);
  return { min, max: Math.max(max, min) };
}

export function redondearAlIncremento(peso: number, incremento: number): number {
  const inc = incremento > 0 ? incremento : 2.5;
  return red2(Math.max(inc, Math.round(peso / inc) * inc));
}

// ¿Progresa con peso? (kg y no "solo reps")
export function usaPeso(ex: ConfigEjercicio): boolean {
  return ex.unidad === "kg" && ex.progresion !== "solo_reps";
}

// ¿Cumplió el plan? Todas las series planificadas con las reps objetivo
// (y al menos el peso planificado).
export function cumplioPlan(plan: PlanBase, registros: RegistroSerie[]): boolean {
  const hechas = registros.filter((r) => r.completado);
  if (hechas.length < plan.series) return false;
  if (plan.al_fallo || plan.reps == null) return true;
  const primeras = [...hechas].sort((a, b) => a.serie - b.serie).slice(0, plan.series);
  return primeras.every((r) => {
    const repsOk = (r.reps ?? 0) >= plan.reps!;
    const pesoOk = plan.peso_kg == null || (r.peso_kg ?? 0) >= plan.peso_kg - 0.01;
    return repsOk && pesoOk;
  });
}

// ¿Llegó al menos al piso del rango en todas las series? Es la red de
// seguridad para no subir peso si la semana fue claramente fallida.
export function cumplioMinimo(
  plan: PlanBase,
  registros: RegistroSerie[],
  repMin: number
): boolean {
  const hechas = registros.filter((r) => r.completado);
  if (hechas.length === 0) return true; // sin registros: no penalizamos
  if (hechas.length < plan.series) return false;
  return hechas.every((r) => (r.reps ?? 0) >= repMin);
}

// Plan de la semana `semanaActual + 1` a partir del plan y los registros
// de `semanaActual`. `planAnterior` es el de `semanaActual - 1` (hace
// falta en la fase 4 para reiniciar con el peso de la fase 3).
export function planSiguiente(
  ex: ConfigEjercicio,
  semanaActual: number,
  planActual: PlanBase,
  planAnterior: PlanBase | null,
  registros: RegistroSerie[]
): Propuesta {
  const base: Propuesta = {
    series: planActual.series,
    reps: planActual.reps,
    peso_kg: planActual.peso_kg,
    al_fallo: planActual.al_fallo,
    nota: ""
  };
  if (ex.progresion === "al_fallo" || planActual.al_fallo) {
    base.nota = "Series al fallo: se mantiene igual.";
    return base;
  }

  const fase = faseDe(semanaActual);
  const { min, max } = rangoReps(ex);
  const inc = ex.incremento_kg > 0 ? ex.incremento_kg : 2.5;

  if (usaPeso(ex)) {
    // Peso todavía sin definir ("a completar en el primer entreno"): el
    // primer registro fija la base y desde ahí se ondula normal.
    if (base.peso_kg == null) {
      const pesos = registros
        .filter((r) => r.completado && r.peso_kg != null)
        .map((r) => r.peso_kg!);
      if (!pesos.length) {
        base.nota = "Peso a definir: registrá una serie para fijar la base.";
        return base;
      }
      base.peso_kg = red2(Math.max(...pesos));
    }
    const peso = base.peso_kg;

    switch (fase) {
      case 1:
        base.reps = max;
        base.nota = `Mismo peso, subís al tope del rango (${max} reps).`;
        return base;
      case 2: {
        if (!cumplioMinimo(planActual, registros, min)) {
          base.reps = min;
          base.nota = `No llegaste a ${min} reps en todas las series: se mantiene el peso.`;
          return base;
        }
        base.reps = min;
        base.peso_kg = red2(peso + inc);
        base.nota = `Semana de carga: +${inc} kg y volvés a ${min} reps.`;
        return base;
      }
      case 3:
        base.reps = min;
        base.peso_kg = redondearAlIncremento(peso * 0.5, inc);
        base.nota = "Descarga: 50 % del peso para recuperar.";
        return base;
      case 4: {
        const pesoFase3 = planAnterior?.peso_kg ?? red2(peso * 2);
        base.reps = min;
        base.peso_kg = pesoFase3;
        base.nota = `Nuevo ciclo: arrancás con ${pesoFase3} kg (el peso de la semana de carga).`;
        return base;
      }
    }
  }

  // Sin peso: ondula solo en repeticiones
  const reps = base.reps ?? min;
  const delta = Math.max(max - min, 2);
  switch (fase) {
    case 1:
      base.reps = reps + delta;
      base.nota = `Subís al tope del rango (${base.reps} reps).`;
      return base;
    case 2:
      base.reps = reps - delta + 2;
      base.nota = `Semana de carga: +2 reps sobre el piso (${base.reps}).`;
      return base;
    case 3:
      base.reps = Math.max(1, Math.ceil(reps / 2));
      base.nota = "Descarga: mitad de repeticiones.";
      return base;
    case 4:
      base.reps = planAnterior?.reps ?? reps * 2;
      base.nota = `Nuevo ciclo: arrancás con ${base.reps} reps.`;
      return base;
  }
}

// Peso final tras la sugerencia de la IA: acotado a ±15 % de la propuesta
// y redondeado al incremento del equipo, para que un error del modelo no
// descalabre el plan.
export function acotarSugerencia(
  propuesto: number,
  sugerido: number,
  incremento: number
): number {
  const min = propuesto * 0.85;
  const max = propuesto * 1.15;
  const acotado = Math.min(max, Math.max(min, sugerido));
  return redondearAlIncremento(acotado, incremento);
}
