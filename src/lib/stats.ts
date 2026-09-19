// Números de adherencia y progreso, calculados desde los registros
// reales (sin IA): entrenos hechos, comidas del menú marcadas, macros
// promedio contra la referencia, subidas de carga y evolución del peso.

import {
  getBloque,
  getCheckins,
  getComidasRango,
  getConsultasAsistente,
  getDias,
  getEjercicios,
  getLogs,
  getLogsRango,
  getPlanComidas,
  getPlanes,
  getSemanasCerradas,
  logsPorEjercicio,
  planesPorEjercicio
} from "./data";
import { diaSemanaDe, hoyDiaSemana, hoyFecha, sumarDias } from "./format";
import { macrosDe, objetivosCliente, sumarMacros } from "./nutrition";
import type { Mesocycle, Profile, ResumenSemana } from "./types";

// Comidas del menú por día (según lo que eligió el cliente)
function comidasPorDia(perfil: Profile): number {
  return perfil.cuestionario_nutricion?.comidas.length ?? 4;
}

// ── Semana en curso (lunes → hoy) ───────────────────────────────

export interface AdherenciaSemana {
  entrenos_hechos: number;
  entrenos_planificados: number; // hasta hoy
  entrenos_semana: number; // en toda la semana
  comidas_hechas: number;
  comidas_esperadas: number; // hasta hoy
  dias_transcurridos: number;
}

export async function adherenciaSemanaActual(perfil: Profile): Promise<AdherenciaSemana> {
  const hoy = hoyFecha();
  const diaHoy = hoyDiaSemana();
  const lunes = sumarDias(hoy, -(diaHoy - 1));
  const [dias, comidas, logs, plan] = await Promise.all([
    getDias(perfil.id),
    getComidasRango(perfil.id, lunes, hoy),
    getLogsRango(perfil.id, `${lunes}T00:00:00`, `${hoy}T23:59:59`),
    getPlanComidas(perfil.id)
  ]);
  const entreno = new Set(dias.filter((d) => !d.es_descanso).map((d) => d.dia_semana));
  const planificados = [...entreno].filter((d) => d <= diaHoy).length;
  // Un entreno "hecho" = un día con al menos una serie registrada
  const diasConLog = new Set(logs.map((l) => l.logged_at.slice(0, 10)));
  const hechos = [...diasConLog].filter((f) => entreno.has(diaSemanaDe(f))).length;
  const porDia = comidasPorDia(perfil);
  // Una comida del menú cuenta como hecha si ese día tiene al menos un
  // registro de ese momento que viene del plan
  const hechas = new Set(comidas.filter((c) => c.plan_item_id).map((c) => `${c.fecha}:${c.momento}`)).size;
  return {
    entrenos_hechos: Math.min(hechos, planificados),
    entrenos_planificados: planificados,
    entrenos_semana: entreno.size,
    comidas_hechas: plan ? hechas : 0,
    comidas_esperadas: plan ? porDia * diaHoy : 0,
    dias_transcurridos: diaHoy
  };
}

// ── Semana cerrada (para el check-in y el informe) ──────────────

export async function resumenDeSemana(perfil: Profile, meso: Mesocycle, semana: number): Promise<ResumenSemana> {
  const cierres = await getSemanasCerradas(meso.id);
  const cierre = cierres.find((c) => c.semana === semana)?.cerrada_at ?? new Date().toISOString();
  const hasta = cierre.slice(0, 10);
  const desde = sumarDias(hasta, -6);

  const [dias, ejercicios, planes, planesPrev, logs, comidas, plan, checkins, consultas] = await Promise.all([
    getDias(perfil.id),
    getEjercicios(perfil.id),
    getPlanes(meso.id, semana),
    semana > 1 ? getPlanes(meso.id, semana - 1) : Promise.resolve([]),
    getLogs(meso.id, semana),
    getComidasRango(perfil.id, desde, hasta),
    getPlanComidas(perfil.id),
    getCheckins(perfil.id, 2),
    getConsultasAsistente(perfil.id, { limite: 50 })
  ]);

  const entreno = dias.filter((d) => !d.es_descanso);
  const logsEj = logsPorEjercicio(logs);
  const diasHechos = new Set(
    ejercicios.filter((e) => (logsEj[e.id] ?? []).length > 0).map((e) => e.training_day_id)
  ).size;

  // Subidas de carga: peso planificado esta semana vs la anterior
  const mPrev = planesPorEjercicio(planesPrev);
  const mejoras = planes
    .map((p) => {
      const prev = mPrev[p.exercise_id];
      const ex = ejercicios.find((e) => e.id === p.exercise_id);
      if (!ex || !prev || p.peso_kg == null || prev.peso_kg == null || p.peso_kg <= prev.peso_kg) return null;
      return { ejercicio: ex.nombre, antes_kg: prev.peso_kg, ahora_kg: p.peso_kg };
    })
    .filter((x): x is { ejercicio: string; antes_kg: number; ahora_kg: number } => x !== null)
    .slice(0, 6);

  // Macros promedio de los días con registro, contra la referencia media
  const porFecha = new Map<string, typeof comidas>();
  for (const c of comidas) (porFecha.get(c.fecha) ?? porFecha.set(c.fecha, []).get(c.fecha)!).push(c);
  const diasReg = [...porFecha.keys()];
  let kcalProm: number | null = null;
  let protProm: number | null = null;
  let kcalRef: number | null = null;
  let protRef: number | null = null;
  if (diasReg.length) {
    const totales = diasReg.map((f) => sumarMacros(porFecha.get(f)!.map((c) => macrosDe(c.ingredient, c.cantidad_g))));
    kcalProm = Math.round(totales.reduce((a, t) => a + t.kcal, 0) / diasReg.length);
    protProm = Math.round(totales.reduce((a, t) => a + t.prot_g, 0) / diasReg.length);
    const refs = diasReg
      .map((f) => objetivosCliente(perfil, entreno.some((d) => d.dia_semana === diaSemanaDe(f))))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (refs.length) {
      kcalRef = Math.round(refs.reduce((a, r) => a + r.kcal, 0) / refs.length);
      protRef = Math.round(refs.reduce((a, r) => a + r.prot_g, 0) / refs.length);
    }
  }

  const hechasMenu = new Set(comidas.filter((c) => c.plan_item_id).map((c) => `${c.fecha}:${c.momento}`)).size;
  const anterior = checkins.find((c) => !(c.mesocycle_id === meso.id && c.semana === semana));

  return {
    semana,
    entrenos_hechos: diasHechos,
    entrenos_planificados: entreno.length,
    series_registradas: logs.length,
    comidas_menu_hechas: plan ? hechasMenu : 0,
    comidas_menu_esperadas: plan ? comidasPorDia(perfil) * 7 : 0,
    dias_con_registro_comida: diasReg.length,
    kcal_promedio: kcalProm,
    prot_promedio: protProm,
    kcal_referencia: kcalRef,
    prot_referencia: protRef,
    peso_anterior_kg: anterior?.peso_kg ?? perfil.peso_kg,
    peso_actual_kg: null,
    mejoras_carga: mejoras,
    consultas_asistente: consultas.filter((c) => c.fecha >= desde && c.fecha <= hasta).length
  };
}

// Semana cerrada más reciente sin check-in (para el aviso en Inicio)
export async function checkinPendiente(userId: string): Promise<{ mesoId: string; semana: number } | null> {
  const meso = await getBloque(userId);
  if (!meso) return null;
  const [cierres, checkins] = await Promise.all([getSemanasCerradas(meso.id), getCheckins(userId, 20)]);
  const hechos = new Set(checkins.filter((c) => c.mesocycle_id === meso.id).map((c) => c.semana));
  const ultimo = [...cierres].reverse().find((c) => !hechos.has(c.semana));
  return ultimo ? { mesoId: meso.id, semana: ultimo.semana } : null;
}
