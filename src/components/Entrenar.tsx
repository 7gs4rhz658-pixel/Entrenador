"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { resumenSemanaPasada } from "./ExerciseLogger";
import { TarjetaFase } from "./FasesRutina";
import GuiaCadencia from "./GuiaCadencia";
import RestTimer from "./RestTimer";
import Stepper from "./Stepper";
import { ComoSeHace, EtiquetasEjercicio } from "./TecnicaEjercicio";
import { guardarSerie, guardarSesion, type RecordDetectado, type SerieInput } from "@/app/actions/entreno";
import { encolarSerie, pendientesDe } from "@/lib/cola-series";
import { guardarDescanso } from "@/app/actions/rutina";
import { fmtNum, fmtSegundos, resumenPlan } from "@/lib/format";
import { grupoSuperserie, repsDeSerie } from "@/lib/rutina";
import type { Exercise, FaseRutina, LoggedSet, PlannedSet } from "@/lib/types";

interface SerieHecha {
  serie: number;
  reps: number;
  peso: number | null;
  rir: number | null;
  alFallo: boolean;
}

// Modo "Comenzar rutina": guía ejercicio por ejercicio y serie por serie,
// dispara el cronómetro al registrar cada serie y muestra el peso de la
// semana pasada para decidir si repetir o subir. Con cadencia, la guía
// cuenta cada repetición; en superserie alterna los ejercicios y el
// descanso va después del último.
export default function Entrenar({
  diaId,
  titulo,
  mesoId,
  semana,
  ejercicios,
  planes,
  logs,
  logsPrev,
  fases = [],
  conRango = false
}: {
  diaId: string;
  titulo: string;
  mesoId: string;
  semana: number;
  ejercicios: Exercise[];
  planes: Record<string, PlannedSet>;
  logs: Record<string, LoggedSet[]>;
  logsPrev: Record<string, LoggedSet[]>;
  fases?: FaseRutina[];
  conRango?: boolean;
}) {
  // Series ya registradas (de la base) + las que se registran ahora
  const [hechas, setHechas] = useState<Record<string, SerieHecha[]>>(() => {
    const m: Record<string, SerieHecha[]> = {};
    for (const ex of ejercicios) {
      m[ex.id] = (logs[ex.id] ?? [])
        .filter((l) => l.completado)
        .map((l) => ({
          serie: l.serie,
          reps: l.reps ?? 0,
          peso: l.peso_kg,
          rir: l.rir,
          alFallo: l.al_fallo
        }));
    }
    return m;
  });

  const primeroPendiente = useMemo(() => {
    const i = ejercicios.findIndex((ex) => {
      const plan = planes[ex.id];
      return (hechas[ex.id]?.length ?? 0) < (plan?.series ?? 1);
    });
    return i === -1 ? ejercicios.length : i;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [indice, setIndice] = useState(primeroPendiente);
  const [descansos, setDescansos] = useState<Record<string, number>>(() =>
    Object.fromEntries(ejercicios.map((e) => [e.id, e.descanso_seg]))
  );
  const [disparo, setDisparo] = useState(0);
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  // Reloj de la sesión: arranca al abrir "Comenzar rutina" y sobrevive a
  // cerrar la app (queda en el teléfono). Si quedó abierto más de 6 h es
  // de otro día: se reinicia.
  const claveReloj = `sesion:${mesoId}:${semana}:${diaId}`;
  const [inicio] = useState<number>(() => {
    if (typeof window === "undefined") return Date.now();
    try {
      const guardado = Number(localStorage.getItem(claveReloj));
      if (guardado && Date.now() - guardado < 6 * 3600 * 1000) return guardado;
      localStorage.setItem(claveReloj, String(Date.now()));
    } catch {}
    return Date.now();
  });
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const transcurrido = Math.max(0, Math.floor((ahora - inicio) / 1000));
  const [duracionFinal, setDuracionFinal] = useState<number | null>(null);
  const sesionGuardada = useRef(false);
  // Récords logrados en esta sesión (se muestran al momento y al final)
  const [records, setRecords] = useState<RecordDetectado[]>([]);

  const ex = ejercicios[indice] as Exercise | undefined;
  const plan = ex ? planes[ex.id] ?? null : null;
  const conPeso = ex?.unidad === "kg";
  const hechasEx = ex ? hechas[ex.id] ?? [] : [];
  const serieActual = hechasEx.length + 1;
  const totalSeries = (plan?.series ?? 3) + (ex ? extras[ex.id] ?? 0 : 0);
  const prevEx = ex ? logsPrev[ex.id] ?? [] : [];
  const prevSerie = prevEx.find((l) => l.serie === serieActual && l.completado);

  // Valores editables de la serie en curso (se reinician por ejercicio/serie)
  const [borrador, setBorrador] = useState<{ clave: string; reps: number; peso: number; rir: number | null; alFallo: boolean } | null>(null);
  const clave = ex ? `${ex.id}:${serieActual}` : "";
  const actual =
    borrador && borrador.clave === clave
      ? borrador
      : {
          clave,
          reps: hechasEx[hechasEx.length - 1]?.reps ?? plan?.reps ?? 10,
          peso: hechasEx[hechasEx.length - 1]?.peso ?? plan?.peso_kg ?? 0,
          rir: plan?.rir_objetivo ?? null,
          alFallo: plan?.al_fallo ?? false
        };

  // Series que quedaron en el teléfono sin señal (después de recargar):
  // cuentan como hechas y la sesión sigue desde la primera pendiente
  useEffect(() => {
    let cambio = false;
    const m = { ...hechas };
    for (const e of ejercicios) {
      for (const p of pendientesDe(mesoId, e.id, semana)) {
        if ((m[e.id] ?? []).some((h) => h.serie === p.serie)) continue;
        m[e.id] = [...(m[e.id] ?? []), { serie: p.serie, reps: p.reps ?? 0, peso: p.peso_kg, rir: p.rir, alFallo: p.al_fallo }].sort(
          (a, b) => a.serie - b.serie
        );
        cambio = true;
      }
    }
    if (!cambio) return;
    setHechas(m);
    const i = ejercicios.findIndex((e) => (m[e.id]?.length ?? 0) < (planes[e.id]?.series ?? 1));
    setIndice(i === -1 ? ejercicios.length : i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function registrar() {
    if (!ex) return;
    setError(null);
    const fila = { ...actual };
    const datos: SerieInput = {
      mesoId,
      exerciseId: ex.id,
      semana,
      serie: serieActual,
      reps: fila.reps,
      peso_kg: conPeso ? fila.peso : null,
      rir: fila.alFallo ? null : fila.rir,
      al_fallo: fila.alFallo,
      descanso_seg: descansos[ex.id]
    };
    iniciar(async () => {
      let r: Awaited<ReturnType<typeof guardarSerie>>;
      try {
        r = await guardarSerie(datos);
      } catch {
        // Sin señal: queda en el teléfono, se sube sola y la sesión sigue
        encolarSerie(datos);
        r = {};
      }
      if (r.error) {
        setError(r.error);
        return;
      }
      const nuevas = {
        ...hechas,
        [ex.id]: [
          ...(hechas[ex.id] ?? []),
          { serie: serieActual, reps: fila.reps, peso: conPeso ? fila.peso : null, rir: fila.rir, alFallo: fila.alFallo }
        ]
      };
      setHechas(nuevas);
      setBorrador(null);
      if (r.record) setRecords((l) => [...l, r.record!]);
      // Superserie: del primero al siguiente sin descanso; después del
      // último, descanso y de vuelta al primero que tenga series pendientes
      const grupo = grupoSuperserie(ejercicios, indice);
      if (grupo.length > 1) {
        const pendientes = (k: number) =>
          (nuevas[ejercicios[k].id]?.length ?? 0) < (planes[ejercicios[k].id]?.series ?? 3) + (extras[ejercicios[k].id] ?? 0);
        const pos = grupo.indexOf(indice);
        const siguiente = grupo.slice(pos + 1).find(pendientes);
        if (siguiente != null) {
          setIndice(siguiente);
          return;
        }
        setDisparo((d) => d + 1);
        const primero = grupo.find(pendientes);
        if (primero != null) setIndice(primero);
        return;
      }
      setDisparo((d) => d + 1);
    });
  }

  function cambiarDescanso(seg: number) {
    if (!ex) return;
    setDescansos((d) => ({ ...d, [ex.id]: seg }));
    guardarDescanso({ exerciseId: ex.id, descanso_seg: seg }).catch(() => {});
  }

  // Al terminar se guarda la sesión una sola vez y se limpia el reloj
  const terminado = !ex;
  const totalHechasSesion = Object.values(hechas).reduce((n, l) => n + l.length, 0);
  useEffect(() => {
    if (!terminado || sesionGuardada.current) return;
    sesionGuardada.current = true;
    const duracion = Math.round((Date.now() - inicio) / 1000);
    guardarSesion({ mesoId, diaId, semana, inicioIso: new Date(inicio).toISOString(), series: totalHechasSesion })
      .then((r) => setDuracionFinal(r.duracion_seg ?? 0))
      // Sin señal la duración se calcula en el teléfono (la sesión no se registra)
      .catch(() => setDuracionFinal(duracion >= 60 && duracion <= 6 * 3600 ? duracion : 0))
      .finally(() => {
        try {
          localStorage.removeItem(claveReloj);
        } catch {}
      });
  }, [terminado, mesoId, diaId, semana, inicio, totalHechasSesion, claveReloj]);

  // ── Pantalla final ────────────────────────────────────────────
  if (!ex) {
    const totalHechas = totalHechasSesion;
    const volumen = Object.values(hechas)
      .flat()
      .reduce((n, s) => n + (s.peso ?? 0) * s.reps, 0);
    return (
      <main className="flex min-h-[70vh] flex-col justify-center">
        <div className="card text-center">
          <div className="mb-2 text-4xl">🏁</div>
          <h1 className="text-2xl font-bold">¡Entrenamiento terminado!</h1>
          <p className="mt-2 text-muted">
            {totalHechas} series registradas
            {volumen > 0 ? ` · ${fmtNum(Math.round(volumen))} kg movidos` : ""}
            {duracionFinal ? ` · ${Math.round(duracionFinal / 60)} min` : ""}.
          </p>
          {records.length ? (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {records.map((r, i) => (
                <li key={i} className="rounded-xl border border-ok/40 bg-ok/10 px-3 py-1.5 font-semibold text-ok">
                  🏆 Récord en {r.ejercicio}: {fmtNum(r.valor)} {r.tipo === "peso" ? "kg" : "reps"}
                  {r.anterior != null ? <span className="font-normal text-muted"> (antes {fmtNum(r.anterior)})</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <Link href={`/dia/${diaId}`} className="btn-ghost mt-5 w-full">
            Ver y corregir el detalle
          </Link>
          <Link href="/" className="btn-primary mt-2 w-full">
            Volver a la semana
          </Link>
        </div>
      </main>
    );
  }

  const completo = hechasEx.length >= totalSeries;
  const pasada = resumenSemanaPasada(prevEx, conPeso);
  const companero =
    grupoSuperserie(ejercicios, indice)
      .filter((k) => k !== indice)
      .map((k) => ejercicios[k].nombre)
      .join(" y ") || null;
  const { completas, parciales } = repsDeSerie(ex);

  return (
    <main>
      <header className="mb-3">
        <div className="flex items-center justify-between">
          <Link href={`/dia/${diaId}`} className="text-sm font-medium text-accent">
            ← Salir
          </Link>
          <span className="text-sm text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
            ⏱ {fmtSegundos(transcurrido)} · {indice + 1}/{ejercicios.length}
          </span>
        </div>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted">{titulo}</p>
        <div className="mt-1 flex gap-1" aria-hidden>
          {ejercicios.map((e, i) => (
            <span
              key={e.id}
              className={`h-1.5 flex-1 rounded-full ${
                i < indice ? "bg-ok" : i === indice ? "bg-accent" : "bg-line"
              }`}
            />
          ))}
        </div>
      </header>

      {indice === 0 ? <TarjetaFase fases={fases} semana={semana} compacta /> : null}

      <section className="card">
        <h1 className="text-xl font-bold leading-snug">{ex.nombre}</h1>
        <p className="mt-0.5 text-sm text-muted">
          Plan:{" "}
          <span className="font-semibold text-ink">
            {resumenPlan(plan, ex.unidad, { min: conRango ? ex.rep_min : null, max: conRango ? ex.rep_max : null, porLado: ex.por_lado })}
          </span>
          {ex.descanso_seg ? (companero ? ` · descanso ${descansos[ex.id]} s al terminar la superserie` : ` · descanso ${descansos[ex.id]} s`) : ""}
        </p>
        <EtiquetasEjercicio ej={ex} companero={companero} />
        {pasada ? (
          <p className="mt-0.5 text-sm text-muted">
            Semana pasada: <span className="font-semibold text-ink">{pasada}</span>
          </p>
        ) : null}
        {plan?.nota_ia ? (
          <p className="mt-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
            💡 {plan.nota_ia}
          </p>
        ) : null}
        <ComoSeHace ej={ex} abierto={hechasEx.length === 0} />
      </section>

      <div className="mt-3">
        <RestTimer
          duracion={descansos[ex.id] ?? 90}
          disparo={disparo}
          onCambiarDuracion={cambiarDescanso}
        />
      </div>

      {hechasEx.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {hechasEx.map((s) => (
            <li
              key={s.serie}
              className="flex items-center justify-between rounded-xl border border-ok/40 px-3 py-2 text-sm"
            >
              <span className="font-semibold">✓ Serie {s.serie}</span>
              <span className="text-muted">
                {s.reps} reps
                {s.peso != null && conPeso ? ` × ${fmtNum(s.peso)} kg` : ""}
                {s.alFallo ? " · al fallo" : s.rir != null ? ` · RIR ${s.rir}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!completo ? (
        <section className="card mt-3 border-accent/50">
          <div className="flex items-center justify-between">
            <p className="font-bold">
              Serie {serieActual} de {totalSeries}
            </p>
            {prevSerie ? (
              <span className="text-xs text-muted">
                sem. pasada: {prevSerie.reps ?? "—"}
                {conPeso && prevSerie.peso_kg != null ? ` × ${fmtNum(prevSerie.peso_kg)} kg` : " reps"}
              </span>
            ) : null}
          </div>
          {ex.tempo ? (
            <GuiaCadencia
              key={clave}
              tempo={ex.tempo}
              verbos={ex.verbos}
              completas={completas}
              parciales={parciales}
              porLado={ex.por_lado}
              onTerminar={(reps) => setBorrador({ ...actual, reps })}
            />
          ) : null}
          <div className="mt-3 flex flex-wrap items-end justify-around gap-3">
            <Stepper
              etiqueta="Reps"
              valor={actual.reps}
              paso={1}
              min={0}
              max={100}
              onCambio={(v) => setBorrador({ ...actual, reps: v })}
            />
            {conPeso ? (
              <Stepper
                etiqueta="Peso"
                sufijo="kg"
                valor={actual.peso}
                paso={ex.incremento_kg || 2.5}
                min={0}
                max={500}
                onCambio={(v) => setBorrador({ ...actual, peso: v })}
              />
            ) : null}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                Esfuerzo
              </span>
              <select
                aria-label="RIR o al fallo"
                value={actual.alFallo ? "F" : actual.rir ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setBorrador({
                    ...actual,
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
          </div>
          {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
          {records.filter((r) => r.ejercicio === ex.nombre).slice(-1).map((r) => (
            <p key={r.valor} className="mt-2 rounded-xl border border-ok/40 bg-ok/10 px-3 py-1.5 text-sm font-semibold text-ok">
              🏆 ¡Récord! {fmtNum(r.valor)} {r.tipo === "peso" ? "kg" : "reps"}
              {r.anterior != null ? ` (antes ${fmtNum(r.anterior)})` : ""}
            </p>
          ))}
          <button
            type="button"
            onClick={registrar}
            disabled={pendiente}
            className="btn-primary mt-4 w-full text-lg"
          >
            {pendiente ? "Guardando…" : `Registrar serie ${serieActual}`}
          </button>
        </section>
      ) : (
        <section className="card mt-3 border-ok/40 text-center">
          <p className="font-semibold text-ok">✓ Ejercicio completo</p>
          <p className="mt-1 text-sm text-muted">
            Puedes sumar una serie extra o pasar al siguiente.
          </p>
          <button
            type="button"
            onClick={() => setExtras((x) => ({ ...x, [ex.id]: (x[ex.id] ?? 0) + 1 }))}
            className="btn-ghost mt-3 w-full text-sm"
          >
            + Serie extra
          </button>
        </section>
      )}

      <div className="mt-3 flex gap-2">
        {indice > 0 ? (
          <button
            type="button"
            onClick={() => setIndice((i) => i - 1)}
            className="btn-ghost flex-1"
          >
            ‹ Anterior
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setIndice((i) => i + 1)}
          className={`${completo ? "btn-primary" : "btn-ghost"} flex-1`}
        >
          {indice + 1 >= ejercicios.length ? "Terminar" : completo ? "Siguiente ›" : "Saltar ›"}
        </button>
      </div>
    </main>
  );
}
