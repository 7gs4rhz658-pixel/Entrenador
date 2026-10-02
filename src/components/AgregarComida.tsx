"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  agregarComida,
  buscarAlimentos,
  crearIngredienteManual
} from "@/app/actions/nutricion";
import { MOMENTOS, macrosDe } from "@/lib/nutrition";
import type { Ingredient, Momento } from "@/lib/types";

const FUENTE: Record<Ingredient["fuente"], string> = {
  off: "Open Food Facts",
  usda: "USDA",
  manual: "cargado a mano"
};

// Buscador de alimentos (base local + Open Food Facts) con cantidad en
// gramos y vista previa de macros antes de registrar.
export default function AgregarComida({
  userId,
  fecha,
  momentoInicial = "almuerzo"
}: {
  userId?: string;
  fecha: string;
  momentoInicial?: Momento;
}) {
  const [abierto, setAbierto] = useState(false);
  const [momento, setMomento] = useState<Momento>(momentoInicial);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Ingredient[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [sel, setSel] = useState<Ingredient | null>(null);
  const [gramos, setGramos] = useState(100);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const ultimaBusqueda = useRef(0);

  // Búsqueda con debounce
  useEffect(() => {
    if (!abierto || sel) return;
    const t = texto.trim();
    if (t.length < 2) {
      setResultados([]);
      return;
    }
    const id = ++ultimaBusqueda.current;
    const timer = setTimeout(async () => {
      setBuscando(true);
      const r = await buscarAlimentos(t);
      if (id !== ultimaBusqueda.current) return;
      setBuscando(false);
      if (r.error) setError(r.error);
      else setResultados(r.resultados);
    }, 350);
    return () => clearTimeout(timer);
  }, [texto, abierto, sel]);

  function cerrar() {
    setAbierto(false);
    setSel(null);
    setTexto("");
    setResultados([]);
    setManual(false);
    setError(null);
  }

  function agregar() {
    if (!sel) return;
    setError(null);
    iniciar(async () => {
      const r = await agregarComida({
        userId,
        fecha,
        momento,
        ingredientId: sel.id,
        cantidad_g: gramos
      });
      if (r.error) setError(r.error);
      else cerrar();
    });
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="btn-primary w-full">
        + Agregar alimento
      </button>
    );
  }

  const preview = sel ? macrosDe(sel, gramos) : null;

  return (
    <section className="card border-accent/50">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Agregar alimento</h2>
        <button type="button" onClick={cerrar} className="text-sm font-medium text-muted">
          Cerrar
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {MOMENTOS.map((m) => (
          <button
            key={m.valor}
            type="button"
            onClick={() => setMomento(m.valor)}
            className={`chip px-2.5 py-1.5 ${
              momento === m.valor ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"
            }`}
          >
            {m.texto}
          </button>
        ))}
      </div>

      {!sel ? (
        <>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar: pollo, arroz, yogur…"
            className="input mt-3"
            autoFocus
          />
          {buscando ? <p className="mt-2 text-xs text-muted">Buscando…</p> : null}
          {resultados.length > 0 ? (
            <ul className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
              {resultados.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSel(r);
                      setGramos(100);
                    }}
                    className="w-full rounded-xl border border-line px-3 py-2 text-left"
                  >
                    <p className="font-semibold leading-snug">
                      {r.nombre}
                      {r.marca ? <span className="font-normal text-muted"> · {r.marca}</span> : null}
                    </p>
                    <p className="text-xs text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {Math.round(r.kcal_100)} kcal · P {r.prot_100} · C {r.carb_100} · G {r.grasa_100} (por 100 g) · {FUENTE[r.fuente]}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : texto.trim().length >= 2 && !buscando ? (
            <p className="mt-2 text-sm text-muted">Sin resultados. Probá otro nombre o cargalo a mano.</p>
          ) : null}
          {!manual ? (
            <button type="button" onClick={() => setManual(true)} className="mt-3 text-sm font-medium text-accent">
              Cargar un alimento a mano
            </button>
          ) : (
            <ManualForm
              nombreInicial={texto}
              onCreado={(ing) => {
                setSel(ing);
                setGramos(100);
                setManual(false);
              }}
              onCancelar={() => setManual(false)}
            />
          )}
        </>
      ) : (
        <div className="mt-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{sel.nombre}</p>
              <p className="text-xs text-muted">
                {Math.round(sel.kcal_100)} kcal por 100 g · {FUENTE[sel.fuente]}
              </p>
            </div>
            <button type="button" onClick={() => setSel(null)} className="text-sm font-medium text-muted">
              Cambiar
            </button>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Cantidad (g)</label>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={5000}
                value={gramos}
                onChange={(e) => setGramos(Number(e.target.value))}
                className="input"
              />
            </div>
            <div className="flex gap-1.5 pb-1">
              {[50, 100, 150, 200].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGramos(g)}
                  className="h-10 rounded-lg border border-line px-2 text-xs font-semibold text-muted"
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          {preview ? (
            <p className="mt-2 text-sm text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
              = <span className="font-semibold text-ink">{preview.kcal} kcal</span> · P {preview.prot_g} g · C {preview.carb_g} g · G {preview.grasa_g} g
            </p>
          ) : null}
          {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
          <button
            type="button"
            onClick={agregar}
            disabled={pendiente || !(gramos > 0)}
            className="btn-primary mt-3 w-full"
          >
            {pendiente ? "Guardando…" : `Agregar al ${MOMENTOS.find((m) => m.valor === momento)?.texto.toLowerCase()}`}
          </button>
        </div>
      )}
      {error && !sel ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
    </section>
  );
}

function ManualForm({
  nombreInicial,
  onCreado,
  onCancelar
}: {
  nombreInicial: string;
  onCreado: (ing: Ingredient) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [kcal, setKcal] = useState(0);
  const [prot, setProt] = useState(0);
  const [carb, setCarb] = useState(0);
  const [grasa, setGrasa] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function crear() {
    setError(null);
    iniciar(async () => {
      const r = await crearIngredienteManual({
        nombre,
        kcal_100: kcal,
        prot_100: prot,
        carb_100: carb,
        grasa_100: grasa
      });
      if (r.error || !r.ingrediente) setError(r.error ?? "No se pudo crear.");
      else onCreado(r.ingrediente);
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface2 p-3">
      <p className="text-sm font-semibold">Alimento a mano (valores por 100 g)</p>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="input mt-2" />
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[
          ["kcal", kcal, setKcal],
          ["Prot", prot, setProt],
          ["Carb", carb, setCarb],
          ["Grasa", grasa, setGrasa]
        ].map(([k, v, set]) => (
          <div key={k as string}>
            <label className="label text-xs">{k as string}</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={v as number}
              onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
              className="input px-2"
            />
          </div>
        ))}
      </div>
      {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onCancelar} className="btn-ghost flex-1 text-sm" disabled={pendiente}>
          Cancelar
        </button>
        <button type="button" onClick={crear} className="btn-primary flex-1 text-sm" disabled={pendiente}>
          {pendiente ? "Creando…" : "Crear y usar"}
        </button>
      </div>
    </div>
  );
}
