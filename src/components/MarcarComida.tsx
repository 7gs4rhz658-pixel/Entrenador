"use client";

import { useState, useTransition } from "react";
import { marcarComida } from "@/app/actions/comidas";
import type { Momento, TipoDia } from "@/lib/types";

// "✓ La comí": registra en el día todos los ingredientes de esa comida
// del menú (o los quita si se desmarca).
export default function MarcarComida({
  userId,
  fecha,
  tipo,
  momento,
  hecha
}: {
  userId?: string;
  fecha: string;
  tipo: TipoDia;
  momento: Momento;
  hecha: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    iniciar(async () => {
      try {
        const r = await marcarComida({ userId, fecha, tipo_dia: tipo, momento, hecha: !hecha });
        if (r.error) setError(r.error);
      } catch {
        setError("Sin conexión: márcala cuando vuelva la señal.");
      }
    });
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={toggle}
        disabled={pendiente}
        className={`chip min-h-[36px] px-3 ${hecha ? "border-ok/50 bg-ok/15 text-ok" : "border-accent/60 text-accent"}`}
      >
        {pendiente ? "…" : hecha ? "✓ La comí" : "La comí"}
      </button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
