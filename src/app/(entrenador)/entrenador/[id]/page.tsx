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
import ChecklistHoy from "@/components/ChecklistHoy";
import ProtocoloEditor from "@/components/ProtocoloEditor";
import ProtocoloTxt from "@/components/ProtocoloTxt";
import BorradorRutina from "@/components/BorradorRutina";
import { TarjetaFase } from "@/components/FasesRutina";
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
  getPlanesVista,
  getPlantillas,
  getProtocolo,
  getRecords,
  getSesionesSemana,
  getUltimoRegistro,
  logsPorEjercicio,
  urlFoto,
  q
} from "@/lib/data";
import { informeATexto } from "@/lib/ai-informe";
import { propuestaAjuste } from "@/lib/ajuste-macros";
import { evitarDe, objetivosDeReferencia } from "@/lib/comidas-service";
import { totalesDe } from "@/lib/meal-plan";
import { fmtTiempoRelativo, horaLocal, hoyDiaSemana, hoyFecha, nombreDia } from "@/lib/format";
import { checklistHoy } from "@/lib/hoy-db";
import { estadoPago } from "@/lib/pagos";
import { ETIQUETAS_OBJETIVO } from "@/lib/nutrition";
import { getBorradorRutina } from "@/lib/plan-import";
import { activoEnSemana, etapaDelBloque } from "@/lib/rutina";
import { db } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Interpretar .txt, regenerar plan y cerrar semana llaman a la IA.
export const maxDuration = 60;

const TABS = [
  { id: "resumen", texto: "Resumen" },
  { id: "rutina", texto: "Rutina" },
  { id: "progreso", texto: "Progreso" },
  { id: "nutricion", texto: "Comida" },
  { id: "protocolo", texto: "Protocolo" },
  { id: "mensajes", texto: "Mensajes" },
  { id: "plan", texto: "Rutina nueva" }
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function ClientePage({
  params: pParams,
  searchParams: pSearch
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; e?: string; fecha?: string; desde?: string }>;
}) {
  const [params, searchParams] = await Promise.all([pParams, pSearch]);
  let perfil: Profile;
  try {
    perfil = await getPerfil(params.id);
  } catch {
    notFound();
  }
  if (perfil.rol !== "cliente") notFound();

  const tab: Tab = (TABS.find((t) => t.id === searchParams?.tab)?.id ?? "resumen") as Tab;
  const base = `/entrenador/${perfil.id}?tab=${tab}`;
  const [meso, ultimo, ultimaActividad, noLeidos, referidos, referente, planComidas, protocoloBorrador] = await Promise.all([
    getBloque(perfil.id, { conBorrador: true }),
    getUltimoRegistro(perfil.id),
    getUltimaActividad(perfil.id),
    contarNoLeidos(perfil.id, "cliente"),
    getReferidos(perfil.id),
    perfil.referido_por ? getPerfil(perfil.referido_por).catch(() => null) : Promise.resolve(null),
    getPlanComidas(perfil.id, { conBorrador: true }),
    getProtocolo(perfil.id, { borrador: true })
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
              return ` · ${p.vencido ? "mes vencido el" : "mes vence el"} ${new Date(`${p.vence}T12:00:00`).toLocaleDateString("es-MX")}`;
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
          protocolo={protocoloBorrador && protocoloBorrador.items.length ? protocoloBorrador.protocolo.nombre : null}
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
        <Comida perfil={perfil} fecha={fechaValida(searchParams?.fecha)} base={base} desdeProtocolo={searchParams?.desde === "protocolo"} />
      ) : null}
      {tab === "protocolo" ? (
        <div className="flex flex-col gap-3">
          <ProtocoloTxt userId={perfil.id} conIA={iaDisponible()} tieneMenuCliente={!!planComidas} />
          <ProtocoloEditor
          userId={perfil.id}
          borrador={protocoloBorrador}
          publicado={await getProtocolo(perfil.id)}
          cn={perfil.cuestionario_nutricion}
          horarios={planComidas?.plan.horarios ?? null}
          />
        </div>
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
        <PlanTxt
          userId={perfil.id}
          conIA={iaDisponible()}
          nombreBloque={meso?.nombre ?? null}
          plantillas={(await getPlantillas()).map((p) => ({ id: p.id, nombre: p.nombre, descripcion: p.descripcion, dias: p.plan.dias.length }))}
        />
      ) : null}
    </main>
  );
}

function fechaValida(f?: string): string {
  const hoy = hoyFecha();
  return f && /^\d{4}-\d{2}-\d{2}$/.test(f) && f <= hoy ? f : hoy;
}

// Lo que el cliente tiene hoy y cómo viene en los últimos 14 días
async function ChecklistCliente({ perfil }: { perfil: Profile }) {
  const datos = await checklistHoy(perfil);
  return (
    <>
      <ChecklistHoy
        datos={datos}
        ahoraMin={horaLocal() * 60}
        diaNombre={`Hoy, ${nombreDia(hoyDiaSemana()).toLowerCase()}`}
        soloLectura
      />
      {datos.porArea.length ? (
        <section className="card -mt-1">
          <h2 className="font-bold">Cumplimiento por área</h2>
          <p className="text-xs text-muted">Últimos 14 días (sin contar hoy)</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {datos.porArea.map((a) => (
              <li key={a.area} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate">{a.area}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <span
                    className={`block h-full rounded-full ${a.pct >= 70 ? "bg-ok" : a.pct >= 40 ? "bg-warn" : "bg-danger"}`}
                    style={{ width: `${a.pct}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {a.pct} %
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

async function Resumen({ perfil }: { perfil: Profile }) {
  const meso = await getBloque(perfil.id);
  const c = perfil.cuestionario;
  if (!meso) {
    return (
      <section className="card">
        <p className="font-semibold">Sin rutina enviada todavía</p>
        <p className="mt-1 text-sm text-muted">
          {!perfil.onboarding_completo
            ? "El cliente todavía no completó el cuestionario."
            : perfil.estado_pago !== "pagado"
              ? "El cliente todavía no pagó. Puedes marcarlo como pagado arriba y armar el plan."
              : "Arma la rutina en la pestaña \"Rutina nueva\" (con tu PDF o .txt, una plantilla o IA) y después envíala."}
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
  const porDia = ejerciciosPorDia(ejercicios.filter((e) => activoEnSemana(e, meso.semana_actual)));
  const logsEj = logsPorEjercicio(logs);
  const cerradas = await q<{ semana: number }[]>(
    db().from("week_closures").select("semana").eq("mesocycle_id", meso.id).order("semana")
  );

  return (
    <div className="flex flex-col gap-3">
      <section className="card">
        <p className="text-sm text-muted">
          {meso.nombre} · origen: {meso.origen} · progresión {meso.progresion === "plan" ? "del plan" : "ondulada"}
        </p>
        <p className="text-xl font-bold">
          Semana {meso.semana_actual} de {meso.total_semanas}
        </p>
        <p className="text-sm text-accent">{etapaDelBloque(meso, meso.semana_actual)}</p>
        <p className="mt-1 text-xs text-muted">
          Semanas cerradas: {cerradas.length ? cerradas.map((w) => w.semana).join(", ") : "ninguna"}
        </p>
      </section>

      {meso.notas_entrenador ? (
        <section className="card">
          <h2 className="font-bold">Tus notas del bloque</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-muted">{meso.notas_entrenador}</p>
        </section>
      ) : null}

      <ChecklistCliente perfil={perfil} />

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

      <Records userId={perfil.id} />

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
          progresion={meso.progresion}
        />
      ) : (
        <NewBlockButton nombreAnterior={meso.nombre} userId={perfil.id} />
      )}
    </div>
  );
}

// Recomendación de comidas (referencia, generar/IA, .txt, menú activo) y
// el registro del día del cliente.
async function Comida({
  perfil,
  fecha,
  base,
  desdeProtocolo
}: {
  perfil: Profile;
  fecha: string;
  base: string;
  desdeProtocolo: boolean;
}) {
  // El borrador (si hay) es lo que se edita; el enviado es lo que ve el cliente
  const [plan, enviado, ajuste] = await Promise.all([
    getPlanComidas(perfil.id, { conBorrador: true }),
    getPlanComidas(perfil.id),
    propuestaAjuste(perfil)
  ]);
  const evitar = evitarDe(perfil);
  const totalesMenu = plan
    ? {
        entreno: totalesDe(plan.items, "entreno"),
        descanso: totalesDe(plan.items, "descanso")
      }
    : null;
  return (
    <div className="flex flex-col gap-3">
      {ajuste ? <AjusteMacros userId={perfil.id} propuesta={ajuste} /> : null}
      {!perfil.cuestionario_nutricion ? (
        <p className="card text-sm text-warn">
          El cliente todavía no completa el cuestionario de comidas (momentos, horarios, alergias). La
          recomendación se puede generar igual con desayuno, comida, colación y cena.
        </p>
      ) : null}
      <RecomendacionComidas
        userId={perfil.id}
        conIA={iaDisponible()}
        objetivos={objetivosDeReferencia(perfil)}
        macrosManual={perfil.macros_manual}
        tienePlan={!!plan}
        nombrePlan={plan?.plan.nombre ?? null}
        origenPlan={plan?.plan.origen ?? null}
        borrador={!!plan && !plan.plan.publicado}
        hayEnviado={!!enviado}
        totalesMenu={totalesMenu}
        evitar={evitar}
        desdeProtocolo={desdeProtocolo}
      />
      {plan ? <PlanComidasResumen plan={plan} cn={perfil.cuestionario_nutricion} evitar={evitar} /> : null}
      {plan && enviado && plan.plan.id !== enviado.plan.id ? (
        <p className="text-xs text-muted">
          El cliente sigue viendo “{enviado.plan.nombre}” hasta que envíes el borrador.
        </p>
      ) : null}
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

async function Records({ userId }: { userId: string }) {
  const records = await getRecords(userId, 6);
  if (!records.length) return null;
  return (
    <section className="card text-sm">
      <h2 className="mb-2 font-bold">🏆 Últimos récords</h2>
      <ul className="flex flex-col gap-1">
        {records.map((r) => (
          <li key={r.id} className="flex justify-between gap-2">
            <span className="truncate">{r.ejercicio}</span>
            <span className="shrink-0 font-semibold text-ok">
              {Number(r.valor)} {r.tipo === "peso" ? "kg" : "reps"} <span className="font-normal text-muted">· {new Date(`${r.fecha}T12:00:00`).toLocaleDateString("es-MX")}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
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
              {new Date(`${c.fecha}T12:00:00`).toLocaleDateString("es-MX")} · {c.tipo}
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
  const [meso, borrador, dias, ejercicios] = await Promise.all([
    getBloque(userId),
    getBorradorRutina(userId),
    getDias(userId),
    getEjercicios(userId)
  ]);
  const planes = meso ? await getPlanesVista(meso.id, meso.semana_actual) : {};
  const porDia = ejerciciosPorDia(ejercicios);
  return (
    <div className="flex flex-col gap-3">
      {borrador ? (
        <BorradorRutina
          // Se rearma cuando el servidor cambia el plan (pasos nuevos o cambios guardados)
          key={JSON.stringify(borrador.plan).length}
          userId={userId}
          nombre={borrador.nombre}
          plan={borrador.plan}
          conIA={iaDisponible()}
        />
      ) : null}
      {!dias.length || !meso ? (
        <p className="card text-center text-muted">
          {borrador ? "El cliente todavía no tiene una rutina enviada." : "Este cliente todavía no tiene rutina."}
        </p>
      ) : (
        <>
          <h2 className="mt-2 text-lg font-bold">{borrador ? "La rutina que usa hoy" : "Su rutina"}</h2>
          <TarjetaFase fases={meso.fases} semana={meso.semana_actual} compacta />
          <p className="text-sm text-muted">
            Editas la rutina del cliente. Los cambios de series, reps y peso aplican a la semana actual (semana{" "}
            {meso.semana_actual}).
          </p>
          {dias.map((dia) => (
            <RutinaDia
              key={dia.id}
              dia={dia}
              ejercicios={(porDia[dia.id] ?? []).sort((a, b) => a.orden - b.orden)}
              planes={planes}
              semana={meso.semana_actual}
              fases={meso.fases}
              conRango={meso.progresion === "plan"}
            />
          ))}
        </>
      )}
    </div>
  );
}
