"use client";

import { useState } from "react";

// Input numérico con botones +/- grandes, pensado para el teléfono en el
// gym. Permite tipear el valor directo (acepta coma o punto decimal).
export default function Stepper({
  valor,
  onCambio,
  paso = 1,
  min = 0,
  max = 999,
  sufijo,
  etiqueta
}: {
  valor: number;
  onCambio: (v: number) => void;
  paso?: number;
  min?: number;
  max?: number;
  sufijo?: string;
  etiqueta: string;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);

  const red = (n: number) => Math.round(n * 100) / 100;
  const fija = (n: number) => Math.min(max, Math.max(min, red(n)));

  function confirmarBorrador() {
    if (borrador == null) return;
    const n = parseFloat(borrador.replace(",", "."));
    if (Number.isFinite(n)) onCambio(fija(n));
    setBorrador(null);
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {etiqueta}
      </span>
      <div className="flex items-center overflow-hidden rounded-xl border border-line bg-surface2">
        <button
          type="button"
          aria-label={`Restar ${etiqueta}`}
          onClick={() => onCambio(fija(valor - paso))}
          className="h-11 w-10 shrink-0 text-xl font-bold text-muted active:bg-line"
        >
          −
        </button>
        <input
          inputMode="decimal"
          aria-label={etiqueta}
          value={borrador ?? String(valor).replace(".", ",")}
          onFocus={(e) => {
            setBorrador(String(valor));
            e.target.select();
          }}
          onChange={(e) => setBorrador(e.target.value)}
          onBlur={confirmarBorrador}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-11 w-14 border-x border-line bg-transparent text-center text-base font-semibold outline-none"
        />
        <button
          type="button"
          aria-label={`Sumar ${etiqueta}`}
          onClick={() => onCambio(fija(valor + paso))}
          className="h-11 w-10 shrink-0 text-xl font-bold text-muted active:bg-line"
        >
          +
        </button>
      </div>
      {sufijo ? <span className="text-[11px] text-muted">{sufijo}</span> : null}
    </div>
  );
}
