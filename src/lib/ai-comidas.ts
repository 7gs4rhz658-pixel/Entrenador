// IA de la recomendación de comidas: genera el menú (entreno + descanso)
// desde el perfil y el cuestionario nutricional, o lo interpreta de un
// .txt del entrenador. La IA solo propone ingredientes y gramos: los
// macros reales los calcula lib/meal-plan.ts contra la tabla
// `ingredients`, y el tono es siempre de recomendación del entrenador,
// nunca de prescripción profesional.

import { ErrorIA, describirPerfil, generarJSON } from "./ai";
import type { Macros } from "./nutrition";
import { normalizarPlanComidas, normalizarTexto } from "./meal-plan";
import type { BatchCooking, CuestionarioNutricion, Momento, PlanComidasGenerado, Profile, TipoDia } from "./types";

const TONO = `Eres el asistente de un entrenador personal. Lo que escribes son RECOMENDACIONES de alimentación como orientación general del entrenador: usa "te recomiendo", "puedes", "una opción es". Nunca hables como profesional de la salud, no menciones enfermedades, medicación ni suplementos, y no prometas resultados. Español de México, de tú (nunca voseo), frases cortas.`;

const ESQUEMA_COMIDAS = `Devuelve SOLO un JSON con esta forma exacta:
{
  "nombre": string (ej. "Recomendación de comidas · volumen"),
  "notas": string (1-2 frases al cliente, tono de recomendación),
  "entreno": [
    {
      "momento": "desayuno" | "almuerzo" | "merienda" | "cena" | "snack" | "pre_entreno" | "post_entreno",
      "plato": string (nombre corto del plato),
      "ingredientes": [
        { "nombre": string, "gramos": number, "nota": string opcional }
      ]
    }
  ],
  "descanso": [ ...misma forma... ]
}
Momentos: "almuerzo" es la comida del mediodía (en México, "la comida"), "merienda" la colación de la tarde y "snack" la colación de media mañana. Reglas de ingredientes: nombres genéricos en español de México, sin marcas (ej. "Pechuga de pollo", "Arroz blanco cocido", "Huevo", "Avena", "Tortilla de maíz"). Un ingrediente por fila, con gramos de la porción comestible; si es un alimento que se cocina, acláralo en el nombre o en la nota ("cocido", "crudo"). Máximo 6 ingredientes por plato. No pongas agua ni sal.`;

function describirCuestionarioNutricion(cn: CuestionarioNutricion | null): string {
  if (!cn) return "Sin cuestionario nutricional: usa desayuno, almuerzo, merienda y cena.";
  return [
    `Comidas del día, en orden y con horario: ${cn.comidas.map((c) => `${c.momento} (${c.hora || "sin hora"})`).join(", ")}`,
    `Hora de entreno: ${cn.hora_entreno || "variable"}`,
    `ALERGIAS / INTOLERANCIAS (prohibido usarlas): ${cn.alergias || "ninguna"}`,
    `No le gusta / evita: ${cn.no_come || "nada en particular"}`,
    `Cocina: ${cn.cocina === "cocino" ? "cocina en casa" : cn.cocina === "mixto" ? "a veces cocina, a veces come fuera" : "casi siempre come fuera o compra hecho"}`,
    `Batch cooking: ${cn.batch_cooking ? "sí, puede cocinar en tandas una vez por semana" : "no"}`,
    `Presupuesto: ${cn.presupuesto}`,
    `País: ${cn.pais || "México"}`
  ].join("\n");
}

function describirMacros(m: Macros): string {
  return `${m.kcal} kcal · ${m.prot_g} g proteína · ${m.carb_g} g carbohidratos · ${m.grasa_g} g grasa`;
}

// ── 1. Generar el menú desde el perfil ──────────────────────────

export async function generarRecomendacionComidas(
  perfil: Profile,
  objetivos: { entreno: Macros; descanso: Macros },
  base: string[]
): Promise<PlanComidasGenerado> {
  const cn = perfil.cuestionario_nutricion;
  const momentos = cn?.comidas.map((c) => c.momento) ?? ["desayuno", "almuerzo", "merienda", "cena"];
  const raw = await generarJSON<unknown>(
    `${TONO} Armas un menú tipo para DÍA DE ENTRENO y otro para DÍA DE DESCANSO que cuadren con la referencia diaria de calorías y macros (±5 % en calorías; proteína entre la referencia y un 15 % por encima, no más; no agregues proteína en polvo salvo que el cliente lo pida). Usa exactamente estos momentos del día y ningún otro: ${momentos.join(", ")}. Un plato por momento; las colaciones (merienda y snack) son ligeras y rápidas (fruta, yogur, frutos secos, pan o tortilla con algo), no un plato principal; pre y post-entreno, fáciles de digerir. Comidas simples, de supermercado, repetibles toda la semana y acordes al presupuesto; si el cliente come fuera, la comida del mediodía tiene que ser fácil de llevar o de pedir. Alrededor del entreno concentra los carbohidratos. Prefiere ingredientes de esta lista base, con el mismo nombre exacto: ${base.join("; ")}. ${ESQUEMA_COMIDAS}`,
    `Perfil del cliente:\n${describirPerfil(perfil)}\n\nCuestionario nutricional:\n${describirCuestionarioNutricion(cn)}\n\nReferencia diaria día de entreno: ${describirMacros(objetivos.entreno)}\nReferencia diaria día de descanso: ${describirMacros(objetivos.descanso)}\n\nGenera la recomendación.`,
    { temperatura: 0.5 }
  );
  return normalizarPlanComidas(raw, momentos);
}

// ── 2. Interpretar un .txt del entrenador ───────────────────────

const INSTRUCCIONES_TXT = `Eres el asistente de un entrenador personal. Recibes el plan de alimentación que el entrenador escribió para un cliente (texto libre: bloques con horario, listas, tablas, abreviaturas, "150g pollo + 80g arroz") y lo conviertes FIELMENTE a JSON. Transcribes, no recomiendas: no agregues, quites ni cambies comidas, alimentos ni cantidades.

Reglas:
- Días: si el texto distingue día de entreno y de descanso (o "día A / día B", "con gym / sin gym"), respétalo. Si describe varios días de la semana, usa el más representativo de los que entrena como "entreno" y el más representativo del resto como "descanso". Si trae un solo menú, ponlo en "entreno" y deja "descanso" vacío.
- Cada bloque de comida del texto es una comida, con su "hora" (HH:MM, 24 h; si da un rango, el inicio; null si no tiene) y su "etiqueta" tal como la nombra el texto ("Pre-Entrenamiento", "Almuerzo / Desayuno sólido", "Comida", "Colación de la tarde", "Cena"). "momento": "pre_entreno" o "post_entreno" para lo que se come antes o después de entrenar; para el resto el que corresponda ("desayuno", "snack" = colación de media mañana, "almuerzo" = la comida del mediodía, "merienda" = colación de la tarde, "cena"). "plato": nombre corto del bloque (ej. "Energía rápida", "Batido post-entreno").
- Un alimento por fila. Copia la cantidad TAL COMO la escribe el texto en "cantidad" y "unidad": "g" (gramos o mililitros), "pieza" (huevos, claras, galletas, frutas, tortillas…), "scoop", "cucharada", "cucharadita", "taza" o "libre" (si dice "cantidad libre" o no da cantidad; "cantidad": null). Si el texto da piezas Y gramos ("1 plátano mediano (aprox. 100 g)", "1.5 scoops (45 g)"), usa los gramos: unidad "g". En "gramos" pon tu estimación en gramos de la porción (solo es respaldo).
- Peso crudo o cocido: si el texto dice "peso en crudo", el nombre lleva "(crudo)"; si dice "peso cocido" o "hervido", "(cocido)". Si una carne o pescado no lo aclara, usa el mismo criterio que el resto de las proteínas del plan (si las pesa en crudo, crudo).
- Opciones: "pollo o pescado blanco" → usa la primera y pon "o pescado blanco" en la nota (siempre que el texto dé opciones, la nota las dice). "Pepino, jícama y zanahoria" son tres alimentos (reparte la cantidad).
- Todo lo que se come con cantidad va, aunque tenga pocas calorías: aderezos (vinagre, aceite, limón), verduras y ensaladas.
- Cómo se cocina ("al vapor", "con aceite en aerosol", "licuar con agua y hielo") va en la nota del alimento, no como alimento. El agua, el hielo, la sal, las especias, el café o té sin azúcar no van.
- No son comida y NO van: suplementos (creatina, vitaminas, omega 3, minerales, probióticos, enzimas, aminoácidos, glutamina, citrulina, beta-alanina, DIM, pre-entreno), los productos de cuidado personal, las listas de compras y las indicaciones de horario sin comida ("cierre de líquidos", "hora de dormir"); eso va al protocolo del entrenador. La proteína en polvo SÍ es comida.
- Nombres: genéricos, en español de México, sin marcas. Cuando el alimento del texto sea el mismo que uno de la lista base, usa EXACTAMENTE el nombre de la lista.
- "objetivos": si el texto fija calorías y macros diarios (ej. una tabla "Días de entrenamiento 2,150 kcal…"), cópialos por tipo de día; si no, null.
- "notas": 1-2 frases del texto para el cliente (ej. "Pesa todo en tu báscula"), o null.

Devuelve SOLO un JSON con esta forma exacta:
{
  "nombre": string (corto, ej. "Plan de alimentación"),
  "notas": string | null,
  "objetivos": { "entreno": { "kcal": number, "prot_g": number, "carb_g": number, "grasa_g": number } | null, "descanso": { ...igual... } | null } | null,
  "entreno": [ { "etiqueta": string, "hora": "HH:MM" | null, "momento": "pre_entreno" | "post_entreno" | "desayuno" | "snack" | "almuerzo" | "merienda" | "cena", "plato": string, "ingredientes": [ { "nombre": string, "cantidad": number | null, "unidad": "g" | "pieza" | "scoop" | "cucharada" | "cucharadita" | "taza" | "libre", "gramos": number, "nota": string | null } ] } ],
  "descanso": [ ...misma forma... ]
}`;

// La IA gratis tiene un límite de tokens por minuto: se le manda solo lo
// que sirve. De la base, los nombres que tienen que ver con el texto; del
// texto, sin la lista de compras del final (no son comidas).
const raiz = (w: string) => w.replace(/(es|s)$/, "");

export function baseRelevante(base: string[], texto: string): string[] {
  const delTexto = new Set(normalizarTexto(texto).split(" ").map(raiz));
  return base.filter((n) =>
    normalizarTexto(n)
      .split(" ")
      .some((w) => w.length >= 4 && delTexto.has(raiz(w)))
  );
}

export function sinListaDeCompras(texto: string): string {
  const m = /^.*lista de (las )?compras.*$/im.exec(texto);
  return m && m.index > texto.length * 0.5 ? texto.slice(0, m.index).trimEnd() : texto;
}

// Cambiarla cuando cambien las instrucciones: las lecturas guardadas con
// la versión anterior dejan de usarse (ver ia-lecturas.ts)
export const VERSION_MENU_TXT = "2026-10-02";

// Lo que responde la IA, sin sanear (es lo que se guarda)
export async function pedirComidasTxt(texto: string, perfil: Profile, base: string[] = []): Promise<unknown> {
  const fuente = sinListaDeCompras(texto).slice(0, 12000);
  return generarJSON<unknown>(
    INSTRUCCIONES_TXT,
    `Lista base de alimentos (usa estos nombres cuando sea el mismo alimento): ${baseRelevante(base, fuente).join("; ")}\n\nPerfil del cliente:\n${describirPerfil(perfil)}\n\nTexto del entrenador:\n"""\n${fuente}\n"""`,
    { temperatura: 0, maxTokens: 4000 }
  );
}

export async function interpretarComidasTxt(
  texto: string,
  perfil: Profile,
  base: string[] = []
): Promise<PlanComidasGenerado> {
  return normalizarPlanComidas(await pedirComidasTxt(texto, perfil, base));
}

// ── 2b. Ajustar el menú actual a una referencia ─────────────────

export interface MenuParaAjustar {
  tipo: TipoDia;
  comidas: {
    momento: Momento;
    plato: string;
    ingredientes: { nombre: string; gramos: number; kcal_100: number; prot_100: number; carb_100: number; grasa_100: number; nota: string | null }[];
  }[];
  totales: Macros;
  objetivo: Macros;
}

// La IA decide QUÉ cambiar (más camote en la cena, sumar un plátano al
// post-entreno, cambiar lo que el cliente no come); los gramos exactos los
// cierra después el código (ajustarAMacros), porque la IA no suma bien.
export async function pedirAjusteMenu(
  menus: MenuParaAjustar[],
  perfil: Profile,
  base: string[],
  opciones: { indicacion: string; evitar: string[] }
): Promise<unknown> {
  const fmt = (m: Macros) => `${Math.round(m.kcal)} kcal · P ${Math.round(m.prot_g)} · C ${Math.round(m.carb_g)} · G ${Math.round(m.grasa_g)}`;
  const describir = menus
    .map(
      (d) =>
        `${d.tipo === "entreno" ? "DÍA DE ENTRENO" : "DÍA DE DESCANSO"} — ahora: ${fmt(d.totales)} → objetivo: ${fmt(d.objetivo)}\n` +
        d.comidas
          .map(
            (c) =>
              `  [${c.momento}] ${c.plato}\n` +
              c.ingredientes
                .map((i) => `    - ${i.nombre}: ${Math.round(i.gramos)} g${i.nota ? ` (${i.nota})` : ""} · por 100 g: ${i.kcal_100} kcal, P ${i.prot_100}, C ${i.carb_100}, G ${i.grasa_100}`)
                .join("\n")
          )
          .join("\n")
    )
    .join("\n\n");
  return generarJSON<unknown>(
    `Eres el asistente de un entrenador personal. Ajustas el menú que el entrenador ya le dio a su cliente para que cada tipo de día se acerque a su objetivo de calorías y macros.
Reglas:
- Mantén las mismas comidas (mismo "momento") y, en lo posible, los mismos alimentos: cambia sobre todo los GRAMOS, con porciones realistas (carne o pescado 80-250 g, carbohidrato cocido 50-300 g, aceite 3-15 g).
- Si con gramos razonables no se llega, puedes agregar o cambiar como máximo 2 alimentos por tipo de día, usando nombres de la lista base, en la comida donde tenga más sentido (los carbohidratos alrededor del entreno). Nunca pongas algo sólido en un batido o licuado (ahí solo fruta, avena, miel o leche); los carbohidratos sólidos van en comidas de plato.
- Lo que va por piezas ("3 piezas") y las verduras quedan igual salvo que la indicación del entrenador diga otra cosa.
- ${opciones.evitar.length ? `El cliente no come o no debe comer: ${opciones.evitar.join(", ")}. Todo alimento cuyo nombre contenga una de esas palabras (ej. "Galletas de arroz" contiene "arroz", "Tortilla de maíz" contiene "maíz") se REEMPLAZA por un equivalente de la lista base que no las contenga, con su misma función (carbohidrato por carbohidrato).` : "No hay alimentos a evitar."}
- Indicación del entrenador (tiene prioridad): ${opciones.indicacion.trim() || "ninguna"}.
- No agregues suplementos. Nombres en español de México, sin marcas. Las notas del entrenador se conservan.
Devuelve SOLO JSON: { "entreno": [ { "momento": string, "plato": string, "ingredientes": [ { "nombre": string, "gramos": number, "nota": string | null } ] } ], "descanso": [ ...igual... ], "cambios": [string (máx. 5, qué cambiaste y por qué, una frase cada uno)] }`,
    `Cliente:\n${describirPerfil(perfil)}\n\nLista base: ${base.join("; ")}\n\nMenú actual:\n${describir}`,
    { temperatura: 0.2, maxTokens: 4500 }
  );
}

// ── 3. Orden de cocción del batch cooking ───────────────────────

export async function planificarBatchCooking(
  tandas: BatchCooking["tandas"]
): Promise<Pick<BatchCooking, "tiempo_min" | "pasos" | "conservacion">> {
  const data = await generarJSON<{ tiempo_min: number; pasos: string[]; conservacion: string[] }>(
    `${TONO} El cliente va a cocinar en una sola tanda semanal lo que se lista. Ordena la cocción para aprovechar el tiempo (lo que va al horno primero, lo que hierve en paralelo, la plancha al final) y di cómo guardar cada cosa (en el refri cuántos días, qué congelar en porciones). Imperativo de tú ("precalienta", "hierve", "guarda"; nunca voseo). Devuelve SOLO JSON: {"tiempo_min": number, "pasos": [string (máx. 8, con tiempos)], "conservacion": [string (2 a 5)]}.`,
    tandas
      .map((t) => `${t.tecnica}: ${t.items.map((i) => `${i.nombre} ${Math.round(i.gramos_semana)} g`).join(", ")}`)
      .join("\n"),
    { temperatura: 0.3, maxTokens: 1500 }
  );
  if (!Array.isArray(data?.pasos)) throw new ErrorIA("Respuesta de batch cooking inválida.");
  return {
    tiempo_min: Math.max(20, Math.min(240, Math.round(Number(data.tiempo_min) || 90))),
    pasos: data.pasos.map((p) => String(p).trim()).filter(Boolean).slice(0, 8),
    conservacion: (Array.isArray(data.conservacion) ? data.conservacion : [])
      .map((p) => String(p).trim())
      .filter(Boolean)
      .slice(0, 5)
  };
}
