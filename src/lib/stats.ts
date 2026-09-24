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
  getMedidas,
  getPlanComidas,
  getPlanes,
  getRecords,
  getSemanasCerradas,
  getSesionesSemana,
  logsPorEjercicio,
  planesPorEjercicio
} from "./data";
import { diaSemanaDe, fechaLocal, hoyDiaSemana, hoyFecha, sumarDias } from "./format";
import { ETIQUETAS_MEDIDA } from "./medidas";
import { macrosDe, objetivosCliente, sumarMacros } from "./nutrition";
import { CAMPOS_MEDIDA, type Medida, type Mesocycle, type Profile, type ResumenSemana } from "./types";

// Cambios de medidas entre la última toma del período y la última toma
// anterior a él (solo campos presentes en las dos)
export function cambiosMedidas(medidas: Medida[], desde: string, hasta: string): { medida: string; antes: number; ahora: number }[] {
  const enRango = medidas.filter((m) => m.fecha >= desde && m.fecha <= hasta);
  if (!enRango.length) return [];
  const ultima = enRango[0];
  const previas = medidas.filter((m) => m.fecha < desde);
  const out: { medida: string; antes: number; ahora: number }[] = [];
  for (const campo of CAMPOS_MEDIDA) {
    if (ultima[campo] == null) continue;
    const previa = previas.find((m) => m[campo] != null) ?? enRango.slice(1).find((m) => m[campo] != null);
    if (!previa) continue;
    const antes = Number(previa[campo]);
    const ahora = Number(ultima[campo]);
    if (antes !== ahora) out.push({ medida: ETIQUETAS_MEDIDA[campo], antes, ahora });
  }
  return out;
}

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
    // Rango ampliado un día por lado: logged_at está en UTC
    getLogsRango(perfil.id, `${sumarDias(lunes, -1)}T00:00:00Z`, `${sumarDias(hoy, 1)}T23:59:59Z`),
    getPlanComidas(perfil.id)
  ]);
  const entreno = new Set(dias.filter((d) => !d.es_descanso).map((d) => d.dia_semana));
  const planificados = [...entreno].filter((d) => d <= diaHoy).length;
  // Un entreno "hecho" = un día con al menos una serie registrada
  const diasConLog = new Set(
    logs.map((l) => fechaLocal(l.logged_at)).filter((f) => f >= lunes && f <= hoy)
  );
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
  const hasta = fechaLocal(cierre);
  const desde = sumarDias(hasta, -6);

  const [dias, ejercicios, planes, planesPrev, logs, comidas, plan, checkins, consultas, medidas, sesiones, records] = await Promise.all([
    getDias(perfil.id),
    getEjercicios(perfil.id),
    getPlanes(meso.id, semana),
    semana > 1 ? getPlanes(meso.id, semana - 1) : Promise.resolve([]),
    getLogs(meso.id, semana),
    getComidasRango(perfil.id, desde, hasta),
    getPlanComidas(perfil.id),
    getCheckins(perfil.id, 2),
    getConsultasAsistente(perfil.id, { limite: 50 }),
    getMedidas(perfil.id, 30),
    getSesionesSemana(meso.id, semana),
    getRecords(perfil.id, 30)
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
    consultas_asistente: consultas.filter((c) => c.fecha >= desde && c.fecha <= hasta).length,
    cambios_medidas: cambiosMedidas(medidas, desde, hasta),
    minutos_promedio: sesiones.length
      ? Math.round(sesiones.reduce((a, x) => a + x.duracion_seg, 0) / sesiones.length / 60)
      : null,
    records: records
      .filter((r) => r.fecha >= desde && r.fecha <= hasta)
      .map((r) => ({ ejercicio: r.ejercicio, valor: Number(r.valor), tipo: r.tipo }))
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

// ── Tu mes: últimas 4 semanas cerradas ──────────────────────────

export interface ResumenMes {
  semanas: number;
  desde: string;
  hasta: string;
  peso_inicial: number | null;
  peso_final: number | null;
  cintura_inicial: number | null;
  cintura_final: number | null;
  entrenos_hechos: number;
  entrenos_planificados: number;
  series: number;
  comidas_menu_hechas: number;
  comidas_menu_esperadas: number;
  cargas: { ejercicio: string; inicio_kg: number; fin_kg: number }[];
  energia_promedio: number | null;
  sueno_promedio: number | null;
  informes_aprobados: number;
  medidas: { medida: string; antes: number; ahora: number }[];
}

export async function resumenMes(perfil: Profile): Promise<ResumenMes | null> {
  const checkins = (await getCheckins(perfil.id, 8)).filter((c) => c.resumen).slice(0, 4).reverse();
  if (!checkins.length) return null;
  const meso = await getBloque(perfil.id);
  const prom = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const suma = (f: (r: ResumenSemana) => number) => checkins.reduce((a, c) => a + f(c.resumen!), 0);

  // Cargas: peso planificado en la primera semana del bloque vs la actual
  const cargas: ResumenMes["cargas"] = [];
  if (meso) {
    const [ejercicios, inicio, actual] = await Promise.all([
      getEjercicios(perfil.id),
      getPlanes(meso.id, 1),
      getPlanes(meso.id, meso.semana_actual)
    ]);
    const mIni = planesPorEjercicio(inicio);
    for (const p of actual) {
      const ex = ejercicios.find((e) => e.id === p.exercise_id);
      const ini = mIni[p.exercise_id];
      if (!ex || !ini || ini.peso_kg == null || p.peso_kg == null || p.peso_kg <= ini.peso_kg) continue;
      cargas.push({ ejercicio: ex.nombre, inicio_kg: ini.peso_kg, fin_kg: p.peso_kg });
    }
    cargas.sort((a, b) => b.fin_kg - b.inicio_kg - (a.fin_kg - a.inicio_kg));
  }

  const primero = checkins[0];
  const ultimo = checkins[checkins.length - 1];
  const desde = sumarDias(primero.fecha, -6);
  const medidas = await getMedidas(perfil.id, 40);
  return {
    semanas: checkins.length,
    desde,
    hasta: ultimo.fecha,
    medidas: cambiosMedidas(medidas, desde, ultimo.fecha),
    peso_inicial: primero.resumen!.peso_anterior_kg ?? primero.peso_kg,
    peso_final: ultimo.peso_kg,
    cintura_inicial: checkins.find((c) => c.cintura_cm != null)?.cintura_cm ?? null,
    cintura_final: [...checkins].reverse().find((c) => c.cintura_cm != null)?.cintura_cm ?? null,
    entrenos_hechos: suma((r) => r.entrenos_hechos),
    entrenos_planificados: suma((r) => r.entrenos_planificados),
    series: suma((r) => r.series_registradas),
    comidas_menu_hechas: suma((r) => r.comidas_menu_hechas),
    comidas_menu_esperadas: suma((r) => r.comidas_menu_esperadas),
    cargas: cargas.slice(0, 8),
    energia_promedio: prom(checkins.map((c) => c.energia)),
    sueno_promedio: prom(checkins.map((c) => c.sueno)),
    informes_aprobados: checkins.filter((c) => c.informe_estado === "aprobado").length
  };
}
