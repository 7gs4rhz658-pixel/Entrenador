"use client";

import { useMemo, useRef, useState } from "react";
import { fmtNum } from "@/lib/format";

export interface PuntoProgreso {
  semana: number;
  valor: number | null;
}

// Gráfico de línea de una sola serie (evolución por semana).
// Specs: línea 2px, marcadores >=8px de hit target, grilla recesiva,
// crosshair + tooltip al tocar, y tabla accesible debajo (en la página).
const W = 560;
const H = 280;
const M = { top: 16, right: 16, bottom: 34, left: 48 };

function pasoLindo(bruto: number): number {
  if (bruto <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (bruto <= m * mag) return m * mag;
  }
  return 10 * mag;
}

export default function ProgressChart({
  puntos,
  sufijo
}: {
  puntos: PuntoProgreso[];
  sufijo: string; // "kg" o "reps"
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activa, setActiva] = useState<number | null>(null);

  const conDatos = puntos.filter((p) => p.valor != null);

  const escala = useMemo(() => {
    const valores = conDatos.map((p) => p.valor!);
    const minV = valores.length ? Math.min(...valores) : 0;
    const maxV = valores.length ? Math.max(...valores) : 10;
    const margen = maxV === minV ? Math.max(maxV * 0.1, 1) : (maxV - minV) * 0.15;
    const y0 = Math.max(0, minV - margen);
    const y1 = maxV + margen;
    const paso = pasoLindo((y1 - y0) / 3.5);
    const tickMin = Math.ceil(y0 / paso) * paso;
    const ticks: number[] = [];
    for (let t = tickMin; t <= y1 + 1e-9; t += paso) ticks.push(Math.round(t * 100) / 100);

    const nSemanas = puntos.length;
    const x = (semana: number) =>
      M.left +
      ((semana - 1) / Math.max(nSemanas - 1, 1)) * (W - M.left - M.right);
    const y = (v: number) =>
      H - M.bottom - ((v - y0) / Math.max(y1 - y0, 1e-9)) * (H - M.top - M.bottom);
    return { x, y, ticks };
  }, [puntos, conDatos]);

  const linea = useMemo(() => {
    let d = "";
    let previo = false;
    for (const p of puntos) {
      if (p.valor == null) {
        previo = false;
        continue;
      }
      const cmd = previo ? "L" : "M";
      d += `${cmd}${escala.x(p.semana).toFixed(1)},${escala.y(p.valor).toFixed(1)} `;
      previo = true;
    }
    return d.trim();
  }, [puntos, escala]);

  function alMover(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let mejor: number | null = null;
    let distancia = Infinity;
    for (const p of puntos) {
      if (p.valor == null) continue;
      const d = Math.abs(escala.x(p.semana) - px);
      if (d < distancia) {
        distancia = d;
        mejor = p.semana;
      }
    }
    setActiva(mejor);
  }

  const puntoActivo = puntos.find((p) => p.semana === activa && p.valor != null);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`Evolución por semana (${sufijo})`}
        onPointerMove={alMover}
        onPointerDown={alMover}
        onPointerLeave={() => setActiva(null)}
      >
        {/* Grilla horizontal recesiva */}
        {escala.ticks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={escala.y(t)}
              y2={escala.y(t)}
              stroke="var(--line)"
              strokeWidth="1"
            />
            <text
              x={M.left - 8}
              y={escala.y(t) + 4}
              textAnchor="end"
              fontSize="12"
              fill="var(--muted)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fmtNum(t)}
            </text>
          </g>
        ))}

        {/* Eje X: semanas */}
        {puntos.map((p) => (
          <text
            key={p.semana}
            x={escala.x(p.semana)}
            y={H - 10}
            textAnchor="middle"
            fontSize="12"
            fill="var(--muted)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {p.semana}
          </text>
        ))}
        <text
          x={W - M.right}
          y={H - 10}
          textAnchor="end"
          fontSize="11"
          fill="var(--muted)"
        >

        </text>

        {/* Crosshair */}
        {puntoActivo ? (
          <line
            x1={escala.x(puntoActivo.semana)}
            x2={escala.x(puntoActivo.semana)}
            y1={M.top}
            y2={H - M.bottom}
            stroke="var(--muted)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}

        {/* Línea de la serie */}
        {linea ? (
          <path
            d={linea}
            fill="none"
            stroke="var(--serie)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Marcadores con anillo del color de la superficie */}
        {conDatos.map((p) => (
          <circle
            key={p.semana}
            cx={escala.x(p.semana)}
            cy={escala.y(p.valor!)}
            r={p.semana === activa ? 6 : 4.5}
            fill="var(--serie)"
            stroke="var(--surface)"
            strokeWidth="2"
          />
        ))}
      </svg>

      {puntoActivo ? (
        <div
          className="pointer-events-none absolute rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-xs font-semibold shadow-lg"
          style={{
            left: `${(escala.x(puntoActivo.semana) / W) * 100}%`,
            top: 0,
            transform:
              puntoActivo.semana > puntos.length / 2
                ? "translateX(calc(-100% - 8px))"
                : "translateX(8px)"
          }}
        >
          <span className="text-muted">Semana {puntoActivo.semana} · </span>
          {fmtNum(puntoActivo.valor!)} {sufijo}
        </div>
      ) : null}
    </div>
  );
}
