// Checklist de "Hoy": todo lo que le toca al cliente en el día, ordenado
// por hora (comidas, entreno, agua y el protocolo del entrenador), más la
// constancia de los últimos días. Puro: la lectura de la base está en
// hoy-db.ts.

import { fmtLitros, sumarDias } from "./format";
import { normalizarTexto } from "./meal-plan";
import { nombreMomento } from "./nutrition";
import type { AnclaProtocolo, CuestionarioNutricion, FaseProtocolo, Momento, ProtocoloItem } from "./types";

export type TipoItemHoy = "comida" | "entreno" | "agua" | "protocolo";

export interface ItemHoy {
  key: string; // "comida:almuerzo", "entreno", "agua", "p:<id>"
  tipo: TipoItemHoy;
  hora: string; // "HH:MM"; "" si no tiene hora fija
  titulo: string;
  detalle: string;
  porque: string | null;
  segmento: string | null;
  hecho: boolean;
  momento?: Momento;
  conMenu?: boolean; // la comida está en el menú: se marca con un toque
  soloManual?: boolean; // la registró a mano en Nutrición: no se desmarca desde acá
  href?: string;
  orden: number; // minutos desde las 00:00 usados para ordenar
}

export interface HechosDia {
  comidasMenu: Set<Momento>; // momentos con algo registrado desde el menú
  comidasManual: Set<Momento>; // momentos con algo registrado a mano
  entreno: boolean; // hay series registradas ese día
  ticks: Set<string>; // casillas marcadas (agua y protocolo)
}

export interface EntradaDia {
  fecha: string;
  diaSemana: number; // 1 = lunes ... 7 = domingo
  cn: CuestionarioNutricion | null;
  entreno: { diaId: string; nombre: string; ejercicios: number } | null; // null = descanso
  minutosEntreno: number; // duración típica de la sesión
  // null = sin menú; `hora` = la que fija el menú para este tipo de día
  menu: { momento: Momento; titulo: string; detalle: string; hora?: string }[] | null;
  aguaMl: number | null;
  protocolo: { items: ProtocoloItem[]; inicio: string; fases?: FaseProtocolo[] } | null;
  hechos: HechosDia;
}

// ── Horas ───────────────────────────────────────────────────────

const HORA_TIPICA: Record<Momento, string> = {
  desayuno: "08:00",
  almuerzo: "13:00",
  merienda: "17:00",
  cena: "21:00",
  snack: "11:00",
  pre_entreno: "17:30",
  post_entreno: "19:30"
};

export function aMinutos(hora: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((hora ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function aHora(minutos: number): string {
  const m = Math.min(23 * 60 + 59, Math.max(0, Math.round(minutos)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// "05:30" → "5:30 am"; "19:30" → "7:30 pm"
export function fmtHora(hora: string): string {
  const min = aMinutos(hora);
  if (min == null) return "";
  const h = Math.floor(min / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

// Horarios del día del cliente: los que cargó y, si faltan, estimados a
// partir de lo que sí cargó (solo para ordenar; no se muestran).
export interface HorarioDia {
  comida: (m: Momento) => { min: number; real: boolean };
  entreno: { min: number; real: boolean };
  despertar: { min: number; real: boolean };
  dormir: { min: number; real: boolean };
}

// `horasMenu`: las horas que fija el menú para este tipo de día (mandan
// sobre las del cuestionario: entreno y descanso pueden ir distinto).
export function horarioDelDia(
  cn: CuestionarioNutricion | null,
  horasMenu: Partial<Record<Momento, string>> = {},
  minutosEntreno = 60
): HorarioDia {
  const entrenoReal = aMinutos(cn?.hora_entreno);
  const entreno = entrenoReal != null ? { min: entrenoReal, real: true } : { min: 18 * 60, real: false };
  const comida = (m: Momento) => {
    const real = aMinutos(horasMenu[m]) ?? aMinutos(cn?.comidas.find((c) => c.momento === m)?.hora);
    if (real != null) return { min: real, real: true };
    // Pre y post-entreno, sin hora propia, van pegados al entreno
    if (m === "pre_entreno") return { min: entreno.min - 30, real: entreno.real };
    if (m === "post_entreno") return { min: entreno.min + minutosEntreno + 15, real: entreno.real };
    return { min: aMinutos(HORA_TIPICA[m])!, real: false };
  };

  const conocidas = [
    ...(cn?.comidas ?? []).map((c) => aMinutos(c.hora)),
    ...Object.values(horasMenu).map((h) => aMinutos(h)),
    entrenoReal
  ].filter((x): x is number => x != null);
  const despReal = aMinutos(cn?.hora_despertar);
  const dormReal = aMinutos(cn?.hora_dormir);
  const despertar =
    despReal != null
      ? { min: despReal, real: true }
      : { min: conocidas.length ? Math.max(3 * 60 + 30, Math.min(...conocidas) - 30) : 7 * 60, real: false };
  const dormir =
    dormReal != null
      ? { min: dormReal, real: true }
      : { min: conocidas.length ? Math.min(23 * 60 + 30, Math.max(...conocidas) + 150) : 22 * 60 + 30, real: false };
  return { comida, entreno, despertar, dormir };
}

// ── Protocolo: ¿aplica hoy y a qué hora? ────────────────────────

// Día del protocolo (1 = la fecha de inicio; 0 o menos = todavía no empezó)
export function diaDelProtocolo(inicio: string, fecha: string): number {
  return (
    Math.round((new Date(`${fecha}T12:00:00Z`).getTime() - new Date(`${inicio}T12:00:00Z`).getTime()) / 86_400_000) + 1
  );
}

// Semana del protocolo (1 = la primera) para una fecha
export function semanaDelProtocolo(inicio: string, fecha: string): number {
  return Math.max(1, Math.floor((diaDelProtocolo(inicio, fecha) - 1) / 7) + 1);
}

// Fase en la que cae un día del protocolo (1 = la primera); null si el
// protocolo no tiene fases
export function faseDelDia(fases: FaseProtocolo[] | undefined, dia: number): number | null {
  if (!fases?.length) return null;
  let n = 1;
  fases.forEach((f, i) => {
    if (dia >= f.desde_dia) n = i + 1;
  });
  return n;
}

const ANCLAS_DE_ENTRENO: AnclaProtocolo[] = [
  "antes_entreno",
  "durante_entreno",
  "despues_entreno",
  "con_pre_entreno",
  "con_post_entreno"
];

export function aplicaHoy(
  item: Pick<ProtocoloItem, "dias" | "aplica" | "semana_desde" | "semana_hasta"> &
    Partial<Pick<ProtocoloItem, "fase_desde" | "fase_hasta">> & { ancla?: AnclaProtocolo },
  diaSemana: number,
  esEntreno: boolean,
  semana: number,
  fase: number | null = null
): boolean {
  if (item.dias.length && !item.dias.includes(diaSemana)) return false;
  if (item.aplica === "entreno" && !esEntreno) return false;
  // Antes, durante o después de entrenar no existe en un día de descanso
  if (!esEntreno && item.ancla && ANCLAS_DE_ENTRENO.includes(item.ancla)) return false;
  if (item.aplica === "descanso" && esEntreno) return false;
  if (item.semana_desde != null && semana < item.semana_desde) return false;
  if (item.semana_hasta != null && semana > item.semana_hasta) return false;
  // Las fases solo cuentan si el protocolo las tiene
  if (fase != null && item.fase_desde != null && fase < item.fase_desde) return false;
  if (fase != null && item.fase_hasta != null && fase > item.fase_hasta) return false;
  return true;
}

const ANCLA_COMIDA: Partial<Record<AnclaProtocolo, Momento>> = {
  con_desayuno: "desayuno",
  con_almuerzo: "almuerzo",
  con_merienda: "merienda",
  con_cena: "cena",
  con_snack: "snack",
  con_pre_entreno: "pre_entreno",
  con_post_entreno: "post_entreno"
};

// Hora del ítem en el día del cliente. `real` = false cuando depende de un
// horario que el cliente no cargó: sirve para ordenar pero no se muestra.
export function horaDelItem(
  item: Pick<ProtocoloItem, "ancla" | "offset_min" | "hora">,
  h: HorarioDia,
  minutosEntreno: number
): { min: number; real: boolean } | null {
  const mas = (b: { min: number; real: boolean }, extra = 0) => ({ min: b.min + extra + item.offset_min, real: b.real });
  const momento = ANCLA_COMIDA[item.ancla];
  if (momento) return mas(h.comida(momento));
  switch (item.ancla) {
    case "hora_fija": {
      const m = aMinutos(item.hora);
      return m == null ? null : { min: m + item.offset_min, real: true };
    }
    case "al_despertar":
      return mas(h.despertar);
    case "antes_entreno":
      // "15 min antes de entrenar" = −15; sin minutos, media hora antes
      return item.offset_min ? mas(h.entreno) : mas(h.entreno, -30);
    case "durante_entreno":
      return mas(h.entreno, 1);
    case "despues_entreno":
      return mas(h.entreno, minutosEntreno);
    case "antes_dormir":
      return mas(h.dormir, -30);
    default:
      return null; // en_el_dia
  }
}

// ── Armar el día ────────────────────────────────────────────────

const PRIORIDAD: Record<TipoItemHoy, number> = { comida: 0, entreno: 1, protocolo: 2, agua: 3 };
const SIN_HORA = 24 * 60; // lo que va "en el día" queda al final
const AGUA = /\bagua\b/;

export function armarDia(e: EntradaDia): ItemHoy[] {
  const horasMenu: Partial<Record<Momento, string>> = {};
  for (const c of e.menu ?? []) if (c.hora) horasMenu[c.momento] = c.hora;
  const h = horarioDelDia(e.cn, horasMenu, e.minutosEntreno);
  const items: ItemHoy[] = [];

  // Comidas: las del menú o, sin menú, las que el cliente dijo que hace
  const comidas =
    e.menu ??
    (e.cn?.comidas ?? []).map((c) => ({ momento: c.momento, titulo: nombreMomento(c.momento), detalle: "" }));
  for (const c of comidas) {
    const hora = h.comida(c.momento);
    const porMenu = e.hechos.comidasMenu.has(c.momento);
    const aMano = e.hechos.comidasManual.has(c.momento);
    items.push({
      key: `comida:${c.momento}`,
      tipo: "comida",
      hora: hora.real ? aHora(hora.min) : "",
      titulo: c.titulo,
      detalle: c.detalle || (e.menu ? "" : "Registra lo que comiste"),
      porque: null,
      segmento: null,
      hecho: porMenu || aMano,
      momento: c.momento,
      conMenu: e.menu != null,
      soloManual: !porMenu && aMano,
      href: e.menu ? undefined : "/nutricion",
      orden: hora.min
    });
  }

  if (e.entreno) {
    items.push({
      key: "entreno",
      tipo: "entreno",
      hora: h.entreno.real ? aHora(h.entreno.min) : "",
      titulo: `Entreno${e.entreno.nombre ? ` · ${e.entreno.nombre}` : ""}`,
      detalle: `${e.entreno.ejercicios} ejercicio${e.entreno.ejercicios === 1 ? "" : "s"}`,
      porque: null,
      segmento: null,
      hecho: e.hechos.entreno,
      href: `/dia/${e.entreno.diaId}/entrenar`,
      orden: h.entreno.min
    });
  }

  // Protocolo: lo del mismo segmento a la misma hora es una sola casilla
  // ("Cara: limpiador, sérum, protector"), como una rutina, no tres pasos
  if (e.protocolo) {
    const semana = semanaDelProtocolo(e.protocolo.inicio, e.fecha);
    const fase = faseDelDia(e.protocolo.fases, diaDelProtocolo(e.protocolo.inicio, e.fecha));
    const grupos = new Map<string, { it: ProtocoloItem; hora: { min: number; real: boolean } | null }[]>();
    for (const it of [...e.protocolo.items].sort((a, b) => a.orden - b.orden)) {
      if (!aplicaHoy(it, e.diaSemana, e.entreno != null, semana, fase)) continue;
      const hora = horaDelItem(it, h, e.minutosEntreno);
      const clave = `${it.segmento}|${hora ? hora.min : SIN_HORA}`;
      (grupos.get(clave) ?? grupos.set(clave, []).get(clave)!).push({ it, hora });
    }
    for (const lista of grupos.values()) {
      const { it: primero, hora } = lista[0];
      const key = `p:${primero.id}`;
      const varios = lista.length > 1;
      const nombre = (t: string) => t.replace(/\s*\((mañana|noche|am|pm)\)/i, "");
      const detalles = lista.map((x) => x.it.detalle).filter(Boolean).join(" · ");
      const razones = lista.filter((x) => x.it.porque).map((x) => (varios ? `${nombre(x.it.titulo)}: ${x.it.porque}` : x.it.porque));
      items.push({
        key,
        tipo: "protocolo",
        hora: hora?.real ? aHora(hora.min) : "",
        titulo: varios ? lista.map((x) => nombre(x.it.titulo)).join(", ") : primero.titulo,
        detalle: detalles.length > 160 ? `${detalles.slice(0, 157)}…` : detalles,
        porque: razones.length ? razones.join(" · ") : null,
        segmento: primero.segmento,
        hecho: e.hechos.ticks.has(key),
        orden: hora ? hora.min : SIN_HORA
      });
    }
  }

  // Si el entrenador ya puso el agua en el protocolo, no se repite
  const aguaEnProtocolo = items.some((i) => i.tipo === "protocolo" && AGUA.test(normalizarTexto(i.titulo)));
  if (e.aguaMl && !aguaEnProtocolo) {
    items.push({
      key: "agua",
      tipo: "agua",
      hora: "",
      titulo: `Agua: ${fmtLitros(e.aguaMl)}`,
      detalle: "Repartida en el día",
      porque: null,
      segmento: null,
      hecho: e.hechos.ticks.has("agua"),
      orden: SIN_HORA + 1
    });
  }

  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => a.it.orden - b.it.orden || PRIORIDAD[a.it.tipo] - PRIORIDAD[b.it.tipo] || a.i - b.i)
    .map((x) => x.it);
}

// ── Fases del protocolo ─────────────────────────────────────────

export interface InfoFase {
  numero: number;
  total: number;
  nombre: string;
  nota: string | null;
  dia: number; // día del protocolo (1 = el inicio)
  diaDeLaFase: number;
  hasta: string | null; // último día de esta fase; null = la última
  nuevos: string[]; // lo que se suma en esta fase
  proxima: { numero: number; nombre: string; fecha: string; nuevos: string[] } | null;
}

// Dónde va el cliente en las fases y qué cambia ahora o en la próxima.
// Antes del inicio devuelve la fase 1 con día ≤ 0 (para "empieza el…").
export function infoFase(
  fases: FaseProtocolo[] | undefined,
  inicio: string,
  fecha: string,
  items: Pick<ProtocoloItem, "titulo" | "fase_desde">[]
): InfoFase | null {
  if (!fases?.length) return null;
  const dia = diaDelProtocolo(inicio, fecha);
  const numero = faseDelDia(fases, Math.max(1, dia))!;
  const fase = fases[numero - 1];
  const sig = fases[numero];
  const nuevosDe = (n: number) => [
    ...new Set(items.filter((i) => (i.fase_desde ?? 1) === n).map((i) => i.titulo))
  ];
  return {
    numero,
    total: fases.length,
    nombre: fase.nombre,
    nota: fase.nota,
    dia,
    diaDeLaFase: dia - fase.desde_dia + 1,
    hasta: sig ? sumarDias(inicio, sig.desde_dia - 2) : null,
    nuevos: nuevosDe(numero),
    proxima: sig
      ? { numero: numero + 1, nombre: sig.nombre, fecha: sumarDias(inicio, sig.desde_dia - 1), nuevos: nuevosDe(numero + 1) }
      : null
  };
}

export function porcentaje(items: Pick<ItemHoy, "hecho">[]): number | null {
  if (!items.length) return null;
  return Math.round((items.filter((i) => i.hecho).length / items.length) * 100);
}

// El que toca ahora: el primer pendiente desde una hora antes; si todo lo
// de más tarde está hecho, el primer pendiente que quede.
export function siguientePendiente(items: ItemHoy[], ahoraMin: number): ItemHoy | null {
  const pendientes = items.filter((i) => !i.hecho);
  return pendientes.find((i) => i.orden >= ahoraMin - 60) ?? pendientes[0] ?? null;
}

// ── Constancia ──────────────────────────────────────────────────

export const UMBRAL_DIA = 70; // un día "cumplido" = 70 % o más

export interface DiaConstancia {
  fecha: string;
  pct: number | null; // null = antes de arrancar el plan
}

// Días seguidos cumplidos. `dias` va de hoy hacia atrás. Hoy suma si ya
// está cumplido, pero si todavía no, no corta la racha.
export function racha(dias: DiaConstancia[]): number {
  let n = 0;
  for (let i = 0; i < dias.length; i++) {
    const p = dias[i].pct;
    if (p != null && p >= UMBRAL_DIA) n++;
    else if (i > 0) break;
  }
  return n;
}

export function promedio(dias: DiaConstancia[]): number | null {
  const con = dias.filter((d) => d.pct != null);
  if (!con.length) return null;
  return Math.round(con.reduce((a, d) => a + (d.pct ?? 0), 0) / con.length);
}

// Fechas de hoy hacia atrás
export function fechasHaciaAtras(hoy: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => sumarDias(hoy, -i));
}
