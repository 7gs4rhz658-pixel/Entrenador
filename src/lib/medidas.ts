// Medidas corporales: etiquetas, guía de cómo medir y comparación entre
// tomas. Sin base ni IA.

import { CAMPOS_MEDIDA, type CampoMedida, type Medida } from "./types";

export const ETIQUETAS_MEDIDA: Record<CampoMedida, string> = {
  cuello: "Cuello",
  hombros: "Hombros",
  pecho: "Pecho",
  cintura: "Cintura",
  cadera: "Cadera",
  brazo_izq: "Brazo izq. relajado",
  brazo_izq_contraido: "Brazo izq. contraído",
  brazo_der: "Brazo der. relajado",
  brazo_der_contraido: "Brazo der. contraído",
  antebrazo_izq: "Antebrazo izq.",
  antebrazo_der: "Antebrazo der.",
  muslo_izq: "Muslo izq.",
  muslo_der: "Muslo der.",
  pantorrilla_izq: "Pantorrilla izq.",
  pantorrilla_der: "Pantorrilla der."
};

// Cómo medir cada zona, en una línea
export const GUIA_MEDIDA: Record<CampoMedida, string> = {
  cuello: "Debajo de la nuez de Adán, cinta horizontal, sin apretar.",
  hombros: "Con los brazos relajados a los costados, por el punto más ancho, cinta horizontal.",
  pecho: "A la altura de los pezones, después de exhalar normal, sin sacar pecho.",
  cintura: "A la altura del ombligo, relajado, al final de una exhalación normal.",
  cadera: "Por la parte más ancha de los glúteos, pies juntos.",
  brazo_izq: "Brazo colgando relajado, en el punto más grueso del bíceps.",
  brazo_izq_contraido: "Codo a 90°, puño cerrado y bíceps contraído, punto más grueso.",
  brazo_der: "Brazo colgando relajado, en el punto más grueso del bíceps.",
  brazo_der_contraido: "Codo a 90°, puño cerrado y bíceps contraído, punto más grueso.",
  antebrazo_izq: "Brazo extendido y relajado, en el punto más grueso, cerca del codo.",
  antebrazo_der: "Brazo extendido y relajado, en el punto más grueso, cerca del codo.",
  muslo_izq: "De pie, peso repartido, un palmo por encima de la rodilla, en el punto más grueso.",
  muslo_der: "De pie, peso repartido, un palmo por encima de la rodilla, en el punto más grueso.",
  pantorrilla_izq: "De pie, en el punto más grueso, sin ponerse en puntas de pie.",
  pantorrilla_der: "De pie, en el punto más grueso, sin ponerse en puntas de pie."
};

// Grupos para la pantalla (en este orden)
export const GRUPOS_MEDIDA: { titulo: string; campos: CampoMedida[] }[] = [
  { titulo: "Tronco", campos: ["cuello", "hombros", "pecho", "cintura", "cadera"] },
  { titulo: "Brazos", campos: ["brazo_izq", "brazo_izq_contraido", "brazo_der", "brazo_der_contraido", "antebrazo_izq", "antebrazo_der"] },
  { titulo: "Piernas", campos: ["muslo_izq", "muslo_der", "pantorrilla_izq", "pantorrilla_der"] }
];

export interface ComparacionMedida {
  campo: CampoMedida;
  actual: number;
  anterior: number | null; // toma anterior con ese campo
  primera: number | null; // primera toma con ese campo
}

// Última toma vs la anterior y vs la primera, solo campos cargados.
// `medidas` viene de la más nueva a la más vieja.
export function compararMedidas(medidas: Medida[]): ComparacionMedida[] {
  if (!medidas.length) return [];
  const ultima = medidas[0];
  const out: ComparacionMedida[] = [];
  for (const campo of CAMPOS_MEDIDA) {
    const actual = ultima[campo];
    if (actual == null) continue;
    const previas = medidas.slice(1).filter((m) => m[campo] != null);
    out.push({
      campo,
      actual: Number(actual),
      anterior: previas.length ? Number(previas[0][campo]) : null,
      primera: previas.length ? Number(previas[previas.length - 1][campo]) : null
    });
  }
  return out;
}

export function fmtDelta(n: number | null): string {
  if (n == null) return "";
  const r = Math.round(n * 10) / 10;
  if (r === 0) return "=";
  return `${r > 0 ? "+" : ""}${r.toLocaleString("es-AR")}`;
}
