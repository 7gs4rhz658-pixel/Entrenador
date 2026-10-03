"use client";

import { useState, useTransition } from "react";
import { aplicarPlanCliente, interpretarTxt, leerPdf, previsualizarPlan } from "@/app/actions/entrenador";
import { borrarPlantilla, cargarPlantilla, guardarPlantillaDesdeCliente } from "@/app/actions/plantillas";
import ExplicarRutina from "./ExplicarRutina";
import PlanRutinaVista from "./PlanRutinaVista";
import type { PlanGenerado } from "@/lib/types";

// Rutina nueva para el cliente: la propone la IA desde el cuestionario,
// sale de una plantilla o la sube el entrenador (.txt, PDF o texto
// pegado) → vista previa → borrador (el cliente sigue con su rutina)
// → paso a paso de cada ejercicio → el entrenador la revisa y la envía.
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
  const [lecturaGuardada, setLecturaGuardada] = useState(false);
  const [espera, setEspera] = useState(0);
  const [inicio, setInicio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<{ total: number; explicar: boolean } | null>(null);
  const [pendiente, iniciar] = useTransition();

  function limpiar() {
    setError(null);
    setPlan(null);
    setGuardado(null);
  }

  function generar() {
    limpiar();
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
    limpiar();
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
    const nombre = window.prompt('Nombre de la plantilla (ej. "Full body 3 días principiante"):', nombreBloque ?? "");
    if (!nombre) return;
    setAvisoPlantilla(null);
    iniciar(async () => {
      const r = await guardarPlantillaDesdeCliente({ userId, nombre });
      setAvisoPlantilla(r.error ? `✗ ${r.error}` : "✓ Plantilla guardada. Ya la puedes usar con otros clientes.");
    });
  }

  function quitarPlantilla(id: string, nombre: string) {
    if (!window.confirm(`¿Borrar la plantilla "${nombre}"?`)) return;
    iniciar(async () => {
      const r = await borrarPlantilla({ id });
      setAvisoPlantilla(r.error ? `✗ ${r.error}` : "✓ Plantilla borrada.");
    });
  }

  function leerArchivo(f: File | undefined) {
    if (!f) return;
    setError(null);
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      const datos = new FormData();
      datos.set("archivo", f);
      iniciar(async () => {
        const r = await leerPdf(datos);
        if (r.error || !r.texto) setError(r.error ?? "No se pudo leer el PDF.");
        else setTexto(r.texto);
      });
      return;
    }
    void f.text().then(setTexto);
  }

  function interpretar(releer = false) {
    limpiar();
    iniciar(async () => {
      // Si la IA gratis pide unos segundos, se espera aquí y se reintenta
      for (let intento = 0; intento < 3; intento++) {
        const r = await interpretarTxt({ userId, texto, releer });
        if (r.reintentarEn) {
          for (let s = r.reintentarEn; s > 0; s--) {
            setEspera(s);
            await new Promise((ok) => setTimeout(ok, 1000));
          }
          setEspera(0);
          continue;
        }
        if (r.error || !r.plan) setError(r.error ?? "No se pudo leer el plan.");
        else {
          setPlan(r.plan);
          setOrigen("txt");
          setLecturaGuardada(!!r.lecturaGuardada);
        }
        return;
      }
      setError("La IA gratis sigue ocupada. Espera un minuto y vuelve a intentar.");
    });
  }

  function aplicar() {
    if (!plan) return;
    setError(null);
    iniciar(async () => {
      const r = await aplicarPlanCliente({ userId, plan: { ...plan, fecha_inicio: inicio || null }, origen });
      if (r.error) setError(r.error);
      else {
        const total = plan.dias.reduce((n, d) => n + d.ejercicios.length, 0);
        const sinPasos = plan.dias.some((d) => d.ejercicios.some((e) => !e.pasos?.length));
        setGuardado({ total, explicar: conIA && sinPasos && origen === "txt" });
        setPlan(null);
        setTexto("");
      }
    });
  }

  const ejercicios = plan ? plan.dias.reduce((n, d) => n + d.ejercicios.length, 0) : 0;

  return (
    <div className="flex flex-col gap-3">
      <section className="card">
        <h2 className="font-bold">Rutina nueva</h2>
        <p className="mt-1 text-sm text-muted">
          Súbela tú (PDF, .txt o texto pegado), usa una plantilla o genérala con IA desde el cuestionario. Siempre
          ves una vista previa y queda como borrador: el cliente sigue con su rutina actual hasta que la envías.
        </p>

        <p className="mt-4 text-sm font-semibold">Sube tu plan</p>
        {!conIA ? (
          <p className="mt-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            Falta configurar la IA (GROQ_API_KEY): sin ella no se puede leer el plan. Mientras tanto puedes editar la
            rutina a mano en la pestaña Rutina.
          </p>
        ) : null}
        <input
          type="file"
          accept=".txt,text/plain,.md,.pdf,application/pdf"
          onChange={(e) => leerArchivo(e.target.files?.[0])}
          className="mt-3 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface2 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink"
        />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={10}
          className="input mt-3 font-mono text-sm"
          placeholder={`FASE 1: SEMANAS 1 A 4 — CADENCIA 3-5-3-0\nDía 1: Push\n• Press inclinado mancuernas: 4 series × 20 reps (10 completas + 10 parciales)\n• Aperturas polea baja: 3 × 20 (5s contracción)\n\nFASE 2: SEMANAS 5 A 8\nDía 1: Push\n• Press inclinado mancuernas: 4 × 6–8\n...`}
        />
        <p className="mt-1 text-xs text-muted">
          La IA lee fases, días, series, repeticiones, cadencias, parciales, superseries y notas. Solo transcribe: no
          agrega ejercicios ni cambia lo que escribiste.
        </p>
        <button
          type="button"
          onClick={() => interpretar(false)}
          disabled={pendiente || !conIA || texto.trim().length < 20}
          className="btn-primary mt-3 w-full"
        >
          {espera ? `La IA gratis pide una pausa: sigo en ${espera} s…` : pendiente && !plan ? "Leyendo tu plan…" : "Leer mi plan con IA"}
        </button>

        <p className="mt-5 text-sm font-semibold">O usa una plantilla tuya</p>
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
          <p className="mt-1 text-xs text-muted">
            Todavía no guardas ninguna. Guarda la rutina de un cliente como plantilla y la reutilizas con otros en un clic.
          </p>
        )}
        {nombreBloque ? (
          <button type="button" onClick={guardarComoPlantilla} disabled={pendiente} className="mt-2 text-sm font-semibold text-accent">
            + Guardar la rutina de este cliente como plantilla
          </button>
        ) : null}
        {avisoPlantilla ? <p className="mt-1 text-sm">{avisoPlantilla}</p> : null}

        <p className="mt-5 text-sm font-semibold">O genérala con IA</p>
        <button type="button" onClick={generar} disabled={pendiente} className="btn-ghost mt-2 w-full">
          {conIA ? "Generar desde el cuestionario" : "Generar con plantilla base"}
        </button>
        {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
      </section>

      {guardado ? (
        <section className="card border-ok/40">
          <p className="font-semibold text-ok">✓ Rutina guardada como borrador</p>
          <p className="mt-1 text-sm text-muted">
            El cliente sigue con su rutina actual. Revisa el borrador en la pestaña Rutina y envíalo desde arriba.
          </p>
          {guardado.explicar ? (
            <div className="mt-3">
              <ExplicarRutina userId={userId} hechos={0} total={guardado.total} auto />
            </div>
          ) : null}
        </section>
      ) : null}

      {plan ? (
        <section className="card border-accent/50">
          <h2 className="font-bold">
            Vista previa: {plan.nombre_bloque}
            <span className="ml-2 text-xs font-normal text-muted">
              {origen === "txt" ? "de tu plan" : origen === "ia" ? "generada con IA" : "de plantilla"} · {plan.dias.length} días ·{" "}
              {ejercicios} ejercicios
              {plan.total_semanas ? ` · ${plan.total_semanas} semanas` : ""}
            </span>
          </h2>
          {origen === "txt" && lecturaGuardada ? (
            <p className="mt-1 text-xs text-muted">
              Es la misma lectura de la vez pasada.{" "}
              <button type="button" onClick={() => interpretar(true)} disabled={pendiente} className="font-semibold text-accent">
                Leerlo de nuevo
              </button>
            </p>
          ) : null}
          {plan.progresion === "plan" ? (
            <p className="mt-2 rounded-xl border border-line px-3 py-2 text-xs text-muted">
              Progresión: la de tu plan. Cada semana repite tus series y rangos, y el peso sube un escalón cuando el
              cliente llega al tope del rango en todas las series. Sin descargas automáticas.
            </p>
          ) : null}
          <div className="mt-3">
            <PlanRutinaVista plan={plan} />
          </div>
          <div className="mt-3">
            <label className="label">Fecha de inicio (opcional)</label>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="input" />
            <p className="mt-1 text-xs text-muted">Vacía: empieza el día que la envías.</p>
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
