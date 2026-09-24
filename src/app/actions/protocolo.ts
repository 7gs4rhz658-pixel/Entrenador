"use server";

import { revalidatePath } from "next/cache";
import { requireEntrenador } from "@/lib/auth";
import { exec } from "@/lib/data";
import { sanearItem, type ItemEntrada } from "@/lib/protocolo";
import {
  actualizarDatosBorrador,
  borrarItemBorrador,
  descartarBorrador,
  guardarItemBorrador,
  moverItemBorrador,
  publicarProtocolo,
  quitarProtocolo
} from "@/lib/protocolo-db";
import { enviarPush } from "@/lib/push";
import { db } from "@/lib/supabase/server";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

// Todas editan el borrador: el cliente no ve nada hasta "Enviar". El
// chequeo de sesión va fuera del try para que su redirect no se muestre
// como error.
async function correr(fn: () => Promise<void>): Promise<Resultado> {
  await requireEntrenador();
  try {
    await fn();
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function guardarItemProtocolo(input: {
  userId: string;
  itemId: string | null;
  item: Partial<ItemEntrada>;
}): Promise<Resultado> {
  return correr(() => guardarItemBorrador(input.userId, input.itemId, sanearItem(input.item)));
}

export async function borrarItemProtocolo(input: { userId: string; itemId: string }): Promise<Resultado> {
  return correr(() => borrarItemBorrador(input.userId, input.itemId));
}

export async function moverItemProtocolo(input: { userId: string; itemId: string; direccion: -1 | 1 }): Promise<Resultado> {
  return correr(() => moverItemBorrador(input.userId, input.itemId, input.direccion === -1 ? -1 : 1));
}

export async function guardarDatosProtocolo(input: {
  userId: string;
  nombre: string;
  fuera: string; // una línea por cosa descartada
  fecha_inicio: string;
}): Promise<Resultado> {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(input.fecha_inicio) ? input.fecha_inicio : null;
  return correr(() =>
    actualizarDatosBorrador(input.userId, {
      nombre: input.nombre.trim().slice(0, 80) || "Protocolo",
      fuera_protocolo: input.fuera
        .split("\n")
        .map((l) => l.replace(/^[-•*]\s*/, "").trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 20),
      fecha_inicio: fecha
    })
  );
}

export async function descartarCambiosProtocolo(input: { userId: string }): Promise<Resultado> {
  return correr(() => descartarBorrador(input.userId));
}

export async function quitarProtocoloCliente(input: { userId: string }): Promise<Resultado> {
  return correr(() => quitarProtocolo(input.userId));
}

// "Enviar al cliente": publica el borrador, le deja un mensaje y le avisa
export async function enviarProtocolo(input: { userId: string }): Promise<Resultado> {
  return correr(async () => {
    const items = await publicarProtocolo(input.userId);
    const segmentos = [...new Set(items.map((i) => i.segmento.toLowerCase()))].join(", ");
    await exec(
      db().from("mensajes").insert({
        user_id: input.userId,
        de: "entrenador",
        texto: `Te dejé tu protocolo (${segmentos}). Ya aparece en tu checklist de Hoy, cada cosa a su hora.`
      })
    );
    await enviarPush(input.userId, {
      titulo: "Tu protocolo está listo",
      cuerpo: "Lo ves en Hoy, ordenado por hora.",
      url: "/",
      tag: "protocolo"
    });
  });
}
