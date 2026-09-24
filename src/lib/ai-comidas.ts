// IA de la recomendación de comidas: genera el menú (entreno + descanso)
// desde el perfil y el cuestionario nutricional, o lo interpreta de un
// .txt del entrenador. La IA solo propone ingredientes y gramos: los
// macros reales los calcula lib/meal-plan.ts contra la tabla
// `ingredients`, y el tono es siempre de recomendación del entrenador,
// nunca de prescripción profesional.

import { ErrorIA, describirPerfil, generarJSON } from "./ai";
import type { Macros } from "./nutrition";
import { normalizarPlanComidas } from "./meal-plan";
import type { BatchCooking, CuestionarioNutricion, PlanComidasGenerado, Profile } from "./types";

const TONO = `Sos el asistente de un entrenador personal. Lo que escribís son RECOMENDACIONES de alimentación como orientación general del entrenador: usá "te recomiendo", "podés", "una opción es". Nunca hables como profesional de la salud, no menciones enfermedades, medicación ni suplementos, y no prometas resultados. Español rioplatense, voseo, frases cortas.`;

const ESQUEMA_COMIDAS = `Devolvé SOLO un JSON con esta forma exacta:
{
  "nombre": string (ej. "Recomendación de comidas · volumen"),
  "notas": string (1-2 frases al cliente, tono de recomendación),
  "entreno": [
    {
      "momento": "desayuno" | "almuerzo" | "merienda" | "cena" | "snack",
      "plato": string (nombre corto del plato),
      "ingredientes": [
        { "nombre": string, "gramos": number, "nota": string opcional }
      ]
    }
  ],
  "descanso": [ ...misma forma... ]
}
Reglas de ingredientes: nombres genéricos en español, sin marcas (ej. "Pechuga de pollo", "Arroz blanco cocido", "Huevo", "Avena"). Un ingrediente por fila, con gramos de la porción comestible; si es un alimento que se cocina, aclaralo en el nombre o en la nota ("cocido", "crudo"). Máximo 5 ingredientes por plato. No pongas agua ni sal.`;

function describirCuestionarioNutricion(cn: CuestionarioNutricion | null): string {
  if (!cn) return "Sin cuestionario nutricional: usá desayuno, almuerzo, merienda y cena.";
  return [
    `Comidas del día, en orden y con horario: ${cn.comidas.map((c) => `${c.momento} (${c.hora || "sin hora"})`).join(", ")}`,
    `Hora de entreno: ${cn.hora_entreno || "variable"}`,
    `ALERGIAS / INTOLERANCIAS (prohibido usarlas): ${cn.alergias || "ninguna"}`,
    `No le gusta / evita: ${cn.no_come || "nada en particular"}`,
    `Cocina: ${cn.cocina === "cocino" ? "cocina en casa" : cn.cocina === "mixto" ? "a veces cocina, a veces come fuera" : "casi siempre come fuera o compra hecho"}`,
    `Batch cooking: ${cn.batch_cooking ? "sí, puede cocinar en tandas una vez por semana" : "no"}`,
    `Presupuesto: ${cn.presupuesto}`,
    `País: ${cn.pais || "Argentina"}`
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
    `${TONO} Armás un menú tipo para DÍA DE ENTRENO y otro para DÍA DE DESCANSO que cuadren con la referencia diaria de calorías y macros (±5 % en calorías; proteína entre la referencia y un 15 % por encima, no más; no agregues proteína en polvo salvo que el cliente lo pida). Usá exactamente estos momentos del día y ningún otro: ${momentos.join(", ")}. Un plato por momento; merienda y snack son livianos y rápidos (fruta, yogur, frutos secos, pan con algo), no un plato principal. Comidas simples, de supermercado, repetibles toda la semana y acordes al presupuesto; si el cliente come fuera, el almuerzo tiene que ser fácil de llevar o de pedir. Alrededor del entreno concentrá los carbohidratos. Preferí ingredientes de esta lista base, con el mismo nombre exacto: ${base.join("; ")}. ${ESQUEMA_COMIDAS}`,
    `Perfil del cliente:\n${describirPerfil(perfil)}\n\nCuestionario nutricional:\n${describirCuestionarioNutricion(cn)}\n\nReferencia diaria día de entreno: ${describirMacros(objetivos.entreno)}\nReferencia diaria día de descanso: ${describirMacros(objetivos.descanso)}\n\nGenerá la recomendación.`,
    { temperatura: 0.5 }
  );
  return normalizarPlanComidas(raw, momentos);
}

// ── 2. Interpretar un .txt del entrenador ───────────────────────

export async function interpretarComidasTxt(
  texto: string,
  perfil: Profile
): Promise<PlanComidasGenerado> {
  const raw = await generarJSON<unknown>(
    `${TONO} Recibís una recomendación de comidas escrita a mano por el entrenador (texto libre: listas, tablas, abreviaturas, "150g pollo + 80g arroz", con o sin días ni horarios) y la convertís FIELMENTE a JSON. No inventes comidas ni ingredientes que el texto no mencione; si falta la cantidad, estimá una porción razonable y anotá "cantidad estimada" en la nota. Si el texto distingue día de entreno y día de descanso (o "día A / día B", "con gym / sin gym"), respetalo. Si describe varios días de la semana, usá el más representativo de los días que entrena como "entreno" y el más representativo del resto como "descanso". Si trae un solo menú, usalo para los dos. Mapeá cada comida al momento que corresponda (desayuno, almuerzo, merienda, cena o snack); "colación" y "pre/post entreno" son snack. Si el cuestionario del cliente ya trae horarios, usalos para decidir el momento de cada comida del texto ("Comida 1 a las 12:00" es la comida del cliente más cercana a esa hora). Ignorá lo que no es comida: suplementos sin calorías relevantes (creatina, vitaminas, minerales, magnesio, aminoácidos, electrolitos, pre-entreno), café o té sin azúcar, el agua y los productos de cuidado personal; eso va al protocolo del entrenador. La proteína en polvo sí es comida. ${ESQUEMA_COMIDAS}`,
    `Perfil del cliente:\n${describirPerfil(perfil)}\n\nTexto del entrenador:\n"""\n${texto.slice(0, 12000)}\n"""`,
    { temperatura: 0.1 }
  );
  return normalizarPlanComidas(raw);
}

// ── 3. Orden de cocción del batch cooking ───────────────────────

export async function planificarBatchCooking(
  tandas: BatchCooking["tandas"]
): Promise<Pick<BatchCooking, "tiempo_min" | "pasos" | "conservacion">> {
  const data = await generarJSON<{ tiempo_min: number; pasos: string[]; conservacion: string[] }>(
    `${TONO} El cliente va a cocinar en una sola tanda semanal lo que se lista. Ordená la cocción para aprovechar el tiempo (lo que va al horno primero, lo que hierve en paralelo, la plancha al final) y decí cómo guardar cada cosa (heladera cuántos días, qué congelar en porciones). Imperativo con voseo ("precalentá", "herví", "guardá"). Devolvé SOLO JSON: {"tiempo_min": number, "pasos": [string (máx. 8, con tiempos)], "conservacion": [string (2 a 5)]}.`,
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
