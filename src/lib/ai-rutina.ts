// Lee la rutina del entrenador (texto copiado de un PDF, Word o notas) en
// dos pasos, para no pasar el tope por pedido de la IA gratis:
//  1. pedirRutinaTxt: la estructura (fases, días, ejercicios, series,
//     cadencia y notas). Solo transcribe: no agrega ni cambia nada.
//  2. pedirTecnica: por tandas, cómo se ejecuta cada ejercicio paso a
//     paso con la prescripción del plan (se guarda por ejercicio).

import { ErrorIA, describirPerfil, generarJSON } from "./ai";
import { claveTexto } from "./clave-texto";
import { infoEjercicio } from "./exercise-info";
import { activoEnSemana, faseDeSemana, grupoSuperserie, repsDeSerie } from "./rutina";
import type { EjercicioGenerado, FaseRutina, PlanGenerado, Profile } from "./types";

// Cambiarla cuando cambien las instrucciones: las lecturas guardadas con
// la versión anterior dejan de usarse (ver ia-lecturas.ts)
export const VERSION_RUTINA_TXT = "2026-10-03";
export const VERSION_TECNICA = "2026-10-03e";

const INSTRUCCIONES = `Eres el asistente de un entrenador personal. Recibes su plan de entrenamiento (texto copiado de un PDF, Word o notas: puede traer tablas, viñetas y abreviaturas) y lo conviertes FIELMENTE a JSON. Solo transcribes y ordenas: no agregas ejercicios, equipo ni técnicas que el texto no dice (si habla de "oclusión" pero no menciona bandas, no hay bandas), no cambias series, repeticiones, cadencias ni descansos y no das consejos médicos.

Devuelve SOLO JSON compacto (en una sola línea, sin sangrías ni espacios de más: el plan es largo) con esta forma, omitiendo las claves opcionales que no apliquen:
{"nombre_bloque": string corto (el título del plan como lo escribe el texto, ej. "Macrociclo de 8 semanas"; no el nombre de una fase),
 "total_semanas": number,
 "notas": string (1-2 frases para el cliente: de qué se trata el plan),
 "notas_entrenador": string (lo que el texto le dice AL ENTRENADOR: transiciones, soporte calórico, métricas de éxito; sin perder números; "" si no hay),
 "fases": [{
  "nombre": string corto (ej. "Estrés metabólico y oclusión"),
  "semana_desde": number, "semana_hasta": number,
  "objetivo": string (una frase),
  "reglas": [string] (la técnica de la fase en frases claras para el cliente, de tú: qué significa la cadencia, cómo es cada serie, la carga, el descanso, el RIR),
  "tempo": {"concentrico": s, "contraccion": s, "excentrico": s, "estiramiento": s} | null (segundos de la fase de fuerza, de la pausa apretando en la contracción, del regreso y de la pausa en el estiramiento),
  "descanso_seg": number | null (si da un rango, el mayor),
  "rir": number | null (si da un rango, el mayor),
  "parciales": number | null (si la fase pide N parciales cortas al final de cada serie),
  "dias": [{"dia": number (el "Día N" del texto), "dia_semana": number | null (1=lunes…7=domingo, solo si el texto nombra el día), "nombre": string (ej. "Push"),
   "ejercicios": [{"nombre": string (como en el texto, sin series ni reps), "series": number, "reps": string ("20", "6-8"), "nota": string (lo que el texto dice del ejercicio entre paréntesis o junto a él, literal; sin repetir series, reps ni la superserie), "parciales": number, "por_lado": true, "superserie": string, "al_fallo": true, "unidad": "peso_corporal"|"sin_peso", "descanso_seg": number, "tempo": {…}}]}]
 }]}

Reglas:
- Si el plan no tiene fases, usa una sola fase con todas las semanas (8 si no lo dice).
- Cada fase lleva TODOS sus días y ejercicios, aunque se repitan en otra fase.
- "A / B … cada uno" son dos ejercicios con las mismas series. "A o B" es uno solo (el cliente elige).
- "parciales": cuántas de las reps son parciales cortas al final de la serie. Si la fase dice "10 completas + 10 parciales" en series de 20, cada ejercicio de 20 reps de esa fase lleva 10, salvo que su nota diga otra cosa. Si las parciales van después de una pausa ("al fallo + 10s descanso + 10 parciales"), eso va en la nota y sin "parciales".
- "Superserie 1: A + B" son dos ejercicios con "superserie": "1".
- "por_lado": true si dice por pierna, por brazo o por lado.
- "tempo" de un ejercicio solo si el texto le da una cadencia distinta a la de su fase; "descanso_seg" solo si es distinto al de la fase.
- "unidad" solo si el ejercicio no usa peso externo.
- Español de México, de tú.`;

// Lo que responde la IA, sin sanear (es lo que se guarda en ia_lecturas)
export async function pedirRutinaTxt(texto: string, perfil: Profile): Promise<unknown> {
  const raw = await generarJSON<unknown>(
    INSTRUCCIONES,
    `Cliente:\n${describirPerfil(perfil)}\n\nPlan del entrenador:\n"""\n${texto.slice(0, 12000)}\n"""`,
    { temperatura: 0, maxTokens: 5000, sinEspera: true }
  );
  if (!raw || typeof raw !== "object") throw new ErrorIA("La IA no devolvió una rutina válida.");
  return raw;
}

// ── Técnica paso a paso ─────────────────────────────────────────

export interface Tecnica {
  pasos: string[];
  clave: string;
  fuerza: string;
  regreso: string;
}

export interface PedidoTecnica {
  id: string;
  ej: EjercicioGenerado;
  fase: FaseRutina | null;
  companero: string | null; // el otro ejercicio de su superserie
}

const INSTRUCCIONES_TECNICA = `Eres un entrenador personal experto en técnica. Para cada ejercicio escribes cómo se ejecuta paso a paso, para que el cliente lo haga solo en el gimnasio, integrando la prescripción que recibes (series, reps, cadencia en segundos, parciales y la nota del plan).

Los pasos van en este orden:
1. Preparación (1 a 3 pasos): ajuste del banco, la máquina o la polea, el agarre y la postura, hasta la POSICIÓN INICIAL (la del estiramiento, antes de hacer fuerza).
2. La repetición: un paso por cada tramo de "cadencia", en ESE orden exacto y con esos verbos y segundos (la pausa en el estiramiento va después del regreso). En las pausas di dónde se sienten; la contracción no siempre es "arriba": en jalones, remos, extensiones de tríceps en polea y cruces de polea alta es abajo o atrás. Si dudas, no digas arriba ni abajo. Nunca menciones tramos que no vienen ni pausas de 0 segundos.
3. Las repeticiones exactamente como dice "repeticiones": si dice "10 completas y, sin descansar, 10 parciales", el último paso son las parciales "en el tramo donde mantienes la tensión" (sin tecnicismos como "concéntrica"); si dice "sin parciales", no menciones parciales.

Reglas:
- Si el ejercicio trae "referencia", esa es la técnica correcta: úsala para la preparación y el movimiento.
- Respeta el equipo que dice el nombre (polea baja o alta, mancuernas, máquina, barra Z). No inventes accesorios (cuerda, barra, bandas) que el nombre, la nota o la referencia no mencionan; si no está claro, descríbelo de forma general.
- Si es por lado (una pierna o un brazo), dilo.
- Español de México, de tú, en imperativo ("siéntate", "aprieta", "baja"); nunca voseo. De 5 a 8 pasos de máximo 18 palabras.
- "clave": el error más común a evitar o el punto técnico más importante de ESE ejercicio, en una frase.
- "fuerza": el verbo corto de la parte que vence al peso; "regreso": el de la parte en que el peso vuelve. Son para un cronómetro que siempre muestra primero la fuerza. Ej.: press "Empuja"/"Baja", jalón "Jala"/"Regresa", prensa "Empuja"/"Baja", peso muerto rumano "Sube"/"Baja", talones "Sube"/"Baja", sentadilla "Sube"/"Baja", extensión de tríceps "Extiende"/"Regresa".
- Las sensaciones y la "clave" hablan del músculo que dice "musculo" (en un cruce de poleas es el pecho, no la espalda).
- No cambies series, reps, cargas ni cadencia. Sin consejos médicos.

Ejemplo (press inclinado con mancuernas, 4 × 20, cadencia 3-5-3-0, 10 parciales):
{"id":"ej","pasos":["Banco a 30°, mancuernas a la altura del pecho.","Escápulas atrás y abajo; pecho arriba.","Sube las mancuernas en 3 segundos.","Arriba, sin bloquear los codos, aprieta el pecho 5 segundos.","Baja en 3 segundos hasta un estiramiento cómodo.","Repite 10 veces completas.","Sin descansar, haz 10 parciales cortas en el tramo donde mantienes la tensión."],"clave":"No conviertas las últimas repeticiones en rebotes.","fuerza":"Sube","regreso":"Baja"}

Devuelve SOLO JSON: {"ejercicios": [{"id": string, "pasos": [string], "clave": string, "fuerza": string, "regreso": string}]}`;

// Solo los tramos que existen, numerados y con los verbos del ejercicio
// ("1) Sube en 3 s, 2) aprieta 5 s…"): con el código "3-0-3-5" la IA
// escribía pausas de 0 segundos y en pierna confundía subir con bajar
function describirCadencia(ej: EjercicioGenerado): string | null {
  const t = ej.tempo;
  if (!t) return null;
  const fuerza = ej.verbos?.fuerza ?? "fuerza (vence al peso)";
  const regreso = ej.verbos?.regreso ?? "regreso controlado";
  return [
    `${fuerza} en ${t.concentrico} s`,
    t.contraccion ? `aprieta ${t.contraccion} s en la contracción` : null,
    `${regreso} en ${t.excentrico} s`,
    t.estiramiento ? `mantén ${t.estiramiento} s en el estiramiento` : null
  ]
    .filter(Boolean)
    .map((x, i) => `${i + 1}) ${x}`)
    .join(", ");
}

// Lo que se le pasa a la IA de cada ejercicio (también es su huella para
// guardar la explicación: el mismo ejercicio con la misma prescripción
// no se vuelve a pedir)
// Repeticiones y cadencia explícitas: con las reglas de la fase la IA
// ponía parciales donde no van y contaba "20 completas" en un 10 + 10
export function fichaTecnica(p: Omit<PedidoTecnica, "id">): Record<string, unknown> {
  const { ej } = p;
  const rango = ej.rep_min === ej.rep_max ? `${ej.rep_max}` : `${ej.rep_min} a ${ej.rep_max}`;
  const lado = ej.por_lado ? " por lado" : "";
  const { completas, parciales } = repsDeSerie(ej);
  const base = infoEjercicio(ej.nombre, ej.grupo_muscular);
  return {
    nombre: ej.nombre,
    musculo: ej.grupo_muscular,
    ...(base.especifica ? { referencia: base.descripcion } : {}),
    series: ej.series,
    repeticiones: parciales
      ? `${completas} completas${lado} y, sin descansar, ${parciales} parciales cortas`
      : `${rango}${lado}${ej.al_fallo ? " al fallo" : ""}, sin parciales`,
    ...(describirCadencia(ej) ? { cadencia: describirCadencia(ej) } : {}),
    ...(ej.nota ? { nota: ej.nota } : {}),
    ...(p.companero ? { superserie_con: p.companero } : {})
  };
}

export async function pedirTecnica(lote: PedidoTecnica[]): Promise<Map<string, Tecnica>> {
  const data = await generarJSON<{ ejercicios?: Record<string, unknown>[] }>(
    INSTRUCCIONES_TECNICA,
    JSON.stringify({ ejercicios: lote.map((p) => ({ id: p.id, ...fichaTecnica(p) })) }),
    { temperatura: 0.1, maxTokens: 3500, sinEspera: true }
  );
  const res = new Map<string, Tecnica>();
  for (const e of Array.isArray(data?.ejercicios) ? data.ejercicios : []) {
    const id = String(e?.id ?? "");
    const pasos = Array.isArray(e?.pasos) ? e.pasos.map((x) => String(x).trim()).filter(Boolean).slice(0, 10) : [];
    if (!id || pasos.length < 2) continue;
    res.set(id, {
      pasos,
      clave: String(e.clave ?? "").trim().slice(0, 220),
      fuerza: String(e.fuerza ?? "").trim().slice(0, 20),
      regreso: String(e.regreso ?? "").trim().slice(0, 20)
    });
  }
  if (!res.size) throw new ErrorIA("La IA no devolvió las explicaciones.");
  return res;
}

// ── Tandas (las usa rutina-tecnica.ts; aquí, sin base, para poder probarlas) ──

const POR_TANDA = 12;
const conPasos = (e: EjercicioGenerado) => (e.pasos?.length ?? 0) > 0;

export function avanceTecnica(plan: PlanGenerado): { hechos: number; total: number } {
  const todos = plan.dias.flatMap((d) => d.ejercicios);
  return { hechos: todos.filter(conPasos).length, total: todos.length };
}

// Lo que falta del primer día con ejercicios sin explicar
export function siguienteTanda(plan: PlanGenerado): PedidoTecnica[] {
  for (const d of plan.dias) {
    const faltan = d.ejercicios.map((ej, i) => ({ ej, i })).filter(({ ej }) => !conPasos(ej));
    if (!faltan.length) continue;
    return faltan.slice(0, POR_TANDA).map(({ ej, i }) => {
      const semana = ej.semana_desde ?? 1;
      const misma = d.ejercicios.filter((o) => activoEnSemana(o, semana));
      const grupo = grupoSuperserie(misma, misma.indexOf(ej)).map((k) => misma[k]).filter((o) => o !== ej);
      return {
        id: `${d.dia_semana}:${i}`,
        ej,
        fase: faseDeSemana(plan.fases, semana)?.fase ?? null,
        companero: grupo.map((o) => o.nombre).join(" y ") || null
      };
    });
  }
  return [];
}

export const claveTecnica = (p: PedidoTecnica) => claveTexto(`tecnica:${VERSION_TECNICA}`, JSON.stringify(fichaTecnica(p)));

const sinTecnicismos = (x: string) =>
  x
    .replace(/\s*\(fuerza\)/gi, "")
    .replace(/(en|de|durante) la fase (concéntrica|excéntrica)/gi, (_m, p, fase) => (fase.toLowerCase().startsWith("c") ? `${p} la subida` : `${p} la bajada`));

export function aplicarTecnica(plan: PlanGenerado, id: string, t: Tecnica): void {
  const [dia, i] = id.split(":").map(Number);
  const ej = plan.dias.find((d) => d.dia_semana === dia)?.ejercicios[i];
  if (!ej) return;
  // Las parciales siempre con las mismas palabras (y solo si el plan las tiene)
  const pasos = t.pasos.filter((p) => !/parcial/i.test(p)).map(sinTecnicismos);
  if (ej.parciales) pasos.push(`Sin descansar, haz ${ej.parciales} parciales cortas en el tramo donde mantienes la tensión.`);
  ej.pasos = pasos;
  if (t.clave) ej.clave = sinTecnicismos(t.clave);
  // Los verbos de la base de técnica mandan; los de la IA, solo si no hay
  if (!ej.verbos && t.fuerza && t.regreso) {
    // En pierna la fuerza nunca es bajar: si vinieron al revés, se invierten
    const alReves = ej.grupo_muscular === "pierna" && /^(baja|desciende|bajar|descender)$/i.test(t.fuerza);
    ej.verbos = alReves ? { fuerza: t.regreso, regreso: t.fuerza } : { fuerza: t.fuerza, regreso: t.regreso };
  }
}

