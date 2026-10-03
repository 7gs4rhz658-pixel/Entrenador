// Lectura del checklist de "Hoy": junta de la base lo que el cliente
// tiene que hacer y lo que ya hizo, y arma el día con hoy.ts. Lo usan
// Inicio (cliente) y la ficha del entrenador.

import {
  ejerciciosPorDia,
  getBloque,
  getDias,
  getEjercicios,
  getPlanComidas,
  getProtocolo,
  getSesiones,
  inicioDelPlan,
  q,
  type ProtocoloActivo
} from "./data";
import { diaSemanaDe, fechaLocal, hoyFecha, sumarDias } from "./format";
import { activoEnSemana } from "./rutina";
import {
  armarDia,
  fechasHaciaAtras,
  infoFase,
  type InfoFase,
  porcentaje,
  promedio,
  racha,
  type DiaConstancia,
  type EntradaDia,
  type HechosDia,
  type ItemHoy
} from "./hoy";
import { comidasPorMomento, type ComidaDelPlan } from "./meal-plan";
import { nombreMomento, objetivosCliente } from "./nutrition";
import { db } from "./supabase/server";
import type { Momento, Profile, TipoDia } from "./types";

const DIAS_HISTORIAL = 60; // tope de la racha

export interface ChecklistHoy {
  fecha: string;
  tipoDia: TipoDia;
  items: ItemHoy[];
  pct: number | null;
  tira: DiaConstancia[]; // últimos 14 días, del más viejo a hoy
  racha: number;
  promedio14: number | null; // los 14 días anteriores a hoy
  porArea: { area: string; pct: number }[]; // comidas, entreno, agua y cada segmento, en esos 14 días
  conProtocolo: boolean;
  fase: InfoFase | null; // en qué fase del protocolo va y qué cambia
  protocoloEmpieza: string | null; // fecha de inicio, si todavía no empezó
}

// Cumplimiento por área en un conjunto de días: "Comidas 80 %, Cara 40 %"
export function cumplimientoPorArea(dias: ItemHoy[][]): { area: string; pct: number }[] {
  const nombre = (i: ItemHoy) =>
    i.tipo === "comida" ? "Comidas" : i.tipo === "entreno" ? "Entreno" : i.tipo === "agua" ? "Agua" : i.segmento || "Protocolo";
  const cuenta = new Map<string, { hechos: number; total: number }>();
  for (const i of dias.flat()) {
    const c = cuenta.get(nombre(i)) ?? cuenta.set(nombre(i), { hechos: 0, total: 0 }).get(nombre(i))!;
    c.total++;
    if (i.hecho) c.hechos++;
  }
  return [...cuenta.entries()].map(([area, c]) => ({ area, pct: Math.round((c.hechos / c.total) * 100) }));
}

function menuDelDia(comidas: ComidaDelPlan[]): EntradaDia["menu"] {
  return comidas.map((c) => {
    const ingredientes = c.items
      .map((i) => `${i.ingredient?.nombre ?? "?"} ${Math.round(i.cantidad_g)} g`)
      .join(" · ");
    return {
      momento: c.momento,
      titulo: `${nombreMomento(c.momento)}${c.plato ? ` · ${c.plato}` : ""}`,
      detalle: `${ingredientes.length > 110 ? `${ingredientes.slice(0, 107)}…` : ingredientes} · ${c.macros.kcal} kcal`,
      hora: c.hora || undefined
    };
  });
}

const vacio = (): HechosDia => ({
  comidasMenu: new Set(),
  comidasManual: new Set(),
  entreno: false,
  ticks: new Set()
});

// Carga de una vez lo registrado entre dos fechas y devuelve cómo armar
// el checklist de cualquier día de ese rango.
async function preparar(
  perfil: Profile,
  desde: string,
  fecha: string
): Promise<{
  inicio: string | null;
  protocolo: ProtocoloActivo | null;
  itemsDe: (f: string) => { items: ItemHoy[]; tipo: TipoDia };
}> {
  const userId = perfil.id;
  const [meso, inicio, dias, ejercicios, plan, sesiones, protocolo, comidas, logs, ticks] = await Promise.all([
    getBloque(userId),
    inicioDelPlan(userId),
    getDias(userId),
    getEjercicios(userId),
    getPlanComidas(userId),
    getSesiones(userId, 4),
    getProtocolo(userId),
    q<{ fecha: string; momento: Momento; plan_item_id: string | null }[]>(
      db()
        .from("meal_logs")
        .select("fecha, momento, plan_item_id")
        .eq("user_id", userId)
        .gte("fecha", desde)
        .lte("fecha", fecha)
    ),
    // logged_at está en UTC: se pide un día de más por lado
    q<{ logged_at: string }[]>(
      db()
        .from("logged_sets")
        .select("logged_at")
        .eq("user_id", userId)
        .gte("logged_at", `${sumarDias(desde, -1)}T00:00:00Z`)
        .lte("logged_at", `${sumarDias(fecha, 1)}T23:59:59Z`)
    ),
    q<{ fecha: string; item_key: string }[]>(
      db()
        .from("checklist_dia")
        .select("fecha, item_key")
        .eq("user_id", userId)
        .gte("fecha", desde)
        .lte("fecha", fecha)
    )
  ]);

  const hechos = new Map<string, HechosDia>();
  const de = (f: string) => hechos.get(f) ?? hechos.set(f, vacio()).get(f)!;
  for (const c of comidas) (c.plan_item_id ? de(c.fecha).comidasMenu : de(c.fecha).comidasManual).add(c.momento);
  for (const l of logs) {
    const f = fechaLocal(l.logged_at);
    if (f >= desde && f <= fecha) de(f).entreno = true;
  }
  for (const t of ticks) de(t.fecha).ticks.add(t.item_key);

  const cn = perfil.cuestionario_nutricion;
  const porDia = ejerciciosPorDia(meso ? ejercicios.filter((e) => activoEnSemana(e, meso.semana_actual)) : ejercicios);
  const menus = plan
    ? {
        entreno: menuDelDia(comidasPorMomento(plan.items, "entreno", plan.plan.horarios)),
        descanso: menuDelDia(comidasPorMomento(plan.items, "descanso", plan.plan.horarios))
      }
    : null;
  const ultimas = sesiones.filter((s) => s.duracion_seg > 0);
  const minutosEntreno = ultimas.length
    ? Math.min(150, Math.max(20, Math.round(ultimas.reduce((a, s) => a + s.duracion_seg, 0) / ultimas.length / 60)))
    : 60;

  const itemsDe = (f: string): { items: ItemHoy[]; tipo: TipoDia } => {
    const diaSemana = diaSemanaDe(f);
    const dia = dias.find((d) => d.dia_semana === diaSemana);
    const entrena = !!meso && !!dia && !dia.es_descanso;
    const tipo: TipoDia = entrena ? "entreno" : "descanso";
    const items = armarDia({
      fecha: f,
      diaSemana,
      cn,
      entreno: entrena && dia ? { diaId: dia.id, nombre: dia.nombre ?? "", ejercicios: (porDia[dia.id] ?? []).length } : null,
      minutosEntreno,
      menu: menus ? menus[tipo] : null,
      aguaMl: objetivosCliente(perfil, entrena)?.agua_ml ?? null,
      // El protocolo cuenta desde que arrancó, no para atrás
      protocolo:
        protocolo && f >= protocolo.inicio
          ? { items: protocolo.items, inicio: protocolo.inicio, fases: protocolo.protocolo.fases }
          : null,
      hechos: hechos.get(f) ?? vacio()
    });
    return { items, tipo };
  };
  return { inicio, protocolo, itemsDe };
}

export async function checklistHoy(perfil: Profile, fecha = hoyFecha()): Promise<ChecklistHoy> {
  const { inicio, protocolo, itemsDe } = await preparar(perfil, sumarDias(fecha, -(DIAS_HISTORIAL - 1)), fecha);
  const hoy = itemsDe(fecha);
  const ultimos14: ItemHoy[][] = [];
  const historial: DiaConstancia[] = fechasHaciaAtras(fecha, DIAS_HISTORIAL).map((f, i) => {
    if (i === 0) return { fecha: f, pct: porcentaje(hoy.items) };
    if (!inicio || f < inicio) return { fecha: f, pct: null };
    const items = itemsDe(f).items;
    if (i <= 14) ultimos14.push(items);
    return { fecha: f, pct: porcentaje(items) };
  });

  return {
    fecha,
    tipoDia: hoy.tipo,
    items: hoy.items,
    pct: porcentaje(hoy.items),
    tira: historial.slice(0, 14).reverse(),
    racha: racha(historial),
    promedio14: promedio(historial.slice(1, 15)),
    porArea: cumplimientoPorArea(ultimos14),
    conProtocolo: !!protocolo,
    fase: protocolo ? infoFase(protocolo.protocolo.fases, protocolo.inicio, fecha, protocolo.items) : null,
    protocoloEmpieza: protocolo && protocolo.inicio > fecha ? protocolo.inicio : null
  };
}

// Cumplimiento del checklist entre dos fechas (informe semanal, panel)
export async function cumplimientoRango(
  perfil: Profile,
  desde: string,
  hasta: string
): Promise<{ promedio: number | null; porArea: { area: string; pct: number }[] }> {
  const { inicio, itemsDe } = await preparar(perfil, desde, hasta);
  const dias: ItemHoy[][] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    if (inicio && f >= inicio) dias.push(itemsDe(f).items);
  }
  const pcts = dias.map((d) => porcentaje(d)).filter((p): p is number => p != null);
  return {
    promedio: pcts.length ? Math.round(pcts.reduce((a, p) => a + p, 0) / pcts.length) : null,
    porArea: cumplimientoPorArea(dias)
  };
}
