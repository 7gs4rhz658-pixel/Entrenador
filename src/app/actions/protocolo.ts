"use server";

import { revalidatePath } from "next/cache";
import { ErrorIA, iaDisponible } from "@/lib/ai";
import {
  VERSION_PROTOCOLO_TXT,
  pedirProtocoloTxt,
  procesarProtocoloTxt,
  type HorariosTexto,
  type ProtocoloInterpretado
} from "@/lib/ai-protocolo";
import { conLectura } from "@/lib/ia-lecturas";
import { requireEntrenador } from "@/lib/auth";
import { exec, getPerfil, getProtocolo } from "@/lib/data";
import { hoyFecha } from "@/lib/format";
import { sanearFases, sanearItem, type ItemEntrada } from "@/lib/protocolo";
import type { FaseProtocolo } from "@/lib/types";
import {
  actualizarDatosBorrador,
  borrarItemBorrador,
  descartarBorrador,
  guardarItemBorrador,
  moverItemBorrador,
  publicarProtocolo,
  quitarProtocolo,
  reemplazarBorrador
} from "@/lib/protocolo-db";
import { enviarPush } from "@/lib/push";
import { db } from "@/lib/supabase/server";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof ErrorIA || e instanceof Error ? e.message : "Ocurrió un error inesperado.";
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
  fases: FaseProtocolo[];
}): Promise<Resultado> {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(input.fecha_inicio) ? input.fecha_inicio : null;
  const fases = sanearFases(input.fases);
  return correr(() =>
    actualizarDatosBorrador(input.userId, {
      nombre: input.nombre.trim().slice(0, 80) || "Protocolo",
      fuera_protocolo: input.fuera
        .split("\n")
        .map((l) => l.replace(/^[-•*]\s*/, "").trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 20),
      fecha_inicio: fecha,
      fases: fases.length > 1 ? fases : []
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
    const enviado = await getProtocolo(input.userId);
    const inicio = enviado?.inicio ?? hoyFecha();
    const fases = enviado?.protocolo.fases.length ?? 0;
    const cuando =
      inicio > hoyFecha()
        ? ` Empieza el ${new Date(`${inicio}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}`
        : " Ya aparece en tu checklist de Hoy";
    await exec(
      db().from("mensajes").insert({
        user_id: input.userId,
        de: "entrenador",
        texto: `Te dejé tu protocolo (${segmentos}).${cuando}, cada cosa a su hora.${
          fases > 1 ? ` Va en ${fases} fases: la app te muestra en cuál vas y te avisa la víspera de cada cambio.` : ""
        }`
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

// ── Importar el plan escrito por el entrenador ──────────────────

export async function interpretarProtocoloTxtAction(input: {
  userId: string;
  texto: string;
  releer?: boolean; // ignorar la lectura guardada de este texto
}): Promise<{ resultado?: ProtocoloInterpretado; lecturaGuardada?: boolean; error?: string }> {
  await requireEntrenador();
  const texto = input.texto.trim();
  if (texto.length < 20) return { error: "El texto es demasiado corto para ser un plan." };
  if (!iaDisponible()) return { error: "Interpretar el texto necesita la IA configurada (GROQ_API_KEY o GEMINI_API_KEY)." };
  try {
    const perfil = await getPerfil(input.userId);
    // El mismo texto da siempre la misma lectura (queda guardada)
    const { resultado: raw, guardada } = await conLectura("protocolo", VERSION_PROTOCOLO_TXT, texto, !!input.releer, () =>
      pedirProtocoloTxt(texto, perfil)
    );
    const resultado = procesarProtocoloTxt(raw, texto);
    if (!resultado.items.length && !resultado.horarios.comidas.length) {
      return { error: "No encontré suplementos, hábitos ni cuidados en el texto." };
    }
    return { resultado, lecturaGuardada: guardada };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

// Guarda la vista previa (ya revisada) como borrador del protocolo y, si
// el entrenador lo pide, pasa los horarios del texto al cliente.
export async function aplicarProtocoloTxtAction(input: {
  userId: string;
  nombre: string;
  items: Partial<ItemEntrada>[];
  fuera: string[];
  fases: FaseProtocolo[];
  fecha_inicio: string | null; // día 1 del protocolo (y de la fase 1)
  horarios: HorariosTexto | null;
}): Promise<Resultado> {
  const fases = sanearFases(input.fases);
  const fecha = input.fecha_inicio && /^\d{4}-\d{2}-\d{2}$/.test(input.fecha_inicio) ? input.fecha_inicio : null;
  return correr(async () => {
    await reemplazarBorrador(input.userId, {
      nombre: input.nombre.trim().slice(0, 80) || "Protocolo",
      origen: "txt",
      fuera_protocolo: input.fuera.map((f) => f.trim().slice(0, 200)).filter(Boolean).slice(0, 20),
      fases: fases.length > 1 ? fases : [],
      fecha_inicio: fecha,
      items: input.items.map((i) => sanearItem(i))
    });
    if (input.horarios) await aplicarHorarios(input.userId, input.horarios);
  });
}

async function aplicarHorarios(userId: string, h: HorariosTexto): Promise<void> {
  const perfil = await getPerfil(userId);
  const cn = perfil.cuestionario_nutricion;
  if (!cn) return;
  const valida = (x: string | null) => (x && /^\d{2}:\d{2}$/.test(x) ? x : null);
  // El plan del entrenador define las comidas del día (3 a 7); con menos o
  // más, solo se ajustan las horas de las que el cliente ya tiene.
  const comidas =
    h.comidas.length >= 3 && h.comidas.length <= 7
      ? h.comidas.map((c) => ({ momento: c.momento, hora: c.hora }))
      : cn.comidas.map((c) => ({ ...c, hora: h.comidas.find((x) => x.momento === c.momento)?.hora ?? c.hora }));
  await exec(
    db()
      .from("profiles")
      .update({
        cuestionario_nutricion: {
          ...cn,
          comidas,
          hora_entreno: valida(h.entreno) ?? cn.hora_entreno,
          hora_despertar: valida(h.despertar) ?? cn.hora_despertar ?? "",
          hora_dormir: valida(h.dormir) ?? cn.hora_dormir ?? ""
        }
      })
      .eq("id", userId)
  );
}
