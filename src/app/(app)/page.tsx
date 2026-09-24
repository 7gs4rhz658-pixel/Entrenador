import Link from "next/link";
import AnticipoDia from "@/components/AnticipoDia";
import ChecklistHoy from "@/components/ChecklistHoy";
import InformeCard from "@/components/InformeCard";
import CloseWeekButton from "@/components/CloseWeekButton";
import NewBlockButton from "@/components/NewBlockButton";
import { requireCliente } from "@/lib/auth";
import {
  ejerciciosPorDia,
  contarNoLeidos,
  getBloque,
  getCheckins,
  getComidas,
  getDias,
  getEjercicios,
  getLogs,
  logsPorEjercicio
} from "@/lib/data";
import { fmtKcal, horaLocal, hoyDiaSemana, hoyFecha, nombreDia } from "@/lib/format";
import { checklistHoy } from "@/lib/hoy-db";
import { recomendacionPara } from "@/lib/meal-plan-db";
import { estadoPago } from "@/lib/pagos";
import { checkinPendiente } from "@/lib/stats";
import { macrosDe, objetivosCliente, sumarMacros } from "@/lib/nutrition";
import { faseDe, nombreFase } from "@/lib/progression";

// Cerrar semana consulta a la IA: margen para la server action.
export const maxDuration = 60;

export default async function Home({
  searchParams
}: {
  searchParams?: { bienvenida?: string; checkin?: string; renovado?: string };
}) {
  const { userId, perfil } = await requireCliente();

  const meso = await getBloque(userId);
  if (!meso) {
    return (
      <main className="card mt-10 text-center">
        <p className="text-lg font-semibold">Tu entrenador está armando tu plan</p>
        <p className="mt-2 text-sm text-muted">
          Está revisando tu rutina y tu recomendación de comidas con tus datos. Cuando te las
          envíe te llega un aviso y aparecen acá. Mientras tanto podés activar los avisos en
          Perfil.
        </p>
      </main>
    );
  }

  const hoy = hoyDiaSemana();
  const fecha = hoyFecha();
  const [dias, ejercicios, logs, comidas] = await Promise.all([
    getDias(userId),
    getEjercicios(userId),
    getLogs(meso.id, meso.semana_actual),
    getComidas(userId, fecha)
  ]);
  const porDia = ejerciciosPorDia(ejercicios);
  const logsEj = logsPorEjercicio(logs);

  const diaHoy = dias.find((d) => d.dia_semana === hoy);
  const esEntrenoHoy = diaHoy ? !diaHoy.es_descanso : false;

  const objetivos = objetivosCliente(perfil, esEntrenoHoy);
  const consumido = sumarMacros(comidas.map((c) => macrosDe(c.ingredient, c.cantidad_g)));
  const fase = faseDe(meso.semana_actual);

  // Desde las 18 la app mira al día siguiente
  const manana = horaLocal() >= 18;
  const diaObjetivo = manana ? (hoy % 7) + 1 : hoy;
  const diaAnticipo = dias.find((d) => d.dia_semana === diaObjetivo);
  const entrenaAnticipo = diaAnticipo ? !diaAnticipo.es_descanso : false;
  const reco = await recomendacionPara(userId, entrenaAnticipo ? "entreno" : "descanso", perfil.cuestionario_nutricion);
  const diaBatch = perfil.cuestionario_nutricion?.batch_cooking ? perfil.cuestionario_nutricion.dia_batch ?? 7 : null;

  const [checklist, pendiente, checkins, noLeidos] = await Promise.all([
    checklistHoy(perfil, fecha),
    checkinPendiente(userId),
    getCheckins(userId, 3),
    contarNoLeidos(userId, "entrenador")
  ]);
  const pago = estadoPago(perfil, fecha);
  // Con el mes vencido no llegan informes nuevos hasta renovar
  const informe = pago.vencido ? undefined : checkins.find((c) => c.informe_estado === "aprobado" && c.informe_final);
  const avisoPago =
    pago.pagado && pago.diasRestantes != null && (pago.vencido || pago.diasRestantes <= 3)
      ? pago.vencido
        ? { titulo: "Tu mes venció", texto: "Seguís viendo tu rutina y tu historial. Para cerrar semanas, recibir informes y arrancar el próximo bloque, renová →" }
        : { titulo: pago.diasRestantes === 0 ? "Tu mes vence hoy" : `Tu mes vence en ${pago.diasRestantes} día${pago.diasRestantes === 1 ? "" : "s"}`, texto: "Renová ahora y los días que te quedan se suman →" }
      : null;

  return (
    <main>
      {searchParams?.bienvenida ? (
        <section className="card mb-4 border-ok/40">
          <p className="font-semibold">✓ ¡Tu plan está listo, {perfil.nombre.split(" ")[0]}!</p>
          <p className="mt-1 text-sm text-muted">
            Abajo tenés tu semana. Tocá el día de hoy y usá &quot;Comenzar
            rutina&quot; para que la app te guíe ejercicio por ejercicio.
          </p>
        </section>
      ) : null}

      {searchParams?.checkin ? (
        <section className="card mb-4 border-ok/40">
          <p className="font-semibold">✓ Check-in enviado</p>
          <p className="mt-1 text-sm text-muted">
            Tu entrenador revisa el informe de la semana y te lo manda acá mismo.{" "}
            <Link href="/progreso?tab=medidas" className="font-semibold text-accent">
              ¿Cargás tus medidas de la semana? →
            </Link>
          </p>
        </section>
      ) : null}

      {searchParams?.renovado ? (
        <section className="card mb-4 border-ok/40">
          <p className="font-semibold">✓ Mes renovado</p>
          <p className="mt-1 text-sm text-muted">Seguimos. Tu rutina, tu menú y tus informes siguen donde estaban.</p>
        </section>
      ) : null}

      {avisoPago ? (
        <Link href="/pago" className={`card mb-4 block ${pago.vencido ? "border-danger/50" : "border-warn/50"}`}>
          <p className="font-semibold">{pago.vencido ? "⏸️" : "📅"} {avisoPago.titulo}</p>
          <p className="mt-1 text-sm text-muted">{avisoPago.texto}</p>
          {checkins.length >= 2 ? (
            <span className="mt-1 block text-xs font-semibold text-accent">Antes, mirá tu mes: peso, cargas y adherencia</span>
          ) : null}
        </Link>
      ) : null}

      {pendiente ? (
        <Link href="/checkin" className="card mb-4 block border-warn/50">
          <p className="font-semibold">📝 Check-in de la semana {pendiente.semana}</p>
          <p className="mt-1 text-sm text-muted">
            Un minuto: peso, energía y cómo te fue. Con eso sale tu informe semanal →
          </p>
        </Link>
      ) : null}

      {noLeidos ? (
        <Link href="/mensajes" className="card mb-4 block border-accent/60">
          <p className="font-semibold">💬 {noLeidos === 1 ? "Tenés un mensaje nuevo" : `Tenés ${noLeidos} mensajes nuevos`} de tu entrenador</p>
          <p className="mt-1 text-sm text-muted">Leer y responder →</p>
        </Link>
      ) : null}

      {informe ? <InformeCard checkin={informe} /> : null}

      <header className="mb-4">
        <p className="text-sm font-medium text-muted">{meso.nombre}</p>
        <h1 className="text-2xl font-bold">
          Semana {meso.semana_actual} de {meso.total_semanas}
        </h1>
        <p className="mt-0.5 text-sm text-accent">
          Fase {fase} · {nombreFase(fase)}
          {checkins.length ? (
            <>
              {" · "}
              <Link href="/mes" className="font-semibold underline-offset-2 hover:underline">
                Tu mes →
              </Link>
            </>
          ) : null}
        </p>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {Array.from({ length: meso.total_semanas }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i + 1 < meso.semana_actual
                  ? "bg-accent"
                  : i + 1 === meso.semana_actual
                    ? "bg-accent/50"
                    : "bg-line"
              }`}
            />
          ))}
        </div>
      </header>

      {!objetivos ? (
        <Link href="/perfil" className="card mb-4 block">
          <p className="font-semibold">Completá tu perfil</p>
          <p className="text-sm text-muted">
            Con tus datos calculamos calorías y macros diarios →
          </p>
        </Link>
      ) : null}

      <ChecklistHoy
        datos={checklist}
        ahoraMin={horaLocal() * 60}
        diaNombre={`Hoy, ${nombreDia(hoy).toLowerCase()}`}
        resumenComida={
          objetivos
            ? `Comida: ${fmtKcal(consumido.kcal)} de ${fmtKcal(objetivos.kcal)} · proteína ${Math.round(consumido.prot_g)} de ${objetivos.prot_g} g`
            : null
        }
      />

      <AnticipoDia
        perfil={perfil}
        manana={manana}
        diaSemana={diaObjetivo}
        dia={diaAnticipo}
        cantidadEjercicios={diaAnticipo ? (porDia[diaAnticipo.id] ?? []).length : 0}
        reco={reco}
        esDiaBatch={diaBatch === diaObjetivo}
      />

      {diaHoy && esEntrenoHoy && !checklist.items.some((i) => i.key === "entreno" && i.hecho) ? (
        <Link href={`/dia/${diaHoy.id}/entrenar`} className="btn-primary mb-4 w-full">
          ▶ Comenzar rutina de hoy
          {diaHoy.nombre ? ` · ${diaHoy.nombre}` : ""}
        </Link>
      ) : null}

      <section className="card">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">Tu semana de entreno</h2>
          <Link href="/rutina" className="text-xs font-semibold text-accent">
            Rutina →
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {dias.map((dia) => {
            const exs = porDia[dia.id] ?? [];
            const conRegistro = exs.filter((e) => (logsEj[e.id] ?? []).length > 0);
            const completo = exs.length > 0 && conRegistro.length === exs.length;
            const estado = dia.es_descanso
              ? "border-dashed border-line text-muted"
              : completo
                ? "border-ok/50 bg-ok/15 text-ok"
                : conRegistro.length
                  ? "border-warn/50 bg-warn/10 text-warn"
                  : "border-line";
            const contenido = (
              <>
                <span className="text-[11px] font-semibold uppercase">{nombreDia(dia.dia_semana).slice(0, 2)}</span>
                <span className="text-sm font-bold">{dia.es_descanso ? "—" : completo ? "✓" : conRegistro.length ? "…" : exs.length}</span>
              </>
            );
            const clase = `flex flex-col items-center rounded-xl border py-1.5 ${estado} ${
              dia.dia_semana === hoy ? "ring-2 ring-accent" : ""
            }`;
            return dia.es_descanso ? (
              <div key={dia.id} className={clase} title="Descanso">
                {contenido}
              </div>
            ) : (
              <Link key={dia.id} href={`/dia/${dia.id}`} className={clase} title={dia.nombre ?? ""}>
                {contenido}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-5">
        {pago.vencido ? (
          <Link href="/pago" className="card block text-center">
            <p className="font-semibold">Renová tu mes para cerrar la semana</p>
            <p className="mt-1 text-sm text-muted">Tus registros se guardan igual; al renovar seguís exactamente donde estabas.</p>
          </Link>
        ) : meso.estado === "activo" ? (
          <CloseWeekButton
            mesoId={meso.id}
            semana={meso.semana_actual}
            esUltima={meso.semana_actual >= meso.total_semanas}
            conCheckin
          />
        ) : (
          <NewBlockButton nombreAnterior={meso.nombre} />
        )}
      </section>
    </main>
  );
}
