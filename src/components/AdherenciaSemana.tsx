import type { AdherenciaSemana as Datos } from "@/lib/stats";

function Anillo({ valor, total, etiqueta }: { valor: number; total: number; etiqueta: string }) {
  const pct = total > 0 ? Math.min(1, valor / total) : 0;
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={pct >= 0.99 ? "var(--ok)" : "var(--accent)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform="rotate(-90 28 28)"
        />
      </svg>
      <div>
        <p className="text-lg font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
          {valor}
          <span className="text-sm font-medium text-muted">/{total}</span>
        </p>
        <p className="text-xs text-muted">{etiqueta}</p>
      </div>
    </div>
  );
}

// Semana en curso: entrenos y comidas del menú hechos hasta hoy.
export default function AdherenciaSemana({ datos }: { datos: Datos }) {
  if (!datos.entrenos_semana && !datos.comidas_esperadas) return null;
  return (
    <section className="card mb-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">Tu semana</h2>
        <span className="text-xs text-muted">hasta hoy</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Anillo valor={datos.entrenos_hechos} total={datos.entrenos_planificados} etiqueta={`entrenos (${datos.entrenos_semana} en la semana)`} />
        {datos.comidas_esperadas ? (
          <Anillo valor={datos.comidas_hechas} total={datos.comidas_esperadas} etiqueta="comidas del menú" />
        ) : null}
      </div>
    </section>
  );
}
