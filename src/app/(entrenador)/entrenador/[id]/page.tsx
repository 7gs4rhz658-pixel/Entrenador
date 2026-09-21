import Link from "next/link";
import { notFound } from "next/navigation";
import AjusteMacros from "@/components/AjusteMacros";
import ClienteAcciones from "@/components/ClienteAcciones";
import HiloMensajes from "@/components/HiloMensajes";
import InformesEntrenador from "@/components/InformesEntrenador";
import FotosForm from "@/components/FotosForm";
import FotosGaleria from "@/components/FotosGaleria";
import MedidasForm from "@/components/MedidasForm";
import MedidasHistorial from "@/components/MedidasHistorial";
import PendienteEnviar from "@/components/PendienteEnviar";
import CloseWeekButton from "@/components/CloseWeekButton";
import NewBlockButton from "@/components/NewBlockButton";
import NutricionDia from "@/components/NutricionDia";
import PlanComidasResumen from "@/components/PlanComidasResumen";
import PlanTxt from "@/components/PlanTxt";
import RecomendacionComidas from "@/components/RecomendacionComidas";
import ProgresoCliente from "@/components/ProgresoCliente";
import RutinaDia from "@/components/RutinaDia";
import { iaDisponible } from "@/lib/ai";
import {
  ejerciciosPorDia,
  getBloque,
  contarNoLeidos,
  getCheckins,
  getConsultasAsistente,
  getFotos,
  getMedidas,
  getMensajes,
  getReferidos,
  getUltimaActividad,
  getDias,
  getEjercicios,
  getLogs,
  getPerfil,
  getPlanComidas,
  getPlanes,
  getSesionesSemana,
  getUltimoRegistro,
  logsPorEjercicio,
  urlFoto,
  planesPorEjercicio,
  q
} from "@/lib/data";
import { informeATexto } from "@/lib/ai-informe";
import { propuestaAjuste } from "@/lib/ajuste-macros";
import { objetivosDeReferencia } from "@/lib/comidas-service";
import { fmtTiempoRelativo, hoyFecha, nombreDia } from "@/lib/format";
import { estadoPago } from "@/lib/pagos";
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
  { id: "mensajes", texto: "Mensajes" },
  { id: "plan", texto: "Rutina nueva" }
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
  const [meso, ultimo, ultimaActividad, noLeidos, referidos, referente, planComidas] = await Promise.all([
    getBloque(perfil.id, { conBorrador: true }),
    getUltimoRegistro(perfil.id),
    getUltimaActividad(perfil.id),
    contarNoLeidos(perfil.id, "cliente"),
    getReferidos(perfil.id),
    perfil.referido_por ? getPerfil(perfil.referido_por).catch(() => null) : Promise.resolve(null),
    getPlanComidas(perfil.id, { conBorrador: true })
  ]);
  const diasSinActividad = ultimaActividad ? Math.floor((Date.now() - new Date(ultimaActividad).getTime()) / 86_400_000) : null;

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
            {(() => {
              const p = estadoPago(perfil, hoyFecha());
              if (!p.vence) return null;
              return ` · ${p.vencido ? "mes vencido el" : "mes vence el"} ${new Date(`${p.vence}T12:00:00`).toLocaleDateString("es-AR")}`;
            })()}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {diasSinActividad != null && diasSinActividad >= 4 ? (
              <Link href={`/entrenador/${perfil.id}?tab=mensajes`} className="chip border-danger/40 text-danger">
                sin registros hace {diasSinActividad} días · escribirle
              </Link>
            ) : null}
            {noLeidos ? (
              <Link href={`/entrenador/${perfil.id}?tab=mensajes`} className="chip border-accent/60 text-accent">
                {noLeidos} mensaje{noLeidos === 1 ? "" : "s"} sin leer
              </Link>
            ) : null}
            {perfil.codigo_referido ? <span className="chip border-line text-muted">código {perfil.codigo_referido}</span> : null}
            {referente ? <span className="chip border-line text-muted">referido por {referente.nombre || referente.email}</span> : null}
            {referidos.length ? (
              <span className="chip border-ok/40 text-ok">
                trajo a {referidos.map((r) => r.nombre || r.email).join(", ")} · aplicar descuento
              </span>
            ) : null}
          </div>
        </div>
        <ClienteAcciones perfil={perfil} tienePlan={!!meso} />
      </div>

      <div className="mt-4">
        <PendienteEnviar
          userId={perfil.id}
          rutina={meso && !meso.publicado ? meso.nombre : null}
          menu={planComidas && !planComidas.plan.publicado ? planComidas.plan.nombre : null}
        />
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
        <div className="flex flex-col gap-3">
          <ProgresoCliente userId={perfil.id} ejercicioSel={searchParams?.e} base={base} />
          <h2 className="mt-2 text-lg font-bold">Medidas corporales</h2>
          <MedidasEntrenador perfil={perfil} />
          <h2 className="mt-2 text-lg font-bold">Fotos de progreso</h2>
          <FotosEntrenador userId={perfil.id} />
        </div>
      ) : null}
      {tab === "nutricion" ? (
        <Comida perfil={perfil} fecha={fechaValida(searchParams?.fecha)} base={base} />
      ) : null}
      {tab === "mensajes" ? (
        <HiloMensajes
          userId={perfil.id}
          soyEntrenador
          inicial={await getMensajes(perfil.id, 60)}
          conIA={iaDisponible()}
          nombreCliente={perfil.nombre.split(" ")[0]}
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
  const meso = await getBloque(perfil.id, { conBorrador: true });
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
              : "Armá la rutina en la pestaña \"Rutina nueva\" (con IA o con tu .txt) y después enviala."}
        </p>
      </section>
    );
  }

  const [dias, ejercicios, logs, sesiones] = await Promise.all([
    getDias(perfil.id),
    getEjercicios(perfil.id),
    getLogs(meso.id, meso.semana_actual),
    getSesionesSemana(meso.id, meso.semana_actual)
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
        <p className="text-sm text-muted">
          {meso.nombre} · origen: {meso.origen}
          {!meso.publicado ? <span className="ml-2 chip border-warn/40 text-warn">borrador sin enviar</span> : null}
        </p>
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
                    {(() => {
                      const s = sesiones.find((x) => x.training_day_id === d.id);
                      return s ? <span className="ml-1 text-xs text-muted">· {Math.round(s.duracion_seg / 60)} min</span> : null;
                    })()}
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

      <Informes userId={perfil.id} />

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
            {perfil.cuestionario_nutricion ? (
              <>
                <dt>Comidas</dt>
                <dd className="text-ink">
                  {perfil.cuestionario_nutricion.comidas.map((x) => `${x.momento} ${x.hora}`).join(", ")}
                </dd>
                <dt>Alergias</dt>
                <dd className="text-ink">{perfil.cuestionario_nutricion.alergias || "—"}</dd>
                <dt>Evita</dt>
                <dd className="text-ink">{perfil.cuestionario_nutricion.no_come || "—"}</dd>
                <dt>Cocina</dt>
                <dd className="text-ink">
                  {perfil.cuestionario_nutricion.cocina}
                  {perfil.cuestionario_nutricion.batch_cooking
                    ? ` · batch cooking los ${nombreDia(perfil.cuestionario_nutricion.dia_batch ?? 7).toLowerCase()}`
                    : ""}{" "}
                  · presupuesto {perfil.cuestionario_nutricion.presupuesto}
                </dd>
              </>
            ) : null}
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

// Recomendación de comidas (referencia, generar/IA, .txt, menú activo) y
// el registro del día del cliente.
async function Comida({ perfil, fecha, base }: { perfil: Profile; fecha: string; base: string }) {
  const [plan, ajuste] = await Promise.all([getPlanComidas(perfil.id, { conBorrador: true }), propuestaAjuste(perfil)]);
  return (
    <div className="flex flex-col gap-3">
      {ajuste ? <AjusteMacros userId={perfil.id} propuesta={ajuste} /> : null}
      {!perfil.cuestionario_nutricion ? (
        <p className="card text-sm text-warn">
          El cliente todavía no completó el cuestionario de comidas (momentos, horarios, alergias). La
          recomendación se puede generar igual con desayuno, almuerzo, merienda y cena.
        </p>
      ) : null}
      <RecomendacionComidas
        userId={perfil.id}
        conIA={iaDisponible()}
        objetivos={objetivosDeReferencia(perfil)}
        macrosManual={perfil.macros_manual}
        tienePlan={!!plan}
        nombrePlan={plan?.plan.nombre ?? null}
      />
      {plan ? <PlanComidasResumen plan={plan} cn={perfil.cuestionario_nutricion} /> : null}
      <ConsultasCliente userId={perfil.id} />
      <h2 className="mt-2 text-lg font-bold">Registro del día</h2>
      <NutricionDia perfil={perfil} fecha={fecha} base={base} paraEntrenador />
    </div>
  );
}

async function MedidasEntrenador({ perfil }: { perfil: Profile }) {
  const medidas = await getMedidas(perfil.id);
  return (
    <>
      <MedidasForm hoy={hoyFecha()} ultima={medidas[0] ?? null} pesoActual={perfil.peso_kg} userId={perfil.id} />
      <MedidasHistorial medidas={medidas} />
    </>
  );
}

async function FotosEntrenador({ userId }: { userId: string }) {
  const fotos = await getFotos(userId);
  const conUrl = await Promise.all(fotos.map(async (f) => ({ ...f, url: await urlFoto(f.path) })));
  return (
    <>
      <FotosForm hoy={hoyFecha()} userId={userId} />
      <FotosGaleria fotos={conUrl} />
    </>
  );
}

async function Informes({ userId }: { userId: string }) {
  const checkins = await getCheckins(userId, 12);
  const textos: Record<string, string> = {};
  for (const c of checkins) textos[c.id] = c.informe_final ?? (c.informe ? informeATexto(c.informe) : "");
  return <InformesEntrenador checkins={checkins} textoInicial={textos} />;
}

// Qué le pregunta el cliente al asistente: pista de qué le cuesta y de
// cuándo conviene escribirle en persona.
async function ConsultasCliente({ userId }: { userId: string }) {
  const consultas = await getConsultasAsistente(userId, { limite: 8 });
  if (!consultas.length) return null;
  return (
    <section className="card">
      <h2 className="font-bold">Consultas al asistente</h2>
      <ul className="mt-2 flex flex-col gap-2 text-sm">
        {consultas.map((c) => (
          <li key={c.id} className="rounded-xl border border-line px-3 py-2">
            <p className="text-xs text-muted">
              {new Date(`${c.fecha}T12:00:00`).toLocaleDateString("es-AR")} · {c.tipo}
              {c.aplicado ? " · usó la respuesta como ajuste del día" : ""}
            </p>
            <p className="mt-0.5">&ldquo;{c.pregunta}&rdquo;</p>
            <p className="mt-0.5 text-muted">→ {c.respuesta.resumen}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Rutina({ userId }: { userId: string }) {
  const [meso, dias, ejercicios] = await Promise.all([
    getBloque(userId, { conBorrador: true }),
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
