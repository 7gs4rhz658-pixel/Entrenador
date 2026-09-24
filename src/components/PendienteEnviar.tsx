"use client";

import { useState, useTransition } from "react";
import { enviarMenu, enviarRutina } from "@/app/actions/entrenador";
import { enviarProtocolo } from "@/app/actions/protocolo";

// Borradores del cliente que el entrenador todavía no envió: hasta que
// toque "Enviar", el cliente ve "tu entrenador está armando tu plan".
export default function PendienteEnviar({
  userId,
  rutina,
  menu,
  protocolo = null
}: {
  userId: string;
  rutina: string | null; // nombre del bloque en borrador
  menu: string | null; // nombre del menú en borrador
  protocolo?: string | null; // nombre del protocolo en borrador
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!rutina && !menu && !protocolo) return null;

  function correr(fn: () => Promise<{ error?: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  }

  return (
    <section className="card mb-4 border-warn/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-warn">Pendiente de enviar</p>
      <p className="mt-1 text-sm text-muted">
        El cliente todavía no lo ve. Revisalo en las pestañas (Rutina / Comida / Protocolo) y cuando esté bien,
        envialo: le llega un aviso y un mensaje tuyo.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {rutina ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">🏋️ {rutina}</p>
              <p className="text-xs text-muted">Rutina en borrador</p>
            </div>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => enviarRutina({ userId }))}
              className="btn-primary shrink-0 px-3 py-1.5 text-sm"
            >
              {pendiente ? "…" : "Enviar rutina"}
            </button>
          </div>
        ) : null}
        {menu ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">🥗 {menu}</p>
              <p className="text-xs text-muted">Recomendación de comidas en borrador</p>
            </div>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => enviarMenu({ userId }))}
              className="btn-primary shrink-0 px-3 py-1.5 text-sm"
            >
              {pendiente ? "…" : "Enviar menú"}
            </button>
          </div>
        ) : null}
        {protocolo ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">✨ {protocolo}</p>
              <p className="text-xs text-muted">Protocolo con cambios sin enviar</p>
            </div>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => enviarProtocolo({ userId }))}
              className="btn-primary shrink-0 px-3 py-1.5 text-sm"
            >
              {pendiente ? "…" : "Enviar protocolo"}
            </button>
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
    </section>
  );
}
