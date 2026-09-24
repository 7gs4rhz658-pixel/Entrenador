import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./supabase/server";
import { usuarioDeSesion } from "./supabase/usuario";
import type { Profile } from "./types";

export interface Sesion {
  userId: string;
  email: string;
  perfil: Profile;
}

// Usuario logueado + su perfil, o null. Cacheado por request.
export const getSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = db();
  const user = await usuarioDeSesion(supabase);
  if (!user) return null;

  const { data: perfil, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Base de datos: ${error.message}`);
  if (!perfil) {
    throw new Error(
      "No existe el perfil de este usuario. Ejecutá las migraciones SQL (carpeta supabase/)."
    );
  }
  return { userId: user.id, email: user.email ?? perfil.email, perfil };
});

// A dónde va cada usuario al entrar, según rol y estado del onboarding.
// Se usa para redirigir directo desde el login y evitar cadenas de
// redirecciones (server action → "/" → "/cuestionario").
export function destinoInicial(perfil: Profile): string {
  if (perfil.rol === "entrenador") return "/entrenador";
  if (!perfil.onboarding_completo) return "/cuestionario";
  if (perfil.estado_pago !== "pagado") return "/pago";
  return "/";
}

export async function requireSesion(): Promise<Sesion> {
  const s = await getSesion();
  if (!s) redirect("/login");
  return s;
}

// Cliente con onboarding y pago completos; si falta algo lo manda al
// paso que corresponde. El entrenador nunca pasa por acá.
export async function requireCliente(): Promise<Sesion> {
  const s = await requireSesion();
  if (s.perfil.rol === "entrenador") redirect("/entrenador");
  if (!s.perfil.onboarding_completo) redirect("/cuestionario");
  if (s.perfil.estado_pago !== "pagado") redirect("/pago");
  return s;
}

export async function requireEntrenador(): Promise<Sesion> {
  const s = await requireSesion();
  if (s.perfil.rol !== "entrenador") redirect("/");
  return s;
}

// Para acciones que pueden ejecutarse sobre otro usuario (el entrenador
// editando a un cliente): devuelve el id efectivo o tira error.
export async function resolverUsuario(
  userId: string | null | undefined
): Promise<{ sesion: Sesion; userId: string }> {
  const sesion = await requireSesion();
  if (!userId || userId === sesion.userId) return { sesion, userId: sesion.userId };
  if (sesion.perfil.rol !== "entrenador") {
    throw new Error("No tenés permiso para editar a otro usuario.");
  }
  return { sesion, userId };
}
