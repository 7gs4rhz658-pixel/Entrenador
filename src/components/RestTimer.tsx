"use client";

import { useEffect, useRef, useState } from "react";
import { fmtSegundos } from "@/lib/format";

// Cronómetro de descanso. Se dispara desde afuera con `disparo` (cada vez
// que cambia arranca de nuevo) y usa `duracion` segundos. Avisa con
// sonido y vibración al terminar.
export default function RestTimer({
  duracion,
  disparo,
  onCambiarDuracion,
  onTerminar,
  compacto = false
}: {
  duracion: number;
  disparo: number; // contador: cada incremento reinicia el cronómetro
  onCambiarDuracion: (seg: number) => void;
  onTerminar?: () => void;
  compacto?: boolean;
}) {
  const [restante, setRestante] = useState<number | null>(null);
  const [pausado, setPausado] = useState(false);
  const finRef = useRef<number>(0);
  const ultimoDisparo = useRef(disparo);

  // Arranque por disparo
  useEffect(() => {
    if (disparo === ultimoDisparo.current) return;
    ultimoDisparo.current = disparo;
    if (disparo <= 0) return;
    finRef.current = Date.now() + duracion * 1000;
    setRestante(duracion);
    setPausado(false);
  }, [disparo, duracion]);

  // Tick
  useEffect(() => {
    if (restante == null || pausado) return;
    const id = setInterval(() => {
      const r = Math.max(0, Math.round((finRef.current - Date.now()) / 1000));
      setRestante(r);
      if (r === 0) {
        clearInterval(id);
        avisar();
        onTerminar?.();
        setTimeout(() => setRestante(null), 1500);
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante == null, pausado]);

  function avisar() {
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {}
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      [0, 0.25, 0.5].forEach((t) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        o.connect(g);
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0.3, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.2);
      });
    } catch {}
  }

  function ajustar(delta: number) {
    const nueva = Math.min(600, Math.max(0, duracion + delta));
    onCambiarDuracion(nueva);
    if (restante != null && !pausado) {
      finRef.current += delta * 1000;
      setRestante(Math.max(0, Math.round((finRef.current - Date.now()) / 1000)));
    }
  }

  function togglePausa() {
    if (restante == null) return;
    if (pausado) {
      finRef.current = Date.now() + restante * 1000;
      setPausado(false);
    } else {
      setPausado(true);
    }
  }

  const corriendo = restante != null;
  const progreso = corriendo ? 1 - restante / Math.max(duracion, 1) : 0;

  return (
    <div
      className={`rounded-xl border ${
        corriendo && restante === 0
          ? "border-ok/60 bg-ok/10"
          : corriendo
            ? "border-accent/60 bg-accent/10"
            : "border-line bg-surface2"
      } ${compacto ? "px-3 py-2" : "p-3"}`}
      role="timer"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Descanso
          </p>
          <p
            className={`font-bold ${compacto ? "text-xl" : "text-3xl"}`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {corriendo ? fmtSegundos(restante) : fmtSegundos(duracion)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => ajustar(-15)}
            className="h-10 min-w-[44px] rounded-lg border border-line px-2 text-sm font-semibold text-muted"
            aria-label="Restar 15 segundos"
          >
            −15
          </button>
          <button
            type="button"
            onClick={() => ajustar(15)}
            className="h-10 min-w-[44px] rounded-lg border border-line px-2 text-sm font-semibold text-muted"
            aria-label="Sumar 15 segundos"
          >
            +15
          </button>
          {corriendo ? (
            <>
              <button
                type="button"
                onClick={togglePausa}
                className="h-10 min-w-[44px] rounded-lg border border-line px-2 text-sm font-semibold"
              >
                {pausado ? "▶" : "❚❚"}
              </button>
              <button
                type="button"
                onClick={() => setRestante(null)}
                className="h-10 min-w-[44px] rounded-lg border border-line px-2 text-sm font-semibold text-muted"
                aria-label="Saltar descanso"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                finRef.current = Date.now() + duracion * 1000;
                setRestante(duracion);
                setPausado(false);
              }}
              className="h-10 min-w-[44px] rounded-lg bg-accent px-3 text-sm font-bold text-accent-ink"
            >
              ▶
            </button>
          )}
        </div>
      </div>
      {corriendo ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full ${restante === 0 ? "bg-ok" : "bg-accent"}`}
            style={{ width: `${Math.round(progreso * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
