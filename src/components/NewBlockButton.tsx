"use client";

import { useState, useTransition } from "react";
import { crearBloque } from "@/app/actions/entreno";

export default function NewBlockButton({
  nombreAnterior,
  userId
}: {
  nombreAnterior: string;
  userId?: string;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (
      !window.confirm(
        "¿Crear un nuevo bloque de 8 semanas partiendo de los últimos pesos?"
      )
    )
      return;
    setError(null);
    iniciar(async () => {
      const r = await crearBloque(userId);
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="card border-ok/40">
      <p className="font-semibold">✓ {nombreAnterior} finalizado</p>
      <p className="mt-1 text-sm text-muted">
        Buen trabajo. Empieza un bloque nuevo de 8 semanas: la semana 1 arranca
        con los pesos de tu última semana.
      </p>
      {error ? (
        <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p>
      ) : null}
      <button
        onClick={onClick}
        disabled={pendiente}
        className="btn-primary mt-3 w-full"
      >
        {pendiente ? "Creando…" : "Crear nuevo bloque de 8 semanas"}
      </button>
    </div>
  );
}
