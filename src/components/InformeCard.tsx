"use client";

import { useState, useTransition } from "react";
import { marcarInformeVisto } from "@/app/actions/checkin";
import type { Checkin } from "@/lib/types";

// Informe semanal aprobado por el entrenador, tal como lo ve el cliente.
export default function InformeCard({ checkin }: { checkin: Checkin }) {
  const [abierto, setAbierto] = useState(!checkin.visto_at);
  const [pendiente, iniciar] = useTransition();
  const texto = checkin.informe_final ?? "";
  const [titulo, ...resto] = texto.split("\n");

  function cerrar() {
    setAbierto(false);
    if (!checkin.visto_at) iniciar(async () => void (await marcarInformeVisto({ checkinId: checkin.id })));
  }

  return (
    <section className={`card mb-4 ${checkin.visto_at ? "" : "border-accent/60 ring-1 ring-accent/30"}`}>
      <button type="button" onClick={() => (abierto ? cerrar() : setAbierto(true))} className="flex w-full items-start justify-between gap-2 text-left">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Informe de la semana {checkin.semana} · de tu entrenador
          </p>
          <h2 className="font-bold">{titulo}</h2>
        </div>
        <span className="text-muted">{abierto ? "▾" : "▸"}</span>
      </button>
      {abierto ? (
        <div className="mt-2 whitespace-pre-line text-sm leading-relaxed">
          {resto.join("\n").trim()}
          <button type="button" onClick={cerrar} disabled={pendiente} className="btn-ghost mt-3 w-full py-1.5 text-sm">
            {checkin.visto_at ? "Cerrar" : "Leído ✓"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
