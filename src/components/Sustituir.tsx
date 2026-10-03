"use client";

import { useState, useTransition } from "react";
import {
  aplicarSustitucion,
  sustituirIngrediente,
  type ResultadoSustitucion
} from "@/app/actions/nutricion";
import type { CriterioSustitucion } from "@/lib/nutrition";

const CRITERIOS: { valor: CriterioSustitucion; texto: string }[] = [
  { valor: "kcal", texto: "calorías" },
  { valor: "prot", texto: "proteína" },
  { valor: "carb", texto: "carbohidratos" }
];

// "Cambiar frutos rojos por manzana": la IA (o un parser simple) entiende
// el pedido, y la cantidad del reemplazo sale de una regla de tres sobre
// la tabla de macros para mantener el criterio elegido.
export default function Sustituir({
  userId,
  fecha,
  hayComidas,
  conIA
}: {
  userId?: string;
  fecha: string;
  hayComidas: boolean;
  conIA: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [criterio, setCriterio] = useState<CriterioSustitucion | undefined>(undefined);
  const [res, setRes] = useState<ResultadoSustitucion | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [aplicando, setAplicando] = useState<string | null>(null);

  function consultar(c?: CriterioSustitucion) {
    if (texto.trim().length < 3) return;
    iniciar(async () => {
      const r = await sustituirIngrediente({ userId, fecha, texto, criterio: c ?? criterio });
      setRes(r);
      if (r.criterio) setCriterio(r.criterio);
    });
  }

  function aplicar(ingredientId: string, gramos: number) {
    if (!res?.comida) return;
    setAplicando(ingredientId);
    iniciar(async () => {
      const r = await aplicarSustitucion({ mealLogId: res.comida!.id, ingredientId, gramos });
      setAplicando(null);
      if (r.error) setRes({ ...res, error: r.error });
      else {
        setAbierto(false);
        setRes(null);
        setTexto("");
      }
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={!hayComidas}
        className="btn-ghost w-full"
        title={hayComidas ? "" : "Primero registra alguna comida"}
      >
        🔄 Sustituir un ingrediente
      </button>
    );
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Sustituir ingrediente</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm font-medium text-muted">
          Cerrar
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Escribe el cambio y calculamos la cantidad que mantiene{" "}
        {conIA ? "los macros del plato" : "las calorías"}.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") consultar();
          }}
          placeholder='Ej: "cambiar frutos rojos por manzana"'
          className="input"
        />
        <button type="button" onClick={() => consultar()} disabled={pendiente} className="btn-primary shrink-0">
          {pendiente && !aplicando ? "…" : "Ver"}
        </button>
      </div>

      {res?.error ? <p className="mt-2 text-sm font-medium text-danger">✗ {res.error}</p> : null}

      {res?.comida && res.opciones && res.macrosOriginal ? (
        <div className="mt-3">
          <p className="text-sm">
            <span className="text-muted">Reemplazar</span>{" "}
            <span className="font-semibold">
              {res.comida.ingredient.nombre} · {Math.round(res.comida.cantidad_g)} g
            </span>{" "}
            <span className="text-muted">
              ({res.macrosOriginal.kcal} kcal · P {res.macrosOriginal.prot_g} · C {res.macrosOriginal.carb_g} · G {res.macrosOriginal.grasa_g})
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            Igualar por:
            {CRITERIOS.map((c) => (
              <button
                key={c.valor}
                type="button"
                onClick={() => {
                  setCriterio(c.valor);
                  consultar(c.valor);
                }}
                className={`chip ${
                  criterio === c.valor ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"
                }`}
              >
                {c.texto}
              </button>
            ))}
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {res.opciones.map((o) => (
              <li key={o.ingrediente.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-snug">
                    {o.ingrediente.nombre}
                    {o.ingrediente.marca ? <span className="font-normal text-muted"> · {o.ingrediente.marca}</span> : null}
                  </p>
                  <p className="text-xs text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <span className="font-semibold text-ink">{o.gramos} g</span> · {o.macros.kcal} kcal · P {o.macros.prot_g} · C {o.macros.carb_g} · G {o.macros.grasa_g}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => aplicar(o.ingrediente.id, o.gramos)}
                  disabled={pendiente}
                  className="btn-primary shrink-0 px-3 py-1.5 text-sm"
                >
                  {aplicando === o.ingrediente.id ? "…" : "Usar"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
