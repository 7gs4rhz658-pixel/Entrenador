// Lecturas de la IA guardadas por huella del texto (ver clave-texto.ts):
// si el entrenador vuelve a cargar el mismo plan, recibe exactamente el
// mismo resultado, y no se gasta el límite gratis de la IA.

import { claveTexto } from "./clave-texto";
import { db } from "./supabase/server";

export async function conLectura<T>(
  tipo: "menu" | "protocolo" | "rutina",
  version: string,
  texto: string,
  releer: boolean,
  leer: () => Promise<T>
): Promise<{ resultado: T; guardada: boolean }> {
  const clave = claveTexto(`${tipo}:${version}`, texto);
  if (!releer) {
    const { data } = await db().from("ia_lecturas").select("resultado").eq("clave", clave).maybeSingle();
    if (data) return { resultado: data.resultado as T, guardada: true };
  }
  const resultado = await leer();
  // Si no se puede guardar, igual sirve la lectura recién hecha
  await db().from("ia_lecturas").upsert({ clave, tipo, resultado }, { onConflict: "clave" });
  return { resultado, guardada: false };
}
