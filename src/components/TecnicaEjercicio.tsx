// Cómo se ejecuta un ejercicio del plan del entrenador: etiquetas
// (cadencia, parciales, superserie, por lado) y el paso a paso.

import { repsDeSerie, textoRep, textoTempo } from "@/lib/rutina";
import type { Exercise } from "@/lib/types";

type Ej = Pick<Exercise, "tempo" | "parciales" | "superserie" | "por_lado" | "rep_min" | "rep_max" | "verbos">;

export function EtiquetasEjercicio({ ej, companero }: { ej: Ej; companero?: string | null }) {
  const { completas, parciales } = repsDeSerie(ej);
  const chips = [
    ej.tempo ? `Cadencia ${textoTempo(ej.tempo)}` : null,
    parciales ? `${completas} completas + ${parciales} parciales` : null,
    ej.superserie ? `Superserie ${ej.superserie}${companero ? ` con ${companero}` : ""}` : null,
    ej.por_lado ? "Por lado" : null
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c} className="chip border-accent/40 text-accent">
          {c}
        </span>
      ))}
    </div>
  );
}

// El paso a paso del entrenador (o de la IA); sin pasos, la descripción y
// los tips de siempre
export function ComoSeHace({
  ej,
  abierto = false
}: {
  ej: Pick<Exercise, "pasos" | "clave" | "nota" | "descripcion" | "tips" | "tempo" | "verbos">;
  abierto?: boolean;
}) {
  const conPasos = ej.pasos.length > 0;
  if (!conPasos && !ej.descripcion && !ej.tips.length && !ej.nota) return null;
  return (
    <details className="mt-2 rounded-xl bg-surface2 px-3 py-2" open={abierto}>
      <summary className="cursor-pointer select-none text-sm font-medium text-accent">
        {conPasos ? "Cómo se hace, paso a paso" : "Técnica y tips"}
      </summary>
      {ej.nota ? (
        <p className="mt-2 text-sm">
          <span className="font-semibold">Indicación del plan:</span> {ej.nota}
        </p>
      ) : null}
      {ej.tempo ? (
        <p className="mt-1 text-sm text-muted">
          Cada repetición: <span className="font-semibold text-ink">{textoRep(ej.tempo, ej.verbos).toLowerCase()}</span>
        </p>
      ) : null}
      {conPasos ? (
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm text-ink/90">
          {ej.pasos.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      ) : (
        <>
          {ej.descripcion ? <p className="mt-2 text-sm text-ink/90">{ej.descripcion}</p> : null}
          {ej.tips.length ? (
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
              {ej.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      {ej.clave ? (
        <p className="mt-2 rounded-lg border border-warn/40 bg-warn/10 px-2.5 py-1.5 text-sm">
          <span className="font-semibold">Clave:</span> {ej.clave}
        </p>
      ) : null}
    </details>
  );
}
