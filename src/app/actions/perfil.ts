"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSesion } from "@/lib/auth";
import { exec, q } from "@/lib/data";
import { avisarEntrenadores } from "@/lib/push";
import { adminDisponible, conAdmin, db } from "@/lib/supabase/server";
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

// "Eliminar mi cuenta" (derecho de cancelación): borra las fotos del
// almacenamiento y el usuario de Auth; todas sus filas caen en cascada.
// Necesita la clave service_role (solo vive en el servidor).
export async function eliminarCuenta(input: { confirmacion: string }): Promise<{ error?: string }> {
  const sesion = await requireSesion();
  if (sesion.perfil.rol === "entrenador") return { error: "La cuenta del entrenador no se elimina desde la app." };
  if (input.confirmacion.trim().toUpperCase() !== "ELIMINAR") return { error: "Escribe ELIMINAR para confirmar." };
  if (!adminDisponible()) {
    return { error: "Falta configurar la clave de servicio en el servidor. Pídele a tu entrenador que elimine tu cuenta." };
  }
  const { userId, perfil, email } = sesion;
  try {
    await conAdmin(async () => {
      const fotos = await q<{ path: string }[]>(db().from("fotos_progreso").select("path").eq("user_id", userId));
      if (fotos.length) {
        const { error } = await db().storage.from("fotos").remove(fotos.map((f) => f.path));
        if (error) throw new Error(`Fotos: ${error.message}`);
      }
      const { error } = await db().auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    });
  } catch (e) {
    return { error: `No se pudo eliminar la cuenta: ${mensaje(e)}` };
  }
  try {
    await avisarEntrenadores({
      titulo: "Un cliente eliminó su cuenta",
      cuerpo: `${perfil.nombre || email} eliminó su cuenta y sus datos.`,
      url: "/entrenador",
      tag: "baja"
    });
  } catch (e) {
    console.error("Aviso al entrenador falló:", mensaje(e));
  }
  await db().auth.signOut();
  redirect("/login");
}
