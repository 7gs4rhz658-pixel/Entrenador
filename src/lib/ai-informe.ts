// Informe semanal: la IA redacta un borrador corto y personal a partir
// del check-in y de los números reales de la semana. El entrenador lo
// aprueba o lo edita antes de que lo vea el cliente, y sale de su parte.

import { ErrorIA, generarJSON } from "./ai";
import type { Checkin, Informe, ResumenSemana } from "./types";

const ETIQUETA_1A5 = ["", "muy baja", "baja", "normal", "buena", "muy buena"];

function describirSemana(nombre: string, objetivo: string, c: Checkin, r: ResumenSemana): string {
  const pesoLinea =
    r.peso_actual_kg != null && r.peso_anterior_kg != null
      ? `Peso: ${r.peso_anterior_kg} kg → ${r.peso_actual_kg} kg (${(r.peso_actual_kg - r.peso_anterior_kg >= 0 ? "+" : "") + (r.peso_actual_kg - r.peso_anterior_kg).toFixed(1)} kg)`
      : r.peso_actual_kg != null
        ? `Peso: ${r.peso_actual_kg} kg`
        : "Peso: no cargó";
  return [
    `Cliente: ${nombre || "sin nombre"} · objetivo: ${objetivo} · semana ${r.semana} del bloque`,
    `Entrenos: ${r.entrenos_hechos} de ${r.entrenos_planificados} · series registradas: ${r.series_registradas}`,
    r.mejoras_carga.length
      ? `Subió carga en: ${r.mejoras_carga.map((m) => `${m.ejercicio} ${m.antes_kg}→${m.ahora_kg} kg`).join(", ")}`
      : "No hubo subidas de carga planificadas esta semana",
    r.comidas_menu_esperadas
      ? `Comidas del menú marcadas: ${r.comidas_menu_hechas} de ${r.comidas_menu_esperadas} · días con registro de comida: ${r.dias_con_registro_comida}/7`
      : `Días con registro de comida: ${r.dias_con_registro_comida}/7 (sin menú recomendado)`,
    r.kcal_promedio != null
      ? `Promedio en días registrados: ${r.kcal_promedio} kcal (referencia ${r.kcal_referencia ?? "?"}) · proteína ${r.prot_promedio} g (referencia ${r.prot_referencia ?? "?"})`
      : "Sin datos de comida suficientes",
    pesoLinea,
    c.cintura_cm != null ? `Cintura: ${c.cintura_cm} cm` : "",
    `Energía: ${ETIQUETA_1A5[c.energia ?? 3]} · sueño: ${ETIQUETA_1A5[c.sueno ?? 3]} · adherencia percibida: ${ETIQUETA_1A5[c.adherencia ?? 3]}`,
    r.consultas_asistente ? `Consultas al asistente de situaciones: ${r.consultas_asistente}` : "",
    c.comentario ? `Comentario del cliente: "${c.comentario}"` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export async function redactarInforme(
  nombre: string,
  objetivo: string,
  checkin: Checkin,
  resumen: ResumenSemana
): Promise<Informe> {
  const data = await generarJSON<Informe>(
    `Sos un entrenador personal escribiéndole a tu cliente el informe de su semana. Usá SOLO los datos que te doy: nada de inventar números ni logros. Reconocé lo concreto que hizo bien (con sus números), señalá con honestidad y sin reto lo que flojeó, y dejá 2 o 3 acciones claras para la semana que viene. Si el peso se mueve en la dirección del objetivo, decilo; si no, explicá que una semana no define nada y qué ajustar. Español rioplatense con voseo (lograste, registrá, sumá, vas a ver; nunca "verás" ni "sigue"), cercano, frases cortas, sin emojis. Nunca hables como profesional de la salud ni menciones enfermedades, medicación o suplementos. Devolvé SOLO JSON con esta forma exacta:
{
  "titulo": string (ej. "Semana 3: subiste peso en todo"),
  "resumen": string (2-3 frases, lo más importante de la semana),
  "logros": [string] (1 a 3, concretos y con números),
  "a_mejorar": [string] (0 a 2, sin reproche),
  "foco": [string] (2 a 3 acciones para la semana que viene),
  "mensaje": string (1 frase de cierre, personal)
}`,
    describirSemana(nombre, objetivo, checkin, resumen),
    { temperatura: 0.5, maxTokens: 1500 }
  );
  if (!data || typeof data !== "object" || !data.resumen) throw new ErrorIA("Informe inválido.");
  const lista = (x: unknown, max: number) =>
    (Array.isArray(x) ? x : []).map((s) => String(s).trim()).filter(Boolean).slice(0, max);
  return {
    titulo: String(data.titulo ?? "").trim().slice(0, 80) || `Semana ${resumen.semana}`,
    resumen: String(data.resumen).trim().slice(0, 600),
    logros: lista(data.logros, 3),
    a_mejorar: lista(data.a_mejorar, 2),
    foco: lista(data.foco, 3),
    mensaje: String(data.mensaje ?? "").trim().slice(0, 200)
  };
}

// Texto plano del informe, para que el entrenador lo edite o lo mande
export function informeATexto(i: Informe): string {
  return [
    i.titulo,
    "",
    i.resumen,
    "",
    ...(i.logros.length ? ["Lo que lograste:", ...i.logros.map((l) => `• ${l}`), ""] : []),
    ...(i.a_mejorar.length ? ["Para afinar:", ...i.a_mejorar.map((l) => `• ${l}`), ""] : []),
    ...(i.foco.length ? ["Foco de la semana que viene:", ...i.foco.map((l) => `• ${l}`), ""] : []),
    i.mensaje
  ].join("\n");
}
