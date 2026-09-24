"use server";

import { revalidatePath } from "next/cache";
import { resolverUsuario } from "@/lib/auth";
import { exec } from "@/lib/data";
import { hoyFecha, sumarDias } from "@/lib/format";
import { db } from "@/lib/supabase/server";

type Resultado = { ok?: boolean; error?: string };

// Casillas del checklist que no tienen otro registro: el agua y los ítems
// del protocolo. Las comidas se marcan con marcarComida y el entreno se
// da por hecho al registrar series.
const CLAVE = /^(agua|p:[0-9a-f-]{36})$/;

export async function marcarItemHoy(input: {
  userId?: string;
  fecha: string;
  key: string;
  hecho: boolean;
}): Promise<Resultado> {
  const hoy = hoyFecha();
  // Hoy o ayer (si se olvidó de marcar a la noche)
  if (input.fecha !== hoy && input.fecha !== sumarDias(hoy, -1)) return { error: "Solo puedes marcar hoy o ayer." };
  if (!CLAVE.test(input.key)) return { error: "Casilla inválida." };
  // Fuera del try: si la sesión no es válida, que redirija
  const { userId } = await resolverUsuario(input.userId);
  try {
    if (input.hecho) {
      await exec(
        db()
          .from("checklist_dia")
          .upsert(
            { user_id: userId, fecha: input.fecha, item_key: input.key },
            { onConflict: "user_id,fecha,item_key", ignoreDuplicates: true }
          )
      );
    } else {
      await exec(
        db()
          .from("checklist_dia")
          .delete()
          .eq("user_id", userId)
          .eq("fecha", input.fecha)
          .eq("item_key", input.key)
      );
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ocurrió un error inesperado." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
