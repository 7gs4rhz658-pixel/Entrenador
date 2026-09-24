import Link from "next/link";
import ActivarAvisos from "@/components/ActivarAvisos";
import { propuestaAjuste } from "@/lib/ajuste-macros";
import { contarNoLeidos, getBloque, getClientes, getDias, getInformesPendientes, getUltimaActividad, getUltimoRegistro } from "@/lib/data";
import { fechaLocal, fmtTiempoRelativo, hoyDiaSemana, hoyFecha, sumarDias } from "@/lib/format";
import { cumplimientoRango } from "@/lib/hoy-db";
import { checkinPendiente } from "@/lib/stats";
import { estadoPago } from "@/lib/pagos";
import { ETIQUETAS_OBJETIVO } from "@/lib/nutrition";

export default async function ClientesPage() {
  const [clientes, pendientesInforme] = await Promise.all([getClientes(), getInformesPendientes()]);
  const conInforme = new Set(pendientesInforme.map((p) => p.user_id));
  const filas = await Promise.all(
    clientes.map(async (c) => {
      const ayer = sumarDias(hoyFecha(), -1);
      const [meso, ultimo, ajuste, ultimaActividad, noLeidos, dias, checkin, cumplioAyer] = await Promise.all([
        getBloque(c.id, { conBorrador: true }),
        getUltimoRegistro(c.id),
        propuestaAjuste(c),
        getUltimaActividad(c.id),
        contarNoLeidos(c.id, "cliente"),
        getDias(c.id),
        checkinPendiente(c.id),
        c.activo && c.estado_pago === "pagado" ? cumplimientoRango(c, ayer, ayer).then((r) => r.promedio) : Promise.resolve(null)
      ]);
      const diaHoy = dias.find((d) => d.dia_semana === hoyDiaSemana());
      const entrenaHoy = !!diaHoy && !diaHoy.es_descanso && !!meso?.publicado;
      const entrenoHoy = !!ultimo && fechaLocal(ultimo) === hoyFecha();
      const diasSin = ultimaActividad ? Math.floor((Date.now() - new Date(ultimaActividad).getTime()) / 86_400_000) : null;
      // Sin registros hace 4+ días: candidato a abandono, va arriba
      const abandono = c.activo && c.estado_pago === "pagado" && meso != null && meso.publicado && (diasSin == null || diasSin >= 4);
      const nuevo = c.activo && c.onboarding_completo && c.estado_pago === "pagado" && (!meso || !meso.publicado);
      // Ayer cumplió menos de la mitad del checklist (y no está ya como caído)
      const flojoAyer = !abandono && !nuevo && cumplioAyer != null && cumplioAyer < 50;
      return { c, meso, ultimo, ajuste, diasSin, noLeidos, abandono, nuevo, entrenaHoy, entrenoHoy, checkin, diaHoy, cumplioAyer, flojoAyer };
    })
  );
  const hoy = hoyFecha();
  const activos = filas
    .filter((f) => f.c.activo)
    .sort((a, b) => Number(b.nuevo) - Number(a.nuevo) || Number(b.abandono) - Number(a.abandono));
  const inactivos = filas.filter((f) => !f.c.activo);

  return (
    <main>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <span className="text-sm text-muted">
          {activos.length} activo{activos.length === 1 ? "" : "s"}
        </span>
      </div>

      {filas.length === 0 ? (
        <p className="card text-center text-muted">
          Todavía no hay clientes. Cuando alguien se registre en la app aparece acá.
        </p>
      ) : (
        <PanelHoy filas={activos} conInforme={conInforme} hoy={hoy} />
      )}

      <ul className="flex flex-col gap-3">
        {[...activos, ...inactivos].map(({ c, meso, ultimo, ajuste, diasSin, noLeidos, abandono }) => {
          const pendientes: string[] = [];
          if (!c.onboarding_completo) pendientes.push("cuestionario");
          if (c.estado_pago !== "pagado") pendientes.push("pago");
          const pago = estadoPago(c, hoy);
          if (pago.vencido) pendientes.push("mes vencido");
          else if (pago.diasRestantes != null && pago.diasRestantes <= 3) pendientes.push(`vence en ${pago.diasRestantes} d`);
          if (c.onboarding_completo && c.estado_pago === "pagado" && !meso) pendientes.push("nuevo: armar rutina y menú");
          if (meso && !meso.publicado) pendientes.push("rutina sin enviar");
          if (conInforme.has(c.id)) pendientes.push("informe por aprobar");
          if (ajuste) pendientes.push("ajuste de kcal sugerido");
          if (abandono) pendientes.push(diasSin == null ? "nunca registró" : `sin registros hace ${diasSin} d`);
          if (noLeidos) pendientes.push(`${noLeidos} msj`);
          return (
            <li key={c.id}>
              <Link
                href={`/entrenador/${c.id}`}
                className={`card block ${c.activo ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.nombre || c.email}</p>
                    <p className="truncate text-xs text-muted">{c.email}</p>
                    <p className="mt-1 text-sm text-muted">
                      {ETIQUETAS_OBJETIVO[c.objetivo]}
                      {meso ? ` · ${meso.nombre} · sem. ${meso.semana_actual}/${meso.total_semanas}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {pendientes.length ? (
                      <span className="chip border-warn/40 text-warn">{pendientes.join(" · ")}</span>
                    ) : (
                      <span className="chip border-ok/40 text-ok">al día</span>
                    )}
                    <span className="text-xs text-muted">entrenó {fmtTiempoRelativo(ultimo)}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <ActivarAvisos vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} entrenador />
    </main>
  );
}

// Lo que pide acción hoy, en una sola tarjeta: nuevos por armar,
// informes por aprobar, mensajes, quién entrena hoy y quién se está
// cayendo. Cada línea lleva a la ficha.
function PanelHoy({
  filas,
  conInforme,
  hoy
}: {
  filas: {
    c: { id: string; nombre: string; email: string; estado_pago: "pendiente" | "pagado"; pago_vence_at: string | null };
    nuevo: boolean;
    abandono: boolean;
    diasSin: number | null;
    noLeidos: number;
    entrenaHoy: boolean;
    entrenoHoy: boolean;
    checkin: { semana: number } | null;
    diaHoy: { nombre: string | null } | undefined;
    cumplioAyer: number | null;
    flojoAyer: boolean;
  }[];
  conInforme: Set<string>;
  hoy: string;
}) {
  const nombre = (f: (typeof filas)[number]) => f.c.nombre.split(" ")[0] || f.c.email;
  const nuevos = filas.filter((f) => f.nuevo);
  const informes = filas.filter((f) => conInforme.has(f.c.id));
  const mensajes = filas.filter((f) => f.noLeidos > 0);
  const checkins = filas.filter((f) => f.checkin && !f.nuevo);
  const entrenan = filas.filter((f) => f.entrenaHoy);
  const caidos = filas.filter((f) => f.abandono);
  const flojos = filas.filter((f) => f.flojoAyer);
  const vencen = filas.filter((f) => {
    const p = estadoPago(f.c, hoy);
    return p.vencido || (p.diasRestantes != null && p.diasRestantes <= 3);
  });
  const grupos = [
    { titulo: "Nuevos por armar", lista: nuevos, tab: "plan", color: "text-warn" },
    { titulo: "Informes por aprobar", lista: informes, tab: "resumen", color: "text-warn" },
    { titulo: "Mensajes sin leer", lista: mensajes, tab: "mensajes", color: "text-accent" },
    { titulo: "Check-in pendiente", lista: checkins, tab: "resumen", color: "text-muted" },
    { titulo: "Sin registros hace días", lista: caidos, tab: "mensajes", color: "text-danger" },
    { titulo: "Ayer menos de 50 %", lista: flojos, tab: "resumen", color: "text-warn" },
    { titulo: "Mes por vencer o vencido", lista: vencen, tab: "resumen", color: "text-danger" }
  ].filter((g) => g.lista.length);

  return (
    <section className="card mb-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">Hoy</h2>
        <span className="text-xs text-muted">
          {entrenan.length} entrena{entrenan.length === 1 ? "" : "n"} hoy · {entrenan.filter((f) => f.entrenoHoy).length} ya registr{entrenan.filter((f) => f.entrenoHoy).length === 1 ? "ó" : "aron"}
        </span>
      </div>
      {grupos.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nada pendiente. Todo al día.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {grupos.map((g) => (
            <li key={g.titulo} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className={`font-semibold ${g.color}`}>{g.titulo}:</span>
              {g.lista.map((f) => (
                <Link key={f.c.id} href={`/entrenador/${f.c.id}?tab=${g.tab}`} className="chip border-line">
                  {nombre(f)}
                  {g.titulo.startsWith("Sin registros") && f.diasSin != null ? ` · ${f.diasSin} d` : ""}
                  {g.titulo.startsWith("Mensajes") ? ` · ${f.noLeidos}` : ""}
                  {g.titulo.startsWith("Ayer") ? ` · ${f.cumplioAyer} %` : ""}
                </Link>
              ))}
            </li>
          ))}
        </ul>
      )}
      {entrenan.length ? (
        <p className="mt-2 text-xs text-muted">
          Entrenan hoy: {entrenan.map((f) => `${nombre(f)}${f.diaHoy?.nombre ? ` (${f.diaHoy.nombre})` : ""}${f.entrenoHoy ? " ✓" : ""}`).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
