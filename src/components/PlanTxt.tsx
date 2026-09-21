"use client";

import { useState, useTransition } from "react";
import { aplicarPlanCliente, interpretarTxt, previsualizarPlan } from "@/app/actions/entrenador";
import { borrarPlantilla, cargarPlantilla, guardarPlantillaDesdeCliente } from "@/app/actions/plantillas";
import { nombreDia } from "@/lib/format";
import type { PlanGenerado } from "@/lib/types";

// Rutina nueva para el cliente: la propone la IA desde el cuestionario o
// la escribe el entrenador en un .txt → vista previa → queda como
// borrador hasta que el entrenador la envía.
export interface PlantillaResumen {
  id: string;
  nombre: string;
  descripcion: string;
  dias: number;
}

export default function PlanTxt({
  userId,
  conIA,
  nombreBloque,
  plantillas = []
}: {
  userId: string;
  conIA: boolean;
  nombreBloque: string | null;
  plantillas?: PlantillaResumen[];
}) {
  const [plantillaSel, setPlantillaSel] = useState(plantillas[0]?.id ?? "");
  const [avisoPlantilla, setAvisoPlantilla] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [plan, setPlan] = useState<PlanGenerado | null>(null);
  const [origen, setOrigen] = useState<"txt" | "ia" | "plantilla">("txt");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, iniciar] = useTransition();

  function generar() {
    setError(null);
    setPlan(null);
    setOk(false);
    iniciar(async () => {
      const r = await previsualizarPlan({ userId });
      if (r.error || !r.plan) setError(r.error ?? "No se pudo generar.");
      else {
        setPlan(r.plan);
        setOrigen(r.origen ?? "plantilla");
      }
    });
  }

  function usarPlantilla() {
    if (!plantillaSel) return;
    setError(null);
    setPlan(null);
    setOk(false);
    iniciar(async () => {
      const r = await cargarPlantilla({ id: plantillaSel });
      if (r.error || !r.plan) setError(r.error ?? "No se pudo cargar la plantilla.");
      else {
        setPlan(r.plan);
        setOrigen("plantilla");
      }
    });
  }

  function guardarComoPlantilla() {
    const nombre = window.prompt("Nombre de la plantilla (ej. \"Full body 3 días principiante\"):", nombreBloque ?? "");
    if (!nombre) return;
    setAvisoPlantilla(null);
    iniciar(async () => {
      const r = await guardarPlantillaDesdeCliente({ userId, nombre });
      setAvisoPlantilla(r.error ? `✗ ${r.error}` : "✓ Plantilla guardada. Ya la podés usar con otros clientes.");
    });
  }

  function quitarPlantilla(id: string, nombre: string) {
    if (!window.confirm(`¿Borrar la plantilla "${nombre}"?`)) return;
    iniciar(async () => {
      const r = await borrarPlantilla({ id });
      setAvisoPlantilla(r.error ? `✗ ${r.error}` : "✓ Plantilla borrada.");
    });
  }

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
      else {
        setPlan(r.plan);
        setOrigen("txt");
      }
    });
  }

  function aplicar() {
    if (!plan) return;
    if (
      nombreBloque &&
      !window.confirm(
        `¿Reemplazar "${nombreBloque}" con esta rutina? Queda como borrador hasta que la envíes; el historial de registros se conserva.`
      )
    )
      return;
    setError(null);
    iniciar(async () => {
      const r = await aplicarPlanCliente({ userId, plan, origen });
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
        <h2 className="font-bold">Rutina nueva</h2>
        <p className="mt-1 text-sm text-muted">
          Generala con IA desde el cuestionario del cliente, o subí/pegá tu propio plan (días,
          ejercicios, series × reps, pesos, descansos). En los dos casos ves una vista previa,
          la guardás como borrador, la ajustás en la pestaña Rutina y recién cuando la enviás
          el cliente la ve.
        </p>
        <button type="button" onClick={generar} disabled={pendiente} className="btn-primary mt-3 w-full">
          {pendiente && !plan ? "Generando…" : conIA ? "Generar con IA desde el cuestionario" : "Generar con plantilla"}
        </button>
        <p className="mt-4 text-sm font-semibold">O usá una plantilla tuya</p>
        {plantillas.length ? (
          <div className="mt-2 flex gap-2">
            <select value={plantillaSel} onChange={(e) => setPlantillaSel(e.target.value)} className="input flex-1 py-1.5 text-sm">
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {p.dias} día{p.dias === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <button type="button" onClick={usarPlantilla} disabled={pendiente || !plantillaSel} className="btn-ghost px-3 py-1.5 text-sm">
              Cargar
            </button>
            <button
              type="button"
              onClick={() => {
                const p = plantillas.find((x) => x.id === plantillaSel);
                if (p) quitarPlantilla(p.id, p.nombre);
              }}
              disabled={pendiente || !plantillaSel}
              className="text-xs text-danger"
              aria-label="Borrar plantilla"
            >
              ✕
            </button>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted">Todavía no guardaste ninguna. Guardá la rutina de un cliente como plantilla y la reutilizás con otros en un clic.</p>
        )}
        {nombreBloque ? (
          <button type="button" onClick={guardarComoPlantilla} disabled={pendiente} className="mt-2 text-sm font-semibold text-accent">
            + Guardar la rutina actual de este cliente como plantilla
          </button>
        ) : null}
        {avisoPlantilla ? <p className="mt-1 text-sm">{avisoPlantilla}</p> : null}

        <p className="mt-4 text-sm font-semibold">O cargá tu .txt</p>
        {!conIA ? (
          <p className="mt-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            Falta configurar la IA (GROQ_API_KEY): sin ella no se puede interpretar el texto. Mientras
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
        {ok ? (
          <p className="mt-2 text-sm font-medium text-ok">
            ✓ Rutina guardada como borrador. Revisala en la pestaña Rutina y enviala desde arriba.
          </p>
        ) : null}
        <button
          type="button"
          onClick={interpretar}
          disabled={pendiente || !conIA || texto.trim().length < 20}
          className="btn-ghost mt-3 w-full"
        >
          {pendiente && !plan ? "Interpretando…" : "Interpretar el .txt con IA"}
        </button>
      </section>

      {plan ? (
        <section className="card border-accent/50">
          <h2 className="font-bold">
            Vista previa: {plan.nombre_bloque}
            <span className="ml-2 text-xs font-normal text-muted">
              {origen === "txt" ? "de tu .txt" : origen === "ia" ? "generada con IA" : "de plantilla"}
            </span>
          </h2>
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
              {pendiente ? "Guardando…" : "Guardar como borrador"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
