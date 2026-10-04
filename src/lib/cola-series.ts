"use client";

// Series que no llegaron al servidor (sin señal en el gym): quedan en el
// teléfono y se suben solas al volver la conexión. guardarSerie es un
// upsert por (bloque, ejercicio, semana, serie), así que reintentar no
// duplica nada.

import { useEffect, useState } from "react";
import { guardarSerie, type SerieInput } from "@/app/actions/entreno";

const CLAVE = "series-pendientes";
export const EVENTO_COLA = "series-pendientes";

type Pendiente = SerieInput & { logged_at: string };

const mismaSerie = (a: SerieInput, b: SerieInput) =>
  a.mesoId === b.mesoId && a.exerciseId === b.exerciseId && a.semana === b.semana && a.serie === b.serie;

function leer(): Pendiente[] {
  try {
    const l = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

function escribir(l: Pendiente[]): void {
  try {
    if (l.length) localStorage.setItem(CLAVE, JSON.stringify(l));
    else localStorage.removeItem(CLAVE);
  } catch {}
  window.dispatchEvent(new Event(EVENTO_COLA));
}

// La última versión de cada serie es la que vale
export function encolarSerie(serie: SerieInput): void {
  const pendiente = { ...serie, logged_at: serie.logged_at ?? new Date().toISOString() };
  escribir([...leer().filter((p) => !mismaSerie(p, serie)), pendiente]);
}

// Las series de un ejercicio que siguen en el teléfono
export function pendientesDe(mesoId: string, exerciseId: string, semana: number): Pendiente[] {
  return leer().filter((p) => p.mesoId === mesoId && p.exerciseId === exerciseId && p.semana === semana);
}

let subiendo = false;

// Sube en orden; si vuelve a fallar la red, para y espera al próximo intento.
// Si el servidor la rechaza (dato inválido, sesión de otro), se descarta.
export async function subirPendientes(): Promise<void> {
  if (subiendo || typeof navigator === "undefined" || !navigator.onLine) return;
  subiendo = true;
  try {
    for (const p of leer()) {
      try {
        const r = await guardarSerie(p);
        if (r.error) console.warn("Serie pendiente rechazada:", r.error);
      } catch {
        return;
      }
      escribir(leer().filter((x) => !(mismaSerie(x, p) && x.logged_at === p.logged_at)));
    }
  } finally {
    subiendo = false;
  }
}

// Cuántas series esperan señal; mientras haya, reintenta al volver la
// conexión, al volver a la app y cada 30 s.
export function useSeriesPendientes(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const contar = () => setN(leer().length);
    const intentar = () => void subirPendientes();
    contar();
    intentar();
    window.addEventListener(EVENTO_COLA, contar);
    window.addEventListener("storage", contar);
    window.addEventListener("online", intentar);
    document.addEventListener("visibilitychange", intentar);
    const t = setInterval(() => {
      if (leer().length) intentar();
    }, 30_000);
    return () => {
      window.removeEventListener(EVENTO_COLA, contar);
      window.removeEventListener("storage", contar);
      window.removeEventListener("online", intentar);
      document.removeEventListener("visibilitychange", intentar);
      clearInterval(t);
    };
  }, []);
  return n;
}
