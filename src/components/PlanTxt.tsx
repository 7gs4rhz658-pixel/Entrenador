"use client";

import { useState, useTransition } from "react";
import { aplicarPlanCliente, interpretarTxt } from "@/app/actions/entrenador";
import { nombreDia } from "@/lib/format";
import type { PlanGenerado } from "@/lib/types";

// Reemplazo total del plan por un .txt del entrenador: pegar o subir el
// archivo → la IA lo interpreta → vista previa → confirmar.
export default function PlanTxt({
  userId,
  conIA,
  nombreBloque
}: {
  userId: string;
  conIA: boolean;
  nombreBloque: string | null;
}) {
  const [texto, setTexto] = useState("");
  const [plan, setPlan] = useState<PlanGenerado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, iniciar] = useTransition();

  async function leerArchivo(f: File | undefined) {
    if (!f) return;
    setTexto(await f.text());
  }

  function interpretar() {
    setError(null);
    setPlan(null);
    iniciar(async () => {
      const r = await interpretarTxt({ userId, texto });
      if (r.error || !r.plan) setError(r.error ?? "No se pudo interpretar.");
      else setPlan(r.plan);
    });
  }

  function aplicar() {
    if (!plan) return;
    if (
      !window.confirm(
        `¿Reemplazar por completo ${nombreBloque ? `"${nombreBloque}"` : "la rutina actual"} con este plan? El historial de registros se conserva.`
      )
    )
      return;
    setError(null);
    iniciar(async () => {
      const r = await aplicarPlanCliente({ userId, plan, origen: "txt" });
      if (r.error) setError(r.error);
      else {
        setOk(true);
        setPlan(null);
        setTexto("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="card">
        <h2 className="font-bold">Reemplazar el plan con un .txt</h2>
        <p className="mt-1 text-sm text-muted">
          Subí o pegá el plan tal como lo escribís (días, ejercicios, series × reps, pesos,
          descansos). La IA lo interpreta y te muestra una vista previa antes de aplicarlo. Al
          confirmar, la rutina actual se reemplaza por completo.
        </p>
        {!conIA ? (
          <p className="mt-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            Falta configurar GEMINI_API_KEY: sin IA no se puede interpretar el texto. Mientras
            tanto podés editar la rutina a mano en la pestaña Rutina.
          </p>
        ) : null}
        <input
          type="file"
          accept=".txt,text/plain,.md"
          onChange={(e) => leerArchivo(e.target.files?.[0])}
          className="mt-3 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface2 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink"
        />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={10}
          className="input mt-3 font-mono text-sm"
          placeholder={`Lunes - Pecho y tríceps\nPress banca 4x8-10 60kg desc 120s\nAperturas 3x12-15 12kg\nTríceps polea 3x12 25kg\n\nMiércoles - Pierna\nSentadilla 4x8 80kg\n...`}
        />
        {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
        {ok ? <p className="mt-2 text-sm font-medium text-ok">✓ Plan aplicado.</p> : null}
        <button
          type="button"
          onClick={interpretar}
          disabled={pendiente || !conIA || texto.trim().length < 20}
          className="btn-primary mt-3 w-full"
        >
          {pendiente && !plan ? "Interpretando…" : "Interpretar con IA"}
        </button>
      </section>

      {plan ? (
        <section className="card border-accent/50">
          <h2 className="font-bold">Vista previa: {plan.nombre_bloque}</h2>
          {plan.notas ? <p className="mt-1 text-sm text-muted">{plan.notas}</p> : null}
          <div className="mt-3 flex flex-col gap-3">
            {plan.dias.map((d) => (
              <div key={d.dia_semana} className="rounded-xl border border-line p-3">
                <p className="font-semibold">
                  {nombreDia(d.dia_semana)} — {d.nombre}
                </p>
                <ul className="mt-1.5 flex flex-col gap-1 text-sm">
                  {d.ejercicios.map((e, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{e.nombre}</span>
                      <span className="shrink-0 text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {e.series} × {e.rep_min}
                        {e.rep_max !== e.rep_min ? `–${e.rep_max}` : ""}
                        {e.unidad === "kg"
                          ? e.peso_inicial_kg != null
                            ? ` · ${e.peso_inicial_kg} kg`
                            : " · peso a definir"
                          : e.unidad === "peso_corporal"
                            ? " · peso corporal"
                            : ""}
                        {` · ${e.descanso_seg} s`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setPlan(null)} className="btn-ghost flex-1" disabled={pendiente}>
              Descartar
            </button>
            <button type="button" onClick={aplicar} className="btn-primary flex-1" disabled={pendiente}>
              {pendiente ? "Aplicando…" : "Reemplazar plan"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
