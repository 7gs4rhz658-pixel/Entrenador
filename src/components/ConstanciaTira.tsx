import { UMBRAL_DIA, type DiaConstancia } from "@/lib/hoy";

// Fondo tenue de un color del tema (las variables no tienen canal alfa)
const tinte = (variable: string, pct: number) => ({
  background: `color-mix(in srgb, var(${variable}) ${pct}%, transparent)`
});

// Últimos 14 días: cada cuadro es un día y el color dice cuánto se
// cumplió (verde = 70 % o más). Los días antes de arrancar el plan quedan
// vacíos.
export default function ConstanciaTira({ tira, promedio }: { tira: DiaConstancia[]; promedio: number | null }) {
  const hoy = tira[tira.length - 1]?.fecha;
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {tira.map((d) => {
          const [clase, fondo] =
            d.pct == null
              ? ["border border-dashed border-line text-muted", undefined]
              : d.pct >= UMBRAL_DIA
                ? ["text-ok", tinte("--ok", 22)]
                : d.pct > 0
                  ? ["text-warn", tinte("--warn", 18)]
                  : ["text-muted", tinte("--line", 70)];
          return (
            <span
              key={d.fecha}
              title={`${d.fecha}${d.pct != null ? ` · ${d.pct} %` : ""}`}
              className={`flex h-8 items-center justify-center rounded-lg text-xs font-semibold ${clase} ${
                d.fecha === hoy ? "ring-2 ring-accent" : ""
              }`}
              style={{ fontVariantNumeric: "tabular-nums", ...fondo }}
            >
              {Number(d.fecha.slice(8, 10))}
            </span>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {promedio != null ? `Promedio de los últimos 14 días: ${promedio} %` : "Tu constancia aparece aquí a partir de mañana."}
      </p>
    </div>
  );
}
