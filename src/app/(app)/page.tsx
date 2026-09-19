import Link from "next/link";
import AdherenciaSemana from "@/components/AdherenciaSemana";
import AnticipoDia from "@/components/AnticipoDia";
import InformeCard from "@/components/InformeCard";
import CloseWeekButton from "@/components/CloseWeekButton";
import NewBlockButton from "@/components/NewBlockButton";
import { requireCliente } from "@/lib/auth";
import {
  ejerciciosPorDia,
  getBloque,
  getCheckins,
  getComidas,
  getDias,
  getEjercicios,
  getLogs,
  logsPorEjercicio
} from "@/lib/data";
import { fmtKcal, fmtLitros, horaLocal, hoyDiaSemana, hoyFecha, nombreDia } from "@/lib/format";
import { recomendacionPara } from "@/lib/meal-plan-db";
import { adherenciaSemanaActual, checkinPendiente } from "@/lib/stats";
import { macrosDe, objetivosCliente, sumarMacros } from "@/lib/nutrition";
import { faseDe, nombreFase } from "@/lib/progression";

// Cerrar semana consulta a la IA: margen para la server action.
export const maxDuration = 60;

export default async function Home({
  searchParams
}: {
  searchParams?: { bienvenida?: string; checkin?: string };
}) {
  const { userId, perfil } = await requireCliente();

  const meso = await getBloque(userId);
  if (!meso) {
    return (
      <main className="card mt-10 text-center">
        <p className="text-lg font-semibold">Tu plan todavía no está generado</p>
        <p className="mt-2 text-sm text-muted">
          Tu entrenador lo va a activar en breve. Si acabás de pagar, recargá
          esta página en unos segundos.
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

  const [adherencia, pendiente, checkins] = await Promise.all([
    adherenciaSemanaActual(perfil),
    checkinPendiente(userId),
    getCheckins(userId, 3)
  ]);
  const informe = checkins.find((c) => c.informe_estado === "aprobado" && c.informe_final);

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
            Tu entrenador revisa el informe de la semana y te lo manda acá mismo.
          </p>
        </section>
      ) : null}

      {pendiente ? (
        <Link href="/checkin" className="card mb-4 block border-warn/50">
          <p className="font-semibold">📝 Check-in de la semana {pendiente.semana}</p>
          <p className="mt-1 text-sm text-muted">
            Un minuto: peso, energía y cómo te fue. Con eso sale tu informe semanal →
          </p>
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

      {objetivos ? (
        <Link href="/nutricion" className="card mb-4 block">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted">Comida de hoy</p>
            <span className="text-xs font-semibold text-accent">Ver detalle →</span>
          </div>
          <p className="mt-1 text-2xl font-bold">
            {fmtKcal(consumido.kcal)}{" "}
            <span className="text-base font-medium text-muted">/ {fmtKcal(objetivos.kcal)}</span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, (consumido.kcal / objetivos.kcal) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Proteína {Math.round(consumido.prot_g)} / {objetivos.prot_g} g ·{" "}
            {esEntrenoHoy ? "día de entreno" : "día de descanso"} · agua{" "}
            {fmtLitros(objetivos.agua_ml)}
          </p>
        </Link>
      ) : (
        <Link href="/perfil" className="card mb-4 block">
          <p className="font-semibold">Completá tu perfil</p>
          <p className="text-sm text-muted">
            Con tus datos calculamos calorías y macros diarios →
          </p>
        </Link>
      )}

      <AdherenciaSemana datos={adherencia} />

      <AnticipoDia
        perfil={perfil}
        manana={manana}
        diaSemana={diaObjetivo}
        dia={diaAnticipo}
        cantidadEjercicios={diaAnticipo ? (porDia[diaAnticipo.id] ?? []).length : 0}
        reco={reco}
        esDiaBatch={diaBatch === diaObjetivo}
      />

      {diaHoy && esEntrenoHoy ? (
        <Link href={`/dia/${diaHoy.id}/entrenar`} className="btn-primary mb-4 w-full">
          ▶ Comenzar rutina de hoy
          {diaHoy.nombre ? ` · ${diaHoy.nombre}` : ""}
        </Link>
      ) : null}

      <section className="flex flex-col gap-3">
        {dias.map((dia) => {
          const exs = porDia[dia.id] ?? [];
          const conRegistro = exs.filter((e) => (logsEj[e.id] ?? []).length > 0);
          const esHoy = dia.dia_semana === hoy;

          let chip: { texto: string; clase: string };
          if (dia.es_descanso) {
            chip = { texto: "Descanso", clase: "border-line text-muted" };
          } else if (exs.length > 0 && conRegistro.length === exs.length) {
            chip = { texto: "✓ Completado", clase: "border-ok/40 text-ok" };
          } else if (conRegistro.length > 0) {
            chip = { texto: "En curso", clase: "border-warn/40 text-warn" };
          } else {
            chip = { texto: "Pendiente", clase: "border-line text-muted" };
          }

          const contenido = (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`font-semibold ${dia.es_descanso ? "text-muted" : ""}`}>
                  {nombreDia(dia.dia_semana)}
                  {dia.nombre && !dia.es_descanso ? ` — ${dia.nombre}` : ""}
                </p>
                <p className="text-sm text-muted">
                  {dia.es_descanso
                    ? "Día libre"
                    : `${exs.length} ejercicio${exs.length === 1 ? "" : "s"}${
                        conRegistro.length > 0 && conRegistro.length < exs.length
                          ? ` · ${conRegistro.length} registrado${conRegistro.length === 1 ? "" : "s"}`
                          : ""
                      }`}
                </p>
              </div>
              <span className={`chip ${chip.clase}`}>{chip.texto}</span>
            </div>
          );

          const clase = `card block ${esHoy ? "border-accent/60 ring-1 ring-accent/30" : ""}`;
          return dia.es_descanso ? (
            <div key={dia.id} className={clase}>
              {contenido}
            </div>
          ) : (
            <Link key={dia.id} href={`/dia/${dia.id}`} className={clase}>
              {contenido}
            </Link>
          );
        })}
      </section>

      <section className="mt-5">
        {meso.estado === "activo" ? (
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
