// Lee el plan del entrenador escrito a mano (texto libre, como un plan con
// horarios de "5:30 despertar / 6:00 entreno / Comida 1…") y saca lo que
// no es comida: suplementos, hábitos y cuidado personal, cada uno con su
// momento del día, más los horarios que fija el texto. La IA no agrega
// ni recomienda nada: solo transcribe y ordena. Lo que diga de más se
// filtra después (filtrarInventados).

import { ErrorIA, describirPerfil, generarJSON } from "./ai";
import { esComida, filtrarInventados, momentosPorHora, sanearItem, SEGMENTOS, type ItemEntrada } from "./protocolo";
import type { Momento, Profile } from "./types";

export interface HorariosTexto {
  despertar: string | null;
  entreno: string | null;
  dormir: string | null;
  comidas: { etiqueta: string; momento: Momento; hora: string }[];
}

export interface ProtocoloInterpretado {
  nombre: string;
  horarios: HorariosTexto;
  tiene_comidas: boolean;
  items: ItemEntrada[];
  fuera_protocolo: string[];
  descartados: string[]; // lo que la IA propuso y no está en el texto
  al_menu: string[]; // lo que tiene calorías: va al menú, no al protocolo
}

const INSTRUCCIONES = `Eres el asistente de un entrenador personal. Recibes el plan que el entrenador escribió para un cliente (texto libre: horarios, bloques del día, tablas, listas) y extraes SOLO lo que no es comida, para ordenarlo en el día del cliente.

Reglas estrictas:
- Transcribe, no recomiendes. No agregues suplementos, productos ni hábitos que el texto no mencione. No cambies dosis ni cantidades. Si el texto dice "tu pre-entreno habitual", lo dejas así.
- NO son ítems (van al menú, no aquí): comidas y todo lo que tenga calorías relevantes (proteína en polvo o whey, fruta, pan, yogur, ganadores de peso). Si el texto trae comidas, marca "tiene_comidas": true.
- SÍ son ítems: suplementos sin calorías relevantes (creatina, multivitamínico, magnesio, aminoácidos esenciales, electrolitos, sal, pre-entreno, cafeína), café o té sin azúcar, hábitos (agua, sueño, pasos, caminatas, pausas), cuidado de cara y cabello (limpiador, sérum, protector solar, retinol, shampoo, tratamientos) y cualquier otra rutina diaria del plan.
- Segmento: uno de ${SEGMENTOS.join(", ")}; si el texto tiene una categoría claramente distinta, usa un nombre corto propio.
- Cuándo ("ancla"): si el ítem va atado a un momento del día, usa el ancla relativa para que se adapte al horario del cliente: "al_despertar", "antes_entreno", "durante_entreno", "despues_entreno", "con_desayuno", "con_almuerzo", "con_merienda", "con_cena", "con_snack", "antes_dormir". Si el texto da una hora explícita para el ítem y esa hora no es la del despertar, la del entreno ni la de una de las comidas de "horarios", usa "hora_fija" con esa "hora" (HH:MM, 24 h) (ej. "9:00 AM café negro" = hora_fija 09:00, no "con_snack"). Usa "en_el_dia" si no tiene momento. Si el texto no dice cuándo va un suplemento, usa su momento habitual (post-entreno para lo que se toma al terminar, con la última comida o antes de dormir para magnesio).
- "offset_min": minutos respecto del ancla si el texto lo dice (ej. "15 min antes de entrenar" = antes_entreno con 15 → usa -15 con ancla "antes_entreno" solo si el texto es explícito; si no, 0).
- Días: "dias" con 1=lunes … 7=domingo. Si dice "lunes y viernes", [1,5]. Sin restricción, los 7. "aplica": "entreno" si es solo en días de entreno (intra/post-entreno), "descanso" si es solo en descanso, si no "todos".
- Frecuencia semanal: si el texto dice "N noches (o veces) por semana", "dias" DEBE tener exactamente N días repartidos (2 = [2,5]; 3 = [1,3,5]; 4 = [1,2,4,6]). Nunca dejes los 7 días en algo que no es diario.
- Progresiones por semanas (ej. "semanas 1-2: 2 noches; semanas 3-4: 3 noches"): un ítem por tramo con "semana_desde"/"semana_hasta" y los días de ese tramo.
- "detalle": la cantidad y el cómo, corto. "porque": SOLO la razón que da el texto para ese ítem, en una frase; si el texto no la da, null. No inventes razones.
- "horarios": las horas que fija el texto para despertar, entrenar (cuando EMPIEZA el entrenamiento, no el pre-entreno), dormir y CADA comida principal (HH:MM, 24 h; si da un rango, el inicio). Incluye todas las comidas del texto (Comida 1, 2, 3…), no los bloques de solo suplementos o café. Si no fija algo, null o lista vacía.
- "fuera_protocolo": lo que el texto dice que NO hay que usar o comprar, con su motivo corto.
- Español neutro de México.

Devuelve SOLO JSON con esta forma exacta:
{
  "nombre": string (corto, ej. "Protocolo V-Shape"),
  "horarios": { "despertar": "HH:MM" | null, "entreno": "HH:MM" | null, "dormir": "HH:MM" | null, "comidas": [ { "etiqueta": string, "hora": "HH:MM" } ] },
  "tiene_comidas": boolean,
  "items": [ { "segmento": string, "titulo": string, "detalle": string, "porque": string | null, "ancla": string, "offset_min": number, "hora": "HH:MM" | null, "dias": number[], "aplica": "todos"|"entreno"|"descanso", "semana_desde": number | null, "semana_hasta": number | null } ],
  "fuera_protocolo": [string]
}`;

const hora = (v: unknown): string | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v ?? "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};

export async function interpretarProtocoloTxt(texto: string, perfil: Profile): Promise<ProtocoloInterpretado> {
  const fuente = texto.slice(0, 12000);
  const raw = await generarJSON<Record<string, unknown>>(
    INSTRUCCIONES,
    `Cliente:\n${describirPerfil(perfil)}\n\nTexto del entrenador:\n"""\n${fuente}\n"""`,
    { temperatura: 0.1, maxTokens: 4000 }
  );
  if (!raw || typeof raw !== "object") throw new ErrorIA("La IA no devolvió un protocolo válido.");

  const h = (raw.horarios ?? {}) as Record<string, unknown>;
  const comidas = momentosPorHora(
    (Array.isArray(h.comidas) ? h.comidas : [])
      .map((c) => c as Record<string, unknown>)
      .map((c) => ({ etiqueta: String(c.etiqueta ?? "").slice(0, 40), hora: hora(c.hora) }))
      .filter((c): c is { etiqueta: string; hora: string } => !!c.hora)
  );

  const items: ItemEntrada[] = [];
  for (const x of Array.isArray(raw.items) ? raw.items : []) {
    try {
      items.push(sanearItem(x as Partial<ItemEntrada>));
    } catch {
      // ítem sin título o con hora fija sin hora: se ignora
    }
  }
  const alMenu = items.filter((i) => esComida(i.titulo));
  const { validos, descartados } = filtrarInventados(
    items.filter((i) => !esComida(i.titulo)),
    fuente
  );

  return {
    nombre: String(raw.nombre ?? "").trim().slice(0, 80) || "Protocolo",
    horarios: { despertar: hora(h.despertar), entreno: hora(h.entreno), dormir: hora(h.dormir), comidas },
    tiene_comidas: raw.tiene_comidas === true || alMenu.length > 0,
    items: validos.slice(0, 40),
    fuera_protocolo: (Array.isArray(raw.fuera_protocolo) ? raw.fuera_protocolo : [])
      .map((f) => String(f).trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 20),
    descartados,
    al_menu: alMenu.map((i) => i.titulo)
  };
}
