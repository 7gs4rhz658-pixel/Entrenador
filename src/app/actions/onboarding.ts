"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSesion } from "@/lib/auth";
import { exec, getBloque } from "@/lib/data";
import { hoyFecha } from "@/lib/format";
import { nuevoVencimiento, procesarPago } from "@/lib/pagos";
import { avisarEntrenadores } from "@/lib/push";
import { db } from "@/lib/supabase/server";
import type { Cuestionario, CuestionarioNutricion, Momento, NivelActividad, Objetivo, Sexo } from "@/lib/types";

type Estado = { error?: string };

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

export async function guardarCuestionario(
  _prev: Estado,
  formData: FormData
): Promise<Estado> {
  const sesion = await requireSesion();

  const edad = Number(formData.get("edad"));
  const sexo = String(formData.get("sexo") ?? "") as Sexo;
  const peso = Number(String(formData.get("peso_kg") ?? "").replace(",", "."));
  const altura = Number(String(formData.get("altura_cm") ?? "").replace(",", "."));
  const actividad = String(formData.get("nivel_actividad") ?? "") as NivelActividad;
  const objetivo = String(formData.get("objetivo") ?? "") as Objetivo;
  const experiencia = String(formData.get("experiencia") ?? "") as Cuestionario["experiencia"];
  const dias = formData
    .getAll("dias")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  const minutos = Number(formData.get("minutos_sesion"));
  const equipamiento = String(formData.get("equipamiento") ?? "") as Cuestionario["equipamiento"];
  const lesiones = String(formData.get("lesiones") ?? "").trim().slice(0, 500);
  const preferencias = String(formData.get("preferencias") ?? "").trim().slice(0, 500);

  if (!Number.isFinite(edad) || edad < 14 || edad > 90) return { error: "Revisá la edad (entre 14 y 90)." };
  if (sexo !== "masculino" && sexo !== "femenino") return { error: "Elegí el sexo." };
  if (!Number.isFinite(peso) || peso < 30 || peso > 300) return { error: "Revisá el peso corporal (en kg)." };
  if (!Number.isFinite(altura) || altura < 120 || altura > 230) return { error: "Revisá la altura (en cm)." };
  if (!["sedentario", "ligero", "moderado", "alto"].includes(actividad)) return { error: "Elegí el nivel de actividad." };
  if (!["deficit", "mantenimiento", "superavit"].includes(objetivo)) return { error: "Elegí tu objetivo." };
  if (!["principiante", "intermedio", "avanzado"].includes(experiencia)) return { error: "Elegí tu experiencia." };
  if (dias.length < 1) return { error: "Marcá al menos un día para entrenar." };
  if (![30, 45, 60, 90].includes(minutos)) return { error: "Elegí cuánto tiempo tenés por sesión." };
  if (!["gimnasio", "casa_basico", "sin_equipo"].includes(equipamiento)) return { error: "Elegí con qué equipamiento contás." };

  const cuestionario: Cuestionario = {
    experiencia,
    dias_disponibles: dias.sort((a, b) => a - b),
    minutos_sesion: minutos,
    equipamiento,
    lesiones,
    preferencias
  };

  try {
    await exec(
      db()
        .from("profiles")
        .update({
          edad,
          sexo,
          peso_kg: peso,
          altura_cm: altura,
          nivel_actividad: actividad,
          objetivo,
          cuestionario
        })
        .eq("id", sesion.userId)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  redirect("/cuestionario/comida");
}

// Paso 2 del onboarding: cómo come el cliente + aceptación del descargo.
// Recién acá se cierra el onboarding.
const MOMENTOS: Momento[] = ["desayuno", "almuerzo", "merienda", "cena", "snack"];

export async function guardarCuestionarioNutricion(
  _prev: Estado,
  formData: FormData
): Promise<Estado> {
  const sesion = await requireSesion();
  if (!sesion.perfil.cuestionario) redirect("/cuestionario");

  const comidas = MOMENTOS.filter((m) => formData.get(`comida_${m}`) === "on").map((m) => ({
    momento: m,
    hora: String(formData.get(`hora_${m}`) ?? "").trim().slice(0, 5)
  }));
  const cocina = String(formData.get("cocina") ?? "") as CuestionarioNutricion["cocina"];
  const presupuesto = String(formData.get("presupuesto") ?? "") as CuestionarioNutricion["presupuesto"];
  const diaBatchRaw = Number(formData.get("dia_batch"));
  const batch = formData.get("batch_cooking") === "on";
  const acepto = formData.get("acepto") === "on";

  if (comidas.length < 3 || comidas.length > 6) return { error: "Elegí entre 3 y 6 comidas por día." };
  if (!["cocino", "mixto", "como_fuera"].includes(cocina)) return { error: "Contanos si cocinás o comés fuera." };
  if (!["bajo", "medio", "alto"].includes(presupuesto)) return { error: "Elegí tu presupuesto." };
  if (!acepto) return { error: "Para ver las recomendaciones de comida tenés que aceptar el aviso." };

  const cn: CuestionarioNutricion = {
    comidas: comidas.sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99")),
    hora_entreno: String(formData.get("hora_entreno") ?? "").trim().slice(0, 5),
    alergias: String(formData.get("alergias") ?? "").trim().slice(0, 300),
    no_come: String(formData.get("no_come") ?? "").trim().slice(0, 300),
    cocina,
    batch_cooking: batch,
    dia_batch: !batch ? null : Number.isInteger(diaBatchRaw) && diaBatchRaw >= 1 && diaBatchRaw <= 7 ? diaBatchRaw : 7,
    presupuesto,
    pais: String(formData.get("pais") ?? "").trim().slice(0, 40)
  };

  try {
    await exec(
      db()
        .from("profiles")
        .update({
          cuestionario_nutricion: cn,
          acepto_descargo_at: sesion.perfil.acepto_descargo_at ?? new Date().toISOString(),
          onboarding_completo: true
        })
        .eq("id", sesion.userId)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  revalidatePath("/", "layout");
  redirect(sesion.perfil.estado_pago === "pagado" ? "/" : "/pago");
}

// Checkout (simulado). Marca el mes pagado y avisa al entrenador; la
// rutina y el menú los arma él desde su panel y los envía cuando los
// revisó. Renovar solo extiende el vencimiento.
export async function pagar(_prev: Estado, formData: FormData): Promise<Estado> {
  const sesion = await requireSesion();
  if (!sesion.perfil.onboarding_completo) redirect("/cuestionario");

  const r = await procesarPago({
    titular: String(formData.get("titular") ?? ""),
    numero: String(formData.get("numero") ?? ""),
    vencimiento: String(formData.get("vencimiento") ?? ""),
    cvv: String(formData.get("cvv") ?? "")
  });
  if (!r.ok) return { error: r.error };

  // Renovación: ya tiene rutina, solo se extiende el mes
  const renovacion = !!(await getBloque(sesion.userId, { conBorrador: true }));
  try {
    await exec(
      db()
        .from("profiles")
        .update({
          estado_pago: "pagado",
          pagado_at: new Date().toISOString(),
          pago_vence_at: nuevoVencimiento(sesion.perfil.pago_vence_at, hoyFecha())
        })
        .eq("id", sesion.userId)
    );
  } catch (e) {
    return { error: mensaje(e) };
  }
  if (renovacion) {
    revalidatePath("/", "layout");
    redirect("/?renovado=1");
  }

  // Alta nueva: la rutina y el menú los arma y revisa el entrenador desde
  // su panel; acá solo le avisamos que tiene un cliente nuevo.
  try {
    await avisarEntrenadores({
      titulo: "Cliente nuevo para armar",
      cuerpo: `${sesion.perfil.nombre || sesion.email} ya pagó: armale la rutina y el menú desde su ficha.`,
      url: "/entrenador",
      tag: "nuevo-cliente"
    });
  } catch (e) {
    console.error("Aviso al entrenador falló:", mensaje(e));
  }
  revalidatePath("/", "layout");
  redirect("/?bienvenida=1");
}
