// Protocolo del entrenador: catálogos, validación y textos. Puro (lo usan
// el editor del entrenador, la pantalla del cliente y la importación).

import { fmtHora } from "./hoy";
import type { AnclaProtocolo, AplicaDia, ProtocoloItem } from "./types";

export const SEGMENTOS = ["Suplementos", "Hábitos", "Cara", "Cabello", "Sueño", "Hidratación", "Movilidad"];

export const ANCLAS: { valor: AnclaProtocolo; texto: string }[] = [
  { valor: "al_despertar", texto: "Al despertar" },
  { valor: "antes_entreno", texto: "Antes de entrenar" },
  { valor: "durante_entreno", texto: "Durante el entreno" },
  { valor: "despues_entreno", texto: "Después de entrenar" },
  { valor: "con_desayuno", texto: "Con el desayuno" },
  { valor: "con_almuerzo", texto: "Con el almuerzo" },
  { valor: "con_merienda", texto: "Con la merienda" },
  { valor: "con_cena", texto: "Con la cena" },
  { valor: "con_snack", texto: "Con el snack" },
  { valor: "antes_dormir", texto: "Antes de dormir" },
  { valor: "hora_fija", texto: "A una hora fija" },
  { valor: "en_el_dia", texto: "En cualquier momento del día" }
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
  return {
    segmento: texto(x.segmento, 40) || "Hábitos",
    titulo,
    detalle: texto(x.detalle, 300),
    porque: texto(x.porque, 300) || null,
    ancla,
    offset_min: Math.max(-240, Math.min(240, Math.round(Number(x.offset_min) || 0))),
    hora: ancla === "hora_fija" ? hora : null,
    dias: dias.length ? dias : [1, 2, 3, 4, 5, 6, 7],
    aplica: x.aplica === "entreno" || x.aplica === "descanso" ? x.aplica : "todos",
    semana_desde: desde,
    semana_hasta: hasta != null && desde != null && hasta < desde ? desde : hasta
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

// "Todos los días", "Lun, Mié, Vie", "Días de entreno", "Semanas 1-2"
export function textoCuandoAplica(item: Pick<ProtocoloItem, "dias" | "aplica" | "semana_desde" | "semana_hasta">): string {
  const partes: string[] = [];
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
  return partes.length ? partes.join(" · ") : "Todos los días";
}
