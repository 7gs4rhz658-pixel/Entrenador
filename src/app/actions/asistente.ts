"use server";

import { revalidatePath } from "next/cache";
import { ErrorIA, iaDisponible } from "@/lib/ai";
import { resolverSituacion, type ContextoAsistente } from "@/lib/ai-asistente";
import { resolverUsuario } from "@/lib/auth";
import { exec, getComidas, getDias, getPerfil } from "@/lib/data";
import { diaSemanaDe, horaLocal } from "@/lib/format";
import { recomendacionPara } from "@/lib/meal-plan-db";
import { ETIQUETAS_OBJETIVO, macrosDe, objetivosCliente, sumarMacros } from "@/lib/nutrition";
import { db } from "@/lib/supabase/server";
import type { AsistenteLog, Momento, RespuestaAsistente } from "@/lib/types";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof ErrorIA || e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

// Arma el contexto real del día (referencia, consumido, menú, alergias)
// y consulta a la IA. Guarda la consulta para el historial del entrenador.
export async function consultarAsistente(input: {
  userId?: string;
  fecha: string;
  pregunta: string;
}): Promise<{ log?: AsistenteLog; error?: string }> {
  const pregunta = input.pregunta.trim();
  if (pregunta.length < 5) return { error: "Contame un poco más qué pasa hoy." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return { error: "Fecha inválida." };
  if (!iaDisponible()) return { error: "El asistente necesita la IA configurada (GROQ_API_KEY)." };
  try {
    const { userId } = await resolverUsuario(input.userId);
    const [perfil, comidas, dias] = await Promise.all([
      getPerfil(userId),
      getComidas(userId, input.fecha),
      getDias(userId)
    ]);
    const diaSemana = diaSemanaDe(input.fecha);
    const esEntreno = dias.some((d) => d.dia_semana === diaSemana && !d.es_descanso);
    const tipoDia = esEntreno ? "entreno" : "descanso";
    const referencia = objetivosCliente(perfil, esEntreno);
    const consumido = sumarMacros(comidas.map((c) => macrosDe(c.ingredient, c.cantidad_g)));
    const reco = await recomendacionPara(userId, tipoDia, perfil.cuestionario_nutricion);
    const hechos = new Set(comidas.map((c) => c.plan_item_id).filter(Boolean));
    const comidasHechas: Momento[] = (reco?.comidas ?? [])
      .filter((c) => c.items.every((i) => hechos.has(i.id)))
      .map((c) => c.momento);

    const contexto: ContextoAsistente = {
      nombre: perfil.nombre.split(" ")[0],
      objetivo: ETIQUETAS_OBJETIVO[perfil.objetivo],
      tipoDia,
      hora: horaLocal(),
      referencia,
      consumido,
      restante: referencia
        ? {
            kcal: Math.max(0, referencia.kcal - consumido.kcal),
            prot_g: Math.max(0, referencia.prot_g - consumido.prot_g),
            carb_g: Math.max(0, referencia.carb_g - consumido.carb_g),
            grasa_g: Math.max(0, referencia.grasa_g - consumido.grasa_g)
          }
        : null,
      menuHoy: reco?.comidas ?? [],
      comidasHechas,
      cn: perfil.cuestionario_nutricion
    };

    const respuesta: RespuestaAsistente = await resolverSituacion(contexto, pregunta);
    const { data, error } = await db()
      .from("asistente_logs")
      .insert({ user_id: userId, fecha: input.fecha, pregunta: pregunta.slice(0, 600), tipo: respuesta.tipo, respuesta })
      .select("*")
      .single();
    if (error || !data) throw new Error(`Base de datos: ${error?.message ?? "no se guardó la consulta"}`);
    return { log: data as AsistenteLog };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

// El cliente elige esta respuesta como "ajuste de hoy": aparece junto al
// menú del día. Solo una por día queda aplicada.
export async function aplicarAjuste(input: { logId: string; aplicado: boolean }): Promise<Resultado> {
  try {
    const { userId } = await resolverUsuario(null);
    if (input.aplicado) {
      const hoy = await db().from("asistente_logs").select("fecha").eq("id", input.logId).maybeSingle();
      if (hoy.data?.fecha) {
        await exec(db().from("asistente_logs").update({ aplicado: false }).eq("user_id", userId).eq("fecha", hoy.data.fecha));
      }
    }
    await exec(db().from("asistente_logs").update({ aplicado: input.aplicado }).eq("id", input.logId));
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
