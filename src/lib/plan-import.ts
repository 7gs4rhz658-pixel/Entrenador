// Escribe un plan generado (ver plan-generator.ts) en la base: días,
// ejercicios y el plan de la semana 1.

import { db } from "./supabase/server";
import { contarBloques, exec, getBloque } from "./data";
import type { PlanGenerado } from "./types";

// ── Escritura en la base ────────────────────────────────────────

// Reemplaza por completo la rutina del usuario: finaliza el bloque
// activo, da de baja los ejercicios viejos (se conserva el historial),
// deja los 7 días configurados y crea un bloque nuevo con la semana 1.
export async function aplicarPlan(
  userId: string,
  plan: PlanGenerado,
  origen: "ia" | "txt" | "plantilla",
  opciones: { publicado?: boolean } = {}
): Promise<{ mesocycleId: string }> {
  const supabase = db();
  // Por defecto queda como borrador: el cliente lo ve cuando el
  // entrenador lo envía.
  const publicado = opciones.publicado ?? false;

  const anterior = await getBloque(userId, { conBorrador: true });
  if (anterior && anterior.estado === "activo") {
    await exec(
      supabase.from("mesocycles").update({ estado: "finalizado" }).eq("id", anterior.id)
    );
  }
  await exec(
    supabase.from("exercises").update({ activo: false }).eq("user_id", userId).eq("activo", true)
  );

  // Los 7 días existen siempre; los del plan quedan como entreno
  const porDia = new Map(plan.dias.map((d) => [d.dia_semana, d]));
  const filasDias = Array.from({ length: 7 }, (_, i) => {
    const d = porDia.get(i + 1);
    return {
      user_id: userId,
      dia_semana: i + 1,
      nombre: d?.nombre ?? null,
      es_descanso: !d
    };
  });
  const dias = await (async () => {
    const { data, error } = await supabase
      .from("training_days")
      .upsert(filasDias, { onConflict: "user_id,dia_semana" })
      .select("id, dia_semana");
    if (error || !data) throw new Error(`Base de datos: ${error?.message ?? "sin días"}`);
    return data as { id: string; dia_semana: number }[];
  })();
  const idDia = new Map(dias.map((d) => [d.dia_semana, d.id]));

  const n = await contarBloques(userId);
  const { data: nuevo, error: eMeso } = await supabase
    .from("mesocycles")
    .insert({
      user_id: userId,
      nombre: n === 0 ? plan.nombre_bloque : `Bloque ${n + 1} · ${plan.nombre_bloque}`,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      total_semanas: 8,
      origen,
      publicado,
      publicado_at: publicado ? new Date().toISOString() : null
    })
    .select("id")
    .single();
  if (eMeso || !nuevo) {
    throw new Error(`Base de datos: ${eMeso?.message ?? "no se pudo crear el bloque"}`);
  }
  const mesocycleId = nuevo.id as string;

  const filasEj = plan.dias.flatMap((d) =>
    d.ejercicios.map((e, i) => ({
      user_id: userId,
      training_day_id: idDia.get(d.dia_semana)!,
      nombre: e.nombre,
      grupo_muscular: e.grupo_muscular,
      descripcion: e.descripcion ?? null,
      tips: e.tips ?? [],
      tipo: e.progresion === "compuesto" ? "compuesto" : "aislamiento",
      progresion: e.progresion,
      unidad: e.unidad,
      incremento_kg: e.incremento_kg,
      rep_min: e.rep_min,
      rep_max: e.rep_max,
      descanso_seg: e.descanso_seg,
      orden: i + 1
    }))
  );
  const { data: ejercicios, error: eEj } = await supabase
    .from("exercises")
    .insert(filasEj)
    .select("id, nombre, training_day_id, orden");
  if (eEj || !ejercicios) {
    throw new Error(`Base de datos: ${eEj?.message ?? "no se pudieron crear los ejercicios"}`);
  }

  // Plan de la semana 1: piso del rango de reps al peso inicial
  const porClave = new Map(
    (ejercicios as { id: string; training_day_id: string; orden: number }[]).map((e) => [
      `${e.training_day_id}:${e.orden}`,
      e.id
    ])
  );
  const filasPlan = plan.dias.flatMap((d) =>
    d.ejercicios.map((e, i) => {
      const alFallo = e.progresion === "al_fallo";
      return {
        user_id: userId,
        mesocycle_id: mesocycleId,
        exercise_id: porClave.get(`${idDia.get(d.dia_semana)}:${i + 1}`)!,
        semana: 1,
        series: e.series,
        reps: alFallo ? null : e.rep_min,
        peso_kg: e.unidad === "kg" ? e.peso_inicial_kg : null,
        al_fallo: alFallo,
        rir_objetivo: alFallo ? null : 2,
        nota_ia: null
      };
    })
  );
  await exec(supabase.from("planned_sets").insert(filasPlan));

  return { mesocycleId };
}
