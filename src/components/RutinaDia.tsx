"use client";

import { useState, useTransition } from "react";
import {
  actualizarDia,
  borrarEjercicio,
  guardarEjercicio,
  type EjercicioInput
} from "@/app/actions/rutina";
import { nombreDia, resumenPlan } from "@/lib/format";
import { activoEnSemana, faseDeSemana, textoSemanas, textoTempo } from "@/lib/rutina";
import type {
  Exercise,
  FaseRutina,
  ModoProgresion,
  PlannedSet,
  TrainingDay,
  Unidad
} from "@/lib/types";
import { ComoSeHace, EtiquetasEjercicio } from "./TecnicaEjercicio";

type PlanLite = Pick<
  PlannedSet,
  "series" | "reps" | "peso_kg" | "al_fallo" | "rir_objetivo"
>;

const GRUPOS = ["pecho", "espalda", "pierna", "hombro", "brazo", "core", "otro"];

const PROGRESIONES: { valor: ModoProgresion; texto: string }[] = [
  { valor: "compuesto", texto: "Compuesto · ondula peso y reps (rango 8–12)" },
  { valor: "aislamiento", texto: "Aislamiento · ondula peso y reps (rango 10–15)" },
  { valor: "solo_reps", texto: "Solo repeticiones (flexiones, gemelos a RIR)" },
  { valor: "al_fallo", texto: "Al fallo · se mantiene igual" }
];

// ── Formulario de ejercicio (crear / editar) ────────────────────

function ExerciseForm({
  diaId,
  ejercicio,
  plan,
  alCerrar
}: {
  diaId: string;
  ejercicio: Exercise | null;
  plan: PlanLite | null;
  alCerrar: () => void;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState(ejercicio?.nombre ?? "");
  const [grupo, setGrupo] = useState(ejercicio?.grupo_muscular ?? "pecho");
  const [progresion, setProgresion] = useState<ModoProgresion>(
    ejercicio?.progresion ?? "aislamiento"
  );
  const [unidad, setUnidad] = useState<Unidad>(ejercicio?.unidad ?? "kg");
  const [series, setSeries] = useState(plan?.series ?? 3);
  const [reps, setReps] = useState<number>(plan?.reps ?? 10);
  const [alFallo, setAlFallo] = useState(plan?.al_fallo ?? false);
  const [peso, setPeso] = useState<number>(plan?.peso_kg ?? 0);
  const [repMin, setRepMin] = useState<number>(ejercicio?.rep_min ?? 10);
  const [repMax, setRepMax] = useState<number>(ejercicio?.rep_max ?? 15);
  const [descanso, setDescanso] = useState<number>(ejercicio?.descanso_seg ?? 90);
  const [incremento, setIncremento] = useState(ejercicio?.incremento_kg ?? 2.5);
  const [rir, setRir] = useState<number | null>(plan?.rir_objetivo ?? null);
  const [descripcion, setDescripcion] = useState(ejercicio?.descripcion ?? "");
  const [tips, setTips] = useState((ejercicio?.tips ?? []).join("\n"));
  const [semanaDesde, setSemanaDesde] = useState<string>(ejercicio?.semana_desde?.toString() ?? "");
  const [semanaHasta, setSemanaHasta] = useState<string>(ejercicio?.semana_hasta?.toString() ?? "");
  const [tempo, setTempo] = useState(ejercicio?.tempo ? textoTempo(ejercicio.tempo) : "");
  const [parciales, setParciales] = useState<string>(ejercicio?.parciales?.toString() ?? "");
  const [porLado, setPorLado] = useState(ejercicio?.por_lado ?? false);
  const [superserie, setSuperserie] = useState(ejercicio?.superserie ?? "");
  const [nota, setNota] = useState(ejercicio?.nota ?? "");
  const [pasos, setPasos] = useState((ejercicio?.pasos ?? []).join("\n"));
  const [clave, setClave] = useState(ejercicio?.clave ?? "");
  const conPlan = !!(ejercicio?.semana_desde || ejercicio?.tempo || ejercicio?.pasos.length || ejercicio?.nota);

  function guardar() {
    setError(null);
    const input: EjercicioInput = {
      id: ejercicio?.id ?? null,
      training_day_id: diaId,
      nombre,
      grupo_muscular: grupo,
      tipo: progresion === "compuesto" ? "compuesto" : "aislamiento",
      progresion,
      unidad,
      incremento_kg: incremento,
      rep_min: progresion === "al_fallo" ? null : repMin,
      rep_max: progresion === "al_fallo" ? null : repMax,
      descanso_seg: descanso,
      descripcion,
      tips: tips.split("\n"),
      semana_desde: semanaDesde ? Number(semanaDesde) : null,
      semana_hasta: semanaHasta ? Number(semanaHasta) : null,
      tempo,
      parciales: parciales ? Number(parciales) : null,
      por_lado: porLado,
      superserie,
      nota,
      pasos: pasos.split("\n"),
      clave,
      series,
      reps: alFallo ? null : reps,
      peso_kg: unidad === "kg" && peso > 0 ? peso : null,
      al_fallo: alFallo,
      rir_objetivo: rir
    };
    iniciar(async () => {
      const r = await guardarEjercicio(input);
      if (r.error) setError(r.error);
      else alCerrar();
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-xl border border-line bg-surface2 p-3">
      <div>
        <label className="label">Nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Press inclinado con mancuernas"
          className="input"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Grupo muscular</label>
          <select
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            className="input"
          >
            {GRUPOS.map((g) => (
              <option key={g} value={g}>
                {g[0].toUpperCase() + g.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Unidad</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value as Unidad)}
            className="input"
          >
            <option value="kg">Con peso (kg)</option>
            <option value="peso_corporal">Peso corporal</option>
            <option value="sin_peso">Sin peso</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Cómo progresa</label>
        <select
          value={progresion}
          onChange={(e) => setProgresion(e.target.value as ModoProgresion)}
          className="input"
        >
          {PROGRESIONES.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.texto}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Series</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            value={series}
            onChange={(e) => setSeries(Number(e.target.value))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Reps</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={reps}
            disabled={alFallo}
            onChange={(e) => setReps(Number(e.target.value))}
            className="input disabled:opacity-40"
          />
        </div>
        {unidad === "kg" ? (
          <div>
            <label className="label">Peso (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min={0}
              value={peso}
              onChange={(e) => setPeso(Number(e.target.value))}
              className="input"
            />
          </div>
        ) : (
          <div />
        )}
      </div>
      {unidad === "kg" ? (
        <p className="-mt-2 text-xs text-muted">
          Peso en 0 = &quot;a completar en el primer entreno&quot;. Las reps
          de la semana actual conviene que sean el piso o el tope del rango
          según la fase.
        </p>
      ) : null}

      {progresion !== "al_fallo" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Rango reps: piso</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={repMin}
              onChange={(e) => setRepMin(Number(e.target.value))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Rango reps: tope</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={repMax}
              onChange={(e) => setRepMax(Number(e.target.value))}
              className="input"
            />
          </div>
        </div>
      ) : null}

      <div>
        <label className="label">Descanso entre series (segundos)</label>
        <select
          value={descanso}
          onChange={(e) => setDescanso(Number(e.target.value))}
          className="input"
        >
          {[30, 45, 60, 75, 90, 120, 150, 180, 240, 300].map((s) => (
            <option key={s} value={s}>
              {s} s
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {unidad === "kg" ? (
          <div>
            <label className="label">Incremento del equipo</label>
            <select
              value={incremento}
              onChange={(e) => setIncremento(Number(e.target.value))}
              className="input"
            >
              <option value={1}>1 kg</option>
              <option value={1.25}>1,25 kg</option>
              <option value={2.5}>2,5 kg</option>
              <option value={5}>5 kg</option>
            </select>
          </div>
        ) : null}
        <div>
          <label className="label">RIR objetivo</label>
          <select
            value={rir ?? ""}
            onChange={(e) =>
              setRir(e.target.value === "" ? null : Number(e.target.value))
            }
            className="input"
          >
            <option value="">Sin RIR fijo</option>
            <option value="0">RIR 0</option>
            <option value="1">RIR 1</option>
            <option value="2">RIR 2</option>
            <option value="3">RIR 3</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={alFallo}
          onChange={(e) => setAlFallo(e.target.checked)}
          className="h-5 w-5 accent-[var(--accent)]"
        />
        Series al fallo (sin objetivo de reps)
      </label>

      <details className="rounded-xl border border-line px-3 py-2" open={conPlan}>
        <summary className="cursor-pointer select-none text-sm font-semibold">
          Fase, cadencia y paso a paso
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Desde la semana</label>
              <input type="number" inputMode="numeric" min={1} max={12} value={semanaDesde} onChange={(e) => setSemanaDesde(e.target.value)} placeholder="1" className="input" />
            </div>
            <div>
              <label className="label">Hasta la semana</label>
              <input type="number" inputMode="numeric" min={1} max={12} value={semanaHasta} onChange={(e) => setSemanaHasta(e.target.value)} placeholder="todas" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cadencia</label>
              <input value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="3-5-3-0" className="input" />
              <p className="mt-1 text-[11px] text-muted">sube · aprieta · baja · pausa estirado (s)</p>
            </div>
            <div>
              <label className="label">Parciales al final</label>
              <input type="number" inputMode="numeric" min={0} max={50} value={parciales} onChange={(e) => setParciales(e.target.value)} placeholder="0" className="input" />
              <p className="mt-1 text-[11px] text-muted">de las reps, cuántas son parciales</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Superserie</label>
              <input value={superserie} onChange={(e) => setSuperserie(e.target.value)} placeholder="ej. 1" className="input" />
              <p className="mt-1 text-[11px] text-muted">mismo número = se alternan</p>
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={porLado} onChange={(e) => setPorLado(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
              Reps por lado
            </label>
          </div>
          <div>
            <label className="label">Indicación del plan</label>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ej. 5 s de isometría arriba" className="input" />
          </div>
          <div>
            <label className="label">Paso a paso, uno por línea</label>
            <textarea value={pasos} onChange={(e) => setPasos(e.target.value)} rows={5} className="input" />
          </div>
          <div>
            <label className="label">Clave (lo más importante)</label>
            <input value={clave} onChange={(e) => setClave(e.target.value)} className="input" />
          </div>
        </div>
      </details>

      <div>
        <label className="label">Descripción (vacía = se genera sola)</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className="input"
        />
      </div>
      <div>
        <label className="label">Tips, uno por línea (vacío = automáticos)</label>
        <textarea
          value={tips}
          onChange={(e) => setTips(e.target.value)}
          rows={3}
          className="input"
        />
      </div>

      {error ? (
        <p className="text-sm font-medium text-danger">✗ {error}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={alCerrar}
          className="btn-ghost flex-1"
          disabled={pendiente}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          className="btn-primary flex-1"
          disabled={pendiente}
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ── Tarjeta de un día de la semana ──────────────────────────────

export default function RutinaDia({
  dia,
  ejercicios,
  planes,
  semana = 1,
  fases = [],
  conRango = false
}: {
  dia: TrainingDay;
  ejercicios: Exercise[];
  planes: Record<string, PlanLite>;
  semana?: number; // semana actual del bloque: los de otras fases van aparte
  fases?: FaseRutina[];
  conRango?: boolean; // plan del entrenador: "4 × 6–8" en vez de las reps de la semana
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState(dia.nombre ?? "");
  const [abierto, setAbierto] = useState<string | "nuevo" | null>(null);

  function guardarDia(cambios: { es_descanso?: boolean }) {
    setError(null);
    iniciar(async () => {
      const r = await actualizarDia({
        dayId: dia.id,
        nombre,
        es_descanso: cambios.es_descanso ?? dia.es_descanso
      });
      if (r.error) setError(r.error);
    });
  }

  function eliminar(ex: Exercise) {
    if (!window.confirm(`¿Quitar "${ex.nombre}" de la rutina?`)) return;
    setError(null);
    iniciar(async () => {
      const r = await borrarEjercicio(ex.id);
      if (r.error) setError(r.error);
    });
  }

  return (
    <section className="card">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{nombreDia(dia.dia_semana)}</h2>
        <label className="flex items-center gap-2 text-sm text-muted">
          Entreno
          <input
            type="checkbox"
            checked={!dia.es_descanso}
            disabled={pendiente}
            onChange={(e) => guardarDia({ es_descanso: !e.target.checked })}
            className="h-5 w-5 accent-[var(--accent)]"
          />
        </label>
      </header>

      {!dia.es_descanso ? (
        <>
          <div className="mt-3 flex gap-2">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={() => {
                if ((dia.nombre ?? "") !== nombre) guardarDia({});
              }}
              placeholder='Nombre del día (ej: "Pecho")'
              className="input"
            />
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {ejercicios.filter((ex) => activoEnSemana(ex, semana) || abierto === ex.id).map((ex) => (
              <li key={ex.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{ex.nombre}</p>
                    <p className="text-sm text-muted">
                      {resumenPlan(
                        planes[ex.id] ?? null,
                        ex.unidad,
                        conRango ? { min: ex.rep_min, max: ex.rep_max, porLado: ex.por_lado } : { min: null, max: null, porLado: ex.por_lado }
                      )}
                    </p>
                    <EtiquetasEjercicio ej={ex} />
                  </div>
                  <div className="flex shrink-0 gap-3 text-sm font-medium">
                    <button
                      onClick={() =>
                        setAbierto(abierto === ex.id ? null : ex.id)
                      }
                      className="text-accent"
                    >
                      {abierto === ex.id ? "Cerrar" : "Editar"}
                    </button>
                    <button
                      onClick={() => eliminar(ex)}
                      className="text-danger"
                      disabled={pendiente}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
                {abierto === ex.id ? (
                  <ExerciseForm
                    diaId={dia.id}
                    ejercicio={ex}
                    plan={planes[ex.id] ?? null}
                    alCerrar={() => setAbierto(null)}
                  />
                ) : (
                  <ComoSeHace ej={ex} />
                )}
              </li>
            ))}
          </ul>

          {(() => {
            const otros = ejercicios.filter((ex) => !activoEnSemana(ex, semana) && abierto !== ex.id);
            if (!otros.length) return null;
            return (
              <details className="mt-3 rounded-xl border border-dashed border-line px-3 py-2">
                <summary className="cursor-pointer select-none text-sm font-medium text-muted">
                  De otras fases ({otros.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {otros.map((ex) => {
                    const f = faseDeSemana(fases, ex.semana_desde ?? 1);
                    return (
                      <li key={ex.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {ex.nombre}
                          <span className="ml-1 text-xs text-muted">
                            · {f ? `fase ${f.numero}, ` : ""}
                            {textoSemanas({ semana_desde: ex.semana_desde ?? 1, semana_hasta: ex.semana_hasta ?? ex.semana_desde ?? 1 })}
                          </span>
                        </span>
                        <button onClick={() => setAbierto(ex.id)} className="shrink-0 text-xs font-semibold text-accent">
                          Editar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })()}

          {abierto === "nuevo" ? (
            <ExerciseForm
              diaId={dia.id}
              ejercicio={null}
              plan={null}
              alCerrar={() => setAbierto(null)}
            />
          ) : (
            <button
              onClick={() => setAbierto("nuevo")}
              className="btn-ghost mt-3 w-full text-sm"
            >
              + Agregar ejercicio
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Día de descanso. Activa &quot;Entreno&quot; para agregarle ejercicios
          (por ejemplo, un día de cardio o un cuarto día de pesas).
        </p>
      )}

      {error ? (
        <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p>
      ) : null}
    </section>
  );
}
