// Protocolo del entrenador: catálogos, validación y textos. Puro (lo usan
// el editor del entrenador, la pantalla del cliente y la importación).

import { fmtHora } from "./hoy";
import { asignarMomentos, normalizarTexto } from "./meal-plan";
import type { AnclaProtocolo, AplicaDia, FaseProtocolo, Momento, ProtocoloItem } from "./types";

export const SEGMENTOS = ["Suplementos", "Hábitos", "Cara", "Cabello", "Sueño", "Hidratación", "Movilidad"];

export const ANCLAS: { valor: AnclaProtocolo; texto: string }[] = [
  { valor: "al_despertar", texto: "Al despertar" },
  { valor: "antes_entreno", texto: "Antes de entrenar" },
  { valor: "durante_entreno", texto: "Durante el entreno" },
  { valor: "despues_entreno", texto: "Después de entrenar" },
  { valor: "con_pre_entreno", texto: "Con el pre-entreno" },
  { valor: "con_post_entreno", texto: "Con el post-entreno" },
  { valor: "con_desayuno", texto: "Con el desayuno" },
  { valor: "con_snack", texto: "Con la colación" },
  { valor: "con_almuerzo", texto: "Con la comida" },
  { valor: "con_merienda", texto: "Con la colación de la tarde" },
  { valor: "con_cena", texto: "Con la cena" },
  { valor: "antes_dormir", texto: "Antes de dormir" },
  { valor: "hora_fija", texto: "A una hora fija" },
  { valor: "en_el_dia", texto: "En cualquier momento del día" }
];

export const ANCLAS_ENTRENO: AnclaProtocolo[] = [
  "antes_entreno",
  "durante_entreno",
  "despues_entreno",
  "con_pre_entreno",
  "con_post_entreno"
];

// Lo que el entrenador escribe para un ítem (nuevo o editado)
export interface ItemEntrada {
  segmento: string;
  titulo: string;
  detalle: string;
  porque: string | null;
  ancla: AnclaProtocolo;
  offset_min: number;
  hora: string | null;
  dias: number[];
  aplica: AplicaDia;
  semana_desde: number | null;
  semana_hasta: number | null;
  fase_desde: number | null;
  fase_hasta: number | null;
}

export const MAX_FASES = 12;

// Fases del protocolo: ordenadas, la primera desde el día 1 y cada una
// empezando después de la anterior
export function sanearFases(raw: unknown): FaseProtocolo[] {
  const lista = (Array.isArray(raw) ? raw : [])
    .map((f) => (f ?? {}) as Record<string, unknown>)
    .map((f) => ({
      nombre: String(f.nombre ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
      desde_dia: Math.round(Number(f.desde_dia)),
      nota: String(f.nota ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || null
    }))
    .filter((f) => Number.isFinite(f.desde_dia) && f.desde_dia >= 1 && f.desde_dia <= 730)
    .sort((a, b) => a.desde_dia - b.desde_dia)
    .filter((f, i, xs) => i === 0 || f.desde_dia > xs[i - 1].desde_dia)
    .slice(0, MAX_FASES);
  if (lista.length) lista[0].desde_dia = 1;
  return lista.map((f, i) => ({ ...f, nombre: f.nombre || `Fase ${i + 1}` }));
}

// "Días 1-7", "Días 15 en adelante"
export function textoDiasFase(fases: FaseProtocolo[], i: number): string {
  const desde = fases[i].desde_dia;
  const sig = fases[i + 1];
  if (!sig) return `Desde el día ${desde}`;
  return sig.desde_dia - 1 === desde ? `Día ${desde}` : `Días ${desde}-${sig.desde_dia - 1}`;
}

// Valida y recorta lo que llega del formulario o de la IA
export function sanearItem(x: Partial<ItemEntrada>): ItemEntrada {
  const texto = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const titulo = texto(x.titulo, 120);
  if (!titulo) throw new Error("Cada ítem necesita un título.");
  const ancla = ANCLAS.some((a) => a.valor === x.ancla) ? (x.ancla as AnclaProtocolo) : "en_el_dia";
  const hora = /^\d{1,2}:\d{2}/.test(String(x.hora ?? "")) ? String(x.hora).slice(0, 5).padStart(5, "0") : null;
  if (ancla === "hora_fija" && !hora) throw new Error(`"${titulo}": falta la hora.`);
  const dias = [...new Set((Array.isArray(x.dias) ? x.dias : []).map(Number))]
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
    .sort((a, b) => a - b);
  const semana = (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 52 ? n : null;
  };
  const desde = semana(x.semana_desde);
  const hasta = semana(x.semana_hasta);
  const fase = (v: unknown) => {
    const n = Number(v);
    return v != null && v !== "" && Number.isInteger(n) && n >= 1 && n <= MAX_FASES ? n : null;
  };
  const faseDesde = fase(x.fase_desde);
  const faseHasta = fase(x.fase_hasta);
  return {
    segmento: texto(x.segmento, 40) || "Hábitos",
    titulo,
    detalle: texto(x.detalle, 300),
    porque: texto(x.porque, 300) || null,
    ancla,
    offset_min: Math.max(-240, Math.min(240, Math.round(Number(x.offset_min) || 0))),
    hora: ancla === "hora_fija" ? hora : null,
    dias: dias.length ? dias : [1, 2, 3, 4, 5, 6, 7],
    // Lo atado al entreno solo existe los días que se entrena
    aplica: ANCLAS_ENTRENO.includes(ancla) ? "entreno" : x.aplica === "entreno" || x.aplica === "descanso" ? x.aplica : "todos",
    semana_desde: desde,
    semana_hasta: hasta != null && desde != null && hasta < desde ? desde : hasta,
    // "Fase 1" es lo mismo que desde el principio
    fase_desde: faseDesde === 1 ? null : faseDesde,
    fase_hasta: faseHasta != null && faseDesde != null && faseHasta < faseDesde ? faseDesde : faseHasta
  };
}

const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// "Después de entrenar · +15 min", "A las 9:00 am", "Con la cena"
export function textoCuando(item: Pick<ProtocoloItem, "ancla" | "offset_min" | "hora">): string {
  if (item.ancla === "hora_fija") return item.hora ? `A las ${fmtHora(item.hora)}` : "A una hora fija";
  const base = ANCLAS.find((a) => a.valor === item.ancla)?.texto ?? "En el día";
  if (!item.offset_min || item.ancla === "en_el_dia") return base;
  return `${base} · ${item.offset_min > 0 ? "+" : "−"}${Math.abs(item.offset_min)} min`;
}

// "Todos los días", "Lun, Mié, Vie", "Días de entreno", "Semanas 1-2",
// "Desde la fase 2"
export function textoCuandoAplica(
  item: Pick<ProtocoloItem, "dias" | "aplica" | "semana_desde" | "semana_hasta"> &
    Partial<Pick<ProtocoloItem, "fase_desde" | "fase_hasta">>
): string {
  const partes: string[] = [];
  const fd = item.fase_desde ?? null;
  const fh = item.fase_hasta ?? null;
  if (fd != null || fh != null) {
    partes.push(
      fh == null
        ? `desde la fase ${fd}`
        : (fd ?? 1) === fh
          ? `solo fase ${fh}`
          : `fases ${fd ?? 1}-${fh}`
    );
  }
  const dias = [...item.dias].sort();
  if (dias.length && dias.length < 7) partes.push(dias.map((d) => DIAS_CORTOS[d - 1]).join(", "));
  if (item.aplica === "entreno") partes.push("días de entreno");
  if (item.aplica === "descanso") partes.push("días de descanso");
  if (item.semana_desde != null || item.semana_hasta != null) {
    partes.push(
      item.semana_hasta == null
        ? `desde la semana ${item.semana_desde}`
        : item.semana_desde == null || item.semana_desde === 1
          ? `semanas 1-${item.semana_hasta}`
          : `semanas ${item.semana_desde}-${item.semana_hasta}`
    );
  }
  if (!partes.length) return "Todos los días";
  const texto = partes.join(" · ");
  return texto[0].toUpperCase() + texto.slice(1);
}

// ── Control de lo que propone la IA al leer un texto ────────────

// Palabras que no identifican un producto (cantidades, formas, momentos)
const GENERICAS = new Set([
  "dosis", "capsula", "capsulas", "scoop", "scoops", "gramo", "gramos", "cucharada", "cucharadita",
  "gota", "gotas", "tableta", "tabletas", "sobre", "sobres", "toma", "tomar", "con", "del", "los",
  "las", "una", "uno", "para", "por", "antes", "despues", "dia", "dias", "noche", "manana", "tarde",
  "agua", "vaso", "taza", "mas", "sin", "polvo", "suplemento", "suplementos", "mediano", "grande"
]);

const raiz = (w: string) => w.replace(/(es|s)$/, "");

// ¿El nombre del ítem aparece en el texto? (sin acentos, por palabras,
// tolerando plurales). Sin palabras que comparar, se da por bueno.
export function apareceEnTexto(titulo: string, texto: string): boolean {
  const delTexto = new Set(normalizarTexto(texto).split(" ").map(raiz));
  const clave = normalizarTexto(titulo)
    .split(" ")
    .filter((w) => w.length >= 3 && !GENERICAS.has(w) && !/^\d+$/.test(w));
  if (!clave.length) return true;
  return clave.some((w) => delTexto.has(raiz(w)));
}

// ¿Todas las palabras con contenido de la frase están en el texto? Sirve
// para el "por qué": si la IA lo redactó con palabras suyas, no pasa.
export function apareceTodo(frase: string, texto: string): boolean {
  const delTexto = new Set(normalizarTexto(texto).split(" ").map(raiz));
  const clave = normalizarTexto(frase)
    .split(" ")
    .filter((w) => w.length >= 4 && !/^\d+$/.test(w));
  return clave.length > 0 && clave.every((w) => delTexto.has(raiz(w)));
}

// La IA solo ordena lo que escribió el entrenador: un suplemento que no
// aparece en su texto se descarta y se avisa.
export function filtrarInventados<T extends { segmento: string; titulo: string }>(
  items: T[],
  texto: string
): { validos: T[]; descartados: string[] } {
  const validos: T[] = [];
  const descartados: string[] = [];
  for (const it of items) {
    if (normalizarTexto(it.segmento) === "suplementos" && !apareceEnTexto(it.titulo, texto)) descartados.push(it.titulo);
    else validos.push(it);
  }
  return { validos, descartados };
}

// Lo que tiene calorías va al menú, no al protocolo (la IA a veces lo mete)
export function esComida(titulo: string): boolean {
  const t = normalizarTexto(titulo);
  // "Creatina (en el batido)" sigue siendo un suplemento
  if (/\b(creatina|omega|vitamina|multivitaminico|magnesio|zinc|glutamina|citrulina|alanina|probiotico|enzimas?|dim|colageno|cafeina|electrolitos|aminoacidos)\b/.test(t)) {
    return false;
  }
  return /\b(whey|isolate|caseina|gainer|ganador|proteina|batido|licuado|avena|fruta|platano|yogur)\b/.test(t);
}

// Cada comida del texto va a su momento por la hora y el nombre (12:00 →
// comida, 16:00 → colación de la tarde, 19:30 → cena; "Pre-entreno" →
// pre-entreno), con la misma regla que el menú. No se usa lo que diga la
// IA: suele confundir "Comida 2" con la cena.
export function momentosPorHora(
  comidas: { etiqueta: string; hora: string }[]
): { etiqueta: string; momento: Momento; hora: string }[] {
  const vistos = new Set<Momento>();
  return asignarMomentos(comidas.map((c) => ({ ...c, momento: null as Momento | null })))
    .filter((c) => !vistos.has(c.momento) && !!vistos.add(c.momento))
    .map(({ etiqueta, momento, hora }) => ({ etiqueta, momento, hora }));
}
