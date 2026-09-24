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
  q
} from "./data";
import { diaSemanaDe, fechaLocal, hoyFecha, sumarDias } from "./format";
import {
  armarDia,
  fechasHaciaAtras,
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
}

function menuDelDia(comidas: ComidaDelPlan[]): EntradaDia["menu"] {
  return comidas.map((c) => {
    const ingredientes = c.items
      .map((i) => `${i.ingredient?.nombre ?? "?"} ${Math.round(i.cantidad_g)} g`)
      .join(" · ");
    return {
      momento: c.momento,
      titulo: `${nombreMomento(c.momento)}${c.plato ? ` · ${c.plato}` : ""}`,
      detalle: `${ingredientes.length > 110 ? `${ingredientes.slice(0, 107)}…` : ingredientes} · ${c.macros.kcal} kcal`
    };
  });
}

const vacio = (): HechosDia => ({
  comidasMenu: new Set(),
  comidasManual: new Set(),
  entreno: false,
  ticks: new Set()
});

export async function checklistHoy(perfil: Profile, fecha = hoyFecha()): Promise<ChecklistHoy> {
  const userId = perfil.id;
  const desde = sumarDias(fecha, -(DIAS_HISTORIAL - 1));
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
  const porDia = ejerciciosPorDia(ejercicios);
  const menus = plan
    ? {
        entreno: menuDelDia(comidasPorMomento(plan.items, "entreno")),
        descanso: menuDelDia(comidasPorMomento(plan.items, "descanso"))
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
      horarios: plan?.plan.horarios ?? null,
      entreno: entrena && dia ? { diaId: dia.id, nombre: dia.nombre ?? "", ejercicios: (porDia[dia.id] ?? []).length } : null,
      minutosEntreno,
      menu: menus ? menus[tipo] : null,
      aguaMl: objetivosCliente(perfil, entrena)?.agua_ml ?? null,
      // El protocolo cuenta desde que arrancó, no para atrás
      protocolo: protocolo && f >= protocolo.inicio ? { items: protocolo.items, inicio: protocolo.inicio } : null,
      hechos: hechos.get(f) ?? vacio()
    });
    return { items, tipo };
  };

  const hoy = itemsDe(fecha);
  const historial: DiaConstancia[] = fechasHaciaAtras(fecha, DIAS_HISTORIAL).map((f, i) => ({
    fecha: f,
    pct: i === 0 ? porcentaje(hoy.items) : !inicio || f < inicio ? null : porcentaje(itemsDe(f).items)
  }));

  return {
    fecha,
    tipoDia: hoy.tipo,
    items: hoy.items,
    pct: porcentaje(hoy.items),
    tira: historial.slice(0, 14).reverse(),
    racha: racha(historial),
    promedio14: promedio(historial.slice(1, 15))
  };
}
