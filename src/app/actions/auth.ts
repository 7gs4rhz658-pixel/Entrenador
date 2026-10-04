"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destinoInicial, getSesion, requireSesion } from "@/lib/auth";
import { exec } from "@/lib/data";
import { db } from "@/lib/supabase/server";

type Estado = { error?: string; aviso?: string };

function limpiarEmail(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim().toLowerCase();
}

export async function login(_prev: Estado, formData: FormData): Promise<Estado> {
  const email = limpiarEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Completa correo y contraseña." };

  const { error } = await db().auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "Todavía no confirmas tu correo. Revisa tu bandeja de entrada." };
    }
    return { error: "Correo o contraseña incorrectos." };
  }
  const sesion = await getSesion();
  redirect(sesion ? destinoInicial(sesion.perfil) : "/");
}

export async function registro(_prev: Estado, formData: FormData): Promise<Estado> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = limpiarEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const referido = String(formData.get("referido") ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
  if (nombre.length < 2) return { error: "Escribe tu nombre." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Revisa el correo." };
  if (password.length < 8) return { error: "La contraseña necesita al menos 8 caracteres." };
  // Datos de salud (peso, medidas, fotos, lesiones): consentimiento expreso
  if (formData.get("privacidad") !== "on") {
    return { error: "Para crear tu cuenta acepta el aviso de privacidad." };
  }

  const { data, error } = await db().auth.signUp({
    email,
    password,
    // El trigger de alta enlaza al referente si el código existe
    options: { data: { nombre, referido: referido || null } }
  });
  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Ese correo ya tiene cuenta. Inicia sesión." };
    }
    return { error: `No se pudo crear la cuenta: ${error.message}` };
  }
  // Con "Confirm email" activado en Supabase no hay sesión hasta confirmar
  // (la aceptación se pide de nuevo dentro de la app)
  if (!data.session || !data.user) redirect(`/confirmar?email=${encodeURIComponent(email)}`);
  await exec(db().from("profiles").update({ acepto_privacidad_at: new Date().toISOString() }).eq("id", data.user.id));
  redirect("/cuestionario");
}

export async function logout(): Promise<void> {
  await db().auth.signOut();
  redirect("/login");
}

// Contraseña nueva: obligatoria después de una temporal del entrenador y
// opcional desde Perfil. No necesita correo: usa la sesión abierta.
export async function cambiarClave(_prev: Estado, formData: FormData): Promise<Estado> {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  const nueva = String(formData.get("nueva") ?? "");
  const repetir = String(formData.get("repetir") ?? "");
  if (nueva.length < 8) return { error: "La contraseña necesita al menos 8 caracteres." };
  if (nueva !== repetir) return { error: "Las dos contraseñas no coinciden." };

  const { error } = await db().auth.updateUser({ password: nueva });
  if (error) {
    if (error.code === "same_password") return { error: "La contraseña nueva tiene que ser distinta a la actual." };
    if (error.code === "weak_password") {
      return { error: "Esa contraseña es muy débil o apareció en filtraciones de otras páginas. Elige otra." };
    }
    if (error.code === "reauthentication_needed") {
      return { error: "Por seguridad, cierra sesión, vuelve a entrar y cámbiala enseguida." };
    }
    return { error: `No se pudo cambiar la contraseña: ${error.message}` };
  }
  if (sesion.perfil.debe_cambiar_clave) {
    await exec(db().from("profiles").update({ debe_cambiar_clave: false }).eq("id", sesion.userId));
  }
  revalidatePath("/", "layout");
  redirect(destinoInicial({ ...sesion.perfil, debe_cambiar_clave: false }));
}

// Clientes que ya tenían cuenta antes del aviso de privacidad
export async function aceptarPrivacidad(): Promise<{ ok?: boolean; error?: string }> {
  const { userId } = await requireSesion();
  try {
    await exec(db().from("profiles").update({ acepto_privacidad_at: new Date().toISOString() }).eq("id", userId));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ocurrió un error inesperado." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
