// Explicación paso a paso de los ejercicios del borrador de rutina. Va por
// tandas (un día de la semana por llamada, con todas sus fases) para no
// pasar el tope de la IA gratis: la pantalla llama hasta que no falta
// ninguno. Cada explicación se guarda por ejercicio + prescripción en
// ia_lecturas: el mismo ejercicio no se vuelve a pedir.

import { ErrorIA, iaDisponible } from "./ai";
import {
  aplicarTecnica,
  avanceTecnica,
  claveTecnica,
  pedirTecnica,
  siguienteTanda,
  type PedidoTecnica,
  type Tecnica
} from "./ai-rutina";
import { q } from "./data";
import { normalizarPlan } from "./plan-generator";
import { actualizarBorradorRutina, getBorradorRutina } from "./plan-import";
import { pasosDeRespaldo } from "./rutina";
import { db } from "./supabase/server";

export interface AvanceTecnica {
  hechos: number;
  total: number;
  reintentarEn?: number; // la IA gratis pide esperar: la pantalla cuenta y vuelve a llamar
  aviso?: string;
}

// Explica la siguiente tanda del borrador del cliente y la guarda
// `releer`: no usar las explicaciones guardadas (el entrenador pidió regenerar)
export async function explicarSiguienteTanda(userId: string, releer = false): Promise<AvanceTecnica> {
  const borrador = await getBorradorRutina(userId);
  if (!borrador) throw new Error("No hay una rutina en borrador.");
  const plan = normalizarPlan(borrador.plan);
  const tanda = siguienteTanda(plan);
  if (!tanda.length) return avanceTecnica(plan);

  // Primero lo que ya se explicó alguna vez (mismo ejercicio y prescripción)
  const claves = new Map(tanda.map((p) => [p.id, claveTecnica(p)]));
  const guardadas = releer
    ? []
    : await q<{ clave: string; resultado: Tecnica }[]>(
        db().from("ia_lecturas").select("clave, resultado").in("clave", [...new Set(claves.values())])
      );
  const porClave = new Map(guardadas.map((g) => [g.clave, g.resultado]));
  const faltan: PedidoTecnica[] = [];
  for (const p of tanda) {
    const t = porClave.get(claves.get(p.id)!);
    if (t?.pasos?.length) aplicarTecnica(plan, p.id, t);
    else faltan.push(p);
  }

  let aviso: string | undefined;
  if (faltan.length) {
    let leidas: Map<string, Tecnica> | null = null;
    if (iaDisponible()) {
      try {
        leidas = await pedirTecnica(faltan);
      } catch (e) {
        // Si la IA pide esperar, se guarda lo que ya salió del caché y la
        // pantalla vuelve a llamar después de la cuenta
        if (e instanceof ErrorIA && e.reintentarEn) {
          await actualizarBorradorRutina(borrador.id, plan);
          return { ...avanceTecnica(plan), reintentarEn: e.reintentarEn };
        }
        aviso = `La IA no pudo explicar el ${plan.dias.find((d) => d.dia_semana === Number(faltan[0].id.split(":")[0]))?.nombre ?? "día"}: quedó la explicación básica, puedes regenerarla o editarla.`;
      }
    }
    const nuevas: { clave: string; tipo: string; resultado: Tecnica }[] = [];
    for (const p of faltan) {
      const t = leidas?.get(p.id);
      if (t) {
        aplicarTecnica(plan, p.id, t);
        nuevas.push({ clave: claves.get(p.id)!, tipo: "tecnica", resultado: t });
      } else if (!leidas?.size) {
        // Sin IA (o si no explicó ninguno): la técnica de la base con la
        // cadencia del plan. Si explicó algunos, los que faltan quedan para
        // la siguiente vuelta.
        const r = pasosDeRespaldo(p.ej);
        aplicarTecnica(plan, p.id, { pasos: r.pasos, clave: r.clave, fuerza: "", regreso: "" });
      }
    }
    if (nuevas.length) await db().from("ia_lecturas").upsert(nuevas, { onConflict: "clave" });
  }
  await actualizarBorradorRutina(borrador.id, plan);
  return { ...avanceTecnica(plan), ...(aviso ? { aviso } : {}) };
}
