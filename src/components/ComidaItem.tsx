"use client";

import { useState, useTransition } from "react";
import { actualizarComida, borrarComida } from "@/app/actions/nutricion";
import { macrosDe } from "@/lib/nutrition";
import type { MealLog } from "@/lib/types";

export default function ComidaItem({ comida }: { comida: MealLog }) {
  const [editando, setEditando] = useState(false);
  const [gramos, setGramos] = useState(comida.cantidad_g);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const m = macrosDe(comida.ingredient, comida.cantidad_g);

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await actualizarComida({ id: comida.id, cantidad_g: gramos });
      if (r.error) setError(r.error);
      else setEditando(false);
    });
  }

  function borrar() {
    if (!window.confirm(`¿Quitar ${comida.ingredient.nombre}?`)) return;
    iniciar(async () => {
      const r = await borrarComida(comida.id);
      if (r.error) setError(r.error);
    });
  }

  return (
    <li className="rounded-xl border border-line px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold leading-snug">
            {comida.ingredient.nombre}
            {comida.plan_item_id ? <span className="ml-1.5 text-xs font-medium text-accent">del menú</span> : null}
          </p>
          <p className="text-xs text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
            {Math.round(comida.cantidad_g)} g · {m.kcal} kcal · P {m.prot_g} · C {m.carb_g} · G {m.grasa_g}
          </p>
        </div>
        <div className="flex shrink-0 gap-3 text-sm font-medium">
          <button type="button" onClick={() => setEditando((e) => !e)} className="text-accent">
            {editando ? "Cerrar" : "Editar"}
          </button>
          <button type="button" onClick={borrar} disabled={pendiente} className="text-danger">
            Quitar
          </button>
        </div>
      </div>
      {editando ? (
        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1">
            <label className="label">Cantidad (g)</label>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={gramos}
              onChange={(e) => setGramos(Number(e.target.value))}
              className="input"
            />
          </div>
          <button type="button" onClick={guardar} disabled={pendiente} className="btn-primary">
            OK
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-sm font-medium text-danger">✗ {error}</p> : null}
    </li>
  );
}
