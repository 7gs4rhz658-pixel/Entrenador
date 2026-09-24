// Protocolo del entrenador (suplementos, hábitos, cara, cabello…): el
// cliente ve el publicado; el entrenador edita un borrador que, al
// enviarlo, reemplaza al publicado. Si edita algo ya publicado, el
// borrador nace como copia, así el cliente no ve cambios a medias.

import { exec, getProtocolo, q, type ProtocoloActivo } from "./data";
import { hoyFecha } from "./format";
import { db } from "./supabase/server";
import type { ItemEntrada } from "./protocolo";
import type { Protocolo, ProtocoloItem } from "./types";

// El borrador del cliente; si no hay, lo crea (copiando el publicado)
export async function obtenerBorrador(userId: string): Promise<ProtocoloActivo> {
  const existente = await getProtocolo(userId, { borrador: true });
  if (existente) return existente;
  const publicado = await getProtocolo(userId);
  const nuevo = await q<Protocolo>(
    db()
      .from("protocolos")
      .insert({
        user_id: userId,
        nombre: publicado?.protocolo.nombre ?? "Protocolo",
        origen: publicado?.protocolo.origen ?? "manual",
        publicado: false,
        fecha_inicio: publicado?.protocolo.fecha_inicio ?? null,
        fuera_protocolo: publicado?.protocolo.fuera_protocolo ?? [],
        notas: publicado?.protocolo.notas ?? null
      })
      .select("*")
      .single()
  );
  if (publicado?.items.length) {
    await exec(
      db()
        .from("protocolo_items")
        .insert(publicado.items.map(({ id: _id, protocolo_id: _p, ...resto }) => ({ ...resto, protocolo_id: nuevo.id })))
    );
  }
  const creado = await getProtocolo(userId, { borrador: true });
  if (!creado) throw new Error("No se pudo crear el borrador del protocolo.");
  return creado;
}

// Reemplaza todo el contenido del borrador (lo usa la importación de .txt)
export async function reemplazarBorrador(
  userId: string,
  datos: { nombre: string; origen: "manual" | "txt"; fuera_protocolo: string[]; items: ItemEntrada[] }
): Promise<void> {
  const borrador = await obtenerBorrador(userId);
  await exec(db().from("protocolo_items").delete().eq("protocolo_id", borrador.protocolo.id));
  await exec(
    db()
      .from("protocolos")
      .update({ nombre: datos.nombre, origen: datos.origen, fuera_protocolo: datos.fuera_protocolo })
      .eq("id", borrador.protocolo.id)
  );
  if (datos.items.length) {
    await exec(
      db()
        .from("protocolo_items")
        .insert(datos.items.map((i, n) => ({ ...i, user_id: userId, protocolo_id: borrador.protocolo.id, orden: n + 1 })))
    );
  }
}

// El ítem equivalente dentro del borrador. Si el entrenador estaba viendo
// el publicado, el borrador recién copiado tiene otros ids: se ubica por
// su posición (la copia la conserva).
async function itemDelBorrador(userId: string, itemId: string): Promise<{ borrador: ProtocoloActivo; item: ProtocoloItem }> {
  const borrador = await obtenerBorrador(userId);
  const directo = borrador.items.find((i) => i.id === itemId);
  if (directo) return { borrador, item: directo };
  const publicado = await getProtocolo(userId);
  const original = publicado?.items.find((i) => i.id === itemId);
  const copia = original && borrador.items.find((i) => i.orden === original.orden && i.titulo === original.titulo);
  if (!copia) throw new Error("Ese ítem ya no está en el protocolo. Recarga la página.");
  return { borrador, item: copia };
}

export async function guardarItemBorrador(userId: string, itemId: string | null, entrada: ItemEntrada): Promise<void> {
  if (itemId) {
    const { item } = await itemDelBorrador(userId, itemId);
    await exec(db().from("protocolo_items").update(entrada).eq("id", item.id));
    return;
  }
  const borrador = await obtenerBorrador(userId);
  const orden = borrador.items.reduce((m, i) => Math.max(m, i.orden), 0) + 1;
  await exec(
    db().from("protocolo_items").insert({ ...entrada, user_id: userId, protocolo_id: borrador.protocolo.id, orden })
  );
}

export async function borrarItemBorrador(userId: string, itemId: string): Promise<void> {
  const { item } = await itemDelBorrador(userId, itemId);
  await exec(db().from("protocolo_items").delete().eq("id", item.id));
}

// Sube o baja un ítem dentro de su segmento
export async function moverItemBorrador(userId: string, itemId: string, direccion: -1 | 1): Promise<void> {
  const { borrador, item } = await itemDelBorrador(userId, itemId);
  const mismos = borrador.items.filter((i) => i.segmento === item.segmento).sort((a, b) => a.orden - b.orden);
  const pos = mismos.findIndex((i) => i.id === item.id);
  const otro = mismos[pos + direccion];
  if (!otro) return;
  await exec(db().from("protocolo_items").update({ orden: otro.orden }).eq("id", item.id));
  await exec(db().from("protocolo_items").update({ orden: item.orden }).eq("id", otro.id));
}

export async function actualizarDatosBorrador(
  userId: string,
  datos: { nombre: string; fuera_protocolo: string[]; fecha_inicio: string | null }
): Promise<void> {
  const borrador = await obtenerBorrador(userId);
  await exec(db().from("protocolos").update(datos).eq("id", borrador.protocolo.id));
}

// "Enviar": el borrador pasa a ser lo que ve el cliente
export async function publicarProtocolo(userId: string): Promise<ProtocoloItem[]> {
  const borrador = await getProtocolo(userId, { borrador: true });
  if (!borrador) throw new Error("No hay cambios del protocolo pendientes de enviar.");
  if (!borrador.items.length) throw new Error("El protocolo está vacío: agrega al menos un ítem.");
  await exec(
    db().from("protocolos").update({ activo: false }).eq("user_id", userId).eq("activo", true).eq("publicado", true)
  );
  await exec(
    db()
      .from("protocolos")
      .update({
        publicado: true,
        publicado_at: new Date().toISOString(),
        fecha_inicio: borrador.protocolo.fecha_inicio ?? hoyFecha()
      })
      .eq("id", borrador.protocolo.id)
  );
  return borrador.items;
}

export async function descartarBorrador(userId: string): Promise<void> {
  await exec(
    db().from("protocolos").delete().eq("user_id", userId).eq("activo", true).eq("publicado", false)
  );
}

// El protocolo deja de mostrarse al cliente (queda el historial)
export async function quitarProtocolo(userId: string): Promise<void> {
  await exec(db().from("protocolos").update({ activo: false }).eq("user_id", userId).eq("activo", true));
}
