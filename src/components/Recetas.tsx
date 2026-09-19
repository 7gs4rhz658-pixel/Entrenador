"use client";

import { useState, useTransition } from "react";
import { pedirRecetas } from "@/app/actions/nutricion";
import type { Receta } from "@/lib/ai";
import type { Macros } from "@/lib/nutrition";

export default function Recetas({
  restantes,
  preferencias,
  conIA
}: {
  restantes: Macros;
  preferencias: string;
  conIA: boolean;
}) {
  const [recetas, setRecetas] = useState<Receta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function pedir() {
    setError(null);
    iniciar(async () => {
      const r = await pedirRecetas({ restantes, preferencias });
      if (r.error) setError(r.error);
      else setRecetas(r.recetas ?? []);
    });
  }

  if (!conIA) return null;

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">Ideas para lo que te queda</h2>
          <p className="text-xs text-muted">
            {restantes.kcal} kcal · P {restantes.prot_g} g · C {restantes.carb_g} g · G {restantes.grasa_g} g
          </p>
        </div>
        <button type="button" onClick={pedir} disabled={pendiente} className="btn-ghost shrink-0 text-sm">
          {pendiente ? "Pensando…" : recetas ? "Otras" : "✨ Sugerir"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
      {recetas ? (
        <ul className="mt-3 flex flex-col gap-2">
          {recetas.map((r, i) => (
            <li key={i} className="rounded-xl border border-line p-3">
              <p className="font-semibold">{r.nombre}</p>
              <p className="text-xs text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                {r.momento} · ~{r.macros_aprox?.kcal} kcal · P {r.macros_aprox?.prot_g} · C {r.macros_aprox?.carb_g} · G {r.macros_aprox?.grasa_g}
              </p>
              <p className="mt-1.5 text-sm">
                {r.ingredientes.map((ing) => `${ing.nombre} ${ing.gramos} g`).join(" · ")}
              </p>
              {r.pasos?.length ? (
                <ol className="mt-1.5 list-decimal pl-5 text-sm text-muted">
                  {r.pasos.map((p, j) => (
                    <li key={j}>{p}</li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
