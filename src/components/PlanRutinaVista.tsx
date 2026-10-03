// Un plan de rutina (todavía no escrito en la base) agrupado por fase y
// día: lo que el entrenador revisa antes de guardarlo o enviarlo.

import { nombreDia } from "@/lib/format";
import { activoEnSemana, repsDeSerie, textoSemanas, textoTempo } from "@/lib/rutina";
import type { EjercicioGenerado, FaseRutina, PlanGenerado } from "@/lib/types";

export function textoPrescripcion(e: EjercicioGenerado): string {
  const reps = e.rep_min === e.rep_max ? `${e.rep_max}` : `${e.rep_min}–${e.rep_max}`;
  const peso =
    e.unidad === "kg" ? (e.peso_inicial_kg != null ? ` · ${e.peso_inicial_kg} kg` : "") : e.unidad === "peso_corporal" ? " · peso corporal" : "";
  return `${e.series} × ${e.al_fallo ? "al fallo" : reps}${e.por_lado ? " por lado" : ""}${peso} · ${e.descanso_seg} s`;
}

export function EtiquetasPlan({ e }: { e: EjercicioGenerado }) {
  const { completas, parciales } = repsDeSerie(e);
  const chips = [
    e.tempo ? `Cadencia ${textoTempo(e.tempo)}` : null,
    parciales ? `${completas} + ${parciales} parciales` : null,
    e.superserie ? `Superserie ${e.superserie}` : null
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <span className="mt-0.5 flex flex-wrap gap-1">
      {chips.map((c) => (
        <span key={c} className="chip border-accent/40 py-0 text-[11px] text-accent">
          {c}
        </span>
      ))}
    </span>
  );
}

// Grupos a mostrar: una entrada por fase (o una sola sin fases)
export function gruposPorFase(plan: PlanGenerado): { fase: FaseRutina | null; numero: number | null; semana: number }[] {
  const fases = plan.fases ?? [];
  return fases.length ? fases.map((f, i) => ({ fase: f, numero: i + 1, semana: f.semana_desde })) : [{ fase: null, numero: null, semana: 1 }];
}

export function CabeceraFase({ fase, numero }: { fase: FaseRutina; numero: number }) {
  return (
    <div className="rounded-xl bg-accent/10 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Fase {numero} · {textoSemanas(fase)}
        {fase.tempo ? ` · cadencia ${textoTempo(fase.tempo)}` : ""}
        {fase.descanso_seg ? ` · descanso ${fase.descanso_seg} s` : ""}
        {fase.rir != null ? ` · RIR ${fase.rir}` : ""}
      </p>
      <p className="font-bold">{fase.nombre}</p>
      {fase.objetivo ? <p className="text-sm text-muted">{fase.objetivo}</p> : null}
      {fase.reglas.length ? (
        <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-sm">
          {fase.reglas.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function PlanRutinaVista({ plan }: { plan: PlanGenerado }) {
  return (
    <div className="flex flex-col gap-3">
      {plan.notas ? <p className="text-sm text-muted">{plan.notas}</p> : null}
      {plan.notas_entrenador ? (
        <p className="rounded-xl border border-line px-3 py-2 text-sm">
          <span className="font-semibold">Notas para ti (el cliente no las ve):</span> {plan.notas_entrenador}
        </p>
      ) : null}
      {gruposPorFase(plan).map(({ fase, numero, semana }) => (
        <div key={numero ?? 0} className="flex flex-col gap-2">
          {fase && numero ? <CabeceraFase fase={fase} numero={numero} /> : null}
          {plan.dias.map((d) => {
            const ejercicios = d.ejercicios.filter((e) => activoEnSemana(e, semana));
            if (!ejercicios.length) return null;
            return (
              <div key={d.dia_semana} className="rounded-xl border border-line p-3">
                <p className="font-semibold">
                  {nombreDia(d.dia_semana)} — {d.nombre}
                </p>
                <ul className="mt-1.5 flex flex-col gap-1.5 text-sm">
                  {ejercicios.map((e, i) => (
                    <li key={i}>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{e.nombre}</span>
                        <span className="shrink-0 text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {textoPrescripcion(e)}
                        </span>
                      </div>
                      <EtiquetasPlan e={e} />
                      {e.nota ? <p className="text-xs text-muted">{e.nota}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
