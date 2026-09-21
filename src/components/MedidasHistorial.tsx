"use client";

import { useState, useTransition } from "react";
import { borrarMedidas } from "@/app/actions/medidas";
import { fmtFechaCorta } from "@/lib/format";
import { ETIQUETAS_MEDIDA, compararMedidas, fmtDelta } from "@/lib/medidas";
import { CAMPOS_MEDIDA, type CampoMedida, type Medida } from "@/lib/types";

// Comparación última vs anterior vs primera, gráfica por medida e
// historial de tomas. `medidas` viene de la más nueva a la más vieja.
export default function MedidasHistorial({ medidas, puedeBorrar = true }: { medidas: Medida[]; puedeBorrar?: boolean }) {
  const comparacion = compararMedidas(medidas);
  const conDatos = CAMPOS_MEDIDA.filter((c) => medidas.some((m) => m[c] != null));
  const [campo, setCampo] = useState<CampoMedida | "peso_kg">(conDatos.includes("cintura") ? "cintura" : conDatos[0] ?? "peso_kg");
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!medidas.length) {
    return (
      <p className="card text-center text-sm text-muted">
        Todavía no hay medidas. La primera toma es tu punto de partida: después cada comparación sale
        sola.
      </p>
    );
  }

  const serie = [...medidas]
    .reverse()
    .map((m) => ({ fecha: m.fecha, valor: m[campo] != null ? Number(m[campo]) : null }))
    .filter((p) => p.valor != null) as { fecha: string; valor: number }[];
  const min = serie.length ? Math.min(...serie.map((p) => p.valor)) : 0;
  const max = serie.length ? Math.max(...serie.map((p) => p.valor)) : 1;
  const rango = Math.max(1, max - min);
  const W = 320;
  const H = 120;
  const x = (i: number) => (serie.length > 1 ? (i / (serie.length - 1)) * (W - 20) + 10 : W / 2);
  const y = (v: number) => H - 15 - ((v - min) / rango) * (H - 30);
  const camino = serie.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");

  // Peso: la última toma contra la anterior y la primera que lo tengan
  const conPeso = medidas.filter((m) => m.peso_kg != null);
  const pesoUltimo = medidas[0].peso_kg != null ? Number(medidas[0].peso_kg) : null;
  const pesoAnterior = conPeso.length > 1 && pesoUltimo != null ? Number(conPeso[1].peso_kg) : null;
  const pesoPrimero = conPeso.length > 1 && pesoUltimo != null ? Number(conPeso[conPeso.length - 1].peso_kg) : null;

  function borrar(m: Medida) {
    if (!window.confirm(`¿Borrar la toma del ${fmtFechaCorta(m.fecha)}?`)) return;
    setError(null);
    iniciar(async () => {
      const r = await borrarMedidas({ id: m.id });
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {comparacion.length ? (
        <section className="card">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Última toma</h2>
            <span className="text-xs text-muted">{fmtFechaCorta(medidas[0].fecha)}</span>
          </div>
          <table className="mt-2 w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="text-left font-medium">Medida</th>
                <th className="text-right font-medium">cm</th>
                <th className="text-right font-medium">vs anterior</th>
                <th className="text-right font-medium">vs inicio</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
              {pesoUltimo != null ? (
                <tr className="border-t border-line">
                  <td className="py-1">Peso (kg)</td>
                  <td className="py-1 text-right font-semibold">{pesoUltimo}</td>
                  <td className="py-1 text-right text-muted">{fmtDelta(pesoAnterior != null ? pesoUltimo - pesoAnterior : null)}</td>
                  <td className="py-1 text-right text-muted">{fmtDelta(pesoPrimero != null ? pesoUltimo - pesoPrimero : null)}</td>
                </tr>
              ) : null}
              {comparacion.map((c) => (
                <tr key={c.campo} className="border-t border-line">
                  <td className="py-1">{ETIQUETAS_MEDIDA[c.campo]}</td>
                  <td className="py-1 text-right font-semibold">{c.actual}</td>
                  <td className="py-1 text-right text-muted">{fmtDelta(c.anterior != null ? c.actual - c.anterior : null)}</td>
                  <td className="py-1 text-right text-muted">{fmtDelta(c.primera != null ? c.actual - c.primera : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {serie.length >= 2 ? (
        <section className="card">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-bold">Evolución</h2>
            <select value={campo} onChange={(e) => setCampo(e.target.value as CampoMedida | "peso_kg")} className="input w-auto px-2 py-1 text-sm">
              {medidas.some((m) => m.peso_kg != null) ? <option value="peso_kg">Peso</option> : null}
              {conDatos.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETAS_MEDIDA[c]}
                </option>
              ))}
            </select>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Evolución de la medida">
            <path d={camino} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {serie.map((p, i) => (
              <g key={p.fecha}>
                <circle cx={x(i)} cy={y(p.valor)} r="3.5" fill="var(--accent)" />
                <text x={x(i)} y={y(p.valor) - 8} textAnchor="middle" fontSize="10" fill="var(--ink)">
                  {p.valor}
                </text>
                <text x={x(i)} y={H - 2} textAnchor="middle" fontSize="9" fill="var(--muted)">
                  {fmtFechaCorta(p.fecha).replace(/^\w+,?\s*/, "")}
                </text>
              </g>
            ))}
          </svg>
        </section>
      ) : null}

      <section className="card">
        <h2 className="font-bold">Historial</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {medidas.map((m) => {
            const cargadas = CAMPOS_MEDIDA.filter((c) => m[c] != null).length + (m.peso_kg != null ? 1 : 0);
            return (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                <div>
                  <p className="font-semibold">{fmtFechaCorta(m.fecha)}</p>
                  <p className="text-xs text-muted">
                    {cargadas} medida{cargadas === 1 ? "" : "s"}
                    {m.cintura != null ? ` · cintura ${m.cintura}` : ""}
                    {m.peso_kg != null ? ` · ${m.peso_kg} kg` : ""}
                    {m.notas ? ` · ${m.notas}` : ""}
                  </p>
                </div>
                {puedeBorrar ? (
                  <button type="button" onClick={() => borrar(m)} disabled={pendiente} className="text-xs font-medium text-danger">
                    Borrar
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
      </section>
    </div>
  );
}
