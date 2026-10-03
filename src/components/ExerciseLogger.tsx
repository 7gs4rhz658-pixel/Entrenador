"use client";

import { useState, useTransition } from "react";
import RestTimer from "./RestTimer";
import Stepper from "./Stepper";
import { ComoSeHace, EtiquetasEjercicio } from "./TecnicaEjercicio";
import {
  borrarSerie,
  guardarSerie,
  registrarSegunPlan
} from "@/app/actions/entreno";
import { guardarDescanso } from "@/app/actions/rutina";
import { fmtNum, resumenPlan } from "@/lib/format";
import type { Exercise, LoggedSet, PlannedSet } from "@/lib/types";

interface Fila {
  serie: number;
  reps: number;
  peso: number;
  rir: number | null;
  alFallo: boolean;
  guardada: boolean;
}

function construirFilas(plan: PlannedSet | null, logs: LoggedSet[]): Fila[] {
  const maxSerie = Math.max(
    plan?.series ?? 0,
    logs.reduce((m, l) => Math.max(m, l.serie), 0),
    1
  );
  return Array.from({ length: maxSerie }, (_, i) => {
    const serie = i + 1;
    const log = logs.find((l) => l.serie === serie);
    if (log) {
      return {
        serie,
        reps: log.reps ?? 0,
        peso: log.peso_kg ?? 0,
        rir: log.rir,
        alFallo: log.al_fallo,
        guardada: true
      };
    }
    return {
      serie,
      reps: plan?.reps ?? 10,
      peso: plan?.peso_kg ?? 0,
      rir: plan?.rir_objetivo ?? null,
      alFallo: plan?.al_fallo ?? false,
      guardada: false
    };
  });
}

// Resumen de lo hecho la semana pasada: "3 × 10 · 20 kg" (mejor serie)
export function resumenSemanaPasada(logs: LoggedSet[], conPeso: boolean): string | null {
  const hechas = logs.filter((l) => l.completado);
  if (!hechas.length) return null;
  const reps = hechas.map((l) => l.reps ?? 0);
  const rango =
    Math.min(...reps) === Math.max(...reps)
      ? `${reps[0]}`
      : `${Math.min(...reps)}–${Math.max(...reps)}`;
  if (!conPeso) return `${hechas.length} × ${rango} reps`;
  const pesos = hechas.map((l) => l.peso_kg ?? 0);
  const peso =
    Math.min(...pesos) === Math.max(...pesos)
      ? fmtNum(pesos[0])
      : `${fmtNum(Math.min(...pesos))}–${fmtNum(Math.max(...pesos))}`;
  return `${hechas.length} × ${rango} · ${peso} kg`;
}

export default function ExerciseLogger({
  ejercicio,
  plan,
  logs,
  logsPrev,
  mesoId,
  semana,
  conRango = false,
  companero = null
}: {
  ejercicio: Exercise;
  plan: PlannedSet | null;
  logs: LoggedSet[];
  logsPrev: LoggedSet[];
  mesoId: string;
  semana: number;
  conRango?: boolean; // plan del entrenador: muestra el rango ("6–8")
  companero?: string | null; // el otro ejercicio de su superserie
}) {
  const [filas, setFilas] = useState<Fila[]>(() => construirFilas(plan, logs));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [descanso, setDescanso] = useState(ejercicio.descanso_seg);
  const [disparo, setDisparo] = useState(0);

  const conPeso = ejercicio.unidad === "kg";
  const pasada = resumenSemanaPasada(logsPrev, conPeso);

  function actualizar(serie: number, cambios: Partial<Fila>) {
    setFilas((fs) =>
      fs.map((f) =>
        f.serie === serie ? { ...f, ...cambios, guardada: false } : f
      )
    );
  }

  function cambiarDescanso(seg: number) {
    setDescanso(seg);
    // Queda como descanso por defecto del ejercicio (sin bloquear la UI)
    void guardarDescanso({ exerciseId: ejercicio.id, descanso_seg: seg });
  }

  function guardar(fila: Fila) {
    setError(null);
    iniciar(async () => {
      const r = await guardarSerie({
        mesoId,
        exerciseId: ejercicio.id,
        semana,
        serie: fila.serie,
        reps: fila.reps,
        peso_kg: conPeso ? fila.peso : null,
        rir: fila.alFallo ? null : fila.rir,
        al_fallo: fila.alFallo,
        descanso_seg: descanso
      });
      if (r.error) setError(r.error);
      else {
        setFilas((fs) =>
          fs.map((f) => (f.serie === fila.serie ? { ...f, guardada: true } : f))
        );
        // Arranca el descanso salvo que sea la última serie planificada
        const ultima = plan ? fila.serie >= plan.series : false;
        if (!ultima) setDisparo((d) => d + 1);
      }
    });
  }

  function todoSegunPlan() {
    if (!plan) return;
    setError(null);
    iniciar(async () => {
      const r = await registrarSegunPlan({
        mesoId,
        exerciseId: ejercicio.id,
        semana
      });
      if (r.error) setError(r.error);
      else {
        setFilas((fs) =>
          fs.map((f) =>
            f.serie <= plan.series
              ? {
                  ...f,
                  reps: plan.reps ?? f.reps,
                  peso: plan.peso_kg ?? f.peso,
                  rir: plan.rir_objetivo,
                  alFallo: plan.al_fallo,
                  guardada: true
                }
              : f
          )
        );
      }
    });
  }

  function agregarSerie() {
    setFilas((fs) => {
      const ultima = fs[fs.length - 1];
      return [
        ...fs,
        {
          serie: fs.length + 1,
          reps: ultima?.reps ?? plan?.reps ?? 10,
          peso: ultima?.peso ?? plan?.peso_kg ?? 0,
          rir: ultima?.rir ?? null,
          alFallo: ultima?.alFallo ?? false,
          guardada: false
        }
      ];
    });
  }

  function quitarSerie(fila: Fila) {
    setError(null);
    if (!fila.guardada) {
      setFilas((fs) => fs.filter((f) => f.serie !== fila.serie));
      return;
    }
    iniciar(async () => {
      const r = await borrarSerie({
        mesoId,
        exerciseId: ejercicio.id,
        semana,
        serie: fila.serie
      });
      if (r.error) setError(r.error);
      else setFilas((fs) => fs.filter((f) => f.serie !== fila.serie));
    });
  }

  const todasGuardadas =
    plan != null &&
    filas.filter((f) => f.serie <= plan.series).every((f) => f.guardada);

  return (
    <article className="card">
      <header className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold leading-snug">{ejercicio.nombre}</h2>
        <span className="shrink-0 text-sm font-medium text-muted">
          {resumenPlan(plan, ejercicio.unidad, {
            min: conRango ? ejercicio.rep_min : null,
            max: conRango ? ejercicio.rep_max : null,
            porLado: ejercicio.por_lado
          })}
        </span>
      </header>
      <EtiquetasEjercicio ej={ejercicio} companero={companero} />

      {pasada ? (
        <p className="mt-1 text-sm text-muted">
          Semana pasada: <span className="font-semibold text-ink">{pasada}</span>
        </p>
      ) : semana > 1 ? (
        <p className="mt-1 text-sm text-muted">Semana pasada: sin registro</p>
      ) : null}

      {plan?.nota_ia ? (
        <p className="mt-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
          💡 {plan.nota_ia}
        </p>
      ) : null}

      <ComoSeHace ej={ejercicio} />

      <div className="mt-3">
        <RestTimer
          duracion={descanso}
          disparo={disparo}
          onCambiarDuracion={cambiarDescanso}
          compacto
        />
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {filas.map((fila) => {
          const esExtra = fila.serie > (plan?.series ?? 0);
          const prev = logsPrev.find((l) => l.serie === fila.serie && l.completado);
          return (
            <div
              key={fila.serie}
              className={`rounded-xl border p-3 ${
                fila.guardada ? "border-ok/40" : "border-line"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">
                  Serie {fila.serie}
                  {esExtra ? (
                    <span className="ml-1 text-xs font-normal text-muted">
                      (extra)
                    </span>
                  ) : null}
                  {prev ? (
                    <span className="ml-2 text-xs font-normal text-muted">
                      sem. pasada {prev.reps ?? "—"}
                      {conPeso && prev.peso_kg != null ? ` × ${fmtNum(prev.peso_kg)} kg` : " reps"}
                    </span>
                  ) : null}
                </span>
                <div className="flex items-center gap-2">
                  {fila.guardada ? (
                    <span className="text-sm font-semibold text-ok">
                      ✓ Guardada
                    </span>
                  ) : null}
                  {esExtra ? (
                    <button
                      type="button"
                      onClick={() => quitarSerie(fila)}
                      className="text-sm font-medium text-danger"
                      aria-label={`Quitar serie ${fila.serie}`}
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <Stepper
                  etiqueta="Reps"
                  valor={fila.reps}
                  paso={1}
                  min={0}
                  max={100}
                  onCambio={(v) => actualizar(fila.serie, { reps: v })}
                />
                {conPeso ? (
                  <Stepper
                    etiqueta="Peso"
                    sufijo="kg"
                    valor={fila.peso}
                    paso={ejercicio.incremento_kg || 2.5}
                    min={0}
                    max={500}
                    onCambio={(v) => actualizar(fila.serie, { peso: v })}
                  />
                ) : null}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    Esfuerzo
                  </span>
                  <select
                    aria-label="RIR o al fallo"
                    value={fila.alFallo ? "F" : fila.rir ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      actualizar(fila.serie, {
                        alFallo: v === "F",
                        rir: v === "F" || v === "" ? null : Number(v)
                      });
                    }}
                    className="h-11 rounded-xl border border-line bg-surface2 px-2 text-sm font-semibold outline-none"
                  >
                    <option value="">—</option>
                    <option value="0">RIR 0</option>
                    <option value="1">RIR 1</option>
                    <option value="2">RIR 2</option>
                    <option value="3">RIR 3</option>
                    <option value="4">RIR 4</option>
                    <option value="F">Al fallo</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => guardar(fila)}
                  disabled={pendiente || fila.guardada}
                  className={`h-11 rounded-xl px-4 text-sm font-bold ${
                    fila.guardada
                      ? "border border-ok/40 text-ok"
                      : "bg-accent text-accent-ink"
                  } disabled:opacity-60`}
                >
                  {fila.guardada ? "✓" : "OK"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p>
      ) : null}

      <div className="mt-3 flex gap-2">
        {plan && !todasGuardadas ? (
          <button
            type="button"
            onClick={todoSegunPlan}
            disabled={pendiente}
            className="btn-ghost flex-1 text-sm"
          >
            ✓ Todo según plan
          </button>
        ) : null}
        <button
          type="button"
          onClick={agregarSerie}
          disabled={pendiente}
          className="btn-ghost flex-1 text-sm"
        >
          + Agregar serie
        </button>
      </div>
    </article>
  );
}
