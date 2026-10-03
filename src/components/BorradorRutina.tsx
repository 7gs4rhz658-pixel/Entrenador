"use client";

import { useState, useTransition } from "react";
import { descartarBorradorRutina, guardarBorradorRutinaAction } from "@/app/actions/entrenador";
import { nombreDia } from "@/lib/format";
import { activoEnSemana, parsearTempo, textoTempo } from "@/lib/rutina";
import type { EjercicioGenerado, FaseRutina, PlanGenerado, ProgresionBloque } from "@/lib/types";
import ExplicarRutina from "./ExplicarRutina";
import { CabeceraFase, EtiquetasPlan, gruposPorFase, textoPrescripcion } from "./PlanRutinaVista";

const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const lineas = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

// El borrador de rutina antes de enviarlo: fases, días y ejercicios con
// su paso a paso. Todo se edita aquí; el cliente no ve nada hasta "Enviar".
export default function BorradorRutina({
  userId,
  nombre,
  plan: planInicial,
  conIA
}: {
  userId: string;
  nombre: string;
  plan: PlanGenerado;
  conIA: boolean;
}) {
  const [plan, setPlan] = useState<PlanGenerado>(() => copia(planInicial));
  const [sucio, setSucio] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null); // "dia:indice"
  const [explicando, setExplicando] = useState(false);
  const [regenerar, setRegenerar] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const todos = plan.dias.flatMap((d) => d.ejercicios);
  const hechos = todos.filter((e) => e.pasos?.length).length;

  function cambiar(fn: (p: PlanGenerado) => void) {
    setPlan((p) => {
      const n = copia(p);
      fn(n);
      return n;
    });
    setSucio(true);
    setOk(null);
  }

  function guardar(despues?: () => void) {
    setError(null);
    iniciar(async () => {
      const r = await guardarBorradorRutinaAction({ userId, plan });
      if (r.error) setError(r.error);
      else {
        setSucio(false);
        setOk("✓ Cambios guardados.");
        despues?.();
      }
    });
  }

  function descartar() {
    if (!window.confirm("¿Descartar este borrador? El cliente sigue con su rutina actual.")) return;
    iniciar(async () => {
      const r = await descartarBorradorRutina({ userId });
      if (r.error) setError(r.error);
    });
  }

  // Cambiar las semanas de una fase mueve también a sus ejercicios
  function cambiarFase(i: number, cambios: Partial<FaseRutina>) {
    cambiar((p) => {
      const f = p.fases![i];
      const antes = { d: f.semana_desde, h: f.semana_hasta };
      Object.assign(f, cambios);
      if (cambios.semana_desde != null || cambios.semana_hasta != null) {
        for (const e of p.dias.flatMap((d) => d.ejercicios)) {
          if (e.semana_desde === antes.d && e.semana_hasta === antes.h) {
            e.semana_desde = f.semana_desde;
            e.semana_hasta = f.semana_hasta;
          }
        }
      }
    });
  }

  function mover(dia: number, i: number, paso: -1 | 1, semana: number) {
    cambiar((p) => {
      const lista = p.dias.find((d) => d.dia_semana === dia)!.ejercicios;
      let j = i + paso;
      while (j >= 0 && j < lista.length && !activoEnSemana(lista[j], semana)) j += paso;
      if (j < 0 || j >= lista.length) return;
      [lista[i], lista[j]] = [lista[j], lista[i]];
    });
    setAbierto(null);
  }

  function quitar(dia: number, i: number, nombreEj: string) {
    if (!window.confirm(`¿Quitar "${nombreEj}"?`)) return;
    cambiar((p) => {
      const d = p.dias.find((x) => x.dia_semana === dia)!;
      d.ejercicios.splice(i, 1);
      if (!d.ejercicios.length) p.dias = p.dias.filter((x) => x !== d);
    });
    setAbierto(null);
  }

  function agregar(dia: number, fase: FaseRutina | null) {
    cambiar((p) => {
      const d = p.dias.find((x) => x.dia_semana === dia)!;
      d.ejercicios.push({
        nombre: "Ejercicio nuevo",
        grupo_muscular: "otro",
        unidad: "kg",
        progresion: "aislamiento",
        series: 3,
        rep_min: 10,
        rep_max: 12,
        peso_inicial_kg: null,
        incremento_kg: 2.5,
        descanso_seg: fase?.descanso_seg ?? 90,
        ...(fase && (plan.fases?.length ?? 0) > 1 ? { semana_desde: fase.semana_desde, semana_hasta: fase.semana_hasta } : {}),
        ...(fase?.tempo ? { tempo: fase.tempo } : {})
      });
      setAbierto(`${dia}:${d.ejercicios.length - 1}`);
    });
  }

  function regenerarPasos(dia: number, i: number) {
    cambiar((p) => {
      const e = p.dias.find((x) => x.dia_semana === dia)!.ejercicios[i];
      delete e.pasos;
      delete e.clave;
      delete e.verbos;
    });
    // Se guarda y se vuelve a pedir sin usar la explicación guardada
    setTimeout(() => guardar(() => setRegenerar((n) => n + 1)), 0);
  }

  const diasLibres = (actual: number) => [1, 2, 3, 4, 5, 6, 7].filter((n) => n === actual || !plan.dias.some((d) => d.dia_semana === n));

  return (
    <section className="card border-warn/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-warn">Borrador sin enviar</p>
      <h2 className="font-bold">{nombre}</h2>
      <p className="mt-1 text-sm text-muted">
        El cliente sigue con su rutina actual. Revisa todo, ajusta lo que haga falta y envíalo desde el aviso de arriba.
      </p>

      <div className="mt-3">
        <ExplicarRutina
          key={regenerar}
          userId={userId}
          hechos={hechos}
          total={todos.length}
          auto={regenerar > 0}
          releer={regenerar > 0}
          onCorriendo={setExplicando}
        />
        {!conIA ? <p className="mt-1 text-xs text-muted">Sin IA configurada, los pasos salen de la base de técnica.</p> : null}
      </div>

      <details className="mt-3 rounded-xl border border-line px-3 py-2">
        <summary className="cursor-pointer select-none text-sm font-semibold">Datos del bloque</summary>
        <div className="mt-3">
          <label className="label">Nombre</label>
          <input value={plan.nombre_bloque} onChange={(e) => cambiar((p) => void (p.nombre_bloque = e.target.value))} className="input" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Semanas</label>
            <input
              type="number"
              min={1}
              max={12}
              value={plan.total_semanas ?? 8}
              onChange={(e) => cambiar((p) => void (p.total_semanas = Number(e.target.value)))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Fecha de inicio</label>
            <input
              type="date"
              value={plan.fecha_inicio ?? ""}
              onChange={(e) => cambiar((p) => void (p.fecha_inicio = e.target.value || null))}
              className="input"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="label">Progresión semana a semana</label>
          <select
            value={plan.progresion ?? "ondulada"}
            onChange={(e) => cambiar((p) => void (p.progresion = e.target.value as ProgresionBloque))}
            className="input"
          >
            <option value="plan">La de mi plan: mismas series y rangos; sube el peso al llegar al tope</option>
            <option value="ondulada">Ondulada automática: piso, tope, carga y descarga al 50 %</option>
          </select>
        </div>
        <div className="mt-3">
          <label className="label">Notas para el cliente</label>
          <textarea value={plan.notas ?? ""} onChange={(e) => cambiar((p) => void (p.notas = e.target.value))} rows={2} className="input" />
        </div>
        <div className="mt-3">
          <label className="label">Notas para ti (el cliente no las ve)</label>
          <textarea
            value={plan.notas_entrenador ?? ""}
            onChange={(e) => cambiar((p) => void (p.notas_entrenador = e.target.value))}
            rows={3}
            className="input"
          />
        </div>
      </details>

      {(plan.fases ?? []).length ? (
        <details className="mt-3 rounded-xl border border-line px-3 py-2">
          <summary className="cursor-pointer select-none text-sm font-semibold">Fases ({plan.fases!.length})</summary>
          <div className="mt-3 flex flex-col gap-4">
            {plan.fases!.map((f, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl bg-surface2 p-3">
                <input value={f.nombre} onChange={(e) => cambiarFase(i, { nombre: e.target.value })} className="input font-semibold" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Desde la semana</label>
                    <input type="number" min={1} max={12} value={f.semana_desde} onChange={(e) => cambiarFase(i, { semana_desde: Number(e.target.value) })} className="input" />
                  </div>
                  <div>
                    <label className="label">Hasta la semana</label>
                    <input type="number" min={1} max={12} value={f.semana_hasta} onChange={(e) => cambiarFase(i, { semana_hasta: Number(e.target.value) })} className="input" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="label">Cadencia</label>
                    <input
                      defaultValue={f.tempo ? textoTempo(f.tempo) : ""}
                      onBlur={(e) => cambiarFase(i, { tempo: parsearTempo(e.target.value) })}
                      placeholder="3-5-3-0"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Descanso (s)</label>
                    <input
                      type="number"
                      value={f.descanso_seg ?? ""}
                      onChange={(e) => cambiarFase(i, { descanso_seg: e.target.value ? Number(e.target.value) : null })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">RIR</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={f.rir ?? ""}
                      onChange={(e) => cambiarFase(i, { rir: e.target.value ? Number(e.target.value) : null })}
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Objetivo</label>
                  <input value={f.objetivo} onChange={(e) => cambiarFase(i, { objetivo: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Reglas para el cliente, una por línea</label>
                  <textarea
                    defaultValue={f.reglas.join("\n")}
                    onBlur={(e) => cambiarFase(i, { reglas: lineas(e.target.value) })}
                    rows={4}
                    className="input"
                  />
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        {gruposPorFase(plan).map(({ fase, numero, semana }) => (
          <div key={numero ?? 0} className="flex flex-col gap-2">
            {fase && numero ? <CabeceraFase fase={fase} numero={numero} /> : null}
            {plan.dias.map((d) => {
              const indices = d.ejercicios.map((e, i) => ({ e, i })).filter(({ e }) => activoEnSemana(e, semana));
              return (
                <div key={d.dia_semana} className="rounded-xl border border-line p-3">
                  <div className="flex gap-2">
                    <select
                      value={d.dia_semana}
                      onChange={(e) =>
                        cambiar((p) => {
                          p.dias.find((x) => x.dia_semana === d.dia_semana)!.dia_semana = Number(e.target.value);
                          p.dias.sort((a, b) => a.dia_semana - b.dia_semana);
                        })
                      }
                      className="input w-32 py-1.5 text-sm"
                      aria-label="Día de la semana"
                    >
                      {diasLibres(d.dia_semana).map((n) => (
                        <option key={n} value={n}>
                          {nombreDia(n)}
                        </option>
                      ))}
                    </select>
                    <input
                      value={d.nombre}
                      onChange={(e) => cambiar((p) => void (p.dias.find((x) => x.dia_semana === d.dia_semana)!.nombre = e.target.value))}
                      className="input flex-1 py-1.5 text-sm font-semibold"
                      aria-label="Nombre del día"
                    />
                  </div>
                  <ul className="mt-2 flex flex-col gap-2 text-sm">
                    {indices.map(({ e, i }) => {
                      const k = `${d.dia_semana}:${i}`;
                      return (
                        <li key={k} className="rounded-lg border border-line/60 px-2.5 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <button type="button" onClick={() => setAbierto(abierto === k ? null : k)} className="min-w-0 text-left">
                              <span className="font-medium">{e.nombre}</span>
                              <span className="block text-xs text-muted">{textoPrescripcion(e)}</span>
                              <EtiquetasPlan e={e} />
                              {!e.pasos?.length ? <span className="text-[11px] text-warn">sin paso a paso todavía</span> : null}
                            </button>
                            <span className="flex shrink-0 gap-1.5 text-xs font-semibold">
                              <button type="button" onClick={() => mover(d.dia_semana, i, -1, semana)} className="text-muted" aria-label="Subir">
                                ↑
                              </button>
                              <button type="button" onClick={() => mover(d.dia_semana, i, 1, semana)} className="text-muted" aria-label="Bajar">
                                ↓
                              </button>
                              <button type="button" onClick={() => quitar(d.dia_semana, i, e.nombre)} className="text-danger" aria-label="Quitar">
                                ✕
                              </button>
                            </span>
                          </div>
                          {abierto === k ? (
                            <EditorEjercicio
                              e={e}
                              onCambio={(cambios) =>
                                cambiar((p) => void Object.assign(p.dias.find((x) => x.dia_semana === d.dia_semana)!.ejercicios[i], cambios))
                              }
                              onRegenerar={conIA ? () => regenerarPasos(d.dia_semana, i) : undefined}
                              bloqueado={explicando || pendiente}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  <button type="button" onClick={() => agregar(d.dia_semana, fase)} className="mt-2 text-xs font-semibold text-accent">
                    + Agregar ejercicio
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-danger">✗ {error}</p> : null}
      {ok && !sucio ? <p className="mt-3 text-sm font-medium text-ok">{ok}</p> : null}
      {explicando ? <p className="mt-3 text-xs text-muted">Espera a que terminen las explicaciones para guardar cambios.</p> : null}
      <div className="sticky bottom-2 mt-4 flex gap-2">
        <button type="button" onClick={descartar} disabled={pendiente} className="btn-ghost flex-1 bg-surface">
          Descartar borrador
        </button>
        <button type="button" onClick={() => guardar()} disabled={pendiente || !sucio || explicando} className="btn-primary flex-1">
          {pendiente ? "Guardando…" : sucio ? "Guardar cambios" : "Sin cambios"}
        </button>
      </div>
    </section>
  );
}

function EditorEjercicio({
  e,
  onCambio,
  onRegenerar,
  bloqueado
}: {
  e: EjercicioGenerado;
  onCambio: (cambios: Partial<EjercicioGenerado>) => void;
  onRegenerar?: () => void;
  bloqueado: boolean;
}) {
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg bg-surface2 p-2.5">
      <div>
        <label className="label">Nombre</label>
        <input value={e.nombre} onChange={(x) => onCambio({ nombre: x.target.value })} className="input" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="label">Series</label>
          <input type="number" min={1} max={10} value={e.series} onChange={(x) => onCambio({ series: Number(x.target.value) })} className="input" />
        </div>
        <div>
          <label className="label">Reps mín.</label>
          <input type="number" min={1} value={e.rep_min} onChange={(x) => onCambio({ rep_min: Number(x.target.value) })} className="input" />
        </div>
        <div>
          <label className="label">Reps máx.</label>
          <input type="number" min={1} value={e.rep_max} onChange={(x) => onCambio({ rep_max: Number(x.target.value) })} className="input" />
        </div>
        <div>
          <label className="label">Desc. (s)</label>
          <input type="number" min={15} max={600} value={e.descanso_seg} onChange={(x) => onCambio({ descanso_seg: Number(x.target.value) })} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label">Cadencia</label>
          <input
            defaultValue={e.tempo ? textoTempo(e.tempo) : ""}
            onBlur={(x) => onCambio({ tempo: parsearTempo(x.target.value) })}
            placeholder="3-5-3-0"
            className="input"
          />
        </div>
        <div>
          <label className="label">Parciales</label>
          <input type="number" min={0} value={e.parciales ?? ""} onChange={(x) => onCambio({ parciales: num(x.target.value) })} className="input" />
        </div>
        <div>
          <label className="label">Superserie</label>
          <input value={e.superserie ?? ""} onChange={(x) => onCambio({ superserie: x.target.value || null })} className="input" />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!e.por_lado} onChange={(x) => onCambio({ por_lado: x.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
          Por lado
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={e.unidad !== "kg"}
            onChange={(x) => onCambio({ unidad: x.target.checked ? "peso_corporal" : "kg", progresion: x.target.checked ? "solo_reps" : "aislamiento" })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Peso corporal
        </label>
      </div>
      <div>
        <label className="label">Indicación del plan</label>
        <input value={e.nota ?? ""} onChange={(x) => onCambio({ nota: x.target.value || null })} className="input" />
      </div>
      <div>
        <label className="label">Paso a paso, uno por línea</label>
        <textarea
          defaultValue={(e.pasos ?? []).join("\n")}
          onBlur={(x) => onCambio({ pasos: lineas(x.target.value) })}
          rows={6}
          className="input text-sm"
        />
      </div>
      <div>
        <label className="label">Clave</label>
        <input value={e.clave ?? ""} onChange={(x) => onCambio({ clave: x.target.value || null })} className="input" />
      </div>
      {onRegenerar ? (
        <button type="button" onClick={onRegenerar} disabled={bloqueado} className="self-start text-xs font-semibold text-accent">
          ↻ Volver a escribir el paso a paso con IA
        </button>
      ) : null}
    </div>
  );
}
