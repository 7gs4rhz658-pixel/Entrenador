// La fase del plan del entrenador en la que va el cliente: de qué se
// trata, sus reglas y cómo es cada serie (completas → parciales →
// descanso → siguiente serie), más el aviso cuando cambia de fase.

import { faseDeSemana, faseQueEmpieza, parcialesDeFase, textoRep, textoSemanas } from "@/lib/rutina";
import type { FaseRutina } from "@/lib/types";

function FlujoSerie({ fase }: { fase: FaseRutina }) {
  const p = parcialesDeFase([...fase.reglas, fase.objetivo]);
  const pasos = [
    fase.tempo
      ? { titulo: "Repetición completa", detalle: `${textoRep(fase.tempo, null)}${p ? ` · × ${p.completas}` : ""}` }
      : null,
    p ? { titulo: "Parciales", detalle: `${p.parciales} cortas, sin soltar la tensión` } : null,
    { titulo: "Descanso", detalle: fase.descanso_seg ? `${fase.descanso_seg} s` : "el del ejercicio" },
    { titulo: "Siguiente serie", detalle: null }
  ].filter((x): x is { titulo: string; detalle: string | null } => !!x);
  if (pasos.length < 3) return null;
  return (
    <ol className="mt-3 flex flex-col gap-1">
      {pasos.map((x, i) => (
        <li key={x.titulo} className="flex flex-col items-center text-center">
          <span className="w-full rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm">
            <span className="font-semibold">{x.titulo}</span>
            {x.detalle ? <span className="block text-xs text-muted">{x.detalle}</span> : null}
          </span>
          {i < pasos.length - 1 ? <span className="text-xs text-muted" aria-hidden>↓</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function TarjetaFase({
  fases,
  semana,
  compacta = false
}: {
  fases: FaseRutina[];
  semana: number;
  compacta?: boolean; // en el día: plegada, para no tapar los ejercicios
}) {
  const actual = faseDeSemana(fases, semana);
  if (!actual) return null;
  const { fase, numero } = actual;
  const sigue = faseQueEmpieza(fases, semana);
  const recienEmpieza = semana === fase.semana_desde && numero > 1;

  const cuerpo = (
    <>
      {fase.objetivo ? <p className="mt-1 text-sm text-muted">{fase.objetivo}</p> : null}
      {fase.reglas.length ? (
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
          {fase.reglas.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
      <FlujoSerie fase={fase} />
    </>
  );

  return (
    <section className="card mb-4 border-accent/40">
      {recienEmpieza ? (
        <p className="mb-2 rounded-xl border border-ok/40 bg-ok/10 px-3 py-1.5 text-sm font-semibold text-ok">
          Esta semana empiezas la fase {numero}: cambian ejercicios, cadencia y cargas.
        </p>
      ) : null}
      {compacta ? (
        <details>
          <summary className="cursor-pointer select-none">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              Fase {numero} de {fases.length} · {textoSemanas(fase)}
            </span>
            <span className="block font-bold">{fase.nombre}</span>
            <span className="text-xs font-medium text-accent">Cómo se entrena esta fase ▾</span>
          </summary>
          {cuerpo}
        </details>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Fase {numero} de {fases.length} · {textoSemanas(fase)}
          </p>
          <h2 className="font-bold">{fase.nombre}</h2>
          {cuerpo}
        </>
      )}
      {sigue ? (
        <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-3 py-1.5 text-sm">
          La próxima semana empieza la <span className="font-semibold">fase {sigue.numero}: {sigue.fase.nombre}</span>.
          Cambian los ejercicios y la forma de entrenar.
        </p>
      ) : null}
    </section>
  );
}

// Todas las fases del bloque y dónde va el cliente
export function LineaFases({ fases, semana }: { fases: FaseRutina[]; semana: number }) {
  if (fases.length < 2) return null;
  return (
    <ol className="mb-4 flex gap-1.5">
      {fases.map((f, i) => {
        const estado = semana > f.semana_hasta ? "hecha" : semana >= f.semana_desde ? "ahora" : "despues";
        return (
          <li
            key={i}
            className={`min-w-0 flex-1 rounded-xl border px-2 py-1.5 text-center text-xs ${
              estado === "ahora" ? "border-accent bg-accent/15 text-accent" : estado === "hecha" ? "border-ok/40 text-ok" : "border-line text-muted"
            }`}
          >
            <span className="block font-semibold">
              Fase {i + 1}
              {estado === "hecha" ? " ✓" : ""}
            </span>
            <span className="block truncate">{f.nombre}</span>
            <span className="block">{textoSemanas(f)}</span>
          </li>
        );
      })}
    </ol>
  );
}
