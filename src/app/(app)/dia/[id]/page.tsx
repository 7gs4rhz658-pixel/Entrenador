import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ExerciseLogger from "@/components/ExerciseLogger";
import { TarjetaFase } from "@/components/FasesRutina";
import { requireCliente } from "@/lib/auth";
import {
  getBloque,
  getDiaPorId,
  getEjercicios,
  getLogs,
  getPlanes,
  logsPorEjercicio,
  planesPorEjercicio,
  semanaCerrada
} from "@/lib/data";
import { nombreDia } from "@/lib/format";
import { activoEnSemana, etapaDelBloque, grupoSuperserie } from "@/lib/rutina";

export default async function DiaPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { semana?: string };
}) {
  const { userId } = await requireCliente();
  const dia = await getDiaPorId(params.id);
  if (!dia || dia.user_id !== userId) notFound();

  const meso = await getBloque(userId);
  if (!meso) redirect("/");

  const semanaParam = Number(searchParams?.semana);
  const semana = Number.isInteger(semanaParam)
    ? Math.min(Math.max(semanaParam, 1), meso.semana_actual)
    : meso.semana_actual;

  const [ejercicios, planes, logs, logsPrev, cerrada] = await Promise.all([
    getEjercicios(userId),
    getPlanes(meso.id, semana),
    getLogs(meso.id, semana),
    semana > 1 ? getLogs(meso.id, semana - 1) : Promise.resolve([]),
    semanaCerrada(meso.id, semana)
  ]);
  // Solo los de la fase de esta semana
  const exsDia = ejercicios
    .filter((e) => e.training_day_id === dia.id && activoEnSemana(e, semana))
    .sort((a, b) => a.orden - b.orden);
  const mPlanes = planesPorEjercicio(planes);
  const mLogs = logsPorEjercicio(logs);
  const mLogsPrev = logsPorEjercicio(logsPrev);

  return (
    <main>
      <header className="mb-4">
        <Link href="/" className="text-sm font-medium text-accent">
          ← Volver a la semana
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">
            {nombreDia(dia.dia_semana)}
            {dia.nombre ? ` — ${dia.nombre}` : ""}
          </h1>
          <div className="flex items-center gap-1 text-sm font-semibold">
            {semana > 1 ? (
              <Link
                href={`/dia/${dia.id}?semana=${semana - 1}`}
                className="rounded-lg border border-line px-2.5 py-1.5 text-muted"
                aria-label="Semana anterior"
              >
                ‹
              </Link>
            ) : null}
            <span className="px-1 text-muted">Sem. {semana}</span>
            {semana < meso.semana_actual ? (
              <Link
                href={`/dia/${dia.id}?semana=${semana + 1}`}
                className="rounded-lg border border-line px-2.5 py-1.5 text-muted"
                aria-label="Semana siguiente"
              >
                ›
              </Link>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-sm text-accent">{etapaDelBloque(meso, semana)}</p>
        {cerrada ? (
          <p className="mt-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            Semana ya cerrada: si editas lo realizado, el plan de la semana
            siguiente se recalcula solo.
          </p>
        ) : null}
      </header>

      <TarjetaFase fases={meso.fases} semana={semana} compacta />

      {!dia.es_descanso && exsDia.length > 0 && semana === meso.semana_actual ? (
        <Link href={`/dia/${dia.id}/entrenar`} className="btn-primary mb-4 w-full">
          ▶ Comenzar rutina guiada
        </Link>
      ) : null}

      {dia.es_descanso ? (
        <p className="card text-center text-muted">
          Este día está marcado como descanso. Puedes cambiarlo desde la
          pestaña Rutina.
        </p>
      ) : exsDia.length === 0 ? (
        <p className="card text-center text-muted">
          Este día no tiene ejercicios esta semana. Agrégalos desde la pestaña
          Rutina.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {exsDia.map((ex, i) => (
            <ExerciseLogger
              key={`${ex.id}-${semana}`}
              ejercicio={ex}
              conRango={meso.progresion === "plan"}
              companero={
                grupoSuperserie(exsDia, i)
                  .filter((k) => k !== i)
                  .map((k) => exsDia[k].nombre)
                  .join(" y ") || null
              }
              plan={mPlanes[ex.id] ?? null}
              logs={mLogs[ex.id] ?? []}
              logsPrev={mLogsPrev[ex.id] ?? []}
              mesoId={meso.id}
              semana={semana}
            />
          ))}
        </div>
      )}
    </main>
  );
}
