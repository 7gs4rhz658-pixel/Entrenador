import type { PlannedSet, Unidad } from "./types";

export const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo"
];

export function nombreDia(diaSemana: number): string {
  return DIAS_SEMANA[diaSemana - 1] ?? "";
}

// Día de la semana "de hoy" (1 = lunes ... 7 = domingo) en la zona horaria
// de la app, para que el server en UTC no corra el día.
export function hoyDiaSemana(): number {
  const tz = process.env.TZ_APP || "America/Argentina/Buenos_Aires";
  const dia = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short"
  }).format(new Date());
  const mapa: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7
  };
  return mapa[dia] ?? 1;
}

export function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

export function fmtPeso(n: number | null | undefined): string {
  if (n == null) return "a definir";
  return `${fmtNum(n)} kg`;
}

export function fmtLitros(ml: number): string {
  return `${(ml / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} L`;
}

export function fmtKcal(n: number): string {
  return `${n.toLocaleString("es-AR")} kcal`;
}

export function resumenPlan(
  plan: Pick<PlannedSet, "series" | "reps" | "peso_kg" | "al_fallo"> | null,
  unidad: Unidad
): string {
  if (!plan) return "sin plan esta semana";
  if (plan.al_fallo) return `${plan.series} series al fallo`;
  const reps = plan.reps != null ? ` × ${plan.reps}` : "";
  if (unidad === "kg") {
    const peso = plan.peso_kg != null ? ` · ${fmtNum(plan.peso_kg)} kg` : " · peso a definir";
    return `${plan.series}${reps}${peso}`;
  }
  if (unidad === "peso_corporal") return `${plan.series}${reps} · peso corporal`;
  return `${plan.series}${reps}`;
}

// Fecha de "hoy" (YYYY-MM-DD) en la zona horaria de la app.
export function hoyFecha(): string {
  const tz = process.env.TZ_APP || "America/Argentina/Buenos_Aires";
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Suma días a una fecha YYYY-MM-DD (sin tocar zonas horarias).
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function fmtFechaCorta(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
}

export function fmtGramos(n: number): string {
  return `${Math.round(n)} g`;
}

export function fmtSegundos(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtTiempoRelativo(iso: string | null): string {
  if (!iso) return "nunca";
  const dif = Date.now() - new Date(iso).getTime();
  const dias = Math.floor(dif / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) return `hace ${Math.floor(dias / 7)} sem.`;
  return `hace ${Math.floor(dias / 30)} meses`;
}
