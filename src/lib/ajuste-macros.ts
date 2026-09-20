// Ajuste quincenal de la referencia calórica según la tendencia real del
// peso (check-ins) y el objetivo. Todo determinista: la app sugiere, el
// entrenador confirma con un clic, y el menú recomendado se re-escala
// con la regla de carbohidratos.

import { db } from "./supabase/server";
import { exec, getCheckins, getPlanComidas } from "./data";
import { cuadrarMacros } from "./meal-plan";
import { objetivosCliente } from "./nutrition";
import type { Checkin, ItemComidaResuelto, MacrosBase, Objetivo, Profile } from "./types";

export interface PropuestaAjuste {
  tendencia_kg_semana: number;
  semanas: number;
  peso_desde: number;
  peso_hasta: number;
  delta_kcal: number; // + sube, - baja
  motivo: string;
}

// Rango de cambio de peso semanal que se considera "en camino" para cada
// objetivo (kg/semana). Fuera de eso se propone mover ±150 kcal.
const RANGO: Record<Objetivo, { min: number; max: number }> = {
  deficit: { min: -0.9, max: -0.25 },
  mantenimiento: { min: -0.25, max: 0.25 },
  superavit: { min: 0.1, max: 0.45 }
};

const DIAS_ENTRE_AJUSTES = 14;

// Pendiente (kg/semana) por mínimos cuadrados sobre los check-ins
function tendencia(checkins: Checkin[]): { kgSemana: number; semanas: number; desde: number; hasta: number } | null {
  const puntos = checkins
    .filter((c) => c.peso_kg != null)
    .map((c) => ({ t: new Date(c.fecha).getTime() / 604_800_000, kg: Number(c.peso_kg) }))
    .sort((a, b) => a.t - b.t);
  if (puntos.length < 2) return null;
  const span = puntos[puntos.length - 1].t - puntos[0].t;
  if (span < 1.5) return null; // menos de ~10 días: todavía no hay tendencia
  const n = puntos.length;
  const mt = puntos.reduce((a, p) => a + p.t, 0) / n;
  const mk = puntos.reduce((a, p) => a + p.kg, 0) / n;
  const num = puntos.reduce((a, p) => a + (p.t - mt) * (p.kg - mk), 0);
  const den = puntos.reduce((a, p) => a + (p.t - mt) ** 2, 0);
  if (!den) return null;
  return { kgSemana: num / den, semanas: span, desde: puntos[0].kg, hasta: puntos[n - 1].kg };
}

export async function propuestaAjuste(perfil: Profile): Promise<PropuestaAjuste | null> {
  if (perfil.ajuste_macros_at) {
    const dias = (Date.now() - new Date(perfil.ajuste_macros_at).getTime()) / 86_400_000;
    if (dias < DIAS_ENTRE_AJUSTES) return null;
  }
  const checkins = (await getCheckins(perfil.id, 4)).filter(
    (c) => !perfil.ajuste_macros_at || c.fecha > perfil.ajuste_macros_at.slice(0, 10)
  );
  const t = tendencia(checkins);
  if (!t) return null;
  const rango = RANGO[perfil.objetivo];
  const r1 = Math.round(t.kgSemana * 100) / 100;
  let delta = 0;
  let motivo = "";
  if (t.kgSemana < rango.min) {
    delta = perfil.objetivo === "deficit" ? 150 : 150;
    motivo =
      perfil.objetivo === "deficit"
        ? `Está bajando ${Math.abs(r1)} kg por semana, más rápido de lo ideal: conviene subir un poco las calorías para cuidar el músculo y la energía.`
        : `El peso baja ${Math.abs(r1)} kg por semana y el objetivo es ${perfil.objetivo === "superavit" ? "ganar" : "mantener"}: hacen falta más calorías.`;
  } else if (t.kgSemana > rango.max) {
    delta = -150;
    motivo =
      perfil.objetivo === "superavit"
        ? `Sube ${r1} kg por semana, más de lo que se convierte en músculo: bajar un poco las calorías limita la grasa.`
        : perfil.objetivo === "deficit"
          ? `El peso no baja (${r1 >= 0 ? "+" : ""}${r1} kg por semana): toca bajar las calorías.`
          : `Sube ${r1} kg por semana y el objetivo es mantener: bajar un poco las calorías.`;
  } else {
    return null;
  }
  return { tendencia_kg_semana: r1, semanas: Math.round(t.semanas * 10) / 10, peso_desde: t.desde, peso_hasta: t.hasta, delta_kcal: delta, motivo };
}

// Aplica el delta a la referencia (fórmula o manual) y la deja fijada a
// mano; los carbohidratos absorben el cambio. Después re-escala el menú.
export async function aplicarAjuste(perfil: Profile, deltaKcal: number): Promise<void> {
  const mover = (m: MacrosBase | null): MacrosBase | null =>
    m
      ? {
          kcal: Math.round(m.kcal + deltaKcal),
          prot_g: Math.round(m.prot_g),
          carb_g: Math.max(50, Math.round(m.carb_g + deltaKcal / 4)),
          grasa_g: Math.round(m.grasa_g)
        }
      : null;
  const entreno = mover(objetivosCliente(perfil, true));
  const descanso = mover(objetivosCliente(perfil, false));
  if (!entreno || !descanso) throw new Error("Faltan datos del perfil para calcular la referencia.");

  await exec(
    db()
      .from("profiles")
      .update({ macros_manual: { entreno, descanso }, ajuste_macros_at: new Date().toISOString() })
      .eq("id", perfil.id)
  );

  // Menú activo: mismos platos, carbohidratos re-escalados a la nueva referencia
  const plan = await getPlanComidas(perfil.id);
  if (!plan) return;
  const items: ItemComidaResuelto[] = plan.items.map((i) => ({
    tipo_dia: i.tipo_dia,
    momento: i.momento,
    orden: i.orden,
    plato: i.plato,
    nombre_pedido: i.ingredient.nombre,
    ingredient: i.ingredient,
    cantidad_g: i.cantidad_g,
    nota: i.nota
  }));
  const cuadrados = cuadrarMacros(items, { entreno, descanso });
  for (let k = 0; k < cuadrados.length; k++) {
    if (cuadrados[k].cantidad_g !== plan.items[k].cantidad_g) {
      await exec(db().from("meal_plan_items").update({ cantidad_g: cuadrados[k].cantidad_g }).eq("id", plan.items[k].id));
    }
  }
}

export async function descartarAjuste(userId: string): Promise<void> {
  await exec(db().from("profiles").update({ ajuste_macros_at: new Date().toISOString() }).eq("id", userId));
}
