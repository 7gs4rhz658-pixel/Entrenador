import Link from "next/link";
import { propuestaAjuste } from "@/lib/ajuste-macros";
import { contarNoLeidos, getBloque, getClientes, getInformesPendientes, getUltimaActividad, getUltimoRegistro } from "@/lib/data";
import { fmtTiempoRelativo, hoyFecha } from "@/lib/format";
import { estadoPago } from "@/lib/pagos";
import { ETIQUETAS_OBJETIVO } from "@/lib/nutrition";

export default async function ClientesPage() {
  const [clientes, pendientesInforme] = await Promise.all([getClientes(), getInformesPendientes()]);
  const conInforme = new Set(pendientesInforme.map((p) => p.user_id));
  const filas = await Promise.all(
    clientes.map(async (c) => {
      const [meso, ultimo, ajuste, ultimaActividad, noLeidos] = await Promise.all([
        getBloque(c.id),
        getUltimoRegistro(c.id),
        propuestaAjuste(c),
        getUltimaActividad(c.id),
        contarNoLeidos(c.id, "cliente")
      ]);
      const diasSin = ultimaActividad ? Math.floor((Date.now() - new Date(ultimaActividad).getTime()) / 86_400_000) : null;
      // Sin registros hace 4+ días: candidato a abandono, va arriba
      const abandono = c.activo && c.estado_pago === "pagado" && meso != null && (diasSin == null || diasSin >= 4);
      return { c, meso, ultimo, ajuste, diasSin, noLeidos, abandono };
    })
  );
  const hoy = hoyFecha();
  const activos = filas.filter((f) => f.c.activo).sort((a, b) => Number(b.abandono) - Number(a.abandono));
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
      ) : null}

      <ul className="flex flex-col gap-3">
        {[...activos, ...inactivos].map(({ c, meso, ultimo, ajuste, diasSin, noLeidos, abandono }) => {
          const pendientes: string[] = [];
          if (!c.onboarding_completo) pendientes.push("cuestionario");
          if (c.estado_pago !== "pagado") pendientes.push("pago");
          const pago = estadoPago(c, hoy);
          if (pago.vencido) pendientes.push("mes vencido");
          else if (pago.diasRestantes != null && pago.diasRestantes <= 3) pendientes.push(`vence en ${pago.diasRestantes} d`);
          if (c.onboarding_completo && c.estado_pago === "pagado" && !meso) pendientes.push("sin plan");
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
    </main>
  );
}
