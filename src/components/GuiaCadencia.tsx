"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { secuenciaCadencia, textoRep } from "@/lib/rutina";
import type { Tempo, VerbosCadencia } from "@/lib/types";

// Cronómetro de la serie con la cadencia del plan: dice qué tramo toca
// ("Sube", "Aprieta", "Baja"), cuenta los segundos con un pitido y una
// vibración en cada cambio, y al final cuenta las parciales. Así el
// cliente no tiene que contar mientras empuja.
export default function GuiaCadencia({
  tempo,
  verbos,
  completas,
  parciales,
  porLado,
  onTerminar
}: {
  tempo: Tempo;
  verbos: VerbosCadencia | null;
  completas: number;
  parciales: number;
  porLado: boolean;
  onTerminar: (reps: number) => void; // reps hechas (completas + parciales)
}) {
  const pasos = useMemo(
    () => secuenciaCadencia(tempo, verbos, completas, parciales, porLado),
    [tempo, verbos, completas, parciales, porLado]
  );
  const [indice, setIndice] = useState<number | null>(null); // null = sin empezar
  const [restante, setRestante] = useState(0);
  const [pausa, setPausa] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const bloqueo = useRef<{ release: () => Promise<void> } | null>(null);

  function pitido(agudo: boolean) {
    try {
      const ctx = audio.current;
      if (ctx) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = agudo ? 1046 : 660;
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.16);
      }
      navigator.vibrate?.(agudo ? 120 : 60);
    } catch {}
  }

  function soltarPantalla() {
    void bloqueo.current?.release().catch(() => {});
    bloqueo.current = null;
  }

  function empezar() {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC && !audio.current) audio.current = new AC();
      void audio.current?.resume();
      // Que la pantalla no se apague a mitad de la serie
      const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      void wl?.request("screen").then((b) => (bloqueo.current = b)).catch(() => {});
    } catch {}
    setIndice(0);
    setRestante(pasos[0].seg);
    setPausa(false);
    pitido(true);
  }

  // Reps hechas si se corta antes (las del lado en curso; con "cambia de
  // lado", el primero ya quedó completo)
  function repsHechas(i: number): number {
    const p = pasos[i];
    if (p.tipo === "tramo") return (p.rep ?? 1) - 1;
    if (p.tipo === "parciales") return completas + (parciales - restante);
    if (p.tipo === "cambio") return completas + parciales;
    return 0;
  }

  function terminar(reps: number) {
    soltarPantalla();
    setIndice(null);
    onTerminar(reps);
  }

  useEffect(() => {
    if (indice == null || pausa) return;
    const t = setTimeout(() => {
      if (restante > 1) {
        setRestante(restante - 1);
        // En las parciales, un pitido por cada una
        if (pasos[indice].tipo === "parciales") pitido(false);
        return;
      }
      const sig = indice + 1;
      if (sig >= pasos.length) {
        pitido(true);
        terminar(completas + parciales);
        return;
      }
      setIndice(sig);
      setRestante(pasos[sig].seg);
      pitido(pasos[sig].tipo !== "tramo" || pasos[sig].rep !== pasos[indice].rep);
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, restante, pausa]);

  useEffect(() => () => soltarPantalla(), []);

  if (indice == null) {
    return (
      <button type="button" onClick={empezar} className="btn-ghost mt-3 w-full border-accent/50 text-accent">
        ▶ Guíame la serie ({textoRep(tempo, verbos).toLowerCase()}
        {parciales ? ` · ${parciales} parciales` : ""})
      </button>
    );
  }

  const paso = pasos[indice];
  const total = pasos.reduce((n, p) => n + p.seg, 0);
  const pasado = pasos.slice(0, indice).reduce((n, p) => n + p.seg, 0) + (paso.seg - restante);
  return (
    <div className="mt-3 rounded-2xl border border-accent/50 bg-accent/10 p-4 text-center" aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {paso.tipo === "tramo"
          ? `Repetición ${paso.rep} de ${completas}`
          : paso.tipo === "parciales"
            ? `${parciales} parciales cortas, sin soltar`
            : "Serie guiada"}
        {paso.lado ? ` · lado ${paso.lado}` : ""}
      </p>
      <p className="mt-1 text-4xl font-black uppercase tracking-wide text-accent">{paso.texto}</p>
      <p className="text-5xl font-black" style={{ fontVariantNumeric: "tabular-nums" }}>
        {paso.tipo === "parciales" ? parciales - restante + 1 : restante}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (pasado / total) * 100)}%` }} />
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setPausa((p) => !p)} className="btn-ghost flex-1">
          {pausa ? "▶ Seguir" : "❚❚ Pausa"}
        </button>
        <button type="button" onClick={() => terminar(repsHechas(indice))} className="btn-ghost flex-1">
          ■ Terminé aquí
        </button>
      </div>
    </div>
  );
}
