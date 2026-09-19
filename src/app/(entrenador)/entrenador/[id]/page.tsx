import Link from "next/link";
import { notFound } from "next/navigation";
import ClienteAcciones from "@/components/ClienteAcciones";
import CloseWeekButton from "@/components/CloseWeekButton";
import NewBlockButton from "@/components/NewBlockButton";
import NutricionDia from "@/components/NutricionDia";
import PlanTxt from "@/components/PlanTxt";
import ProgresoCliente from "@/components/ProgresoCliente";
import RutinaDia from "@/components/RutinaDia";
import { iaDisponible } from "@/lib/ai";
import {
  ejerciciosPorDia,
  getBloque,
  getDias,
  getEjercicios,
  getLogs,
  getPerfil,
  getPlanes,
  getUltimoRegistro,
  logsPorEjercicio,
  planesPorEjercicio,
  q
} from "@/lib/data";
import { fmtTiempoRelativo, hoyFecha, nombreDia } from "@/lib/format";
import { ETIQUETAS_OBJETIVO } from "@/lib/nutrition";
import { faseDe, nombreFase } from "@/lib/progression";
import { db } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Interpretar .txt, regenerar plan y cerrar semana llaman a la IA.
export const maxDuration = 60;

const TABS = [
  { id: "resumen", texto: "Resumen" },
  { id: "rutina", texto: "Rutina" },
  { id: "progreso", texto: "Progreso" },
  { id: "nutricion", texto: "Comida" },
  { id: "plan", texto: "Plan .txt" }
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function ClientePage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { tab?: string; e?: string; fecha?: string };
}) {
  let perfil: Profile;
  try {
    perfil = await getPerfil(params.id);
  } catch {
    notFound();
  }
  if (perfil.rol !== "cliente") notFound();

  const tab: Tab = (TABS.find((t) => t.id === searchParams?.tab)?.id ?? "resumen") as Tab;
  const base = `/entrenador/${perfil.id}?tab=${tab}`;
  const [meso, ultimo] = await Promise.all([getBloque(perfil.id), getUltimoRegistro(perfil.id)]);

  return (
    <main>
      <Link href="/entrenador" className="text-sm font-medium text-accent">
        ← Clientes
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{perfil.nombre || perfil.email}</h1>
          <p className="text-sm text-muted">
            {perfil.email} · {ETIQUETAS_OBJETIVO[perfil.objetivo]}
            {perfil.peso_kg ? ` · ${perfil.peso_kg} kg` : ""} · entrenó {fmtTiempoRelativo(ultimo)}
          </p>
        </div>
        <ClienteAcciones perfil={perfil} tienePlan={!!meso} conIA={iaDisponible()} />
      </div>

      <nav className="my-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/entrenador/${perfil.id}?tab=${t.id}`}
            className={`chip shrink-0 px-3 py-1.5 text-sm ${
              t.id === tab ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"
            }`}
          >
            {t.texto}
          </Link>
        ))}
      </nav>

      {tab === "resumen" ? <Resumen perfil={perfil} /> : null}
      {tab === "rutina" ? <Rutina userId={perfil.id} /> : null}
      {tab === "progreso" ? (
        <ProgresoCliente userId={perfil.id} ejercicioSel={searchParams?.e} base={base} />
      ) : null}
      {tab === "nutricion" ? (
        <NutricionDia
          perfil={perfil}
          fecha={fechaValida(searchParams?.fecha)}
          base={base}
          paraEntrenador
        />
      ) : null}
      {tab === "plan" ? (
        <PlanTxt userId={perfil.id} conIA={iaDisponible()} nombreBloque={meso?.nombre ?? null} />
      ) : null}
    </main>
  );
}

function fechaValida(f?: string): string {
  const hoy = hoyFecha();
  return f && /^\d{4}-\d{2}-\d{2}$/.test(f) && f <= hoy ? f : hoy;
}

async function Resumen({ perfil }: { perfil: Profile }) {
  const meso = await getBloque(perfil.id);
  const c = perfil.cuestionario;
  if (!meso) {
    return (
      <section className="card">
        <p className="font-semibold">Sin plan todavía</p>
        <p className="mt-1 text-sm text-muted">
          {!perfil.onboarding_completo
            ? "El cliente todavía no completó el cuestionario."
            : perfil.estado_pago !== "pagado"
              ? "El cliente todavía no pagó. Podés marcarlo como pagado arriba y generar el plan."
              : "Generá el plan con el botón de arriba o subí un .txt en la pestaña Plan."}
        </p>
      </section>
    );
  }

  const [dias, ejercicios, logs] = await Promise.all([
    getDias(perfil.id),
    getEjercicios(perfil.id),
    getLogs(meso.id, meso.semana_actual)
  ]);
  const porDia = ejerciciosPorDia(ejercicios);
  const logsEj = logsPorEjercicio(logs);
  const fase = faseDe(meso.semana_actual);
  const cerradas = await q<{ semana: number }[]>(
    db().from("week_closures").select("semana").eq("mesocycle_id", meso.id).order("semana")
  );

  return (
    <div className="flex flex-col gap-3">
      <section className="card">
        <p className="text-sm text-muted">{meso.nombre} · origen: {meso.origen}</p>
        <p className="text-xl font-bold">
          Semana {meso.semana_actual} de {meso.total_semanas}
        </p>
        <p className="text-sm text-accent">Fase {fase} · {nombreFase(fase)}</p>
        <p className="mt-1 text-xs text-muted">
          Semanas cerradas: {cerradas.length ? cerradas.map((w) => w.semana).join(", ") : "ninguna"}
        </p>
      </section>

      <section className="card">
        <h2 className="mb-2 font-bold">Esta semana</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {dias
            .filter((d) => !d.es_descanso)
            .map((d) => {
              const exs = porDia[d.id] ?? [];
              const hechos = exs.filter((e) => (logsEj[e.id] ?? []).length > 0).length;
              return (
                <li key={d.id} className="flex items-center justify-between">
                  <span>
                    {nombreDia(d.dia_semana)}
                    {d.nombre ? ` — ${d.nombre}` : ""}
                  </span>
                  <span
                    className={`chip ${
                      exs.length && hechos === exs.length
                        ? "border-ok/40 text-ok"
                        : hechos
                          ? "border-warn/40 text-warn"
                          : "border-line text-muted"
                    }`}
                  >
                    {hechos}/{exs.length} ejercicios
                  </span>
                </li>
              );
            })}
        </ul>
      </section>

      {c ? (
        <section className="card text-sm">
          <h2 className="mb-2 font-bold">Cuestionario</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted">
            <dt>Experiencia</dt>
            <dd className="text-ink">{c.experiencia}</dd>
            <dt>Días</dt>
            <dd className="text-ink">{c.dias_disponibles.map((d) => nombreDia(d).slice(0, 3)).join(", ")}</dd>
            <dt>Sesión</dt>
            <dd className="text-ink">{c.minutos_sesion} min · {c.equipamiento}</dd>
            <dt>Lesiones</dt>
            <dd className="text-ink">{c.lesiones || "—"}</dd>
            <dt>Preferencias</dt>
            <dd className="text-ink">{c.preferencias || "—"}</dd>
          </dl>
        </section>
      ) : null}

      {meso.estado === "activo" ? (
        <CloseWeekButton
          mesoId={meso.id}
          semana={meso.semana_actual}
          esUltima={meso.semana_actual >= meso.total_semanas}
        />
      ) : (
        <NewBlockButton nombreAnterior={meso.nombre} userId={perfil.id} />
      )}
    </div>
  );
}

async function Rutina({ userId }: { userId: string }) {
  const [meso, dias, ejercicios] = await Promise.all([
    getBloque(userId),
    getDias(userId),
    getEjercicios(userId)
  ]);
  if (!dias.length) {
    return <p className="card text-center text-muted">Este cliente todavía no tiene rutina.</p>;
  }
  const planes = meso ? planesPorEjercicio(await getPlanes(meso.id, meso.semana_actual)) : {};
  const porDia = ejerciciosPorDia(ejercicios);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Editás la rutina del cliente. Los cambios de series, reps y peso aplican a la semana actual
        {meso ? ` (semana ${meso.semana_actual})` : ""}.
      </p>
      {dias.map((dia) => (
        <RutinaDia
          key={dia.id}
          dia={dia}
          ejercicios={(porDia[dia.id] ?? []).sort((a, b) => a.orden - b.orden)}
          planes={planes}
        />
      ))}
    </div>
  );
}
