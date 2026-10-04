"use server";

import { revalidatePath } from "next/cache";
import { requireEntrenador } from "@/lib/auth";
import { ErrorIA, generarPlanInicial, iaDisponible } from "@/lib/ai";
import { pedirRutinaTxt, VERSION_RUTINA_TXT } from "@/lib/ai-rutina";
import { exec, getBloque, getPerfil } from "@/lib/data";
import { conLectura } from "@/lib/ia-lecturas";
import { hoyFecha } from "@/lib/format";
import { publicarPlanComidas } from "@/lib/meal-plan-db";
import { nuevoVencimiento } from "@/lib/pagos";
import { enviarPush } from "@/lib/push";
import { normalizarPlan, planPlantilla } from "@/lib/plan-generator";
import {
  actualizarBorradorRutina,
  getBorradorRutina,
  guardarBorradorRutina,
  publicarBorradorRutina
} from "@/lib/plan-import";
import { explicarSiguienteTanda, type AvanceTecnica } from "@/lib/rutina-tecnica";
import { db } from "@/lib/supabase/server";
import type { PlanGenerado } from "@/lib/types";

type Resultado = { ok?: boolean; error?: string };

function mensaje(e: unknown): string {
  return e instanceof ErrorIA || e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

// Texto de un PDF del entrenador (el plan exportado o el dossier):
// se lee en el servidor y vuelve al cuadro de texto para revisarlo.
export async function leerPdf(datos: FormData): Promise<{ texto?: string; error?: string }> {
  try {
    await requireEntrenador();
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File)) return { error: "No llegó el archivo." };
    if (archivo.size > 4_000_000) return { error: "El PDF pesa más de 4 MB." };
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await archivo.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    const texto = String(text ?? "").trim();
    if (texto.length < 20) {
      return { error: "El PDF no tiene texto que se pueda leer (¿es una imagen escaneada?). Copia y pega el texto." };
    }
    return { texto };
  } catch (e) {
    return { error: `No se pudo leer el PDF: ${mensaje(e)}` };
  }
}

// Paso 1 de "subir tu plan": la IA lo lee (fases, días, ejercicios,
// series, cadencias) y vuelve la vista previa. La lectura se guarda por
// texto: el mismo plan da el mismo resultado sin gastar la IA.
export async function interpretarTxt(input: {
  userId: string;
  texto: string;
  releer?: boolean;
}): Promise<{ plan?: PlanGenerado; lecturaGuardada?: boolean; error?: string; reintentarEn?: number }> {
  const texto = input.texto.trim();
  if (texto.length < 20) return { error: "El texto es demasiado corto para ser un plan." };
  if (!iaDisponible()) {
    return { error: "Leer tu plan necesita la IA configurada (GROQ_API_KEY o GEMINI_API_KEY)." };
  }
  try {
    await requireEntrenador();
    const perfil = await getPerfil(input.userId);
    const { resultado, guardada } = await conLectura("rutina", VERSION_RUTINA_TXT, texto, !!input.releer, () =>
      pedirRutinaTxt(texto, perfil)
    );
    // El plan del entrenador manda: sin la progresión ondulada automática
    const plan = { ...normalizarPlan(resultado, perfil.cuestionario?.dias_disponibles, { desdeTexto: true, fuente: texto }), progresion: "plan" as const };
    return { plan, lecturaGuardada: guardada };
  } catch (e) {
    if (e instanceof ErrorIA && e.reintentarEn) return { reintentarEn: e.reintentarEn };
    return { error: mensaje(e) };
  }
}

// Paso 2: la vista previa queda como borrador. El cliente sigue con su
// rutina hasta que el entrenador la envía.
export async function aplicarPlanCliente(input: {
  userId: string;
  plan: PlanGenerado;
  origen: "txt" | "ia" | "plantilla";
}): Promise<Resultado> {
  try {
    await requireEntrenador();
    const perfil = await getPerfil(input.userId);
    const plan = normalizarPlan(input.plan, perfil.cuestionario?.dias_disponibles);
    await guardarBorradorRutina(input.userId, plan, input.origen);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Cambios del entrenador sobre el borrador (editor de la pestaña Rutina)
export async function guardarBorradorRutinaAction(input: { userId: string; plan: PlanGenerado }): Promise<Resultado> {
  try {
    await requireEntrenador();
    const borrador = await getBorradorRutina(input.userId);
    if (!borrador) return { error: "Ya no hay borrador: puede que lo hayas enviado o descartado." };
    const plan = normalizarPlan(input.plan);
    const prefijo = /^Bloque \d+ · /.exec(borrador.nombre)?.[0] ?? "";
    await actualizarBorradorRutina(borrador.id, plan, `${prefijo}${plan.nombre_bloque}`);
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Una tanda de explicaciones paso a paso (la pantalla llama hasta terminar)
export async function explicarRutinaAction(input: {
  userId: string;
  releer?: boolean;
}): Promise<AvanceTecnica & { error?: string }> {
  try {
    await requireEntrenador();
    return await explicarSiguienteTanda(input.userId, !!input.releer);
  } catch (e) {
    return { hechos: 0, total: 0, error: mensaje(e) };
  }
}

export async function descartarBorradorRutina(input: { userId: string }): Promise<Resultado> {
  try {
    await requireEntrenador();
    const borrador = await getBorradorRutina(input.userId);
    if (borrador) await exec(db().from("mesocycles").delete().eq("id", borrador.id));
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Propone un plan desde el cuestionario (IA si está, plantilla si no)
// para que el entrenador lo revise antes de aplicarlo como borrador.
export async function previsualizarPlan(input: {
  userId: string;
}): Promise<{ plan?: PlanGenerado; origen?: "ia" | "plantilla"; error?: string }> {
  try {
    await requireEntrenador();
    const perfil = await getPerfil(input.userId);
    if (iaDisponible()) return { plan: await generarPlanInicial(perfil), origen: "ia" };
    return { plan: planPlantilla(perfil.cuestionario), origen: "plantilla" };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

// "Enviar al cliente": publica el borrador de rutina, le avisa y le deja
// un mensaje en el hilo.
export async function enviarRutina(input: { userId: string }): Promise<Resultado> {
  try {
    await requireEntrenador();
    const borrador = await publicarBorradorRutina(input.userId);
    if (!borrador) return { error: "No hay una rutina pendiente de enviar." };
    const fases = borrador.plan?.fases ?? borrador.fases;
    const inicio = borrador.plan?.fecha_inicio;
    await exec(
      db().from("mensajes").insert({
        user_id: input.userId,
        de: "entrenador",
        texto: [
          `Tu rutina "${borrador.nombre}" ya está lista.`,
          fases.length > 1
            ? `Va en ${fases.length} fases: empiezas con la fase 1 (${fases[0].nombre}) y la app te avisa cuando cambies de fase.`
            : null,
          inicio && inicio > hoyFecha()
            ? `Empieza el ${new Date(`${inicio}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}.`
            : "Entra a Inicio y empieza con el día de hoy.",
          "En cada ejercicio tienes el paso a paso y la cadencia."
        ]
          .filter(Boolean)
          .join(" ")
      })
    );
    await enviarPush(input.userId, {
      titulo: "Tu rutina está lista",
      cuerpo: "Tu entrenador ya la revisó. Entra y mira tu semana.",
      url: "/",
      tag: "rutina"
    });
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function enviarMenu(input: { userId: string }): Promise<Resultado> {
  try {
    await requireEntrenador();
    const publicado = await publicarPlanComidas(input.userId);
    if (!publicado) return { error: "No hay una recomendación de comidas pendiente de enviar." };
    await exec(
      db().from("mensajes").insert({
        user_id: input.userId,
        de: "entrenador",
        texto: "Tu recomendación de comidas ya está lista: la ves en Comida, con la lista de compras y la guía para cocinar la semana."
      })
    );
    await enviarPush(input.userId, {
      titulo: "Tu menú está listo",
      cuerpo: "Tu entrenador ya lo revisó. Mira qué te toca hoy en Comida.",
      url: "/nutricion",
      tag: "menu"
    });
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// El cobro es manual: el entrenador confirma el pago (o lo renueva) y el
// cliente recibe el aviso con la nueva fecha de vencimiento.
export async function marcarPago(input: {
  userId: string;
  estado: "pendiente" | "pagado";
}): Promise<Resultado> {
  try {
    await requireEntrenador();
    // "Marcar pagado" o "renovar" cubre 30 días desde hoy (o desde el
    // vencimiento vigente si todavía no pasó)
    const perfil = await getPerfil(input.userId);
    if (input.estado === "pendiente") {
      await exec(db().from("profiles").update({ estado_pago: "pendiente" }).eq("id", input.userId));
    } else {
      const vence = nuevoVencimiento(perfil.pago_vence_at, hoyFecha());
      await exec(
        db()
          .from("profiles")
          .update({ estado_pago: "pagado", pagado_at: new Date().toISOString(), pago_vence_at: vence })
          .eq("id", input.userId)
      );
      const fecha = new Date(`${vence}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" });
      const tieneRutina = !!(await getBloque(input.userId, { conBorrador: true }));
      await exec(
        db()
          .from("mensajes")
          .insert({
            user_id: input.userId,
            de: "entrenador",
            texto: tieneRutina
              ? `Confirmé tu pago: tu plan está activo hasta el ${fecha}.`
              : `Confirmé tu pago: tu plan está activo hasta el ${fecha}. Ahora armo tu rutina y tu menú y te aviso cuando estén listos.`
          })
      );
      await enviarPush(input.userId, {
        titulo: "Pago confirmado",
        cuerpo: `Tu plan está activo hasta el ${fecha}.`,
        url: "/",
        tag: "pago"
      });
    }
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function marcarActivo(input: {
  userId: string;
  activo: boolean;
}): Promise<Resultado> {
  try {
    await requireEntrenador();
    await exec(db().from("profiles").update({ activo: input.activo }).eq("id", input.userId));
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
