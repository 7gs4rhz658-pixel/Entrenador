"use client";

import { useState, useTransition } from "react";
import { aplicarAjusteMacros, descartarAjusteMacros } from "@/app/actions/comidas";
import type { PropuestaAjuste } from "@/lib/ajuste-macros";

// La app propone mover ±150 kcal según la tendencia de peso; el
// entrenador aplica o descarta con un clic.
export default function AjusteMacros({ userId, propuesta }: { userId: string; propuesta: PropuestaAjuste }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sube = propuesta.delta_kcal > 0;

  function correr(fn: () => Promise<{ error?: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  }

  return (
    <section className="card border-warn/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-warn">Ajuste sugerido</p>
      <h2 className="mt-0.5 font-bold">
        {sube ? "Subir" : "Bajar"} {Math.abs(propuesta.delta_kcal)} kcal por día
      </h2>
      <p className="mt-1 text-sm text-muted">
        Peso {propuesta.peso_desde} → {propuesta.peso_hasta} kg en {propuesta.semanas} semanas (
        {propuesta.tendencia_kg_semana >= 0 ? "+" : ""}
        {propuesta.tendencia_kg_semana} kg/sem). {propuesta.motivo}
      </p>
      <p className="mt-1 text-xs text-muted">
        Al aplicar: la referencia queda fijada a mano, el cambio va a los carbohidratos y el menú se
        re-escala solo.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => correr(() => descartarAjusteMacros({ userId }))} disabled={pendiente} className="btn-ghost flex-1 py-1.5 text-sm">
          Ignorar 2 semanas
        </button>
        <button
          type="button"
          onClick={() => correr(() => aplicarAjusteMacros({ userId, deltaKcal: propuesta.delta_kcal }))}
          disabled={pendiente}
          className="btn-primary flex-1 py-1.5 text-sm"
        >
          {pendiente ? "Aplicando…" : `Aplicar ${sube ? "+" : "−"}${Math.abs(propuesta.delta_kcal)} kcal`}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
    </section>
  );
}
