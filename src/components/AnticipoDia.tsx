import Link from "next/link";
import { nombreDia } from "@/lib/format";
import { horaDe, type RecomendacionDia } from "@/lib/meal-plan";
import { nombreMomento } from "@/lib/nutrition";
import type { Profile, TrainingDay } from "@/lib/types";

// La app se anticipa: desde la tarde muestra qué toca mañana (entreno y
// comidas) con lo que hay que dejar listo; durante el día, lo de hoy.
export default function AnticipoDia({
  perfil,
  manana,
  diaSemana,
  dia,
  cantidadEjercicios,
  reco,
  esDiaBatch
}: {
  perfil: Profile;
  manana: boolean;
  diaSemana: number;
  dia: TrainingDay | undefined;
  cantidadEjercicios: number;
  reco: RecomendacionDia | null;
  esDiaBatch: boolean;
}) {
  const entrena = dia ? !dia.es_descanso : false;
  const cn = perfil.cuestionario_nutricion;
  if (!reco && !entrena && !esDiaBatch) return null;

  return (
    <section className="card mb-4 border-accent/40">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">{manana ? "Mañana te toca" : "Hoy te toca"}</h2>
        <span className="text-xs text-muted">{nombreDia(diaSemana)}</span>
      </div>

      <p className="mt-2 text-sm">
        {entrena ? (
          <>
            <span className="font-semibold">🏋️ {dia?.nombre || "Entreno"}</span>
            <span className="text-muted">
              {" "}
              · {cantidadEjercicios} ejercicio{cantidadEjercicios === 1 ? "" : "s"} · ~
              {Math.max(30, cantidadEjercicios * 9)} min
            </span>
          </>
        ) : (
          <span className="text-muted">😌 Día de descanso: caminá, dormí bien y comé según tu menú.</span>
        )}
      </p>

      {reco ? (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {reco.comidas.map((c) => {
            const hora = horaDe(c.momento, cn, c.hora);
            return (
              <li key={c.momento} className="flex gap-2">
                <span className="w-24 shrink-0 text-muted">
                  {nombreMomento(c.momento)}
                  {hora ? <span className="block text-xs">{hora}</span> : null}
                </span>
                <span className="min-w-0 truncate">{c.plato || c.items.map((i) => i.ingredient.nombre).join(", ")}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {reco?.avisos.length ? (
        <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm">
          <p className="font-semibold text-warn">{manana ? "Dejá listo esta noche" : "Para hoy"}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {reco.avisos.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {esDiaBatch ? (
        <Link href="/nutricion/compras" className="mt-3 block rounded-xl border border-line px-3 py-2 text-sm">
          <span className="font-semibold">🍳 {manana ? "Mañana es" : "Hoy es"} día de batch cooking</span>
          <span className="block text-xs text-muted">Compras y guía para cocinar la semana en una tanda →</span>
        </Link>
      ) : null}

      {reco ? (
        <Link href="/nutricion" className="mt-3 block text-right text-xs font-semibold text-accent">
          Ver el menú completo →
        </Link>
      ) : null}
    </section>
  );
}
