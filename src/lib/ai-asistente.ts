// Asistente de situaciones: el cliente cuenta qué le pasa hoy ("tengo un
// cumpleaños con asado y torta", "no tengo pollo", "me pasé ayer") y la IA
// responde con qué comer, cuánto y cómo acomodar el resto del día, con
// todo el contexto real de su día. Es orientación del entrenador.

import { ErrorIA, generarJSON } from "./ai";
import type { Macros } from "./nutrition";
import type { ComidaDelPlan } from "./meal-plan";
import type { CuestionarioNutricion, Momento, RespuestaAsistente, TipoSituacion } from "./types";

const TIPOS: TipoSituacion[] = ["evento", "restaurante", "falta_ingrediente", "antojo", "viaje", "me_pase", "otro"];
const MOMENTOS: (Momento | "general")[] = ["desayuno", "almuerzo", "merienda", "cena", "snack", "pre_entreno", "post_entreno", "general"];

export interface ContextoAsistente {
  nombre: string;
  objetivo: string;
  tipoDia: "entreno" | "descanso";
  hora: number;
  referencia: Macros | null;
  consumido: Macros;
  restante: Macros | null;
  menuHoy: ComidaDelPlan[];
  comidasHechas: Momento[];
  cn: CuestionarioNutricion | null;
}

function describirContexto(c: ContextoAsistente): string {
  const m = (x: Macros) => `${x.kcal} kcal · P ${Math.round(x.prot_g)} g · C ${Math.round(x.carb_g)} g · G ${Math.round(x.grasa_g)} g`;
  const menu = c.menuHoy.length
    ? c.menuHoy
        .map(
          (x) =>
            `- ${x.momento}${c.comidasHechas.includes(x.momento) ? " (YA LA COMIÓ)" : ""}: ${x.plato || ""} → ${x.items
              .map((i) => `${i.ingredient.nombre} ${Math.round(i.cantidad_g)} g`)
              .join(", ")} (${x.macros.kcal} kcal)`
        )
        .join("\n")
    : "(sin menú recomendado; se guía por la referencia diaria)";
  return [
    `Cliente: ${c.nombre || "sin nombre"} · objetivo: ${c.objetivo} · hoy es día de ${c.tipoDia} · son las ${c.hora}:00`,
    c.referencia ? `Referencia diaria: ${m(c.referencia)}` : "Referencia diaria: no calculada",
    `Ya comió hoy: ${m(c.consumido)}`,
    c.restante ? `Le queda para hoy: ${m(c.restante)}` : "",
    `Menú recomendado de hoy:\n${menu}`,
    c.cn?.alergias ? `ALERGIAS (prohibido sugerirlas): ${c.cn.alergias}` : "",
    c.cn?.no_come ? `No le gusta / evita: ${c.cn.no_come}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export async function resolverSituacion(
  contexto: ContextoAsistente,
  pregunta: string
): Promise<RespuestaAsistente> {
  const data = await generarJSON<RespuestaAsistente>(
    `Eres el asistente de un entrenador personal y le respondes a un cliente que te cuenta una situación de hoy con la comida. Tu trabajo es que NO se salga de su objetivo sin renunciar a la vida social: dile QUÉ comer y CUÁNTO en esa situación (porciones concretas: "2 rebanadas de pizza", "3 tacos de carne asada", "un plato de carne del tamaño de tu mano", "1 rebanada chica de pastel") y cómo acomodar el resto del día (aligerar otras comidas, priorizar proteína, no saltarse comidas). Usa lo que ya comió y lo que le queda. Si la situación reemplaza una comida del menú (una cena de cumpleaños ES la cena), dilo y no propongas además esa comida del menú en "reacomodo_dia". En eventos prioriza la proteína magra (carne, pollo, pescado) y limita lo más denso (chorizo, pizza, pastel, fritos) a una porción de cada uno. Un día no rompe nada: nada de culpa ni de compensar con ayunos ni con más entreno. Tono de entrenador, cercano, español de México de tú (cumples, sigues, disfruta; nunca voseo como "cumplís" o "disfrutá"), frases cortas. En "que_comer", "opcion" es solo el alimento o plato (sin cantidad) y "cantidad" va en su campo. Nunca hables como profesional de la salud, no menciones enfermedades, medicación ni suplementos, y no prometas resultados. Si pregunta algo que no es de comida, responde breve y con tipo "otro". Devuelve SOLO JSON con esta forma exacta:
{
  "tipo": "evento" | "restaurante" | "falta_ingrediente" | "antojo" | "viaje" | "me_pase" | "otro",
  "resumen": string (1 frase con la idea principal),
  "que_comer": [ { "opcion": string, "cantidad": string, "por_que": string (corto) } ] (1 a 4; en "falta_ingrediente" la opción es el reemplazo con sus gramos equivalentes),
  "reacomodo_dia": [ { "momento": "desayuno"|"almuerzo"|"merienda"|"cena"|"snack"|"pre_entreno"|"post_entreno"|"general", "cambio": string } ] (0 a 4; solo comidas que todavía no comió),
  "mensaje": string (cierre de 1-2 frases, tranquilizador y concreto)
}`,
    `${describirContexto(contexto)}\n\nEl cliente dice: "${pregunta.slice(0, 600)}"`,
    { temperatura: 0.4, maxTokens: 1800 }
  );
  if (!data || typeof data !== "object") throw new ErrorIA("Respuesta del asistente inválida.");
  const tipo = TIPOS.includes(data.tipo) ? data.tipo : "otro";
  return {
    tipo,
    resumen: String(data.resumen ?? "").trim().slice(0, 300),
    que_comer: (Array.isArray(data.que_comer) ? data.que_comer : [])
      .map((x) => ({
        opcion: String(x?.opcion ?? "").trim().slice(0, 120),
        cantidad: String(x?.cantidad ?? "").trim().slice(0, 120),
        por_que: String(x?.por_que ?? "").trim().slice(0, 200)
      }))
      .filter((x) => x.opcion)
      .slice(0, 4),
    reacomodo_dia: (Array.isArray(data.reacomodo_dia) ? data.reacomodo_dia : [])
      .map((x) => ({
        momento: (MOMENTOS.includes(x?.momento) ? x.momento : "general") as Momento | "general",
        cambio: String(x?.cambio ?? "").trim().slice(0, 200)
      }))
      .filter((x) => x.cambio)
      .slice(0, 4),
    mensaje: String(data.mensaje ?? "").trim().slice(0, 400)
  };
}
