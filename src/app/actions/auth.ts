"use server";

import { redirect } from "next/navigation";
import { destinoInicial, getSesion } from "@/lib/auth";
import { db } from "@/lib/supabase/server";

type Estado = { error?: string; aviso?: string };

function limpiarEmail(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim().toLowerCase();
}

export async function login(_prev: Estado, formData: FormData): Promise<Estado> {
  const email = limpiarEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Completá correo y contraseña." };

  const { error } = await db().auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "Todavía no confirmaste tu correo. Revisá tu bandeja de entrada." };
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
  if (nombre.length < 2) return { error: "Poné tu nombre." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Revisá el correo." };
  if (password.length < 8) return { error: "La contraseña necesita al menos 8 caracteres." };

  const { data, error } = await db().auth.signUp({
    email,
    password,
    options: { data: { nombre } }
  });
  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Ese correo ya tiene cuenta. Iniciá sesión." };
    }
    return { error: `No se pudo crear la cuenta: ${error.message}` };
  }
  // Con "Confirm email" activado en Supabase no hay sesión hasta confirmar
  if (!data.session) redirect(`/confirmar?email=${encodeURIComponent(email)}`);
  redirect("/cuestionario");
}

export async function logout(): Promise<void> {
  await db().auth.signOut();
  redirect("/login");
}
