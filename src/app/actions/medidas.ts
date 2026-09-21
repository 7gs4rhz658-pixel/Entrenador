"use server";

import { revalidatePath } from "next/cache";
import { resolverUsuario } from "@/lib/auth";
import { exec } from "@/lib/data";
import { hoyFecha } from "@/lib/format";
import { db } from "@/lib/supabase/server";
import { CAMPOS_MEDIDA } from "@/lib/types";

type Estado = { error?: string; ok?: boolean };

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

function numero(v: FormDataEntryValue | null, min: number, max: number): number | null | "invalido" {
  const t = String(v ?? "").replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < min || n > max) return "invalido";
  return Math.round(n * 10) / 10;
}

// Guarda (o reemplaza) la toma de medidas de una fecha. Si trae peso,
// también actualiza el perfil para que la referencia diaria siga al día.
export async function guardarMedidas(_prev: Estado, formData: FormData): Promise<Estado> {
  const fechaRaw = String(formData.get("fecha") ?? "");
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw) ? fechaRaw : hoyFecha();
  if (fecha > hoyFecha()) return { error: "La fecha no puede ser futura." };

  const fila: Record<string, number | null | string> = { fecha, notas: String(formData.get("notas") ?? "").trim().slice(0, 300) };
  const peso = numero(formData.get("peso_kg"), 30, 300);
  if (peso === "invalido") return { error: "Revisá el peso (en kg)." };
  fila.peso_kg = peso;
  let cargadas = peso != null ? 1 : 0;
  for (const campo of CAMPOS_MEDIDA) {
    const v = numero(formData.get(campo), 10, 250);
    if (v === "invalido") return { error: `Revisá la medida "${campo.replace(/_/g, " ")}" (en cm).` };
    fila[campo] = v;
    if (v != null) cargadas += 1;
  }
  if (!cargadas) return { error: "Cargá al menos una medida." };

  try {
    const { userId } = await resolverUsuario(String(formData.get("userId") ?? "") || null);
    await exec(db().from("medidas").upsert({ ...fila, user_id: userId }, { onConflict: "user_id,fecha" }));
    if (peso != null && fecha === hoyFecha()) {
      await exec(db().from("profiles").update({ peso_kg: peso }).eq("id", userId));
    }
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarMedidas(input: { id: string }): Promise<Estado> {
  try {
    await resolverUsuario(null);
    await exec(db().from("medidas").delete().eq("id", input.id));
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
