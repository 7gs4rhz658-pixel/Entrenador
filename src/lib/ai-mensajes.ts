// Borrador de mensaje del entrenador al cliente. La IA propone; el
// entrenador edita y manda con un toque. Contexto: actividad reciente,
// último check-in, adherencia de la semana y estado del pago.

import { ErrorIA, generarJSON } from "./ai";
import type { AdherenciaSemana } from "./stats";
import type { Checkin, Profile } from "./types";

export interface ContextoMensaje {
  perfil: Profile;
  diasSinRegistro: number | null;
  adherencia: AdherenciaSemana;
  ultimoCheckin: Checkin | null;
  checkinPendiente: number | null; // semana sin check-in
  pagoVencido: boolean;
  motivo: "abandono" | "aliento" | "libre";
}

function describir(c: ContextoMensaje): string {
  const p = c.perfil;
  const ck = c.ultimoCheckin;
  return [
    `Cliente: ${p.nombre.split(" ")[0] || "sin nombre"} · objetivo: ${p.objetivo}`,
    c.diasSinRegistro != null ? `Días sin registrar nada (series ni comidas): ${c.diasSinRegistro}` : "Nunca registró nada todavía",
    `Semana en curso: entrenos ${c.adherencia.entrenos_hechos}/${c.adherencia.entrenos_planificados} hasta hoy (${c.adherencia.entrenos_semana} en la semana) · comidas del menú ${c.adherencia.comidas_hechas}/${c.adherencia.comidas_esperadas}`,
    ck?.resumen
      ? `Último check-in (semana ${ck.semana}): entrenos ${ck.resumen.entrenos_hechos}/${ck.resumen.entrenos_planificados}, peso ${ck.peso_kg ?? "?"} kg, energía ${ck.energia ?? "?"}/5, sueño ${ck.sueno ?? "?"}/5, comentario: "${ck.comentario || "—"}"`
      : "Sin check-ins todavía",
    c.checkinPendiente ? `Tiene pendiente el check-in de la semana ${c.checkinPendiente}` : "",
    c.pagoVencido ? "Su mes está vencido (no renovó)" : "",
    `Motivo del mensaje: ${c.motivo === "abandono" ? "hace días que no registra; recuperarlo sin presión" : c.motivo === "aliento" ? "reconocer lo que viene haciendo bien y sostenerlo" : "mensaje general de seguimiento"}`
  ]
    .filter(Boolean)
    .join("\n");
}

export async function redactarMensaje(contexto: ContextoMensaje): Promise<string> {
  const data = await generarJSON<{ texto: string }>(
    `Sos un entrenador personal escribiéndole un mensaje corto y personal a un cliente por la app (como un WhatsApp). Máximo 4 frases. Usá solo los datos que te doy, mencioná algo concreto de su semana, y cerrá con UNA acción simple para hoy o mañana. Cercano, sin culpa, sin sermón, sin emojis, español rioplatense con voseo estricto (registrá, mandame, seguís; nunca "sigue" ni "registra"). Nunca hables como profesional de la salud ni menciones enfermedades, medicación o suplementos. Devolvé SOLO JSON: {"texto": string}.`,
    describir(contexto),
    { temperatura: 0.6, maxTokens: 600 }
  );
  const texto = String(data?.texto ?? "").trim();
  if (!texto) throw new ErrorIA("Borrador vacío.");
  return texto.slice(0, 800);
}
