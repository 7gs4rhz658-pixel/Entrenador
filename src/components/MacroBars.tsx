import { fmtKcal } from "@/lib/format";
import type { Macros } from "@/lib/nutrition";

function Barra({
  etiqueta,
  valor,
  objetivo,
  unidad
}: {
  etiqueta: string;
  valor: number;
  objetivo: number;
  unidad: string;
}) {
  const pct = objetivo > 0 ? Math.min(100, (valor / objetivo) * 100) : 0;
  const pasado = objetivo > 0 && valor > objetivo * 1.05;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">{etiqueta}</span>
        <span
          className={`font-semibold ${pasado ? "text-warn" : ""}`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {Math.round(valor)}
          <span className="font-normal text-muted">
            {" "}
            / {Math.round(objetivo)} {unidad}
          </span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${pasado ? "bg-warn" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Consumido vs objetivo del día: calorías grandes + 3 barras de macros.
export default function MacroBars({
  consumido,
  objetivo
}: {
  consumido: Macros;
  objetivo: Macros;
}) {
  const restante = objetivo.kcal - consumido.kcal;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtKcal(consumido.kcal)}
          <span className="text-base font-medium text-muted"> / {fmtKcal(objetivo.kcal)}</span>
        </p>
        <p className={`text-sm font-semibold ${restante < 0 ? "text-warn" : "text-muted"}`}>
          {restante >= 0 ? `quedan ${fmtKcal(restante)}` : `${fmtKcal(-restante)} de más`}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        <Barra etiqueta="Proteína" valor={consumido.prot_g} objetivo={objetivo.prot_g} unidad="g" />
        <Barra etiqueta="Carbohidratos" valor={consumido.carb_g} objetivo={objetivo.carb_g} unidad="g" />
        <Barra etiqueta="Grasa" valor={consumido.grasa_g} objetivo={objetivo.grasa_g} unidad="g" />
      </div>
    </div>
  );
}
