// Lee el plan del entrenador escrito a mano (texto libre, como un plan con
// horarios de "5:30 despertar / 6:00 entreno / Comida 1…") y saca lo que
// no es comida: suplementos, hábitos y cuidado personal, cada uno con su
// momento del día, más los horarios que fija el texto. La IA no agrega
// ni recomienda nada: solo transcribe y ordena. Lo que diga de más se
// filtra después (filtrarInventados).

import { ErrorIA, describirPerfil, generarJSON } from "./ai";
import { sinListaDeCompras } from "./ai-comidas";
import {
  ANCLAS_ENTRENO,
  apareceTodo,
  esComida,
  filtrarInventados,
  momentosPorHora,
  sanearFases,
  sanearItem,
  SEGMENTOS,
  type ItemEntrada
} from "./protocolo";
import { asignarMomentos, normalizarTexto } from "./meal-plan";
import type { AnclaProtocolo, FaseProtocolo, Momento, Profile } from "./types";

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
  fases: FaseProtocolo[];
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
- Cuándo ("ancla"): si el ítem va atado a un momento del día, usa el ancla relativa para que se adapte al horario del cliente: "al_despertar", "antes_entreno", "durante_entreno", "despues_entreno", "con_pre_entreno" (con la comida o el batido de antes de entrenar), "con_post_entreno" (con la comida o el batido de después de entrenar), "con_desayuno", "con_snack" (colación de media mañana), "con_almuerzo" (la comida del mediodía; en México se llama "Comida"), "con_merienda" (colación de la tarde), "con_cena", "antes_dormir". Si un suplemento va en un bloque de comida del texto ("2:00 PM – Comida … Suplementación: Omega 3"), usa el ancla de ESA comida, no "hora_fija": así toma la hora correcta aunque el horario cambie entre días de entreno y de descanso. Usa "hora_fija" con su "hora" (HH:MM, 24 h) solo para lo que tiene hora propia y no va con una comida, el despertar ni el entreno (ej. "9:00 AM café negro"; "6:30 PM cierre de líquidos"). Usa "en_el_dia" si no tiene momento. Si el texto no dice cuándo va un suplemento, usa su momento habitual (post-entreno para lo que se toma al terminar, con la última comida o antes de dormir para magnesio).
- No te saltes nada: recorre el texto bloque por bloque (días de entreno y días de descanso) y cada suplemento de cada bloque de "Suplementación" queda en algún ítem. Las indicaciones con hora que no son comida ("cierre de líquidos", "hora de dormir") también son ítems (Hábitos o Sueño).
- Un mismo suplemento que va con la misma comida en días de entreno y de descanso es UN solo ítem con "aplica": "todos". Si cambia de comida según el día (ej. creatina en el batido post-entreno los días de entreno y en la colación los de descanso), son dos ítems: uno con "aplica": "entreno" y otro con "aplica": "descanso".
- "offset_min": minutos respecto del ancla solo si el texto lo dice; si no, 0. Para "antes_entreno" es negativo: "15-20 min antes de entrenar" = -15 (el inicio del rango).
- Días: "dias" con 1=lunes … 7=domingo. Si dice "lunes y viernes", [1,5]. Sin restricción, los 7. "aplica": "entreno" si es solo en días de entreno (intra/post-entreno), "descanso" si es solo en descanso, si no "todos". Lo que es de días de entreno o de descanso lleva los 7 días en "dias": la app ya sabe qué días entrena el cliente.
- Fases: si el plan introduce cosas por fases o etapas ("Fase 1 (días 1 a 7)… Fase 2 (días 8 a 14)… Fase 3 (día 15 en adelante)"), devuelve "fases" en orden con el día en que empieza cada una ("desde_dia": 1, 8, 15) y una "nota" corta con lo que dice el texto de esa fase. En cada ítem, "fase_desde" es la fase en la que se introduce (lo que es de la fase 1 o no dice fase: 1). Si una fase "continúa con la anterior y añade", lo anterior sigue: "fase_hasta" null. Solo pon "fase_hasta" si el texto dice que algo se deja. Si el plan no tiene fases, "fases": [] y "fase_desde": null.
- Frecuencia semanal: si el texto dice "N noches (o veces) por semana", "dias" DEBE tener exactamente N días repartidos (2 = [2,5]; 3 = [1,3,5]; 4 = [1,2,4,6]). Nunca dejes los 7 días en algo que no es diario.
- Progresiones por semanas (ej. "semanas 1-2: 2 noches; semanas 3-4: 3 noches"): un ítem por tramo con "semana_desde"/"semana_hasta" y los días de ese tramo.
- "detalle": la cantidad y el cómo, corto (incluye indicaciones del texto como "con máximo 150 ml de agua"). "porque": COPIA LITERAL de la frase del texto que explica ese ítem (ej. "Esto asienta y repara tu salud intestinal"); si el texto no explica ese ítem, null. Nunca escribas una razón con tus palabras: lo que no esté en el texto se descarta.
- "horarios": las horas que fija el texto para despertar (null si el texto no lo dice; no lo deduzcas de la primera comida), entrenar (cuando EMPIEZA el entrenamiento, no el pre-entreno), dormir y CADA comida (HH:MM, 24 h; si da un rango, el inicio), con la "etiqueta" que le da el texto ("Pre-Entrenamiento", "Comida", "Colación de la tarde"). Incluye todas las comidas del texto (también pre y post-entreno), no los bloques de solo suplementos o café. Si el plan tiene horarios distintos para días de entreno y de descanso, usa los del día de entreno. Si no fija algo, null o lista vacía.
- "fuera_protocolo": lo que el texto dice que NO hay que usar o comprar, con su motivo corto.
- Español neutro de México.

Devuelve SOLO JSON con esta forma exacta:
{
  "nombre": string (corto, ej. "Protocolo V-Shape"),
  "horarios": { "despertar": "HH:MM" | null, "entreno": "HH:MM" | null, "dormir": "HH:MM" | null, "comidas": [ { "etiqueta": string, "hora": "HH:MM" } ] },
  "tiene_comidas": boolean,
  "fases": [ { "nombre": string, "desde_dia": number, "nota": string | null } ],
  "items": [ { "segmento": string, "titulo": string, "detalle": string, "porque": string | null, "ancla": string, "offset_min": number, "hora": "HH:MM" | null, "dias": number[], "aplica": "todos"|"entreno"|"descanso", "semana_desde": number | null, "semana_hasta": number | null, "fase_desde": number | null, "fase_hasta": number | null } ],
  "fuera_protocolo": [string]
}`;

const hora = (v: unknown): string | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v ?? "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};

// Cambiarla cuando cambien las instrucciones: las lecturas guardadas con
// la versión anterior dejan de usarse (ver ia-lecturas.ts)
export const VERSION_PROTOCOLO_TXT = "2026-10-02";

// Lo que responde la IA, sin sanear (es lo que se guarda)
export async function pedirProtocoloTxt(texto: string, perfil: Profile): Promise<Record<string, unknown>> {
  const raw = await generarJSON<Record<string, unknown>>(
    INSTRUCCIONES,
    // Sin la lista de compras del final: no suma ítems y la IA gratis
    // tiene un tope de tokens por pedido
    `Cliente:\n${describirPerfil(perfil)}\n\nTexto del entrenador:\n"""\n${sinListaDeCompras(texto).slice(0, 12000)}\n"""`,
    { temperatura: 0, maxTokens: 4000 }
  );
  if (!raw || typeof raw !== "object") throw new ErrorIA("La IA no devolvió un protocolo válido.");
  return raw;
}

export async function interpretarProtocoloTxt(texto: string, perfil: Profile): Promise<ProtocoloInterpretado> {
  return procesarProtocoloTxt(await pedirProtocoloTxt(texto, perfil), texto);
}

// "2:00 PM – Comida" → "14:00"
function horaDeLinea(linea: string): string | null {
  const m = /\b(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\b/i.exec(linea) ?? /\b(\d{1,2}):(\d{2})\b/.exec(linea);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3]) {
    const pm = m[3].toLowerCase() === "p";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  return h <= 23 && Number(m[2]) <= 59 ? `${String(h).padStart(2, "0")}:${m[2]}` : null;
}

// Si la IA dejó un suplemento "en el día" pero en el texto aparece dentro
// de un bloque de comida con hora ("2:00 PM – Comida … Omega 3"), va con
// esa comida (la IA a veces se lo saltea).
export function anclarPorBloque<T extends Pick<ItemEntrada, "titulo" | "ancla" | "segmento">>(
  items: T[],
  texto: string,
  comidas: { momento: Momento; hora: string }[]
): T[] {
  const lineas = texto.split(/\r?\n/);
  return items.map((it) => {
    if (it.ancla !== "en_el_dia" || normalizarTexto(it.segmento) !== "suplementos") return it;
    const claves = normalizarTexto(it.titulo)
      .split(" ")
      .filter((w) => w.length >= 4 && !["dosis", "tableta", "capsula", "soporte"].includes(w));
    if (!claves.length) return it;
    // Las líneas que lo mencionan, de más a menos palabras del nombre
    // ("Vitamina D con aceite de hígado de bacalao" no es la del "aceite en
    // aerosol"). Gana la primera que cae en un bloque de comida con hora: la
    // mención en la explicación de las fases ("solo toma el Omega-3") no
    // tiene hora y se salta.
    const candidatas = lineas
      .map((l, k) => {
        const ws = normalizarTexto(l).split(" ");
        return { k, n: claves.filter((w) => ws.includes(w)).length };
      })
      .filter((c) => c.n > 0)
      .sort((a, b) => b.n - a.n || a.k - b.k);
    for (const { k } of candidatas) {
      for (let j = k; j >= 0; j--) {
        const hora = horaDeLinea(lineas[j]);
        if (!hora) continue;
        const comida = comidas.find((c) => c.hora === hora);
        if (comida) return { ...it, ancla: `con_${comida.momento}` as AnclaProtocolo };
        break;
      }
    }
    return it;
  });
}

// Si el texto tiene una sección de días de descanso y un suplemento que la
// IA dejó solo para días de entreno también aparece ahí (ej. creatina en
// el batido post-entreno y, en descanso, en la colación), se agrega para
// los días de descanso con la comida de ese bloque.
export function completarDescanso<T extends ItemEntrada>(items: T[], texto: string): T[] {
  const lineas = texto.split(/\r?\n/);
  const n = lineas.map((l) => normalizarTexto(l));
  const FIN = /\bestrategia\b|\blista del? (las )?(compras|super(mercado)?|mandado)\b|\bdias? de entrenamiento\b|\bmeal prep\b/;
  // La sección es la que tiene comidas con hora (no la tabla de calorías
  // del principio, que también dice "días de descanso")
  let desde = -1;
  let hasta = lineas.length;
  let bloques: { i: number; hora: string; etiqueta: string; momento: Momento | null }[] = [];
  for (let d = 0; d < n.length && bloques.length < 2; d++) {
    if (!/\bdias? de descanso\b/.test(n[d])) continue;
    const fin = n.findIndex((l, i) => i > d && FIN.test(l));
    const h = fin < 0 ? lineas.length : fin;
    const encontrados: typeof bloques = [];
    for (let i = d + 1; i < h; i++) {
      const hora = horaDeLinea(lineas[i]);
      // Bloques de comida (sin "cierre de líquidos" ni "hora de dormir")
      if (hora && !/\bcierre\b|\bdormir\b|\bdespertar\b|\bentrenamiento\b/.test(n[i])) {
        encontrados.push({ i, hora, etiqueta: lineas[i], momento: null });
      }
    }
    if (encontrados.length >= 2) {
      desde = d;
      hasta = h;
      bloques = encontrados;
    }
  }
  if (desde < 0) return items;
  const conMomento = asignarMomentos(bloques).sort((a, b) => a.i - b.i);
  // Palabra que identifica el suplemento ("creatina")
  const clave = (titulo: string) => normalizarTexto(titulo).split(" ").find((w) => w.length >= 4) ?? null;
  const vaEnDescanso = (c: string) =>
    items.some((x) => clave(x.titulo) === c && x.aplica !== "entreno" && !ANCLAS_ENTRENO.includes(x.ancla));
  const nuevos: T[] = [];
  for (const it of items) {
    if (normalizarTexto(it.segmento) !== "suplementos" || it.aplica !== "entreno") continue;
    const c = clave(it.titulo);
    if (!c || vaEnDescanso(c) || nuevos.some((x) => clave(x.titulo) === c)) continue;
    const linea = n.findIndex((l, i) => i > desde && i < hasta && l.split(" ").includes(c));
    if (linea < 0) continue;
    const bloque = [...conMomento].reverse().find((b) => b.i < linea);
    if (!bloque) continue;
    nuevos.push({
      ...it,
      ancla: `con_${bloque.momento}` as AnclaProtocolo,
      offset_min: 0,
      hora: null,
      aplica: "descanso",
      dias: [1, 2, 3, 4, 5, 6, 7]
    });
  }
  return [...items, ...nuevos];
}

// Sanea la respuesta de la IA y descarta lo que no está en el texto
export function procesarProtocoloTxt(raw: Record<string, unknown>, texto: string): ProtocoloInterpretado {
  const fuente = texto.slice(0, 12000);

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
  // Sin fases en el texto, ningún ítem depende de una
  const fases = sanearFases(raw.fases);
  const conFase = completarDescanso(anclarPorBloque(validos, fuente, comidas), fuente).map((i) => ({
    ...i,
    // El "por qué" tiene que salir del texto; si la IA lo redactó, se quita
    porque: i.porque && apareceTodo(i.porque, fuente) ? i.porque : null,
    // Lo de días de entreno o descanso sigue la rutina del cliente: la IA
    // a veces le pone días de la semana que no son los suyos
    dias: i.aplica === "todos" ? i.dias : [1, 2, 3, 4, 5, 6, 7],
    fase_desde: fases.length > 1 && i.fase_desde && i.fase_desde <= fases.length ? i.fase_desde : null,
    fase_hasta: fases.length > 1 && i.fase_hasta && i.fase_hasta <= fases.length ? i.fase_hasta : null
  }));

  return {
    nombre: String(raw.nombre ?? "").trim().slice(0, 80) || "Protocolo",
    horarios: { despertar: hora(h.despertar), entreno: hora(h.entreno), dormir: hora(h.dormir), comidas },
    tiene_comidas: raw.tiene_comidas === true || alMenu.length > 0,
    items: conFase.slice(0, 40),
    fases: fases.length > 1 ? fases : [],
    fuera_protocolo: (Array.isArray(raw.fuera_protocolo) ? raw.fuera_protocolo : [])
      .map((f) => String(f).trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 20),
    descartados,
    al_menu: alMenu.map((i) => i.titulo)
  };
}
