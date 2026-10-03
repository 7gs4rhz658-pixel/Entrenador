// Rutinas del entrenador por fases (funciones puras): qué ejercicios
// tocan cada semana, en qué fase va el cliente y cómo se ejecuta cada
// serie (cadencia, parciales, superseries). Lo usan el servidor y las
// pantallas del cliente.

import { infoEjercicio } from "./exercise-info";
import { faseDe, nombreFase } from "./progression";
import type { EjercicioGenerado, FaseRutina, Mesocycle, Tempo, VerbosCadencia } from "./types";

type ConSemanas = { semana_desde?: number | null; semana_hasta?: number | null };

// ¿El ejercicio toca en esta semana del bloque? (sin fase = todas)
export function activoEnSemana(ex: ConSemanas, semana: number): boolean {
  return (ex.semana_desde ?? 1) <= semana && semana <= (ex.semana_hasta ?? 99);
}

export function faseDeSemana(
  fases: FaseRutina[] | null | undefined,
  semana: number
): { fase: FaseRutina; numero: number } | null {
  const lista = fases ?? [];
  const i = lista.findIndex((f) => f.semana_desde <= semana && semana <= f.semana_hasta);
  return i === -1 ? null : { fase: lista[i], numero: i + 1 };
}

// Lo que va debajo de "Semana N de 8"
export function etapaDelBloque(meso: Pick<Mesocycle, "fases" | "progresion">, semana: number): string {
  const f = faseDeSemana(meso.fases, semana);
  if (f) return `Fase ${f.numero} · ${f.fase.nombre}`;
  if (meso.progresion === "plan") return "Plan de tu entrenador";
  const fo = faseDe(semana);
  return `Fase ${fo} · ${nombreFase(fo)}`;
}

// La fase que arranca la semana que viene, si cambia (para avisar)
export function faseQueEmpieza(
  fases: FaseRutina[] | null | undefined,
  semana: number
): { fase: FaseRutina; numero: number } | null {
  const sig = faseDeSemana(fases, semana + 1);
  return sig && sig.fase.semana_desde === semana + 1 ? sig : null;
}

export function textoSemanas(f: Pick<FaseRutina, "semana_desde" | "semana_hasta">): string {
  return f.semana_desde === f.semana_hasta ? `semana ${f.semana_desde}` : `semanas ${f.semana_desde} a ${f.semana_hasta}`;
}

// ── Cadencia ────────────────────────────────────────────────────

const num = (v: unknown, max = 20): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null;
};

// "3-5-3-0" en el orden del plan: fuerza · pausa apretando · regreso ·
// pausa estirado. Si faltan los dos últimos, valen 0.
export function parsearTempo(texto: string): Tempo | null {
  const m = /^\s*(\d{1,2})\s*[-–:/]\s*(\d{1,2})\s*[-–:/]\s*(\d{1,2})(?:\s*[-–:/]\s*(\d{1,2}))?\s*$/.exec(texto ?? "");
  if (!m) return null;
  const [c, pc, e, pe] = [m[1], m[2], m[3], m[4] ?? "0"].map(Number);
  if (c + pc + e + pe === 0) return null;
  return { concentrico: c, contraccion: pc, excentrico: e, estiramiento: pe, texto: `${c}-${pc}-${e}-${pe}` };
}

export function textoTempo(t: Tempo): string {
  return t.texto || `${t.concentrico}-${t.contraccion}-${t.excentrico}-${t.estiramiento}`;
}

// Acepta el objeto (de la IA o guardado) o el texto "3-5-3-0"
export function sanearTempo(raw: unknown): Tempo | null {
  if (typeof raw === "string") return parsearTempo(raw);
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const c = num(r.concentrico);
  const pc = num(r.contraccion) ?? 0;
  const e = num(r.excentrico);
  const pe = num(r.estiramiento) ?? 0;
  if (c == null || e == null || c + pc + e + pe === 0) return null;
  const texto = typeof r.texto === "string" && parsearTempo(r.texto) ? r.texto.trim() : `${c}-${pc}-${e}-${pe}`;
  return { concentrico: c, contraccion: pc, excentrico: e, estiramiento: pe, texto };
}

const SEG = /(\d{1,2})\s*(?:s|seg|segundos)\b/i;

// Dónde va la pausa según la nota del plan: "5s isometría abajo en
// estiramiento" la pasa al estiramiento; "+ 5s en punta" suma una pausa
// apretando; "bajada en 3s" fija el regreso. Lo demás queda como la fase.
export function tempoConNota(base: Tempo | null, nota: string | null | undefined): Tempo | null {
  if (!base || !nota) return base;
  let estiramiento: number | null = null;
  let contraccion: number | null = null;
  let excentrico: number | null = null;
  for (const tramo of nota.split(/\+|,|;/)) {
    const m = SEG.exec(tramo);
    if (!m || /descans/i.test(tramo)) continue;
    const s = Number(m[1]);
    if (/estiramiento|estirad/i.test(tramo)) estiramiento = s;
    else if (/bajada|exc[eé]ntric/i.test(tramo)) excentrico = s;
    else if (/isometr|pausa|contracci|apret|cruce|punta|arriba|pico|centro|clav[ií]cula|retra/i.test(tramo)) contraccion = s;
  }
  if (estiramiento == null && contraccion == null && excentrico == null) return base;
  const t: Tempo = {
    concentrico: base.concentrico,
    contraccion: contraccion ?? (estiramiento != null ? 0 : base.contraccion),
    excentrico: excentrico ?? base.excentrico,
    estiramiento: estiramiento ?? base.estiramiento
  };
  t.texto = `${t.concentrico}-${t.contraccion}-${t.excentrico}-${t.estiramiento}`;
  return t;
}

// Fases de una repetición, en orden, sin las de 0 s
export function tramosDeRep(
  t: Tempo,
  verbos: VerbosCadencia | null | undefined
): { clave: "fuerza" | "contraccion" | "regreso" | "estiramiento"; texto: string; seg: number }[] {
  return [
    { clave: "fuerza" as const, texto: verbos?.fuerza || "Sube", seg: t.concentrico },
    { clave: "contraccion" as const, texto: "Aprieta", seg: t.contraccion },
    { clave: "regreso" as const, texto: verbos?.regreso || "Baja", seg: t.excentrico },
    { clave: "estiramiento" as const, texto: "Pausa estirado", seg: t.estiramiento }
  ].filter((x) => x.seg > 0);
}

// "Sube 3 s → aprieta 5 s → baja 3 s"
export function textoRep(t: Tempo, verbos: VerbosCadencia | null | undefined): string {
  return tramosDeRep(t, verbos)
    .map((x, i) => `${i ? x.texto.toLowerCase() : x.texto} ${x.seg} s`)
    .join(" → ");
}

// ── Guía de cadencia (el cronómetro de la serie) ────────────────

export interface PasoGuia {
  texto: string; // "Sube", "Aprieta", "Parciales"…
  seg: number;
  rep: number | null; // repetición completa a la que pertenece
  lado: 1 | 2 | null;
  tipo: "prepara" | "tramo" | "parciales" | "cambio";
}

// La serie segundo a segundo: preparación, cada repetición con su
// cadencia, las parciales (una por segundo) y, si es por lado, lo mismo
// del otro lado.
export function secuenciaCadencia(
  t: Tempo,
  verbos: VerbosCadencia | null | undefined,
  completas: number,
  parciales: number,
  porLado = false
): PasoGuia[] {
  const pasos: PasoGuia[] = [{ texto: "Prepárate", seg: 3, rep: null, lado: porLado ? 1 : null, tipo: "prepara" }];
  const lados: (1 | 2 | null)[] = porLado ? [1, 2] : [null];
  for (const lado of lados) {
    if (lado === 2) pasos.push({ texto: "Cambia de lado", seg: 5, rep: null, lado, tipo: "cambio" });
    for (let r = 1; r <= completas; r++) {
      for (const x of tramosDeRep(t, verbos)) pasos.push({ texto: x.texto, seg: x.seg, rep: r, lado, tipo: "tramo" });
    }
    if (parciales > 0) pasos.push({ texto: "Parciales", seg: parciales, rep: null, lado, tipo: "parciales" });
  }
  return pasos;
}

// ── Cómo se hace cada serie ─────────────────────────────────────

type EjSerie = {
  rep_min: number | null;
  rep_max: number | null;
  tempo?: Tempo | null;
  parciales?: number | null;
  por_lado?: boolean;
  verbos?: VerbosCadencia | null;
};

// Repeticiones completas y parciales de una serie (con las del tope del rango)
export function repsDeSerie(ex: EjSerie): { completas: number; parciales: number } {
  const total = Math.max(ex.rep_max ?? 0, ex.rep_min ?? 0) || 10;
  const parciales = ex.parciales && ex.parciales > 0 && ex.parciales < total ? ex.parciales : 0;
  return { completas: total - parciales, parciales };
}

// La serie paso a paso: completas con su cadencia → parciales → descanso
export function pasosDeLaSerie(ex: EjSerie, descansoSeg: number | null): string[] {
  const { completas, parciales } = repsDeSerie(ex);
  const rango = ex.rep_min && ex.rep_max && ex.rep_min !== ex.rep_max && !parciales ? `${ex.rep_min} a ${ex.rep_max}` : `${completas}`;
  const lado = ex.por_lado ? " por lado" : "";
  const pasos = [
    ex.tempo
      ? `${rango} repeticiones completas${lado}: ${textoRep(ex.tempo, ex.verbos).toLowerCase()}`
      : `${rango} repeticiones${lado} con control`
  ];
  if (parciales) pasos.push(`Sin soltar: ${parciales} parciales cortas, en el tramo donde mantienes la tensión`);
  if (descansoSeg) pasos.push(`Descansa ${descansoSeg >= 120 && descansoSeg % 60 === 0 ? `${descansoSeg / 60} min` : `${descansoSeg} s`} y sigue con la siguiente serie`);
  return pasos;
}

// Explicación sin IA (si no está configurada o falla): la técnica de la
// base de ejercicios con la cadencia y las parciales del plan.
export function pasosDeRespaldo(ex: EjercicioGenerado): { pasos: string[]; clave: string } {
  const info = infoEjercicio(ex.nombre, ex.grupo_muscular);
  const pasos = [info.descripcion, ...pasosDeLaSerie(ex, null)];
  if (ex.nota) pasos.push(`Indicación del plan: ${ex.nota}`);
  return { pasos, clave: info.tips[0] ?? "Técnica antes que peso." };
}

// ── Grupo muscular por el nombre ────────────────────────────────

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// En orden: lo primero que coincide gana ("curl femoral" es pierna antes
// que brazo; "press francés" es brazo y "press militar" hombro antes que pecho)
const GRUPOS_POR_NOMBRE: [string, RegExp][] = [
  ["core", /abdominal|ab wheel|rueda|plancha|crunch|oblicu|colgad/],
  ["pierna", /prensa|sentadilla|squat|bulgara|zancada|desplante|peso muerto|femoral|cuadricep|extension de pierna|talon|gemelo|pantorrilla|hip thrust|glute|aductor|abductor|step/],
  ["espalda", /jalon|remo|dominada|pull ?over|encogimiento|trapecio|hiperextension|lumbar|pull ?down/],
  ["hombro", /militar|elevaci\w* lateral|lateral|face ?pull|pajaro|posterior|arnold|hombro|deltoide|vuelos/],
  ["brazo", /curl|tricep|frances|katana|martillo|predicador|bicep|copa|patada|rompecraneo/],
  ["pecho", /press|apertura|cruce|fondo|flexion|lagartija|pec ?deck|contractora|pecho/]
];
const COMPUESTOS = /press(?! frances)|sentadilla|bulgara|peso muerto|remo|jalon|dominada|fondo|prensa|zancada|desplante|hip thrust|flexion|lagartija|militar/;

export function clasificarEjercicio(nombre: string): { grupo: string; compuesto: boolean; pesoCorporal: boolean } {
  const n = sinAcentos(nombre);
  const grupo = GRUPOS_POR_NOMBRE.find(([, re]) => re.test(n))?.[0] ?? "otro";
  return {
    grupo,
    compuesto: COMPUESTOS.test(n) && !/frances|katana/.test(n),
    pesoCorporal: /rueda|ab wheel|plancha|flexion|lagartija|burpee/.test(n) && !/lastr/.test(n)
  };
}

// "10 repeticiones completas … seguidas de 10 parciales" en las reglas
// de la fase → cada serie de 20 lleva 10 parciales al final
export function parcialesDeFase(textos: string[]): { completas: number; parciales: number } | null {
  for (const t of textos) {
    const m = /(\d{1,2})\s+(?:repeticiones\s+|reps\s+)?completas\b.*?(\d{1,2})\s+(?:repeticiones\s+|reps\s+)?parciales/i.exec(t);
    if (m) return { completas: Number(m[1]), parciales: Number(m[2]) };
  }
  return null;
}

// ── Superseries ─────────────────────────────────────────────────

// Índices de los ejercicios de la misma superserie que `i` (consecutivos)
export function grupoSuperserie<T extends { superserie?: string | null }>(lista: T[], i: number): number[] {
  const g = lista[i]?.superserie;
  if (!g) return [i];
  let a = i;
  let b = i;
  while (a > 0 && lista[a - 1].superserie === g) a--;
  while (b < lista.length - 1 && lista[b + 1].superserie === g) b++;
  return Array.from({ length: b - a + 1 }, (_, k) => a + k);
}
