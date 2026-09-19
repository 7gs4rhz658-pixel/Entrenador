"use server";

import { revalidatePath } from "next/cache";
import { requireSesion } from "@/lib/auth";
import { exec } from "@/lib/data";
import { db } from "@/lib/supabase/server";
import type { NivelActividad, Objetivo, Sexo } from "@/lib/types";

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

export async function guardarPerfil(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const sesion = await requireSesion();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const edad = Number(formData.get("edad"));
  const sexo = String(formData.get("sexo") ?? "") as Sexo;
  const peso = Number(String(formData.get("peso_kg") ?? "").replace(",", "."));
  const altura = Number(String(formData.get("altura_cm") ?? "").replace(",", "."));
  const actividad = String(formData.get("nivel_actividad") ?? "") as NivelActividad;
  const objetivo = String(formData.get("objetivo") ?? "") as Objetivo;

  if (nombre.length < 2) return { error: "Poné tu nombre." };
  if (!Number.isFinite(edad) || edad < 14 || edad > 90)
    return { error: "Revisá la edad (entre 14 y 90)." };
  if (sexo !== "masculino" && sexo !== "femenino")
    return { error: "Elegí el sexo." };
  if (!Number.isFinite(peso) || peso < 30 || peso > 300)
    return { error: "Revisá el peso corporal (en kg)." };
  if (!Number.isFinite(altura) || altura < 120 || altura > 230)
    return { error: "Revisá la altura (en cm)." };
  if (!["sedentario", "ligero", "moderado", "alto"].includes(actividad))
    return { error: "Elegí el nivel de actividad." };
  if (!["deficit", "mantenimiento", "superavit"].includes(objetivo))
    return { error: "Elegí tu objetivo." };

  try {
    await exec(
      db()
        .from("profiles")
        .update({
          nombre,
          edad,
          sexo,
          peso_kg: peso,
          altura_cm: altura,
          nivel_actividad: actividad,
          objetivo
        })
        .eq("id", sesion.userId)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
