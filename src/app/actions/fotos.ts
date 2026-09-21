"use server";

import { revalidatePath } from "next/cache";
import { resolverUsuario } from "@/lib/auth";
import { exec } from "@/lib/data";
import { hoyFecha } from "@/lib/format";
import { db } from "@/lib/supabase/server";
import type { VistaFoto } from "@/lib/types";

type Resultado = { ok?: boolean; error?: string; subidas?: number };

const VISTAS: VistaFoto[] = ["frente", "perfil", "espalda"];

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

// Sube hasta 3 fotos (frente, perfil, espalda) de una fecha al bucket
// privado y las indexa. Reemplaza si ya había una de esa vista ese día.
export async function subirFotos(formData: FormData): Promise<Resultado> {
  const fechaRaw = String(formData.get("fecha") ?? "");
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw) ? fechaRaw : hoyFecha();
  if (fecha > hoyFecha()) return { error: "La fecha no puede ser futura." };
  try {
    const { userId } = await resolverUsuario(String(formData.get("userId") ?? "") || null);
    let subidas = 0;
    for (const vista of VISTAS) {
      const archivo = formData.get(vista);
      if (!(archivo instanceof File) || archivo.size === 0) continue;
      if (archivo.size > 5 * 1024 * 1024) return { error: `La foto de ${vista} pesa más de 5 MB.` };
      if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return { error: `La foto de ${vista} tiene que ser JPG, PNG o WebP.` };
      const path = `${userId}/${fecha}/${vista}.jpg`;
      const { error } = await db().storage.from("fotos").upload(path, archivo, { upsert: true, contentType: archivo.type });
      if (error) throw new Error(`Almacenamiento: ${error.message}`);
      await exec(db().from("fotos_progreso").upsert({ user_id: userId, fecha, vista, path }, { onConflict: "user_id,fecha,vista" }));
      subidas += 1;
    }
    if (!subidas) return { error: "Elegí al menos una foto." };
    revalidatePath("/", "layout");
    return { ok: true, subidas };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

export async function borrarFoto(input: { id: string; path: string }): Promise<Resultado> {
  try {
    await resolverUsuario(null);
    await db().storage.from("fotos").remove([input.path]);
    await exec(db().from("fotos_progreso").delete().eq("id", input.id));
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
