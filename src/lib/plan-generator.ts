// Planes generados (IA, .txt o plantilla), en memoria y sin tocar la base.
// normalizarPlan sanea lo que devuelva la IA (o un borrador guardado);
// planPlantilla es el camino sin IA. Escribirlos en la base es tarea de
// plan-import.ts.

import { infoEjercicio } from "./exercise-info";
import { clasificarEjercicio, parcialesDeFase, sanearTempo, tempoConNota } from "./rutina";
import type {
  Cuestionario,
  DiaGenerado,
  EjercicioGenerado,
  FaseRutina,
  ModoProgresion,
  PlanGenerado,
  ProgresionBloque,
  Tempo,
  Unidad,
  VerbosCadencia
} from "./types";

const GRUPOS = ["pecho", "espalda", "pierna", "hombro", "brazo", "core", "otro"];
const UNIDADES: Unidad[] = ["kg", "peso_corporal", "sin_peso"];
const PROGRESIONES: ModoProgresion[] = ["compuesto", "aislamiento", "solo_reps", "al_fallo"];
const INCREMENTOS = [1, 1.25, 2.5, 5];
export const MAX_SEMANAS = 12; // tope de la base (planned_sets.semana)

const clamp = (n: unknown, min: number, max: number, def: number) => {
  const v = Number(n);
  return Number.isFinite(v) && n !== null && n !== "" ? Math.min(max, Math.max(min, Math.round(v))) : def;
};
// Guiones raros de la IA ("3‑5‑3‑0" con guion no separable) a "-"
const texto = (v: unknown, max: number) =>
  (typeof v === "string" || typeof v === "number" ? String(v) : "")
    .replace(/[‐-‒−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const lista = (v: unknown, max: number, largo: number) =>
  Array.isArray(v) ? v.map((x) => texto(x, largo)).filter(Boolean).slice(0, max) : [];

// "Día 1…N" sin día de la semana: hasta 3 días se reparten con un día de
// por medio (lunes, miércoles, viernes); con 4 o más, los primeros días
// disponibles del cliente, seguidos.
export function diasParaOrdinales(n: number, permitidos?: number[]): number[] {
  const propios = [...new Set(permitidos ?? [])].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  const disp = propios.length >= n ? propios : [1, 2, 3, 4, 5, 6, 7];
  if (n >= 4) return disp.slice(0, n);
  const elegidos: number[] = [];
  for (const d of disp) if (elegidos.length < n && (!elegidos.length || d - elegidos[elegidos.length - 1] >= 2)) elegidos.push(d);
  for (const d of disp) if (elegidos.length < n && !elegidos.includes(d)) elegidos.push(d);
  return elegidos.sort((a, b) => a - b);
}

function sanearFases(raw: unknown, total: number): FaseRutina[] {
  const fases: FaseRutina[] = [];
  for (const [i, f] of (Array.isArray(raw) ? raw : []).entries()) {
    const ff = (f ?? {}) as Record<string, unknown>;
    const previa = fases[fases.length - 1]?.semana_hasta ?? 0;
    const desde = Math.max(previa + 1, clamp(ff.semana_desde, 1, total, previa + 1));
    const hasta = clamp(ff.semana_hasta, desde, total, total);
    if (desde > total) break;
    const rir = Number(ff.rir);
    fases.push({
      nombre: texto(ff.nombre, 60) || `Fase ${i + 1}`,
      semana_desde: desde,
      semana_hasta: hasta,
      objetivo: texto(ff.objetivo, 160),
      reglas: lista(ff.reglas, 6, 220),
      tempo: sanearTempo(ff.tempo),
      descanso_seg: ff.descanso_seg == null ? null : clamp(ff.descanso_seg, 15, 600, 90),
      rir: ff.rir != null && Number.isFinite(rir) && rir >= 0 && rir <= 5 ? Math.round(rir) : null
    });
  }
  return fases;
}

// Parciales de la fase: el campo de la IA o lo que dicen sus reglas
function parcialesDe(raw: Record<string, unknown>, fase: FaseRutina | null): { completas: number; parciales: number } | null {
  const p = Number(raw?.parciales);
  const desdeReglas = parcialesDeFase([...(fase?.reglas ?? []), fase?.objetivo ?? ""]);
  if (desdeReglas) return desdeReglas;
  return Number.isInteger(p) && p > 0 && p <= 30 ? { completas: p, parciales: p } : null;
}

interface ContextoEj {
  fase: FaseRutina | null;
  semanas: { desde: number; hasta: number } | null; // null = todo el bloque
  // Recién leído por la IA: la nota del plan corrige la cadencia, las
  // parciales de la fase se aplican y el texto original decide "cada uno"
  desdeTexto: boolean;
  parcialesFase: { completas: number; parciales: number } | null;
  fuente: string | null;
}

// ¿La línea del ejercicio en el texto original dice "cada uno"?
function diceCadaUno(fuente: string | null, primera: string): boolean {
  if (!fuente) return false;
  const clave = primera.toLowerCase().slice(0, 18);
  return fuente
    .toLowerCase()
    .split(/\n|•/)
    .some((l) => l.includes(clave) && /cada uno/.test(l));
}

// ¿La línea del ejercicio (con sus reps) dice "por pierna", "/lado"…?
function porLadoEnFuente(fuente: string | null, nombre: string, reps: number): boolean {
  if (!fuente) return false;
  const clave = nombre.toLowerCase().slice(0, 18);
  return fuente
    .toLowerCase()
    .split(/\n|•/)
    .some(
      (l) =>
        l.includes(clave) &&
        l.includes(String(reps)) &&
        /\/\s*(pierna|lado|brazo)|por (pierna|lado|brazo)|cada (pierna|lado|brazo)/.test(l)
    );
}

function normalizarEjercicio(e: unknown, ctx: ContextoEj): EjercicioGenerado[] {
  const ee = (e ?? {}) as Record<string, unknown>;
  const nombre = texto(ee.nombre, 80);
  if (!nombre) return [];
  const porNombre = clasificarEjercicio(nombre);
  const unidad = UNIDADES.includes(ee.unidad as Unidad)
    ? (ee.unidad as Unidad)
    : ctx.desdeTexto && porNombre.pesoCorporal
      ? "peso_corporal"
      : "kg";
  const alFallo = ee.al_fallo === true || ee.progresion === "al_fallo";
  let progresion: ModoProgresion = PROGRESIONES.includes(ee.progresion as ModoProgresion)
    ? (ee.progresion as ModoProgresion)
    : alFallo
      ? "al_fallo"
      : (ee.tipo ?? (porNombre.compuesto ? "compuesto" : "aislamiento")) === "compuesto"
        ? "compuesto"
        : "aislamiento";
  if (unidad !== "kg" && progresion !== "al_fallo") progresion = "solo_reps";
  const compuesto = progresion === "compuesto";

  // "20", "6-8", "15–20" o los campos sueltos
  const m = /(\d{1,3})\s*(?:[-–]|a)?\s*(\d{1,3})?/.exec(texto(ee.reps, 20));
  const rep_min = clamp(ee.rep_min ?? m?.[1], 1, 60, compuesto ? 8 : 10);
  const rep_max = Math.max(rep_min, clamp(ee.rep_max ?? m?.[2] ?? m?.[1], 1, 60, compuesto ? 12 : 15));

  const grupoRaw = String(ee.grupo_muscular ?? ee.grupo ?? "");
  const grupo = GRUPOS.includes(grupoRaw) ? grupoRaw : porNombre.grupo;
  const pesoRaw = Number(ee.peso_inicial_kg);
  const peso_inicial_kg = unidad === "kg" && Number.isFinite(pesoRaw) && pesoRaw > 0 ? Math.round(pesoRaw * 4) / 4 : null;
  const incRaw = Number(ee.incremento_kg);
  const incremento_kg = INCREMENTOS.includes(incRaw) ? incRaw : 2.5;
  const auto = infoEjercicio(nombre, grupo);
  const tips = lista(ee.tips, 5, 200);

  let nota = texto(ee.nota, 200) || null;
  const propio = sanearTempo(ee.tempo);
  const tempo: Tempo | null = ctx.desdeTexto || !propio ? tempoConNota(propio ?? ctx.fase?.tempo ?? null, nota) : propio;
  const parcialesRaw = clamp(ee.parciales, 0, 60, 0);
  let parciales = parcialesRaw > 0 && parcialesRaw < rep_max ? parcialesRaw : null;
  if (ctx.desdeTexto) {
    const pf = ctx.parcialesFase;
    const enNota = /(\d{1,2})\s*(?:parciales|cortas|pulsos|tirones)/i.exec(nota ?? "");
    // "al fallo + 10s descanso + 10 parciales" es una pausa y otra tanda:
    // va en la nota, no como parte de las reps
    if (nota && /descans/i.test(nota) && /parcial/i.test(nota)) parciales = null;
    // La estructura de la fase (20 = 10 + 10) solo en las series que la cumplen
    else if (pf && rep_min === rep_max && rep_max === pf.completas + pf.parciales) parciales = parciales ?? pf.parciales;
    // Fuera de eso, solo si la nota del ejercicio las pide
    else parciales = enNota && Number(enNota[1]) < rep_max ? parciales ?? Number(enNota[1]) : null;
  }
  const vb = (ee.verbos ?? {}) as Record<string, unknown>;
  // Los verbos de la guía: los guardados o los de la base de técnica
  const verbos: VerbosCadencia | null =
    texto(vb.fuerza, 20) && texto(vb.regreso, 20)
      ? { fuerza: texto(vb.fuerza, 20), regreso: texto(vb.regreso, 20) }
      : auto.fuerza && auto.regreso
        ? { fuerza: auto.fuerza, regreso: auto.regreso }
        : null;
  const semanas = ctx.semanas
    ? ctx.semanas
    : ee.semana_desde != null || ee.semana_hasta != null
      ? { desde: clamp(ee.semana_desde, 1, MAX_SEMANAS, 1), hasta: clamp(ee.semana_hasta, 1, MAX_SEMANAS, MAX_SEMANAS) }
      : null;

  const base: EjercicioGenerado = {
    nombre,
    grupo_muscular: grupo,
    unidad,
    progresion,
    series: clamp(ee.series, 1, 10, 3),
    rep_min,
    rep_max,
    peso_inicial_kg,
    incremento_kg,
    descanso_seg: clamp(ee.descanso_seg ?? ctx.fase?.descanso_seg, 15, 600, compuesto ? 120 : 90),
    descripcion: texto(ee.descripcion, 300) || auto.descripcion,
    tips: tips.length ? tips : auto.tips
  };
  if (semanas && semanas.desde <= semanas.hasta) {
    base.semana_desde = semanas.desde;
    base.semana_hasta = semanas.hasta;
  }
  if (tempo) base.tempo = tempo;
  if (parciales) base.parciales = parciales;
  if (ee.por_lado === true || ee.lado === true || (ctx.desdeTexto && porLadoEnFuente(ctx.fuente, nombre, rep_max))) base.por_lado = true;
  const ss = texto(ee.superserie, 10);
  if (ss) {
    base.superserie = ss;
    // "Superserie 1: con X, 5s de pausa" → la superserie ya va aparte
    nota = nota?.replace(/^superserie\s*\w+\s*:?\s*(con\s+[^,.;]+[,.;]?)?\s*/i, "").trim() || null;
  }
  if (alFallo) base.al_fallo = true;
  const pasos = lista(ee.pasos, 10, 220);
  if (pasos.length) base.pasos = pasos;
  const clave = texto(ee.clave, 220);
  if (clave) base.clave = clave;
  if (verbos) base.verbos = verbos;

  // "Curl araña / Curl martillo: 3 × 20 cada uno" son dos ejercicios
  const partes = nombre.split(/\s+\/\s+/).map((p) => p.trim()).filter(Boolean);
  if (partes.length > 1 && (/cada uno/i.test(`${nota ?? ""} ${texto(ee.reps, 40)}`) || diceCadaUno(ctx.fuente, partes[0]))) {
    nota = nota?.replace(/,?\s*cada uno\s*/i, " ").replace(/\s+/g, " ").replace(/^\(\s*\)$/, "").trim() || null;
    return partes.map((p) => {
      const info = infoEjercicio(p, grupo);
      return {
        ...base,
        nombre: p.slice(0, 80),
        descripcion: tips.length ? base.descripcion : info.descripcion,
        tips: tips.length ? base.tips : info.tips,
        ...(info.fuerza && info.regreso ? { verbos: { fuerza: info.fuerza, regreso: info.regreso } } : {}),
        ...(nota ? { nota } : {})
      };
    });
  }
  if (nota) base.nota = nota;
  return [base];
}

// Deja el JSON de la IA (o un borrador guardado) en una forma segura para
// escribir en la base. Dos formas de entrada:
//  - plana: dias[] con dia_semana (planes de IA, plantillas, borradores)
//  - por fases: fases[] con sus dias[] ("Día 1…5" de cada fase), como lo
//    lee la IA del .txt del entrenador; se juntan por día de la semana.
// `diasPermitidos` (del cuestionario) ubica los "Día N" y corrige días
// fuera de rango.
export function normalizarPlan(
  raw: unknown,
  diasPermitidos?: number[],
  opciones: { desdeTexto?: boolean; fuente?: string } = {}
): PlanGenerado {
  const r = (raw ?? {}) as Record<string, unknown>;
  const fasesRaw = Array.isArray(r.fases) ? (r.fases as Record<string, unknown>[]) : [];
  const anidado = fasesRaw.some((f) => Array.isArray(f?.dias));
  const maxFase = fasesRaw.reduce((m, f) => Math.max(m, Number(f?.semana_hasta) || 0), 0);
  const total = clamp(r.total_semanas, 1, MAX_SEMANAS, Math.min(MAX_SEMANAS, maxFase || 8));
  const fases = sanearFases(fasesRaw, total);
  const desdeTexto = opciones.desdeTexto ?? false;
  const fuente = desdeTexto ? opciones.fuente ?? null : null;

  const porDia = new Map<number, DiaGenerado>();
  const agregar = (dia: number, nombre: string, ejercicios: EjercicioGenerado[]) => {
    if (!ejercicios.length) return;
    const previo = porDia.get(dia);
    if (!previo) {
      porDia.set(dia, { dia_semana: dia, nombre: nombre || `Día ${porDia.size + 1}`, ejercicios });
      return;
    }
    previo.ejercicios.push(...ejercicios);
    if (nombre && !previo.nombre.split(" / ").includes(nombre)) previo.nombre = `${previo.nombre} / ${nombre}`.slice(0, 40);
  };

  if (anidado) {
    // Los "Día N" de todas las fases van a los mismos días de la semana
    const ordinales = [
      ...new Set(
        fasesRaw.flatMap((f) =>
          (Array.isArray(f.dias) ? (f.dias as Record<string, unknown>[]) : [])
            .filter((d) => !(Number(d?.dia_semana) >= 1 && Number(d?.dia_semana) <= 7))
            .map((d, i) => clamp(d?.dia, 1, 7, i + 1))
        )
      )
    ].sort((a, b) => a - b);
    const semana = diasParaOrdinales(ordinales.length, diasPermitidos);
    const destino = new Map(ordinales.map((o, i) => [o, semana[i]]));
    fasesRaw.forEach((f, i) => {
      const fase = fases[i] ?? null;
      const cubreTodo = !fase || (fase.semana_desde === 1 && fase.semana_hasta === total);
      const semanas = cubreTodo ? null : { desde: fase.semana_desde, hasta: fase.semana_hasta };
      (Array.isArray(f.dias) ? (f.dias as Record<string, unknown>[]) : []).forEach((d, j) => {
        const ds = Number(d?.dia_semana);
        const dia = ds >= 1 && ds <= 7 && Number.isInteger(ds) ? ds : destino.get(clamp(d?.dia, 1, 7, j + 1));
        if (!dia) return;
        const ejercicios = (Array.isArray(d?.ejercicios) ? d.ejercicios : []).flatMap((e) =>
          normalizarEjercicio(e, { fase, semanas, desdeTexto, fuente, parcialesFase: parcialesDe(f, fase) })
        );
        agregar(dia, texto(d?.nombre, 40), ejercicios);
      });
    });
  } else {
    const usados = new Set<number>();
    for (const d of Array.isArray(r.dias) ? (r.dias as Record<string, unknown>[]) : []) {
      const diaRaw = Number(d?.dia_semana);
      let dia = Number.isInteger(diaRaw) && diaRaw >= 1 && diaRaw <= 7 ? diaRaw : 0;
      if (!dia || usados.has(dia)) {
        // Buscar el primer día libre (preferentemente de los disponibles)
        const candidatos = [...(diasPermitidos ?? []), 1, 2, 3, 4, 5, 6, 7];
        dia = candidatos.find((c) => !usados.has(c)) ?? 0;
        if (!dia) continue;
      }
      const ejercicios = (Array.isArray(d?.ejercicios) ? d.ejercicios : []).flatMap((e) =>
        normalizarEjercicio(e, { fase: null, semanas: null, desdeTexto, fuente, parcialesFase: null })
      );
      if (!ejercicios.length) continue;
      usados.add(dia);
      agregar(dia, texto(d?.nombre, 40), ejercicios);
    }
  }

  const dias = [...porDia.values()].sort((a, b) => a.dia_semana - b.dia_semana);
  if (!dias.length) throw new Error("El plan no tiene ningún día con ejercicios.");

  const plan: PlanGenerado = {
    nombre_bloque: texto(r.nombre_bloque, 60) || "Bloque de hipertrofia",
    notas: texto(r.notas, 400) || undefined,
    dias
  };
  if (r.total_semanas != null || fases.length) plan.total_semanas = total;
  if (fases.length) plan.fases = fases;
  const notasEntrenador = String(r.notas_entrenador ?? "").trim().slice(0, 1500);
  if (notasEntrenador) plan.notas_entrenador = notasEntrenador;
  if (r.progresion === "ondulada" || r.progresion === "plan") plan.progresion = r.progresion as ProgresionBloque;
  if (typeof r.fecha_inicio === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha_inicio)) plan.fecha_inicio = r.fecha_inicio;
  return plan;
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

