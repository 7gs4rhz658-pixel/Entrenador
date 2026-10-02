// Capa de IA: proxy en el servidor contra Groq o Gemini. La clave vive
// solo en el entorno del servidor (server actions / server components) y
// nunca llega al navegador. Toda función devuelve JSON tipado y, si la IA
// no está configurada o falla, quien la llama tiene un camino sin IA.

import type { Cuestionario, Momento, PlanGenerado, Profile } from "./types";
import type { Macros } from "./nutrition";
import { normalizarPlan } from "./plan-generator";

// Proveedores soportados (se elige el primero configurado):
//   GROQ_API_KEY   → Groq, API compatible con OpenAI (plan gratuito, sin tarjeta)
//   GEMINI_API_KEY → Google Gemini
const MODELO_GROQ_DEFAULT = "openai/gpt-oss-120b";
const MODELO_GEMINI_DEFAULT = "gemini-3.6-flash";

type Proveedor = "groq" | "gemini";

function proveedor(): Proveedor | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export function iaDisponible(): boolean {
  return proveedor() !== null;
}

export class ErrorIA extends Error {}

interface Opciones {
  temperatura?: number;
  maxTokens?: number;
}

export async function generarJSON<T>(instrucciones: string, prompt: string, opciones: Opciones = {}): Promise<T> {
  const p = proveedor();
  if (!p) throw new ErrorIA("La IA no está configurada (falta GROQ_API_KEY o GEMINI_API_KEY).");
  const texto =
    p === "groq"
      ? await llamarGroq(instrucciones, prompt, opciones)
      : await llamarGemini(instrucciones, prompt, opciones);
  const limpio = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(limpio) as T;
  } catch {
    throw new ErrorIA("La IA devolvió un JSON inválido.");
  }
}

// El plan gratuito de Groq limita tokens por minuto: si pide esperar
// unos segundos (429), esperamos y reintentamos hasta dos veces. Si el
// modo JSON estricto falla al validar (400), se repite sin él y el JSON
// se extrae del texto.
async function llamarGroq(
  instrucciones: string,
  prompt: string,
  opciones: Opciones,
  intento = 0,
  modoJson = true
): Promise<string> {
  const modelo = process.env.GROQ_MODEL || MODELO_GROQ_DEFAULT;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: modelo,
      messages: [
        { role: "system", content: instrucciones },
        { role: "user", content: prompt }
      ],
      ...(modoJson ? { response_format: { type: "json_object" } } : {}),
      temperature: opciones.temperatura ?? 0.3,
      max_tokens: opciones.maxTokens ?? 8192,
      // gpt-oss razona antes de responder; con esfuerzo alto gasta miles
      // de tokens y puede truncar el JSON. Bajo alcanza para estas tareas.
      ...(modelo.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {})
    }),
    cache: "no-store"
  });
  if (!res.ok) {
    const cuerpo = await res.text().catch(() => "");
    if (res.status === 429) {
      // Límite por minuto del plan gratis (8000 tokens): leer un plan largo
      // y su menú seguidos lo pasa. Se espera lo que pida (hasta 45 s; la
      // página del entrenador permite 60) y se reintenta.
      const seg = Number(cuerpo.match(/try again in ([\d.]+)s/i)?.[1] ?? res.headers.get("retry-after") ?? 0);
      if (intento < 2 && seg > 0 && seg <= 45) {
        await new Promise((r) => setTimeout(r, Math.ceil(seg * 1000) + 500));
        return llamarGroq(instrucciones, prompt, opciones, intento + 1, modoJson);
      }
      if (/per day|TPD|RPD/i.test(cuerpo)) {
        throw new ErrorIA("La IA gratuita llegó a su límite de hoy. Vuelve a intentar mañana.");
      }
      throw new ErrorIA("La IA gratuita está ocupada (límite por minuto). Espera un minuto y vuelve a intentar.");
    }
    // "Request too large": el plan gratis cuenta el pedido más el máximo de
    // respuesta. Se achica el máximo lo justo y se reintenta una vez.
    const pedido = /Limit (\d+), Requested (\d+)/.exec(cuerpo);
    if (res.status === 413 && pedido && intento < 2) {
      const max = (opciones.maxTokens ?? 8192) - (Number(pedido[2]) - Number(pedido[1])) - 150;
      if (max >= 1500) return llamarGroq(instrucciones, prompt, { ...opciones, maxTokens: max }, intento + 1, modoJson);
    }
    if (res.status === 400 && modoJson && cuerpo.includes("json_validate_failed")) {
      return llamarGroq(instrucciones, prompt, opciones, intento, false);
    }
    throw new ErrorIA(`Groq respondió ${res.status}: ${cuerpo.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  if (process.env.IA_DEBUG) console.log("[groq] tokens", data.usage);
  // Cortada por el máximo: un JSON a medias perdería cosas sin avisar
  if (data.choices?.[0]?.finish_reason === "length") {
    throw new ErrorIA("La respuesta de la IA quedó cortada (el texto es largo para la IA gratis). Prueba de nuevo o divide el texto.");
  }
  const texto = data.choices?.[0]?.message?.content ?? "";
  if (!texto) throw new ErrorIA("Groq devolvió una respuesta vacía.");
  return modoJson ? texto : extraerJSON(texto);
}

// Del texto libre del modelo, el primer objeto JSON completo
function extraerJSON(texto: string): string {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio === -1 || fin === -1 || fin <= inicio) throw new ErrorIA("La IA no devolvió JSON.");
  return texto.slice(inicio, fin + 1);
}

async function llamarGemini(instrucciones: string, prompt: string, opciones: Opciones): Promise<string> {
  const modelo = process.env.GEMINI_MODEL || MODELO_GEMINI_DEFAULT;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instrucciones }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: opciones.temperatura ?? 0.3,
        maxOutputTokens: opciones.maxTokens ?? 8192
      }
    }),
    cache: "no-store"
  });
  if (!res.ok) {
    const cuerpo = await res.text().catch(() => "");
    throw new ErrorIA(`Gemini respondió ${res.status}: ${cuerpo.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };
  const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!texto) {
    throw new ErrorIA(
      data.promptFeedback?.blockReason
        ? `Gemini bloqueó la respuesta (${data.promptFeedback.blockReason}).`
        : "Gemini devolvió una respuesta vacía."
    );
  }
  return texto;
}

// ── Contexto compartido ─────────────────────────────────────────

const ESQUEMA_PLAN = `Devolvé SOLO un JSON con esta forma exacta:
{
  "nombre_bloque": string,
  "notas": string (1-2 frases para el cliente),
  "dias": [
    {
      "dia_semana": number (1 = lunes ... 7 = domingo),
      "nombre": string (ej. "Pecho y tríceps"),
      "ejercicios": [
        {
          "nombre": string,
          "grupo_muscular": "pecho" | "espalda" | "pierna" | "hombro" | "brazo" | "core" | "otro",
          "unidad": "kg" | "peso_corporal" | "sin_peso",
          "progresion": "compuesto" | "aislamiento" | "solo_reps" | "al_fallo",
          "series": number (2-5),
          "rep_min": number,
          "rep_max": number,
          "peso_inicial_kg": number | null (null = a definir en el primer entreno),
          "incremento_kg": 1 | 1.25 | 2.5 | 5,
          "descanso_seg": number (60-180),
          "descripcion": string (1 frase de técnica, en español rioplatense, voseo),
          "tips": [string, string, string]
        }
      ]
    }
  ]
}
Reglas: compuestos (press, sentadilla, peso muerto, remo, jalón, dominadas) → progresion "compuesto", rango 8-12 o 6-10; aislamientos → "aislamiento", rango 10-15 o 12-20; ejercicios de peso corporal → "solo_reps"; abdominales/cuello al fallo → "al_fallo". Incluí solo los días que entrena; el resto no va en la lista.`;

export function describirPerfil(perfil: Profile): string {
  return [
    `Nombre: ${perfil.nombre || "sin nombre"}`,
    `Edad: ${perfil.edad ?? "?"} · Sexo: ${perfil.sexo ?? "?"} · Peso: ${perfil.peso_kg ?? "?"} kg · Altura: ${perfil.altura_cm ?? "?"} cm`,
    `Objetivo: ${perfil.objetivo} · Actividad diaria: ${perfil.nivel_actividad}`
  ].join("\n");
}

function describirCuestionario(c: Cuestionario | null): string {
  if (!c) return "Sin cuestionario.";
  return [
    `Experiencia: ${c.experiencia}`,
    `Días disponibles (1=lunes..7=domingo): ${c.dias_disponibles.join(", ")}`,
    `Minutos por sesión: ${c.minutos_sesion}`,
    `Equipamiento: ${c.equipamiento}`,
    `Lesiones o limitaciones: ${c.lesiones || "ninguna"}`,
    `Preferencias: ${c.preferencias || "ninguna"}`
  ].join("\n");
}

// ── 1. Plan inicial desde el cuestionario ───────────────────────

export async function generarPlanInicial(perfil: Profile): Promise<PlanGenerado> {
  const raw = await generarJSON<unknown>(
    `Sos un entrenador personal experto en hipertrofia. Diseñás mesociclos de 8 semanas con progresión ondulada de 4 semanas (semana 1 piso de reps, semana 2 tope de reps, semana 3 sube el peso, semana 4 descarga al 50 %). Elegís ejercicios seguros para el equipamiento y las lesiones del cliente, 4-7 ejercicios por día según los minutos disponibles, y estimás un peso inicial conservador cuando la experiencia lo permite (principiantes: null en los compuestos con barra). ${ESQUEMA_PLAN}`,
    `Perfil del cliente:\n${describirPerfil(perfil)}\n\nCuestionario:\n${describirCuestionario(perfil.cuestionario)}\n\nGenerá el plan inicial.`,
    { temperatura: 0.5 }
  );
  return normalizarPlan(raw, perfil.cuestionario?.dias_disponibles);
}

// ── 2. Interpretar un plan en texto libre (.txt del entrenador) ─

export async function interpretarPlanTxt(
  texto: string,
  perfil: Profile
): Promise<PlanGenerado> {
  const raw = await generarJSON<unknown>(
    `Sos el asistente de un entrenador personal. Recibís un plan de entrenamiento escrito a mano (texto libre, puede tener abreviaturas, tablas o listas) y lo convertís FIELMENTE a JSON estructurado: respetá los ejercicios, el orden, las series, los rangos de reps, los pesos y los descansos que diga el texto. Si el texto no indica un dato, inferilo con criterio (rango 10-15 aislamientos, 8-12 compuestos, descanso 90 s, peso null). Si el texto nombra días ("Lunes", "Día 1"...), mapealos a dia_semana; si solo dice "Día 1, 2, 3", asignalos a lunes, miércoles y viernes. No inventes ejercicios que el texto no menciona. ${ESQUEMA_PLAN}`,
    `Perfil del cliente:\n${describirPerfil(perfil)}\n\nPlan del entrenador (texto):\n"""\n${texto.slice(0, 12000)}\n"""`,
    { temperatura: 0.1 }
  );
  return normalizarPlan(raw);
}

// ── 3. Ajuste de carga semanal ──────────────────────────────────

export interface ItemAjuste {
  exercise_id: string;
  nombre: string;
  fase_actual: number;
  plan_actual: { series: number; reps: number | null; peso_kg: number };
  registros: { serie: number; reps: number | null; peso_kg: number | null; rir: number | null; al_fallo: boolean }[];
  propuesta: { reps: number | null; peso_kg: number; nota: string };
  incremento_kg: number;
}

export interface Ajuste {
  exercise_id: string;
  peso_kg: number;
  motivo: string;
}

export async function sugerirAjustes(items: ItemAjuste[]): Promise<Ajuste[]> {
  if (!items.length) return [];
  const data = await generarJSON<{ ajustes: Ajuste[] }>(
    `Sos un entrenador de fuerza que ajusta cargas semana a semana. Para cada ejercicio recibís: la fase del ciclo ondulado de 4 semanas que acaba de terminar, el plan que tenía, lo que el cliente registró realmente (reps, kg y RIR por serie) y la propuesta determinista del sistema para la semana que viene. Tu trabajo es devolver el peso concreto en kg para la semana siguiente:
- Si el cliente cumplió con RIR alto (≥3) en todas las series, podés subir un poco más que la propuesta.
- Si le costó (RIR 0-1, o no llegó a las reps en alguna serie), mantené o bajá levemente.
- En descargas (fase 3 → 4) respetá la propuesta del 50 %.
- Nunca te alejes más de ±15 % de la propuesta ni uses valores que no sean múltiplos del incremento_kg.
- El motivo va en español rioplatense (voseo), máximo 110 caracteres, hablándole al cliente.
Devolvé SOLO JSON: {"ajustes": [{"exercise_id": string, "peso_kg": number, "motivo": string}]} con TODOS los ejercicios recibidos.`,
    JSON.stringify({ ejercicios: items }),
    { temperatura: 0.2 }
  );
  if (!Array.isArray(data?.ajustes)) throw new ErrorIA("Respuesta de ajustes inválida.");
  return data.ajustes.filter(
    (a) => typeof a?.exercise_id === "string" && Number.isFinite(a?.peso_kg)
  );
}

// ── 4. Sustitución de ingredientes en lenguaje natural ──────────

export interface PedidoSustitucion {
  quitar: string; // ingrediente a reemplazar, como lo nombra el usuario
  poner: string; // ingrediente nuevo
  criterio: "kcal" | "prot" | "carb";
  candidatos_alternativos: string[]; // otras opciones sensatas
}

export async function interpretarSustitucion(
  texto: string,
  comidasHoy: { nombre: string; cantidad_g: number; momento: string }[]
): Promise<PedidoSustitucion> {
  const data = await generarJSON<PedidoSustitucion>(
    `Sos un nutricionista. El usuario pide cambiar un ingrediente de su día por otro, en lenguaje natural. Identificá QUÉ ingrediente de la lista de hoy quiere quitar (usá el nombre exacto de la lista) y por CUÁL lo quiere reemplazar (nombre genérico del alimento, sin marca, en español). Elegí el criterio para igualar: "prot" si el ingrediente original es principalmente proteico (carnes, huevo, lácteos altos en proteína, legumbres), "carb" si es principalmente hidrato (cereales, panes, frutas, tubérculos) y "kcal" en cualquier otro caso. Proponé además 3 alternativas sensatas del mismo grupo por si la elegida no está en la base. Devolvé SOLO JSON: {"quitar": string, "poner": string, "criterio": "kcal"|"prot"|"carb", "candidatos_alternativos": [string, string, string]}.`,
    `Comidas registradas hoy:\n${comidasHoy.map((c) => `- ${c.nombre} · ${c.cantidad_g} g (${c.momento})`).join("\n") || "(ninguna)"}\n\nPedido: "${texto.slice(0, 500)}"`,
    { temperatura: 0.1 }
  );
  if (!data?.quitar || !data?.poner) throw new ErrorIA("No entendí qué querés cambiar.");
  if (!["kcal", "prot", "carb"].includes(data.criterio)) data.criterio = "kcal";
  data.candidatos_alternativos = Array.isArray(data.candidatos_alternativos)
    ? data.candidatos_alternativos.slice(0, 3)
    : [];
  return data;
}

// ── 5. Recetas dentro de los macros restantes ───────────────────

export interface Receta {
  nombre: string;
  momento: string;
  ingredientes: { nombre: string; gramos: number }[];
  pasos: string[];
  macros_aprox: Macros;
}

// Una idea por cada comida que al cliente todavía le falta hoy, repartiendo
// lo que le queda de macros entre ellas.
export async function sugerirRecetas(
  restantes: Macros,
  preferencias: string,
  base: string[],
  momentos: Momento[]
): Promise<Receta[]> {
  const lista: Momento[] = momentos.length ? momentos : ["cena"];
  const data = await generarJSON<{ recetas: Receta[] }>(
    `Sos un cocinero fitness. Al cliente le faltan hoy estas comidas, en este orden: ${lista.join(", ")}. Proponé EXACTAMENTE una receta por cada una (mismo "momento", mismo orden), simples (máx. 6 ingredientes, 20 minutos), repartiendo entre todas los macros que le quedan de modo que la suma cierre en las calorías restantes y priorizando llegar a la proteína. Cada receta tiene que ser acorde a su momento (desayuno o merienda livianos, almuerzo y cena completos, snack chico). Preferí ingredientes de la lista base disponible (para que se puedan registrar) y cantidades en gramos. Los macros son aproximados: calculalos vos con valores estándar por 100 g. Español rioplatense. Devolvé SOLO JSON: {"recetas": [{"nombre": string, "momento": "desayuno"|"almuerzo"|"merienda"|"cena"|"snack", "ingredientes": [{"nombre": string, "gramos": number}], "pasos": [string], "macros_aprox": {"kcal": number, "prot_g": number, "carb_g": number, "grasa_g": number}}]}`,
    `Macros restantes hoy: ${restantes.kcal} kcal · ${restantes.prot_g} g proteína · ${restantes.carb_g} g carbos · ${restantes.grasa_g} g grasa.\nPreferencias / restricciones: ${preferencias || "ninguna"}.\nIngredientes base disponibles: ${base.join(", ")}.`,
    { temperatura: 0.7 }
  );
  if (!Array.isArray(data?.recetas)) throw new ErrorIA("Respuesta de recetas inválida.");
  // Una por momento pedido, en el orden pedido
  const porMomento = new Map<string, Receta>();
  for (const r of data.recetas) if (r?.momento && !porMomento.has(r.momento)) porMomento.set(r.momento, r);
  const ordenadas = lista.map((m) => porMomento.get(m)).filter((r): r is Receta => !!r);
  return (ordenadas.length ? ordenadas : data.recetas).slice(0, 6);
}
